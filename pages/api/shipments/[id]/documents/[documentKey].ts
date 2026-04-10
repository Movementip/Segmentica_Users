import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../../lib/auth';
import { hasDocumentRenderer, renderXlsxTemplateDocument } from '../../../../../lib/documentRendererClient';
import { buildShipmentDocumentPayload } from '../../../../../lib/shipmentDocumentBuilder';
import { normalizeShipmentDocumentKey } from '../../../../../lib/shipmentDocumentDefinitions';

export const config = {
    api: {
        responseLimit: false,
    },
};

const normalizeQueryValue = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : null;
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
};

const resolveFormat = (value: string | null): 'pdf' | 'excel' => {
    if (value === 'excel') return 'excel';
    return 'pdf';
};

const resolveDisposition = (value: string | null): 'inline' | 'attachment' => {
    if (value === 'inline') return 'inline';
    return 'attachment';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const shipmentId = Number(req.query.id);
    if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
        return res.status(400).json({ error: 'Некорректный id отгрузки' });
    }

    const documentKey = normalizeShipmentDocumentKey(normalizeQueryValue(req.query.documentKey));
    if (!documentKey) {
        return res.status(400).json({ error: 'Неизвестный документ отгрузки' });
    }

    const format = resolveFormat(normalizeQueryValue(req.query.format));
    const disposition = resolveDisposition(normalizeQueryValue(req.query.disposition));

    const canViewShipments = hasPermission(user, 'shipments.view');
    const canPrintShipments = hasPermission(user, 'shipments.print');
    const canExportExcel = hasPermission(user, 'shipments.export.excel');

    if (!canViewShipments) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (format === 'pdf' && !canPrintShipments) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (format === 'excel' && !canExportExcel) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!hasDocumentRenderer()) {
        return res.status(400).json({ error: 'Для документов отгрузки нужен включенный document renderer' });
    }

    try {
        const payload = await buildShipmentDocumentPayload(shipmentId, documentKey);
        const templateDefinition = payload.template;

        if (!templateDefinition.isActive) {
            return res.status(400).json({ error: 'Шаблон документа отключен' });
        }

        if (templateDefinition.sourceFormat !== 'xlsx') {
            return res.status(400).json({ error: 'Пока поддерживаются только шаблоны XLSX для документов отгрузки' });
        }

        if (!templateDefinition.outputFormats.includes(format)) {
            return res.status(400).json({ error: `Формат ${format} не поддерживается для этого шаблона` });
        }

        const rendered = await renderXlsxTemplateDocument({
            templateName: payload.template.templateName,
            fileBaseName: payload.fileBaseName,
            cells: payload.cells,
            rowVisibility: payload.rowVisibility,
            printAreas: payload.printAreas,
            rangeCopies: payload.rangeCopies,
            sheetCopies: payload.sheetCopies,
            hiddenSheets: payload.hiddenSheets,
            sheetPageSetup: payload.sheetPageSetup,
            outputFormat: format,
            postprocess: format === 'pdf' ? payload.pdfPostprocess : 'none',
        });

        const safeDisposition = format === 'pdf' ? disposition : 'attachment';
        res.setHeader('Content-Type', rendered.contentType);
        res.setHeader('Content-Length', String(rendered.buffer.byteLength));
        res.setHeader('Content-Disposition', `${safeDisposition}; filename*=UTF-8''${encodeURIComponent(rendered.filename)}`);
        res.status(200).send(rendered.buffer);
    } catch (error) {
        console.error('Shipment document render error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось сформировать документ отгрузки',
        });
    }
}
