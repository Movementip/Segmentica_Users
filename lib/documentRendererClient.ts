import type { DocumentTemplatePostprocess } from './documentTemplates';

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

const DOCUMENT_RENDERER_URL = String(process.env.DOCUMENT_RENDERER_URL || '').trim().replace(/\/+$/, '');

export const hasDocumentRenderer = (): boolean => Boolean(DOCUMENT_RENDERER_URL);

export const renderXlsxTemplateDocument = async (params: RenderXlsxTemplateParams): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
}> => {
    if (!DOCUMENT_RENDERER_URL) {
        throw new Error('DOCUMENT_RENDERER_URL is not configured');
    }

    const response = await fetch(`${DOCUMENT_RENDERER_URL}/render/xlsx-template`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
            `Document renderer failed with status ${response.status}. ${errorText || 'No response body from renderer.'}`
        );
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
};
