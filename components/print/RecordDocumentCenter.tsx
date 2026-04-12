import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DropdownMenu, Text } from '@radix-ui/themes';
import { BsFillFileEarmarkPdfFill } from 'react-icons/bs';
import { FiChevronDown, FiExternalLink, FiMinus, FiPlus, FiPrinter, FiSave, FiX } from 'react-icons/fi';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { saveGeneratedAttachments, type GeneratedAttachmentTarget } from '../../utils/generatedAttachments';
import styles from './RecordDocumentCenter.module.css';

export type RecordPrintField = {
    label: string;
    value: React.ReactNode;
};

export type RecordPrintTable = {
    columns: string[];
    rows: React.ReactNode[][];
};

export type RecordPrintSection = {
    title: string;
    fields?: RecordPrintField[];
    columns?: 1 | 2;
    table?: RecordPrintTable;
    note?: React.ReactNode;
};

export type RecordPrintDocument = {
    key: string;
    title: string;
    fileName?: string;
    content: React.ReactNode;
};

type RecordDocumentCenterProps = {
    documents: RecordPrintDocument[];
    buttonClassName?: string;
    saveTarget?: GeneratedAttachmentTarget;
    onSaved?: () => void | Promise<void>;
};

const PRINT_STYLES = `
html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
*{box-sizing:border-box;}
.rpc-print-wrap{padding:12mm;}
.rpc-sheet{width:100%;max-width:210mm;margin:0 auto;color:#111827;}
.rpc-header{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;}
.rpc-title{margin:0;font-size:24px;font-weight:800;line-height:1.15;}
.rpc-subtitle{margin-top:8px;color:#4b5563;font-size:13px;line-height:1.4;}
.rpc-meta{text-align:right;min-width:180px;color:#4b5563;font-size:12px;line-height:1.5;}
.rpc-section{margin-top:20px;break-inside:avoid;}
.rpc-section-title{margin:0 0 10px;font-size:15px;line-height:1.3;font-weight:700;}
.rpc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;}
.rpc-grid-single{grid-template-columns:minmax(0,1fr);}
.rpc-row{padding:10px 12px;border:1px solid #e5e7eb;border-radius:0;background:#fafafa;break-inside:avoid;}
.rpc-label{display:block;font-size:11px;line-height:1.3;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-bottom:6px;}
.rpc-value{display:block;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word;}
.rpc-table{width:100%;border-collapse:collapse;font-size:13px;}
.rpc-table th,.rpc-table td{border:1px solid #d1d5db;padding:8px 10px;vertical-align:top;text-align:left;}
.rpc-table th{background:#f3f4f6;font-weight:700;}
.rpc-note{margin-top:10px;color:#4b5563;font-size:12px;line-height:1.5;white-space:pre-wrap;}
@media print{
  .rpc-print-wrap{padding:0;}
}
`;

const sanitizeFileName = (value: string): string => {
    const cleaned = value
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned || 'Документ';
};

