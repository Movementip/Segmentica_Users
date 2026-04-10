import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DropdownMenu, Text } from '@radix-ui/themes';
import { FiChevronDown, FiExternalLink, FiPrinter, FiX } from 'react-icons/fi';
import styles from './RecordPrintCenter.module.css';

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
    content: React.ReactNode;
};

type RecordPrintCenterProps = {
    documents: RecordPrintDocument[];
    buttonClassName?: string;
};

const PRINT_STYLES = `
body{margin:0;padding:0;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
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
.rpc-row{padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;break-inside:avoid;}
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

const escapeHtml = (value: string): string =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

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

export const RecordPrintCenter = ({ documents, buttonClassName }: RecordPrintCenterProps): JSX.Element | null => {
    const [selectedDocument, setSelectedDocument] = useState<RecordPrintDocument | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!selectedDocument) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [selectedDocument]);

    const documentTitle = useMemo(
        () => selectedDocument?.title || 'Документ',
        [selectedDocument?.title]
    );

    const openDocumentWindow = (shouldPrint: boolean) => {
        if (!selectedDocument || !contentRef.current) return;

        const popup = window.open('', '_blank', 'noopener,noreferrer');
        if (!popup) return;

        popup.document.open();
        popup.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8" /><title>${escapeHtml(documentTitle)}</title><style>${PRINT_STYLES}</style></head><body><div class="rpc-print-wrap">${contentRef.current.innerHTML}</div></body></html>`);
        popup.document.close();

        if (shouldPrint) {
            popup.onload = () => {
                popup.focus();
                popup.print();
            };
        }
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
                        className={`${styles.triggerButton}${buttonClassName ? ` ${buttonClassName}` : ''}`}
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
                            onSelect={() => setSelectedDocument(document)}
                        >
                            {document.title}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Root>

            {selectedDocument ? (
                <div className={styles.previewScreen}>
                    <div className={styles.previewBackdrop} onClick={() => setSelectedDocument(null)} />
                    <div className={styles.previewPanel} role="dialog" aria-modal="true" aria-label={documentTitle}>
                        <div className={styles.previewHeader}>
                            <div>
                                <h2 className={styles.previewTitle}>Предпросмотр документа</h2>
                                <Text as="div" size="3" className={styles.previewSubtitle}>
                                    {documentTitle}
                                </Text>
                            </div>
                            <button
                                type="button"
                                className={styles.closeButton}
                                onClick={() => setSelectedDocument(null)}
                                aria-label="Закрыть предпросмотр"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.toolbar}>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={() => openDocumentWindow(true)}>
                                <FiPrinter />
                                Напечатать
                            </Button>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={() => openDocumentWindow(false)}>
                                <FiExternalLink />
                                Открыть
                            </Button>
                        </div>

                        <div className={styles.sheetViewport}>
                            <div className={styles.sheetPreview}>
                                <div ref={contentRef}>
                                    {selectedDocument.content}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
};
