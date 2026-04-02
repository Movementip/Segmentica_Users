import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import { buildExportFile, normalizeCatalogKeys } from '../../../../lib/dataExchangeRegistry';
import { canExportCatalog, DATA_EXCHANGE_CATALOGS } from '../../../../lib/dataExchangeConfig';
import type { DataExchangeFormat } from '../../../../lib/dataExchangeConfig';

const normalizeFormat = (value: unknown): DataExchangeFormat => {
    if (value === 'csv' || value === 'json') return value;
    return 'excel';
};

const buildContentDisposition = (filename: string) => {
    const asciiFallback = filename
        .replace(/[^\x20-\x7E]+/g, '_')
        .replace(/[:/\\]/g, '_');
    const encoded = encodeURIComponent(filename);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    const catalogKeys = normalizeCatalogKeys(req.query.catalogs);
    const format = normalizeFormat(req.query.format);

    if (catalogKeys.length === 0) {
        return res.status(400).json({ error: 'Не выбран ни один раздел для экспорта.' });
    }

    if (format === 'csv' && catalogKeys.length > 1) {
        return res.status(400).json({ error: 'CSV экспорт доступен только для одного раздела за раз.' });
    }

    const isFullSiteExport = catalogKeys.length === DATA_EXCHANGE_CATALOGS.length;
    if (isFullSiteExport && format !== 'json') {
        return res.status(400).json({ error: 'Полный экспорт сайта доступен только в JSON.' });
    }

    const isBulkExport = catalogKeys.length > 1;
    if (isBulkExport && !hasPermission(actor, 'admin.data_exchange') && !hasPermission(actor, 'admin.data_export.full')) {
        return res.status(403).json({ error: 'Недостаточно прав для массового экспорта разделов.' });
    }

    const forbiddenCatalog = catalogKeys.find((catalogKey) => !canExportCatalog(actor.permissions, catalogKey));
    if (forbiddenCatalog) {
        return res.status(403).json({ error: `Нет прав на экспорт раздела: ${forbiddenCatalog}` });
    }

    try {
        const file = await buildExportFile(catalogKeys, format);
        const fileBaseName = catalogKeys.length === 1
            ? catalogKeys[0]
            : isFullSiteExport
                ? 'site-backup'
                : 'data-exchange';
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        const datePart = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
        const timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const offsetHours = -now.getTimezoneOffset() / 60;
        const offsetLabel = `${offsetHours >= 0 ? '+' : ''}${offsetHours}UTC`;
        const filename = `${fileBaseName}-${datePart} ${timePart} ${offsetLabel}.${file.extension}`;

        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', buildContentDisposition(filename));
        return res.status(200).send(file.buffer);
    } catch (error) {
        console.error('Data exchange export error:', error);
        return res.status(500).json({ error: 'Ошибка экспорта данных.' });
    }
}
