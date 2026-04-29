import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../../lib/auth';
import { hasDocumentRenderer, renderDocxTemplateDocument, renderPdfPreview, renderXlsxTemplateDocument } from '../../../../../lib/documentRendererClient';
import { buildPurchaseDocumentPayload } from '../../../../../lib/purchaseDocumentBuilder';
import { normalizePurchaseDocumentKey } from '../../../../../lib/purchaseDocumentDefinitions';

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

const resolveFormat = (value: string | null): 'pdf' | 'excel' | 'word' | 'preview' => {
    if (value === 'preview') return 'preview';
    if (value === 'word') return 'word';
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

    const purchaseId = Number(req.query.id);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
        return res.status(400).json({ error: 'Некорректный id закупки' });
    }

    const documentKey = normalizePurchaseDocumentKey(normalizeQueryValue(req.query.documentKey));
    if (!documentKey) {
        return res.status(400).json({ error: 'Неизвестный документ закупки' });
    }

    const format = resolveFormat(normalizeQueryValue(req.query.format));
    const disposition = resolveDisposition(normalizeQueryValue(req.query.disposition));

    const canViewPurchases = hasPermission(user, 'purchases.view');
    const canPrintPurchases = hasPermission(user, 'purchases.print');
    const canExportPdf = hasPermission(user, 'purchases.export.pdf');
    const canExportExcel = hasPermission(user, 'purchases.export.excel');
    const canExportWord = hasPermission(user, 'purchases.export.word');

    if (!canViewPurchases) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if ((format === 'pdf' || format === 'preview') && !canPrintPurchases && !canExportPdf) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (format === 'excel' && !canExportExcel) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (format === 'word' && !canExportWord) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!hasDocumentRenderer()) {
        return res.status(400).json({ error: 'Для документов закупки нужен включенный document renderer' });
    }

    try {
        const payload = await buildPurchaseDocumentPayload(purchaseId, documentKey);
        const templateDefinition = payload.template;

        if (!templateDefinition.isActive) {
            return res.status(400).json({ error: 'Шаблон документа отключен' });
        }

        const renderFormat = format === 'preview' ? 'pdf' : format;

        if (!templateDefinition.outputFormats.includes(renderFormat)) {
            return res.status(400).json({ error: `Формат ${format} не поддерживается для этого шаблона` });
        }

        const rendered = templateDefinition.sourceFormat === 'xlsx'
            ? await renderXlsxTemplateDocument({
                templateName: payload.template.templateName,
                fileBaseName: payload.fileBaseName,
                cells: payload.cells || [],
                rowVisibility: payload.rowVisibility,
                printAreas: payload.printAreas,
                rangeCopies: payload.rangeCopies,
                sheetCopies: payload.sheetCopies,
                hiddenSheets: payload.hiddenSheets,
                sheetPageSetup: payload.sheetPageSetup,
                outputFormat: renderFormat === 'excel' ? 'excel' : 'pdf',
                postprocess: renderFormat === 'pdf' ? payload.pdfPostprocess : 'none',
            })
            : await renderDocxTemplateDocument({
                templateName: payload.template.templateName,
                fileBaseName: payload.fileBaseName,
                replacements: payload.replacements || {},
                replaceFirstImageBase64: payload.replaceFirstImageBase64,
                outputFormat: renderFormat === 'word' ? 'word' : 'pdf',
            });

        if (format === 'preview') {
            const preview = await renderPdfPreview({
                buffer: rendered.buffer,
                filename: rendered.filename,
            });
            return res.status(200).json(preview);
        }

        const safeDisposition = format === 'pdf' ? disposition : 'attachment';
        res.setHeader('Content-Type', rendered.contentType);
        res.setHeader('Content-Length', String(rendered.buffer.byteLength));
        res.setHeader('Content-Disposition', `${safeDisposition}; filename*=UTF-8''${encodeURIComponent(rendered.filename)}`);
        res.status(200).send(rendered.buffer);
    } catch (error) {
        console.error('Purchase document render error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось сформировать документ закупки',
        });
    }
}
