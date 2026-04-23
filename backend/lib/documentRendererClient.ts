import type { DocumentTemplatePostprocess } from './documentTemplates';
import {
    buildDocumentRendererError,
    getDocumentRendererBaseUrls,
} from './documentRendererUrls';

export { hasDocumentRenderer } from './documentRendererUrls';

export type RenderXlsxTemplateParams = {
    templateName: string;
    fileBaseName: string;
    cells: Array<{
        sheetName?: string;
        address: string;
        value: string | number;
        style?: {
            fontName?: string;
            fontSize?: number;
            bold?: boolean;
            horizontal?: 'left' | 'center' | 'right';
            vertical?: 'top' | 'center' | 'bottom';
            wrapText?: boolean;
            shrinkToFit?: boolean;
        };
    }>;
    rowVisibility?: Array<{
        sheetName: string;
        row: number;
        hidden: boolean;
    }>;
    rowHeights?: Array<{
        sheetName: string;
        row: number;
        height: number;
    }>;
    rowBreaks?: Array<{
        sheetName: string;
        breaks: number[];
        clearExisting?: boolean;
    }>;
    printAreas?: Array<{
        sheetName: string;
        range: string;
    }>;
    rangeCopies?: Array<{
        sourceSheetName: string;
        sourceRange: string;
        targetSheetName: string;
        targetStartAddress: string;
    }>;
    sheetCopies?: Array<{
        sourceSheetName: string;
        targetSheetName: string;
    }>;
    hiddenSheets?: string[];
    sheetPageSetup?: Array<{
        sheetName: string;
        fitToWidth?: number;
        fitToHeight?: number;
    }>;
    outputFormat: 'excel' | 'pdf';
    postprocess?: DocumentTemplatePostprocess;
};

export type RenderDocxTemplateParams = {
    templateName: string;
    fileBaseName: string;
    replacements: Record<string, string>;
    replaceFirstImageBase64?: string;
    outputFormat: 'word' | 'pdf';
};

export const renderXlsxTemplateDocument = async (params: RenderXlsxTemplateParams): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
}> => {
    const rendererBaseUrls = getDocumentRendererBaseUrls();
    if (rendererBaseUrls.length === 0) {
        throw new Error('DOCUMENT_RENDERER_URL is not configured');
    }

    const attempts: string[] = [];
    const body = JSON.stringify(params);

    for (const baseUrl of rendererBaseUrls) {
        const requestUrl = `${baseUrl}/render/xlsx-template`;
        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                attempts.push(`${requestUrl} -> ${response.status}${errorText ? `: ${errorText}` : ''}`);
                continue;
            }

            const disposition = response.headers.get('content-disposition') || '';
            const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
            const filename = filenameMatch?.[1]
                ? decodeURIComponent(filenameMatch[1].replace(/"/g, ''))
                : `${params.fileBaseName}.${params.outputFormat === 'excel' ? 'xlsx' : 'pdf'}`;

            return {
                buffer: Buffer.from(await response.arrayBuffer()),
                filename,
                contentType: response.headers.get('content-type')
                    || (params.outputFormat === 'excel'
                        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        : 'application/pdf'),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown fetch error';
            attempts.push(`${requestUrl} -> ${message}`);
        }
    }

    throw buildDocumentRendererError('render XLSX template document', attempts);
};

export const renderDocxTemplateDocument = async (params: RenderDocxTemplateParams): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
}> => {
    const rendererBaseUrls = getDocumentRendererBaseUrls();
    if (rendererBaseUrls.length === 0) {
        throw new Error('DOCUMENT_RENDERER_URL is not configured');
    }

    const attempts: string[] = [];
    const body = JSON.stringify(params);

    for (const baseUrl of rendererBaseUrls) {
        const requestUrl = `${baseUrl}/render/docx-template`;
        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                attempts.push(`${requestUrl} -> ${response.status}${errorText ? `: ${errorText}` : ''}`);
                continue;
            }

            const disposition = response.headers.get('content-disposition') || '';
            const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
            const extension = params.outputFormat === 'word' ? 'docx' : 'pdf';
            const filename = filenameMatch?.[1]
                ? decodeURIComponent(filenameMatch[1].replace(/"/g, ''))
                : `${params.fileBaseName}.${extension}`;

            return {
                buffer: Buffer.from(await response.arrayBuffer()),
                filename,
                contentType: response.headers.get('content-type')
                    || (params.outputFormat === 'word'
                        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        : 'application/pdf'),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown fetch error';
            attempts.push(`${requestUrl} -> ${message}`);
        }
    }

    throw buildDocumentRendererError('render DOCX template document', attempts);
};
