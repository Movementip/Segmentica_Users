import { randomUUID } from 'crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    },
};

const CACHE_DIR = path.join('/tmp', 'segmentica-record-documents');
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_AGE_MS = 60 * 60 * 1000;

const sanitizeFileName = (value: string): string => {
    const cleaned = value
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned || 'Документ.pdf';
};

const normalizeQueryValue = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : null;
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
};

const readRequestBody = async (req: NextApiRequest): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;

        if (total > MAX_PDF_SIZE_BYTES) {
            throw new Error('PDF слишком большой для временного открытия');
        }

        chunks.push(buffer);
    }

    return Buffer.concat(chunks);
};

const cleanupOldFiles = async () => {
    await mkdir(CACHE_DIR, { recursive: true });

    const now = Date.now();
    const entries = await readdir(CACHE_DIR).catch(() => []);

    await Promise.all(entries.map(async (entry) => {
        const filePath = path.join(CACHE_DIR, entry);
        const fileStat = await stat(filePath).catch(() => null);

        if (!fileStat || now - fileStat.mtimeMs <= MAX_AGE_MS) return;

        await rm(filePath, { force: true }).catch(() => undefined);
    }));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    try {
        const fileName = sanitizeFileName(normalizeQueryValue(req.query.filename) || 'Документ.pdf');
        const body = await readRequestBody(req);

        if (!body.length) {
            return res.status(400).json({ error: 'PDF не передан' });
        }

        await cleanupOldFiles();

        const token = randomUUID();
        await writeFile(path.join(CACHE_DIR, `${token}.pdf`), body);
        await writeFile(path.join(CACHE_DIR, `${token}.json`), JSON.stringify({ fileName }), 'utf8');

        return res.status(200).json({
            url: `/api/record-documents/${token}/${encodeURIComponent(fileName)}?disposition=inline`,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось сохранить PDF для открытия';
        return res.status(500).json({ error: message });
    }
}
