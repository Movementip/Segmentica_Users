import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../../lib/auth';
import { hasDocumentRenderer, renderDocxTemplateDocument, renderPdfPreview } from '../../../../../lib/documentRendererClient';
import { buildOrderDocumentPayload } from '../../../../../lib/orderDocumentBuilder';
import { normalizeOrderDocumentKey } from '../../../../../lib/orderDocumentDefinitions';

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

const resolveFormat = (value: string | null): 'pdf' | 'word' | 'preview' => {
    if (value === 'preview') return 'preview';
    if (value === 'word') return 'word';
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

    const orderId = Number(req.query.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'Некорректный id заявки' });
    }

    const documentKey = normalizeOrderDocumentKey(normalizeQueryValue(req.query.documentKey));
    if (!documentKey) {
        return res.status(400).json({ error: 'Неизвестный документ заявки' });
    }

    const format = resolveFormat(normalizeQueryValue(req.query.format));
    const disposition = resolveDisposition(normalizeQueryValue(req.query.disposition));

    const canViewOrders = hasPermission(user, 'orders.view');
    const canPrintOrders = hasPermission(user, 'orders.print');
    const canExportPdf = hasPermission(user, 'orders.export.pdf');
    const canExportWord = hasPermission(user, 'orders.export.word');

    if (!canViewOrders) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if ((format === 'pdf' || format === 'preview') && !canPrintOrders && !canExportPdf) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (format === 'word' && !canExportWord) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!hasDocumentRenderer()) {
        return res.status(400).json({ error: 'Для документов заявки нужен включенный document renderer' });
    }

    try {
        const payload = await buildOrderDocumentPayload(orderId, documentKey);
        const templateDefinition = payload.template;

        if (!templateDefinition.isActive) {
            return res.status(400).json({ error: 'Шаблон документа отключен' });
        }

        if (templateDefinition.sourceFormat !== 'docx' && templateDefinition.sourceFormat !== 'doc') {
            return res.status(400).json({ error: 'Пока поддерживаются только шаблоны Word для документов заявки' });
        }

        const renderFormat = format === 'preview' ? 'pdf' : format;

        if (!templateDefinition.outputFormats.includes(renderFormat)) {
            return res.status(400).json({ error: `Формат ${format} не поддерживается для этого шаблона` });
        }

        const rendered = await renderDocxTemplateDocument({
            templateName: payload.template.templateName,
            fileBaseName: payload.fileBaseName,
            replacements: payload.replacements,
            replaceFirstImageBase64: payload.replaceFirstImageBase64,
            outputFormat: renderFormat,
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
        console.error('Order document render error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось сформировать документ заявки',
        });
    }
}
