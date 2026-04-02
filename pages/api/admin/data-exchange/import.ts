import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { type File as FormidableFile } from 'formidable';
import { promises as fs } from 'fs';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import { canImportCatalog, isOperationalDataCatalog, sortCatalogKeysForImport } from '../../../../lib/dataExchangeConfig';
import { DATA_EXCHANGE_CATALOGS } from '../../../../lib/dataExchangeConfig';
import type { DataExchangeFormat } from '../../../../lib/dataExchangeConfig';
import { importCatalogRows, normalizeCatalogKeys, parseImportBuffer } from '../../../../lib/dataExchangeRegistry';
import { rebuildDerivedState } from '../../../../lib/rebuildDerivedState';

export const config = {
    api: {
        bodyParser: false,
    },
};

const normalizeFormat = (value: unknown): DataExchangeFormat => {
    if (value === 'csv' || value === 'json') return value;
    return 'excel';
};

const readFirstFile = (files: formidable.Files<string>): FormidableFile | null => {
    const fileValues = Object.values(files);
    if (fileValues.length === 0) return null;
    const first = fileValues[0];
    if (!first) return null;
    return Array.isArray(first) ? first[0] ?? null : first;
};

const parseForm = async (req: NextApiRequest): Promise<{ fields: formidable.Fields<string>; file: FormidableFile }> => {
    const form = formidable({
        multiples: false,
        keepExtensions: true,
        maxFileSize: 250 * 1024 * 1024,
    });

    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            const file = readFirstFile(files);
            if (!file) return reject(new Error('Файл не найден'));
            resolve({ fields, file });
        });
    });
};

const getFieldValue = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    try {
        const { fields, file } = await parseForm(req);
        const catalogKeys = normalizeCatalogKeys(getFieldValue(fields.catalogs));
        const importCatalogKeys = sortCatalogKeysForImport(catalogKeys);
        const format = normalizeFormat(getFieldValue(fields.format));

        if (importCatalogKeys.length === 0) {
            return res.status(400).json({ error: 'Не выбран ни один раздел для импорта.' });
        }

        if (format === 'csv' && importCatalogKeys.length > 1) {
            return res.status(400).json({ error: 'CSV импорт доступен только для одного раздела.' });
        }

        const isFullSiteImport = importCatalogKeys.length === DATA_EXCHANGE_CATALOGS.length;
        if (isFullSiteImport && format !== 'json') {
            return res.status(400).json({ error: 'Полный импорт сайта доступен только из JSON.' });
        }

        const isBulkImport = importCatalogKeys.length > 1;
        if (isBulkImport && !hasPermission(actor, 'admin.data_exchange') && !hasPermission(actor, 'admin.data_import.full')) {
            return res.status(403).json({ error: 'Недостаточно прав для массового импорта разделов.' });
        }

        const forbiddenCatalog = importCatalogKeys.find((catalogKey) => !canImportCatalog(actor.permissions, catalogKey));
        if (forbiddenCatalog) {
            return res.status(403).json({ error: `Нет прав на импорт раздела: ${forbiddenCatalog}` });
        }

        const fileBuffer = await fs.readFile(file.filepath);
        const parsed = parseImportBuffer(fileBuffer, format, importCatalogKeys);
        const summaries = await importCatalogRows(parsed.rowsByCatalog, importCatalogKeys);
        const shouldRebuildDerivedState = importCatalogKeys.some((catalogKey) => isOperationalDataCatalog(catalogKey));
        const rebuild = shouldRebuildDerivedState ? await rebuildDerivedState() : null;

        return res.status(200).json({
            message: 'Импорт завершен',
            summaries,
            rebuild,
        });
    } catch (error) {
        console.error('Data exchange import error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Ошибка импорта данных.',
        });
    }
}