export const RecordPrintSheet = ({
    title,
    subtitle,
    meta,
    sections,
}: {
    title: string;
    subtitle?: string;
    meta?: React.ReactNode;
    sections: RecordPrintSection[];
}) => (
    <div className="rpc-sheet">
        <div className="rpc-header">
            <div>
                <h1 className="rpc-title">{title}</h1>
                {subtitle ? <div className="rpc-subtitle">{subtitle}</div> : null}
            </div>
            {meta ? <div className="rpc-meta">{meta}</div> : null}
        </div>

        {sections.map((section) => (
            <section key={section.title} className="rpc-section">
                <h2 className="rpc-section-title">{section.title}</h2>
                {section.fields?.length ? (
                    <div className={`rpc-grid ${section.columns === 1 ? 'rpc-grid-single' : ''}`}>
                        {section.fields.map((field) => (
                            <div key={`${section.title}-${field.label}`} className="rpc-row">
                                <span className="rpc-label">{field.label}</span>
                                <span className="rpc-value">{field.value ?? '—'}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
                {section.table ? (
                    <table className="rpc-table">
                        <thead>
                            <tr>
                                {section.table.columns.map((column) => (
                                    <th key={`${section.title}-${column}`}>{column}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {section.table.rows.map((row, index) => (
                                <tr key={`${section.title}-row-${index + 1}`}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={`${section.title}-row-${index + 1}-cell-${cellIndex + 1}`}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}
                {section.note ? <div className="rpc-note">{section.note}</div> : null}
            </section>
        ))}
    </div>
);

export const RecordDocumentCenter = ({ documents, buttonClassName, saveTarget, onSaved }: RecordDocumentCenterProps): JSX.Element | null => {
    const [selectedDocument, setSelectedDocument] = useState<RecordPrintDocument | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
    const [pdfOpenUrl, setPdfOpenUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const printFrameRef = useRef<HTMLIFrameElement | null>(null);
    const pdfBlobRef = useRef<Blob | null>(null);

    useEffect(() => {
        if (!selectedDocument) return undefined;
        return lockBodyScroll();
    }, [selectedDocument]);

    useEffect(() => {
        pdfBlobRef.current = null;
        setPdfOpenUrl(null);
        setPdfLoading(false);
        setPdfError(null);
        setSaveLoading(false);
        setSaveMessage(null);

        if (printFrameRef.current) {
            printFrameRef.current.removeAttribute('src');
        }

        setPdfObjectUrl((current) => {
            if (current) {
                window.URL.revokeObjectURL(current);
            }

            return null;
        });
    }, [selectedDocument?.key]);

    const documentTitle = useMemo(
        () => selectedDocument?.title || 'Документ',
        [selectedDocument?.title]
    );

    const documentFileBaseName = useMemo(
        () => sanitizeFileName(selectedDocument?.fileName || documentTitle),
        [documentTitle, selectedDocument?.fileName]
    );

    const documentFileName = useMemo(
        () => `${documentFileBaseName}.pdf`,
        [documentFileBaseName]
    );

    const updatePreviewZoom = (nextZoom: number) => {
        setPreviewZoom(Math.min(2, Math.max(0.6, Number(nextZoom.toFixed(2)))));
    };

    const renderPdfBlob = async (): Promise<Blob> => {
        const source = contentRef.current;
        if (!source) {
            throw new Error('Не удалось подготовить документ для PDF');
        }

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);

        const renderFrame = document.createElement('iframe');
        renderFrame.setAttribute('aria-hidden', 'true');
        renderFrame.tabIndex = -1;
        renderFrame.style.position = 'fixed';
        renderFrame.style.top = '0';
        renderFrame.style.left = '0';
        renderFrame.style.width = '210mm';
        renderFrame.style.height = '297mm';
        renderFrame.style.border = '0';
        renderFrame.style.opacity = '0';
        renderFrame.style.pointerEvents = 'none';
        renderFrame.style.zIndex = '-1';
        renderFrame.style.contain = 'layout style paint';
        document.body.appendChild(renderFrame);

        try {
            const frameDocument = renderFrame.contentDocument;
            if (!frameDocument) {
                throw new Error('Не удалось подготовить изолированный слой печати');
            }

            frameDocument.open();
            frameDocument.write(`<!doctype html><html><head><meta charset="utf-8"><style>${PRINT_STYLES}</style></head><body><div class="rpc-print-wrap">${source.innerHTML}</div></body></html>`);
            frameDocument.close();

            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });

            const printableNode = frameDocument.querySelector('.rpc-print-wrap') as HTMLElement | null;
            if (!printableNode) {
                throw new Error('Не удалось собрать печатный лист для PDF');
            }

            const canvas = await html2canvas(printableNode, {
                backgroundColor: '#ffffff',
                scale: Math.min(window.devicePixelRatio || 1, 2),
                useCORS: true,
                logging: false,
                windowWidth: printableNode.scrollWidth,
                windowHeight: printableNode.scrollHeight,
            });

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            pdf.setProperties({
                title: documentFileBaseName,
                creator: 'Segmentica',
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imageWidth = pageWidth;
            const imageHeight = (canvas.height * imageWidth) / canvas.width;
            const imageData = canvas.toDataURL('image/png');

            let remainingHeight = imageHeight;
            let imageTop = 0;

            pdf.addImage(imageData, 'PNG', 0, imageTop, imageWidth, imageHeight, undefined, 'FAST');
            remainingHeight -= pageHeight;

            while (remainingHeight > 0) {
                imageTop -= pageHeight;
                pdf.addPage();
                pdf.addImage(imageData, 'PNG', 0, imageTop, imageWidth, imageHeight, undefined, 'FAST');
                remainingHeight -= pageHeight;
            }

            return pdf.output('blob');
        } finally {
            renderFrame.remove();
        }
    };

    const ensurePdfObjectUrl = async (): Promise<string | null> => {
        if (!selectedDocument) return null;
        if (pdfObjectUrl) return pdfObjectUrl;

        try {
            setPdfLoading(true);
            setPdfError(null);

            const blob = pdfBlobRef.current ?? await renderPdfBlob();
            pdfBlobRef.current = blob;

            const pdfFile = new File([blob], documentFileName, { type: 'application/pdf' });
            const nextObjectUrl = window.URL.createObjectURL(pdfFile);
            setPdfObjectUrl((current) => {
                if (current) {
                    window.URL.revokeObjectURL(current);
                }

                return nextObjectUrl;
            });

            return nextObjectUrl;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Не удалось сформировать PDF';
            setPdfError(message);
            return null;
        } finally {
            setPdfLoading(false);
        }
    };

    const downloadPdf = async () => {
        const objectUrl = await ensurePdfObjectUrl();
        if (!objectUrl) return;

        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = documentFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const openDocument = async () => {
        if (pdfOpenUrl) {
            window.open(pdfOpenUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        setPdfLoading(true);

        try {
            const objectUrl = await ensurePdfObjectUrl();
            const blob = pdfBlobRef.current;

            if (!objectUrl || !blob) return;

            setPdfLoading(true);

            const response = await fetch(`/api/record-documents/cache?filename=${encodeURIComponent(documentFileName)}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/pdf',
                },
                body: blob,
            });

            if (!response.ok) {
                const message = await response.text().catch(() => '');
                throw new Error(message || 'Не удалось подготовить PDF для открытия');
            }

            const payload = await response.json().catch(() => null) as { url?: string } | null;
            const openUrl = payload?.url || objectUrl;

            setPdfOpenUrl(openUrl);
            window.open(openUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            const fallbackUrl = await ensurePdfObjectUrl();
            const message = error instanceof Error ? error.message : 'Не удалось открыть PDF';
            setPdfError(`${message}. Открыл локальную копию PDF.`);

            if (fallbackUrl) {
                window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            }
        } finally {
            setPdfLoading(false);
        }
    };

    const saveDocument = async () => {
        if (!selectedDocument || !saveTarget) return;

        try {
            setSaveLoading(true);
            setSaveMessage(null);
            setPdfError(null);

            const objectUrl = await ensurePdfObjectUrl();
            const blob = pdfBlobRef.current;
            if (!objectUrl || !blob) return;

            const savedCount = await saveGeneratedAttachments(saveTarget, [
                {
                    blob,
                    fileName: documentFileName,
                    mimeType: 'application/pdf',
                },
            ]);

            if (onSaved) {
                await onSaved();
            }

            setSaveMessage(`Сохранено в документы: ${savedCount}`);
        } catch (error) {
            setPdfError(error instanceof Error ? error.message : 'Не удалось сохранить документ');
        } finally {
            setSaveLoading(false);
        }
    };

    const printDocument = async () => {
        const objectUrl = await ensurePdfObjectUrl();
        if (!objectUrl) return;

        const frame = printFrameRef.current;
        if (!frame) {
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        frame.onload = () => {
            frame.onload = null;
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
        };
        frame.src = objectUrl;
    };

    if (!documents.length) return null;

    return (
        <>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                    <Button
                        type="button"
                        variant="surface"
                        color="gray"
                        highContrast
                        className={buttonClassName}
                    >
                        <FiPrinter />
                        Печать
                        <FiChevronDown />
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" sideOffset={8}>
                    {documents.map((document) => (
                        <DropdownMenu.Item
                            key={document.key}
                            onSelect={() => {
                                setPreviewZoom(1);
                                setSelectedDocument(document);
                            }}
                        >
                            {document.title}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Root>

            {selectedDocument ? (
                <div className={styles.previewScreen}>
                    <div className={styles.previewBackdrop} />
                    <div className={styles.previewPanel} role="dialog" aria-modal="true" aria-label={documentTitle}>
                        <div className={styles.previewPanelHeader}>
                            <div className={styles.previewPanelTitleBlock}>
                                <h2 className={styles.previewPanelTitle}>Предпросмотр документа</h2>
                                <Text as="div" size="3" className={styles.previewSubtitle}>
                                    {documentTitle}
                                </Text>
                            </div>
                            <button
                                type="button"
                                className={styles.previewCloseButton}
                                onClick={() => setSelectedDocument(null)}
                                aria-label="Закрыть предпросмотр"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.previewToolbar}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={printDocument}
                                aria-busy={pdfLoading}
                            >
                                <FiPrinter />
                                Напечатать
                            </Button>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={downloadPdf}
                                aria-busy={pdfLoading}
                            >
                                <BsFillFileEarmarkPdfFill className={styles.pdfIcon} />
                                PDF
                            </Button>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={openDocument}
                                aria-busy={pdfLoading}
                            >
                                <FiExternalLink />
                                Открыть
                            </Button>
                            {saveTarget ? (
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={saveDocument}
                                    disabled={saveLoading}
                                >
                                    <FiSave />
                                    {saveLoading ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            ) : null}
                            <div className={styles.previewZoomControls} aria-label="Масштаб предпросмотра">
                                <button
                                    type="button"
                                    className={styles.previewZoomButton}
                                    onClick={() => updatePreviewZoom(previewZoom - 0.2)}
                                    disabled={previewZoom <= 0.6}
                                    aria-label="Уменьшить"
                                >
                                    <FiMinus />
                                </button>
                                <button
                                    type="button"
                                    className={styles.previewZoomValue}
                                    onClick={() => updatePreviewZoom(1)}
                                    disabled={previewZoom === 1}
                                >
                                    {Math.round(previewZoom * 100)}%
                                </button>
                                <button
                                    type="button"
                                    className={styles.previewZoomButton}
                                    onClick={() => updatePreviewZoom(previewZoom + 0.2)}
                                    disabled={previewZoom >= 2}
                                    aria-label="Увеличить"
                                >
                                    <FiPlus />
                                </button>
                            </div>
                        </div>
                        {pdfError ? <div className={styles.previewError}>{pdfError}</div> : null}
                        {saveMessage ? <div className={styles.previewSuccess}>{saveMessage}</div> : null}

                        <div className={styles.previewStage}>
                            <div
                                className={styles.sheetPreview}
                                style={{ transform: `scale(${previewZoom})` }}
                            >
                                <div ref={contentRef}>
                                    {selectedDocument.content}
                                </div>
                            </div>
                        </div>
                    </div>
                    <iframe ref={printFrameRef} title="Печать документа" className={styles.hiddenPrintFrame} />
                </div>
            ) : null}
        </>
    );
};
