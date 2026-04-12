import { readFile } from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../../lib/auth';

export const config = {
    api: {
        responseLimit: false,
    },
};

const CACHE_DIR = path.join('/tmp', 'segmentica-record-documents');

const normalizeQueryValue = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : null;
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
};

const resolveDisposition = (value: string | null): 'inline' | 'attachment' => (
    value === 'attachment' ? 'attachment' : 'inline'
);

const isSafeToken = (value: string | null): value is string => (
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const token = normalizeQueryValue(req.query.token);
    if (!isSafeToken(token)) {
        return res.status(400).json({ error: 'Некорректный токен PDF' });
    }

    try {
        const [pdfBuffer, metaBuffer] = await Promise.all([
            readFile(path.join(CACHE_DIR, `${token}.pdf`)),
            readFile(path.join(CACHE_DIR, `${token}.json`)).catch(() => null),
        ]);

        const meta = metaBuffer ? JSON.parse(metaBuffer.toString('utf8')) as { fileName?: string } : {};
        const fileName = meta.fileName || normalizeQueryValue(req.query.slug) || 'Документ.pdf';
        const disposition = resolveDisposition(normalizeQueryValue(req.query.disposition));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', String(pdfBuffer.length));
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`);

        return res.status(200).send(pdfBuffer);
    } catch {
        return res.status(404).json({ error: 'PDF больше недоступен. Откройте предпросмотр и сформируйте его заново.' });
    }
}
