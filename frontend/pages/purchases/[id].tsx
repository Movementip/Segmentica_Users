import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { withLayout } from '../../layout/Layout';
import EditPurchaseModal from '../../components/modals/EditPurchaseModal/EditPurchaseModal';
import deleteConfirmationStyles from '../../components/modals/DeleteConfirmation/DeleteConfirmation.module.css';
import styles from './PurchaseDetail.module.css';
import { BsFillFileEarmarkExcelFill, BsFillFileEarmarkPdfFill, BsFillFileEarmarkWordFill } from 'react-icons/bs';
import {
    FiArrowLeft,
    FiChevronDown,
    FiDownload,
    FiEdit2,
    FiExternalLink,
    FiEye,
    FiFile,
    FiPaperclip,
    FiPrinter,
    FiSave,
    FiTrash2,
    FiUploadCloud,
    FiX,
} from 'react-icons/fi';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import { DocumentPreviewZoomControls } from '../../components/DocumentPreviewControls/DocumentPreviewControls';
import { EntityActionButton } from '../../components/EntityActionButton/EntityActionButton';
import { EntityStatusBadge } from '../../components/EntityStatusBadge/EntityStatusBadge';
import { EntityTableSurface, entityTableClassName } from '../../components/EntityDataTable/EntityDataTable';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../lib/vat';
import { getClientContragentTypeLabel, normalizeClientContragentType } from '../../lib/clientContragents';
import { getSupplierContragentTypeLabel, normalizeSupplierContragentType } from '../../lib/supplierContragents';
import { getPurchaseDeliveryLabel } from '../../lib/logisticsDeliveryLabels';
import { lockBodyScroll, scheduleForceUnlockBodyScroll } from '../../utils/bodyScrollLock';
import { fetchGeneratedBlob, saveGeneratedAttachments, type GeneratedAttachmentFile } from '../../utils/generatedAttachments';
import {
    getAvailablePurchaseDocumentDefinitions,
    type PurchaseDocumentDefinition,
    type PurchaseDocumentKey,
} from '../../lib/purchaseDocumentDefinitions';
import type { AttachmentItem } from '../../types/attachments';
import type { DocumentPreviewPageImage, DocumentPreviewStateBase, PdfJsModule } from '../../types/document-preview';

interface PurchasePosition {
    id: number;
    товар_id: number;
    товар_название: string;
    товар_артикул: string | null;
    товар_тип_номенклатуры?: string;
    товар_единица_измерения: string;
    количество: number;
    цена: number;
    сумма: number;
    ндс_id?: number;
    ндс_название?: string;
    ндс_ставка?: number;
    сумма_без_ндс?: number;
    сумма_ндс?: number;
    сумма_всего?: number;
}

interface Purchase {
    id: number;
    поставщик_id: number;
    поставщик_название: string;
    поставщик_телефон: string;
    поставщик_email: string;
    поставщик_адрес?: string | null;
    поставщик_тип?: string | null;
    поставщик_краткое_название?: string | null;
    поставщик_полное_название?: string | null;
    поставщик_фамилия?: string | null;
    поставщик_имя?: string | null;
    поставщик_отчество?: string | null;
    поставщик_инн?: string | null;
    поставщик_кпп?: string | null;
    поставщик_огрн?: string | null;
    поставщик_огрнип?: string | null;
    поставщик_окпо?: string | null;
    поставщик_адрес_регистрации?: string | null;
    поставщик_адрес_печати?: string | null;
    поставщик_паспорт_серия?: string | null;
    поставщик_паспорт_номер?: string | null;
    поставщик_паспорт_кем_выдан?: string | null;
    поставщик_паспорт_дата_выдачи?: string | null;
    поставщик_паспорт_код_подразделения?: string | null;
    поставщик_комментарий?: string | null;
    заявка_id?: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
    использовать_доставку?: boolean;
    транспорт_id?: number | null;
    стоимость_доставки?: number | null;
    транспорт_название?: string;
    клиент_id?: number | null;
    клиент_название?: string | null;
    клиент_телефон?: string | null;
    клиент_email?: string | null;
    клиент_адрес?: string | null;
    клиент_тип?: string | null;
    клиент_краткое_название?: string | null;
    клиент_полное_название?: string | null;
    клиент_фамилия?: string | null;
    клиент_имя?: string | null;
    клиент_отчество?: string | null;
    клиент_инн?: string | null;
    клиент_кпп?: string | null;
    клиент_огрн?: string | null;
    клиент_огрнип?: string | null;
    клиент_окпо?: string | null;
    клиент_адрес_регистрации?: string | null;
    клиент_адрес_печати?: string | null;
    клиент_комментарий?: string | null;
    позиции: PurchasePosition[];
}

type EditPurchaseSubmitData = {
    id: number;
    поставщик_id: number | null;
    заявка_id: number | null;
    статус: string;
    дата_поступления: string | null;
    использовать_доставку: boolean;
    транспорт_id: number | null;
    стоимость_доставки: number | null;
    позиции: Array<{
        id?: number;
        товар_id: number;
        количество: number;
        цена: number;
        ндс_id: number;
    }>;
};

type PurchaseDocumentPreviewState = DocumentPreviewStateBase & {
    key: PurchaseDocumentKey;
    downloadUrl: string;
    downloadFormat: 'excel' | 'word';
};

const PREVIEW_ZOOM_MIN = 0.6;
const PREVIEW_ZOOM_MAX = 2;
const PREVIEW_ZOOM_STEP = 0.2;
const PREVIEW_PAGE_RENDER_TIMEOUT_MS = 12000;

const isElectronRuntime = (): boolean => (
    typeof navigator !== 'undefined' && /\bElectron\//i.test(navigator.userAgent)
);

const buildPdfJsDocumentOptions = (data: Uint8Array) => {
    if (!isElectronRuntime()) {
        return { data };
    }

    return {
        data,
        isOffscreenCanvasSupported: false,
        isImageDecoderSupported: false,
        useWasm: false,
        enableHWA: false,
        canvasMaxAreaInBytes: -1,
    };
};

const waitForPdfPageRender = async (renderTask: { promise: Promise<void>; cancel?: () => void }) => {
    let timeoutId: number | null = null;

    try {
        await Promise.race([
            renderTask.promise,
            new Promise<never>((_, reject) => {
                timeoutId = window.setTimeout(() => {
                    renderTask.cancel?.();
                    reject(new Error('Не удалось подготовить предпросмотр PDF. Попробуйте открыть документ в новой вкладке.'));
                }, PREVIEW_PAGE_RENDER_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
    }
};

const buildRasterPreviewUrl = (previewUrl: string): string => {
    const url = new URL(previewUrl, window.location.origin);
    url.searchParams.set('format', 'preview');
    url.searchParams.set('disposition', 'inline');
    return `${url.pathname}${url.search}${url.hash}`;
};

const scalePreviewPages = (
    pages: DocumentPreviewPageImage[],
    zoom: number,
    stageWidth: number | undefined
): DocumentPreviewPageImage[] => (
    pages.map((page) => ({
        ...page,
        width: page.width * ((Math.max((stageWidth ?? 1200) - 8, 320) / Math.max(page.width, 1)) * zoom),
        height: page.height * ((Math.max((stageWidth ?? 1200) - 8, 320) / Math.max(page.width, 1)) * zoom),
    }))
);

const formatDateRu = (value: Date): string => {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}.${month}.${year}`;
};

type SpacingValue = string | number | undefined;

const spacing = (value: SpacingValue) => {
    if (value == null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed * 0.25}rem` : String(value);
};

function Box({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={className} {...props} />;
}

function Flex({
    direction,
    align,
    justify,
    gap,
    mt,
    mb,
    wrap,
    className,
    style,
    ...props
}: React.ComponentProps<'div'> & {
    direction?: React.CSSProperties['flexDirection'];
    align?: React.CSSProperties['alignItems'];
    justify?: React.CSSProperties['justifyContent'] | 'between';
    gap?: SpacingValue;
    mt?: SpacingValue;
    mb?: SpacingValue;
    wrap?: React.CSSProperties['flexWrap'] | boolean;
}) {
    return (
        <div
            className={className}
            style={{
                display: 'flex',
                flexDirection: direction,
                alignItems: align,
                justifyContent: justify === 'between' ? 'space-between' : justify,
                gap: spacing(gap),
                marginTop: spacing(mt),
                marginBottom: spacing(mb),
                flexWrap: wrap === true ? 'wrap' : wrap || undefined,
                ...style,
            }}
            {...props}
        />
    );
}

function Text({
    as,
    size,
    weight,
    color,
    mt,
    mb,
    className,
    style,
    ...props
}: React.ComponentProps<'span'> & {
    as?: keyof JSX.IntrinsicElements;
    size?: string;
    weight?: 'regular' | 'medium' | 'bold' | string;
    color?: string;
    mt?: SpacingValue;
    mb?: SpacingValue;
}) {
    const Component = (as || 'span') as React.ElementType;
    const textClassName = [
        size === '1' ? 'text-xs' : size === '3' ? 'text-base' : 'text-sm',
        weight === 'medium' ? 'font-medium' : '',
        weight === 'bold' ? 'font-bold' : '',
        color === 'gray' ? 'text-muted-foreground' : '',
        color === 'red' ? 'text-destructive' : '',
        className || '',
    ].filter(Boolean).join(' ');

    return React.createElement(Component, {
        className: textClassName,
        style: { marginTop: spacing(mt), marginBottom: spacing(mb), ...style },
        ...props,
    });
}

function Card({ className, ...props }: React.ComponentProps<'div'> & { size?: string; variant?: string }) {
    return <div className={[styles.card, className || ''].filter(Boolean).join(' ')} {...props} />;
}

function Grid({
    columns,
    gap,
    mt,
    className,
    style,
    ...props
}: React.ComponentProps<'div'> & {
    columns?: string | { initial?: string; md?: string; sm?: string };
    gap?: SpacingValue;
    mt?: SpacingValue;
}) {
    const columnValue = typeof columns === 'object' ? (columns.md || columns.sm) : columns;
    const gridTemplateColumns = columnValue === '2'
        ? 'repeat(2, minmax(0, 1fr))'
        : undefined;

    return (
        <div
            className={className}
            style={{
                display: 'grid',
                gridTemplateColumns,
                gap: spacing(gap),
                marginTop: spacing(mt),
                ...style,
            }}
            {...props}
        />
    );
}

function Separator({ className, ...props }: React.ComponentProps<'div'> & { size?: string }) {
    return <div className={[styles.separator, className || ''].filter(Boolean).join(' ')} {...props} />;
}

function PurchaseDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
    const [documentPreview, setDocumentPreview] = useState<PurchaseDocumentPreviewState | null>(null);
    const [documentPreviewPages, setDocumentPreviewPages] = useState<DocumentPreviewPageImage[]>([]);
    const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
    const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
    const [documentPreviewSaveMessage, setDocumentPreviewSaveMessage] = useState<string | null>(null);
    const [documentPreviewSaving, setDocumentPreviewSaving] = useState(false);
    const [documentPreviewPdfObjectUrl, setDocumentPreviewPdfObjectUrl] = useState<string | null>(null);
    const [documentPreviewZoom, setDocumentPreviewZoom] = useState(1);
    const [isPurchasePrintMenuOpen, setIsPurchasePrintMenuOpen] = useState(false);
    const documentPreviewPrintFrameRef = useRef<HTMLIFrameElement | null>(null);
    const documentPreviewStageRef = useRef<HTMLDivElement | null>(null);
    const documentPreviewPdfBytesRef = useRef<Uint8Array | null>(null);
    const documentPreviewPdfSourceUrlRef = useRef<string | null>(null);

    const canView = Boolean(user?.permissions?.includes('purchases.view'));
    const canEdit = Boolean(user?.permissions?.includes('purchases.edit'));
    const canDelete = Boolean(user?.permissions?.includes('purchases.delete'));
    const canPurchaseOrderView = Boolean(user?.permissions?.includes('purchases.order.view'));
    const canOrderView = Boolean(user?.permissions?.includes('orders.view'));
    const canPrint = Boolean(user?.permissions?.includes('purchases.print'));
    const canExportPdf = Boolean(user?.permissions?.includes('purchases.export.pdf'));
    const canExportExcel = Boolean(user?.permissions?.includes('purchases.export.excel'));
    const canExportWord = Boolean(user?.permissions?.includes('purchases.export.word'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('purchases.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('purchases.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('purchases.attachments.delete'));
    const canPreviewPurchaseDocuments = canPrint || canExportPdf;
    const canUsePurchaseDocumentCenter = canPreviewPurchaseDocuments || canExportExcel || canExportWord;

    const availablePurchaseDocuments = useMemo<PurchaseDocumentDefinition[]>(() => {
        if (!purchase) return [];
        return getAvailablePurchaseDocumentDefinitions({
            nomenclatureTypes: (purchase.позиции || []).map((position) => position.товар_тип_номенклатуры || ''),
        }).filter((documentDefinition) => {
            const canPreviewDocument = documentDefinition.outputFormats.includes('pdf') && canPreviewPurchaseDocuments;
            const canDownloadExcel = documentDefinition.outputFormats.includes('excel') && canExportExcel;
            const canDownloadWord = documentDefinition.outputFormats.includes('word') && canExportWord;
            return canPreviewDocument || canDownloadExcel || canDownloadWord;
        });
    }, [purchase, canPreviewPurchaseDocuments, canExportExcel, canExportWord]);

    const buildPurchaseDocumentUrl = useCallback(
        (
            documentKey: PurchaseDocumentKey,
            format: 'pdf' | 'excel' | 'word',
            disposition: 'inline' | 'attachment',
            fileNameBase?: string
        ) => {
            const purchaseId = Number(purchase?.id);
            if (!Number.isInteger(purchaseId) || purchaseId <= 0) return '';
            const params = new URLSearchParams({
                format,
                disposition,
            });
            const extension = format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pdf';
            const readableTail = fileNameBase
                ? `/${encodeURIComponent(`${fileNameBase}.${extension}`)}`
                : '';
            return `/api/purchases/${purchaseId}/documents/${documentKey}${readableTail}?${params.toString()}`;
        },
        [purchase?.id]
    );

    const buildPurchaseDocumentFileNameBase = useCallback((documentDefinition: PurchaseDocumentDefinition) => {
        const purchaseId = Number(purchase?.id);
        if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
            return documentDefinition.title;
        }

        const purchaseDate = purchase?.дата_заказа ? new Date(purchase.дата_заказа) : new Date();
        return `${documentDefinition.title} № ${purchaseId} от ${formatDateRu(purchaseDate)}`;
    }, [purchase?.id, purchase?.дата_заказа]);

    const fetchAttachments = useCallback(async (purchaseId: number) => {
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            if (!canAttachmentsView) {
                setAttachments([]);
                return;
            }
            const res = await fetch(`/api/attachments?entity_type=purchase&entity_id=${encodeURIComponent(String(purchaseId))}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки вложений');
            }
            const data = (await res.json()) as AttachmentItem[];
            setAttachments(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки вложений');
        } finally {
            setAttachmentsLoading(false);
        }
    }, [canAttachmentsView]);

    const fetchPurchase = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/purchases?id=${id}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки закупки');
            }

            const data = await response.json();
            setPurchase(data);
            if (data?.id && canAttachmentsView) {
                await fetchAttachments(Number(data.id));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [canAttachmentsView, fetchAttachments, id]);
    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchPurchase();
        }
    }, [authLoading, canView, fetchPurchase, id]);

    useEffect(() => {
        if (!documentPreview) return undefined;
        return lockBodyScroll();
    }, [documentPreview]);

    useEffect(() => {
        if (!documentPreview) {
            setDocumentPreviewPages([]);
            setDocumentPreviewLoading(false);
            setDocumentPreviewError(null);
            setDocumentPreviewSaveMessage(null);
            setDocumentPreviewSaving(false);
            setDocumentPreviewZoom(1);
            if (documentPreviewPrintFrameRef.current) {
                documentPreviewPrintFrameRef.current.removeAttribute('src');
            }
            documentPreviewPdfBytesRef.current = null;
            documentPreviewPdfSourceUrlRef.current = null;
            setDocumentPreviewPdfObjectUrl((current) => {
                if (current) {
                    window.URL.revokeObjectURL(current);
                }
                return null;
            });
            return undefined;
        }

        let cancelled = false;

        const renderPreview = async () => {
            try {
                setDocumentPreviewLoading(true);
                setDocumentPreviewError(null);
                setDocumentPreviewSaveMessage(null);
                setDocumentPreviewPages([]);

                let fileBytes = documentPreviewPdfBytesRef.current;

                if (!fileBytes || documentPreviewPdfSourceUrlRef.current !== documentPreview.previewUrl) {
                    const response = await fetch(documentPreview.previewUrl, { credentials: 'include' });
                    if (!response.ok) {
                        const errorText = await response.text().catch(() => '');
                        throw new Error(errorText || 'Не удалось загрузить PDF для предпросмотра');
                    }

                    fileBytes = new Uint8Array(await response.arrayBuffer());
                    documentPreviewPdfBytesRef.current = fileBytes;
                    documentPreviewPdfSourceUrlRef.current = documentPreview.previewUrl;

                    const pdfBuffer = fileBytes.buffer.slice(
                        fileBytes.byteOffset,
                        fileBytes.byteOffset + fileBytes.byteLength
                    ) as ArrayBuffer;
                    const pdfObjectUrl = window.URL.createObjectURL(new Blob([pdfBuffer], { type: 'application/pdf' }));
                    setDocumentPreviewPdfObjectUrl((current) => {
                        if (current) {
                            window.URL.revokeObjectURL(current);
                        }
                        return pdfObjectUrl;
                    });
                }

                if (isElectronRuntime()) {
                    const previewResponse = await fetch(buildRasterPreviewUrl(documentPreview.previewUrl), { credentials: 'include' });
                    if (!previewResponse.ok) {
                        const errorText = await previewResponse.text().catch(() => '');
                        throw new Error(errorText || 'Не удалось загрузить предпросмотр PDF');
                    }
                    const previewPayload = await previewResponse.json().catch(() => null) as { pages?: DocumentPreviewPageImage[] } | null;
                    const previewPages = Array.isArray(previewPayload?.pages) ? previewPayload.pages : [];
                    if (!previewPages.length) {
                        throw new Error('Не удалось подготовить предпросмотр PDF');
                    }
                    if (!cancelled) {
                        setDocumentPreviewPages(scalePreviewPages(
                            previewPages,
                            documentPreviewZoom,
                            documentPreviewStageRef.current?.clientWidth
                        ));
                    }
                    return;
                }

                const loadPdfJs = Function('return import("/pdfjs/pdf.mjs")') as () => Promise<PdfJsModule>;
                const pdfjs = await loadPdfJs();
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
                const loadingTask = pdfjs.getDocument(buildPdfJsDocumentOptions(fileBytes.slice()));
                const pdf = await loadingTask.promise;

                const availableWidth = Math.max((documentPreviewStageRef.current?.clientWidth ?? 1200) - 8, 320);
                const pages: DocumentPreviewPageImage[] = [];

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                    const page = await pdf.getPage(pageNumber);
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scale = (availableWidth / baseViewport.width) * documentPreviewZoom;
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { alpha: false });

                    if (!context) {
                        throw new Error('Не удалось подготовить canvas для предпросмотра PDF');
                    }

                    const outputScale = typeof window !== 'undefined'
                        ? Math.min(window.devicePixelRatio || 1, 2)
                        : 1;

                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);

                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    if (outputScale !== 1) {
                        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
                    }

                    await waitForPdfPageRender(page.render({
                        canvasContext: context,
                        viewport,
                        background: 'rgb(255,255,255)',
                    }));

                    pages.push({
                        src: canvas.toDataURL('image/png'),
                        width: viewport.width,
                        height: viewport.height,
                    });
                }

                if (!cancelled) {
                    setDocumentPreviewPages(pages);
                }
            } catch (previewError) {
                if (!cancelled) {
                    setDocumentPreviewError(previewError instanceof Error ? previewError.message : 'Не удалось открыть предпросмотр PDF');
                }
            } finally {
                if (!cancelled) {
                    setDocumentPreviewLoading(false);
                }
            }
        };

        void renderPreview();

        return () => {
            cancelled = true;
        };
    }, [documentPreview, documentPreviewZoom]);

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canView) {
        return <NoAccessPage />;
    }

    const formatBytes = (bytes: number) => {
        const b = Number(bytes) || 0;
        if (b < 1024) return `${b} B`;
        const kb = b / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(1)} GB`;
    };

    const canPreviewInline = (a: AttachmentItem) => {
        const mime = (a.mime_type || '').toLowerCase();
        const name = (a.filename || '').toLowerCase();
        if (mime.includes('pdf') || name.endsWith('.pdf')) return true;
        if (mime.startsWith('image/')) return true;
        if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return true;
        return false;
    };

    const openPreview = (a: AttachmentItem) => {
        if (!canAttachmentsView) {
            setAttachmentsError('Нет доступа');
            return;
        }
        if (!canPreviewInline(a)) {
            window.open(`/api/attachments/${encodeURIComponent(a.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const handlePickFile = () => {
        if (!canAttachmentsUpload) return;
        fileInputRef.current?.click();
    };

    const handleUploadFile = async (file: File) => {
        if (!purchase) return;
        if (!canAttachmentsUpload) return;
        try {
            setUploadLoading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('entity_type', 'purchase');
            form.append('entity_id', String(purchase.id));
            form.append('file', file);

            const res = await fetch('/api/attachments', {
                method: 'POST',
                body: form,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(purchase.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!purchase) return;
        if (!canAttachmentsDelete) return;
        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=purchase&entity_id=${encodeURIComponent(String(purchase.id))}`,
                { method: 'DELETE' }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }

            await fetchAttachments(purchase.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const formatTextValue = (value?: string | null) => {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || 'Не указан';
    };

    const getPurchaseSupplierIdentity = () => {
        const type = normalizeSupplierContragentType(purchase?.поставщик_тип);
        if (type === 'Организация') {
            return formatTextValue(purchase?.поставщик_полное_название || purchase?.поставщик_краткое_название || purchase?.поставщик_название);
        }
        const fullName = [purchase?.поставщик_фамилия, purchase?.поставщик_имя, purchase?.поставщик_отчество]
            .map((item) => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)
            .join(' ');
        return fullName || formatTextValue(purchase?.поставщик_название);
    };

    const getPurchaseSupplierRegistrationNumberLabel = () => {
        return normalizeSupplierContragentType(purchase?.поставщик_тип) === 'Организация' ? 'ОГРН' : 'ОГРНИП';
    };

    const getPurchaseSupplierRegistrationAddressLabel = () => {
        return normalizeSupplierContragentType(purchase?.поставщик_тип) === 'Организация' ? 'Юридический адрес' : 'Адрес регистрации';
    };

    const getPurchaseSupplierPassportSummary = () => {
        return [
            purchase?.поставщик_паспорт_серия && `серия ${purchase.поставщик_паспорт_серия}`,
            purchase?.поставщик_паспорт_номер && `номер ${purchase.поставщик_паспорт_номер}`,
            purchase?.поставщик_паспорт_дата_выдачи && `от ${formatDate(purchase.поставщик_паспорт_дата_выдачи)}`,
        ].filter(Boolean).join(', ') || 'Не указан';
    };

    const getPurchaseClientIdentity = () => {
        const type = normalizeClientContragentType(purchase?.клиент_тип);
        if (type === 'Организация') {
            return formatTextValue(purchase?.клиент_полное_название || purchase?.клиент_краткое_название || purchase?.клиент_название);
        }
        const fullName = [purchase?.клиент_фамилия, purchase?.клиент_имя, purchase?.клиент_отчество]
            .map((item) => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)
            .join(' ');
        return fullName || formatTextValue(purchase?.клиент_название);
    };

    const getVatSummary = (position: PurchasePosition) => {
        if (typeof position.сумма_без_ндс === 'number' && typeof position.сумма_ндс === 'number' && typeof position.сумма_всего === 'number') {
            return {
                net: position.сумма_без_ндс,
                tax: position.сумма_ндс,
                total: position.сумма_всего,
                label: position.ндс_название || getVatRateOption(position.ндс_id).label,
            };
        }

        const vatOption = getVatRateOption(position.ндс_id);
        const breakdown = calculateVatAmountsFromLine(position.количество, position.цена, position.ндс_ставка ?? vatOption.rate);
        return {
            ...breakdown,
            label: position.ндс_название || vatOption.label,
        };
    };

    const openPurchaseDocumentPreview = (documentDefinition: PurchaseDocumentDefinition) => {
        const downloadFormat: 'excel' | 'word' = documentDefinition.outputFormats.includes('word') ? 'word' : 'excel';
        const fileNameBase = buildPurchaseDocumentFileNameBase(documentDefinition);

        if (!canPreviewPurchaseDocuments) {
            if ((downloadFormat === 'word' && canExportWord) || (downloadFormat === 'excel' && canExportExcel)) {
                const downloadUrl = buildPurchaseDocumentUrl(documentDefinition.key, downloadFormat, 'attachment', fileNameBase);
                if (downloadUrl) {
                    void downloadDocumentFile(downloadUrl, `${fileNameBase}.${downloadFormat === 'word' ? 'docx' : 'xlsx'}`)
                        .catch((downloadError) => {
                            setError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать документ');
                        });
                }
                return;
            }
            setError('Нет доступа');
            return;
        }

        const previewUrl = buildPurchaseDocumentUrl(documentDefinition.key, 'pdf', 'inline', fileNameBase);
        const downloadUrl = buildPurchaseDocumentUrl(documentDefinition.key, downloadFormat, 'attachment', fileNameBase);
        if (!previewUrl || !downloadUrl) return;

        setDocumentPreviewZoom(1);
        setDocumentPreview({
            key: documentDefinition.key,
            title: 'Предпросмотр документа',
            description: documentDefinition.title,
            fileNameBase,
            previewUrl,
            downloadUrl,
            downloadFormat,
        });
    };

    const closePurchaseDocumentPreview = () => {
        setDocumentPreview(null);
        scheduleForceUnlockBodyScroll();
    };

    const openPurchaseDocumentInNewTab = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const updateDocumentPreviewZoom = (nextZoom: number) => {
        const normalizedZoom = Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, Number(nextZoom.toFixed(2))));
        setDocumentPreviewZoom(normalizedZoom);
    };

    const downloadDocumentFile = async (url: string, fileName?: string) => {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || 'Не удалось скачать документ');
        }

        const disposition = response.headers.get('content-disposition') || '';
        const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
        const resolvedFileName = fileName || (filenameMatch?.[1]
            ? decodeURIComponent(filenameMatch[1].replace(/"/g, ''))
            : '');

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        if (resolvedFileName) {
            link.download = resolvedFileName;
        }
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
    };

    const handlePrintDocumentPreview = () => {
        if (!documentPreview || !documentPreviewPdfObjectUrl) return;

        if (documentPreviewPrintFrameRef.current) {
            const frame = documentPreviewPrintFrameRef.current;
            const printFrame = () => {
                frame.contentWindow?.focus();
                frame.contentWindow?.print();
            };

            if (frame.src !== documentPreviewPdfObjectUrl) {
                frame.onload = () => {
                    frame.onload = null;
                    printFrame();
                };
                frame.src = documentPreviewPdfObjectUrl;
                return;
            }

            printFrame();
            return;
        }

        openPurchaseDocumentInNewTab(documentPreviewPdfObjectUrl);
    };

    const handleDocumentPreviewDownload = (format: 'pdf' | 'excel' | 'word') => {
        if (!documentPreview) return;

        if (format === 'pdf') {
            if (!canPrint && !canExportPdf) {
                setDocumentPreviewError('Нет доступа');
                return;
            }

            if (documentPreviewPdfObjectUrl) {
                const link = document.createElement('a');
                link.href = documentPreviewPdfObjectUrl;
                link.download = `${documentPreview.fileNameBase}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                return;
            }

            void downloadDocumentFile(
                buildPurchaseDocumentUrl(documentPreview.key, 'pdf', 'attachment', documentPreview.fileNameBase),
                `${documentPreview.fileNameBase}.pdf`
            )
                .catch((downloadError) => {
                    setDocumentPreviewError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать PDF');
                });
            return;
        }

        if (format === 'excel' && !canExportExcel) {
            setDocumentPreviewError('Нет доступа');
            return;
        }

        if (format === 'word' && !canExportWord) {
            setDocumentPreviewError('Нет доступа');
            return;
        }

        void downloadDocumentFile(
            documentPreview.downloadUrl,
            `${documentPreview.fileNameBase}.${format === 'word' ? 'docx' : 'xlsx'}`
        )
            .catch((downloadError) => {
                setDocumentPreviewError(
                    downloadError instanceof Error
                        ? downloadError.message
                        : format === 'word'
                            ? 'Не удалось скачать Word-документ'
                            : 'Не удалось скачать Excel-документ'
                );
            });
    };

    const handleDocumentPreviewSave = async () => {
        if (!documentPreview || !purchase?.id) return;

        if (!canAttachmentsUpload) {
            setDocumentPreviewError('Нет доступа на сохранение документов закупки');
            return;
        }

        try {
            setDocumentPreviewSaving(true);
            setDocumentPreviewError(null);
            setDocumentPreviewSaveMessage(null);

            const files: GeneratedAttachmentFile[] = [];

            if (canPrint || canExportPdf) {
                const sourcePdfBytes = documentPreviewPdfBytesRef.current;
                let pdfBlob: Blob;

                if (sourcePdfBytes) {
                    const pdfArrayBuffer = new ArrayBuffer(sourcePdfBytes.byteLength);
                    new Uint8Array(pdfArrayBuffer).set(sourcePdfBytes);
                    pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
                } else {
                    pdfBlob = await fetchGeneratedBlob(
                        buildPurchaseDocumentUrl(documentPreview.key, 'pdf', 'attachment', documentPreview.fileNameBase)
                    );
                }

                files.push({
                    blob: pdfBlob,
                    fileName: `${documentPreview.fileNameBase}.pdf`,
                    mimeType: 'application/pdf',
                });
            }

            if (documentPreview.downloadFormat === 'excel' && canExportExcel) {
                files.push({
                    blob: await fetchGeneratedBlob(documentPreview.downloadUrl),
                    fileName: `${documentPreview.fileNameBase}.xlsx`,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
            }

            if (documentPreview.downloadFormat === 'word' && canExportWord) {
                files.push({
                    blob: await fetchGeneratedBlob(documentPreview.downloadUrl),
                    fileName: `${documentPreview.fileNameBase}.docx`,
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                });
            }

            if (!files.length) {
                throw new Error('Нет доступных форматов для сохранения');
            }

            const savedCount = await saveGeneratedAttachments(
                { entityType: 'purchase', entityId: purchase.id },
                files
            );

            if (canAttachmentsView) {
                await fetchAttachments(Number(purchase.id));
            }

            setDocumentPreviewSaveMessage(`Сохранено в документы закупки: ${savedCount}`);
        } catch (saveError) {
            setDocumentPreviewError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить документы');
        } finally {
            setDocumentPreviewSaving(false);
        }
    };

    const handleEditPurchase = async (purchaseData: EditPurchaseSubmitData) => {
        if (!canEdit) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/purchases?id=${purchaseData.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(purchaseData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления закупки');
            }

            await fetchPurchase();
            setIsEditModalOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка обновления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeletePurchase = async () => {
        if (!purchase) return;
        if (!canDelete) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/purchases?id=${purchase.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления закупки');
            }
            router.push('/purchases');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка удаления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    if (loading) {
        return <PageLoader label="Загрузка закупки..." fullPage />;
    }

    if (error || !purchase) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <p className={styles.errorText}>{error || 'Закупка не найдена'}</p>
                    <div className={styles.buttonGroup} style={{ marginTop: '16px' }}>
                        <Link href="/purchases" style={{ textDecoration: 'none' }}>
                            <EntityActionButton>
                                Назад к списку закупок
                            </EntityActionButton>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const purchaseItemsTotal = purchase.позиции.reduce((sum, position) => {
        const vatSummary = getVatSummary(position);
        return sum + vatSummary.total;
    }, 0);

    const purchaseLogisticsTotal = purchase.использовать_доставку
        ? Number(purchase.стоимость_доставки || 0)
        : 0;

    const purchaseGrandTotal = purchaseItemsTotal + purchaseLogisticsTotal;
    const purchaseForEditModal: React.ComponentProps<typeof EditPurchaseModal>['purchase'] = {
        id: purchase.id,
        поставщик_id: purchase.поставщик_id,
        поставщик_название: purchase.поставщик_название,
        заявка_id: purchase.заявка_id,
        статус: purchase.статус,
        дата_поступления: purchase.дата_поступления,
        использовать_доставку: purchase.использовать_доставку,
        транспорт_id: purchase.транспорт_id,
        стоимость_доставки: purchase.стоимость_доставки,
        транспорт_название: purchase.транспорт_название,
        позиции: purchase.позиции.map((position) => ({
            id: position.id,
            товар_id: position.товар_id,
            количество: position.количество,
            цена: position.цена,
            ндс_id: position.ндс_id ?? 0,
        })),
    };

    return (
        <div className={`${styles.container} print-purchase-detail`}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Закупка #{purchase.id}</h1>
                        <p className={styles.subtitle}>Детали закупки и позиции</p>
                    </div>
                    <div className={styles.headerActions}>
                        <Link href="/purchases" className={styles['no-print']} style={{ textDecoration: 'none' }}>
                            <EntityActionButton>
                                <FiArrowLeft className={styles.icon} />
                                Назад
                            </EntityActionButton>
                        </Link>

                        {purchase.заявка_id && canPurchaseOrderView && canOrderView ? (
                            <Link href={`/orders/${purchase.заявка_id}`} className={styles['no-print']} style={{ textDecoration: 'none' }}>
                                <EntityActionButton>
                                    <FiEye className={styles.icon} />
                                    Перейти к заявке
                                </EntityActionButton>
                            </Link>
                        ) : null}

                        {canUsePurchaseDocumentCenter && availablePurchaseDocuments.length ? (
                            <DropdownMenu open={isPurchasePrintMenuOpen} onOpenChange={setIsPurchasePrintMenuOpen}>
                                <DropdownMenuTrigger
                                    render={
                                        <EntityActionButton className={styles['no-print']}>
                                            <FiPrinter className={styles.icon} />
                                            Печать
                                            <FiChevronDown className={styles.icon} />
                                        </EntityActionButton>
                                    }
                                />
                                <DropdownMenuContent align="end" sideOffset={8}>
                                    {availablePurchaseDocuments.map((documentDefinition) => (
                                        <DropdownMenuItem
                                            key={documentDefinition.key}
                                            onClick={() => {
                                                setIsPurchasePrintMenuOpen(false);
                                                openPurchaseDocumentPreview(documentDefinition);
                                            }}
                                        >
                                            {documentDefinition.title}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}

                        {canEdit ? (
                            <EntityActionButton
                                onClick={() => setIsEditModalOpen(true)}
                                className={styles['no-print']}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </EntityActionButton>
                        ) : null}

                        {canDelete ? (
                            <EntityActionButton
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                tone="danger"
                                className={styles['no-print']}
                            >
                                <FiTrash2 className={styles.icon} />
                                Удалить
                            </EntityActionButton>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.sectionHeader}>
                    <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                        Детали закупки
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Закупка от {formatDate(purchase.дата_заказа)}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Информация о поставщике
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Поставщик</Text>
                                    <Text as="div" size="2" weight="medium">{formatTextValue(purchase.поставщик_название)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Тип контрагента</Text>
                                    <Text as="div" size="2">{getSupplierContragentTypeLabel(purchase.поставщик_тип)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Полное имя / название</Text>
                                    <Text as="div" size="2">{getPurchaseSupplierIdentity()}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Краткое название</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_краткое_название || purchase.поставщик_название)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Телефон</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_телефон)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Email</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_email)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Адрес</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_адрес)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">ИНН / КПП</Text>
                                    <Text as="div" size="2">{`${formatTextValue(purchase.поставщик_инн)} / ${formatTextValue(purchase.поставщик_кпп)}`}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">{getPurchaseSupplierRegistrationNumberLabel()}</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_огрн || purchase.поставщик_огрнип)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">ОКПО</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_окпо)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">{getPurchaseSupplierRegistrationAddressLabel()}</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_адрес_регистрации)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Адрес для документов</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_адрес_печати || purchase.поставщик_адрес)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Комментарий</Text>
                                    <Text as="div" size="2">{formatTextValue(purchase.поставщик_комментарий)}</Text>
                                </Box>
                                {normalizeSupplierContragentType(purchase.поставщик_тип) === 'Физическое лицо' ? (
                                    <>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Паспорт</Text>
                                            <Text as="div" size="2">{getPurchaseSupplierPassportSummary()}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Код подразделения</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.поставщик_паспорт_код_подразделения)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Кем выдан</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.поставщик_паспорт_кем_выдан)}</Text>
                                        </Box>
                                    </>
                                ) : null}
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Информация о закупке
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Flex direction="column" align="start" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <Text as="div" size="1" color="gray">Статус</Text>
                                    <EntityStatusBadge value={purchase.статус} label={purchase.статус.toUpperCase()} />
                                </Flex>
                                <Box>
                                    <Text as="div" size="1" color="gray">Заявка</Text>
                                    <Text as="div" size="2">{purchase.заявка_id ? `#${purchase.заявка_id}` : 'Не указана'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата заказа</Text>
                                    <Text as="div" size="2">{formatDate(purchase.дата_заказа)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата поступления</Text>
                                    <Text as="div" size="2">{purchase.дата_поступления ? formatDate(purchase.дата_поступления) : 'Не указана'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Способ получения</Text>
                                    <Text as="div" size="2">{getPurchaseDeliveryLabel(purchase.использовать_доставку)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Кто доставляет</Text>
                                    <Text as="div" size="2">
                                        {purchase.использовать_доставку
                                            ? (purchase.транспорт_название || (purchase.транспорт_id ? `ТК #${purchase.транспорт_id}` : 'Не указана'))
                                            : 'Не используется'}
                                    </Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Стоимость доставки</Text>
                                    <Text as="div" size="2">
                                        {purchase.использовать_доставку
                                            ? (purchase.стоимость_доставки ? formatCurrency(purchase.стоимость_доставки) : 'Не указана')
                                            : 'Не используется'}
                                    </Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Сумма товаров</Text>
                                    <Text as="div" size="2">{formatCurrency(purchaseItemsTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Логистика</Text>
                                    <Text as="div" size="2">{formatCurrency(purchaseLogisticsTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Итого по закупке</Text>
                                    <Text as="div" size="2" weight="medium">{formatCurrency(purchaseGrandTotal)}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>

                {purchase.клиент_id ? (
                    <Grid columns={{ initial: '1', md: '1' }} gap="4" mt="4">
                        <Card size="2" variant="surface">
                            <Flex direction="column" gap="3">
                                <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                    Клиент по связанной заявке
                                </Text>
                                <Separator size="4" />
                                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                                    <Flex direction="column" gap="2">
                                        <Box>
                                            <Text as="div" size="1" color="gray">Клиент</Text>
                                            <Text as="div" size="2" weight="medium">{formatTextValue(purchase.клиент_название)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Тип контрагента</Text>
                                            <Text as="div" size="2">{getClientContragentTypeLabel(purchase.клиент_тип)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Полное имя / название</Text>
                                            <Text as="div" size="2">{getPurchaseClientIdentity()}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Телефон</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_телефон)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Email</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_email)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Адрес</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_адрес)}</Text>
                                        </Box>
                                    </Flex>

                                    <Flex direction="column" gap="2">
                                        <Box>
                                            <Text as="div" size="1" color="gray">ИНН / КПП</Text>
                                            <Text as="div" size="2">{`${formatTextValue(purchase.клиент_инн)} / ${formatTextValue(purchase.клиент_кпп)}`}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">ОГРН / ОГРНИП</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_огрн || purchase.клиент_огрнип)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">ОКПО</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_окпо)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Адрес регистрации</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_адрес_регистрации)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Адрес для документов</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_адрес_печати || purchase.клиент_адрес)}</Text>
                                        </Box>
                                        <Box>
                                            <Text as="div" size="1" color="gray">Комментарий</Text>
                                            <Text as="div" size="2">{formatTextValue(purchase.клиент_комментарий)}</Text>
                                        </Box>
                                    </Flex>
                                </Grid>
                            </Flex>
                        </Card>
                    </Grid>
                ) : null}

                {canAttachmentsView ? (
                    <div className={styles.sectionBlock}>
                        <div className={styles.sectionHeaderRow}>
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Документы
                            </Text>
                            <div className={styles.buttonGroup}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void handleUploadFile(file);
                                    }}
                                />
                                {canAttachmentsUpload ? (
                                    <EntityActionButton
                                        type="button"
                                        onClick={handlePickFile}
                                        disabled={uploadLoading}
                                        className={styles['no-print']}
                                    >
                                        <FiUploadCloud className={styles.icon} />
                                        {uploadLoading ? 'Загрузка…' : 'Загрузить файл'}
                                    </EntityActionButton>
                                ) : null}
                            </div>
                        </div>

                        {attachmentsError ? (
                            <Text as="div" size="2" color="red" style={{ marginLeft: 16 }}>
                                {attachmentsError}
                            </Text>
                        ) : null}

                        {attachmentsLoading ? (
                            <Text as="div" size="2" color="gray" style={{ marginLeft: 16 }}>
                                Загрузка документов…
                            </Text>
                        ) : attachments.length === 0 ? (
                            <Text as="div" size="2" color="gray" style={{ marginLeft: 16 }}>
                                Нет прикрепленных документов
                            </Text>
                        ) : (
                            <Box>
                                <EntityTableSurface>
                                    <Table className={`${entityTableClassName} ${styles.documentsTable}`}>
                                        <colgroup>
                                            <col className={styles.documentsFileColumn} />
                                            <col className={styles.documentsSizeColumn} />
                                            <col className={styles.documentsActionsColumn} />
                                        </colgroup>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Файл</TableHead>
                                                <TableHead className={styles.textRight}>Размер</TableHead>
                                                <TableHead className={styles.textRight}>Действия</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {attachments.map((attachment) => (
                                                <TableRow key={attachment.id}>
                                                    <TableCell>
                                                        <Flex align="center" gap="2">
                                                            <FiPaperclip />
                                                            <Text as="div" size="2" weight="medium">
                                                                {attachment.filename}
                                                            </Text>
                                                        </Flex>
                                                        <Text as="div" size="1" color="gray">
                                                            {attachment.mime_type}
                                                        </Text>
                                                    </TableCell>
                                                    <TableCell className={styles.textRight}>{formatBytes(attachment.size_bytes)}</TableCell>
                                                    <TableCell className={styles.textRight}>
                                                        <Flex justify="end" gap="2" wrap="wrap">
                                                            <EntityActionButton
                                                                type="button"
                                                                className={styles['no-print']}
                                                                onClick={() => openPreview(attachment)}
                                                            >
                                                                <FiFile className={styles.icon} />
                                                                Открыть
                                                            </EntityActionButton>
                                                            <a
                                                                href={`/api/attachments/${encodeURIComponent(attachment.id)}/download`}
                                                                style={{ textDecoration: 'none' }}
                                                                className={styles['no-print']}
                                                            >
                                                                <EntityActionButton type="button">
                                                                    <FiDownload className={styles.icon} />
                                                                    Скачать
                                                                </EntityActionButton>
                                                            </a>
                                                            {canAttachmentsDelete ? (
                                                                <EntityActionButton
                                                                    type="button"
                                                                    tone="danger"
                                                                    className={styles['no-print']}
                                                                    onClick={() => void handleDeleteAttachment(attachment.id)}
                                                                >
                                                                    <FiTrash2 className={styles.icon} />
                                                                    Удалить
                                                                </EntityActionButton>
                                                            ) : null}
                                                        </Flex>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </EntityTableSurface>
                            </Box>
                        )}
                    </div>
                ) : null}

                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <DialogContent style={{ maxWidth: 980, width: '95vw' }}>
                        <DialogTitle>{previewAttachment?.filename || 'Документ'}</DialogTitle>
                        <DialogDescription>
                            {previewAttachment?.mime_type || ''}
                        </DialogDescription>

                        <Box style={{ marginTop: 12 }}>
                            {previewAttachment && canPreviewInline(previewAttachment) ? (
                                previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                    <div className={styles.attachmentPreviewImageFrame}>
                                        <Image
                                            src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                            alt={previewAttachment.filename}
                                            fill
                                            unoptimized
                                            sizes="95vw"
                                            style={{ objectFit: 'contain' }}
                                        />
                                    </div>
                                ) : (
                                    <iframe
                                        src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                        className={styles.attachmentPreviewFrame}
                                        title={previewAttachment.filename}
                                    />
                                )
                            ) : (
                                <Text as="div" size="2" color="gray">
                                    Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                                </Text>
                            )}
                        </Box>

                        <Flex gap="3" mt="4" justify="end">
                            {previewAttachment ? (
                                <a
                                    href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <EntityActionButton>
                                        <FiDownload className={styles.icon} />
                                        Скачать
                                    </EntityActionButton>
                                </a>
                            ) : null}
                            <EntityActionButton onClick={() => setIsPreviewOpen(false)}>
                                Закрыть
                            </EntityActionButton>
                        </Flex>
                    </DialogContent>
                </Dialog>

                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Позиции закупки
                        </Text>
                    </div>

                    <EntityTableSurface className={styles.tableWrapper}>
                        <Table className={`${entityTableClassName} ${styles.positionsTable}`}>
                            <colgroup>
                                <col className={styles.positionNameColumn} />
                                <col className={styles.positionUnitColumn} />
                                <col className={styles.positionQuantityColumn} />
                                <col className={styles.positionPriceColumn} />
                                <col className={styles.positionNetColumn} />
                                <col className={styles.positionVatColumn} />
                                <col className={styles.positionTaxColumn} />
                                <col className={styles.positionTotalColumn} />
                            </colgroup>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Название</TableHead>
                                    <TableHead className={styles.textRight}>Ед.изм</TableHead>
                                    <TableHead className={styles.textRight}>Количество</TableHead>
                                    <TableHead className={styles.textRight}>Цена, ₽</TableHead>
                                    <TableHead className={styles.textRight}>Сумма без НДС, ₽</TableHead>
                                    <TableHead className={styles.textRight}>НДС</TableHead>
                                    <TableHead className={styles.textRight}>Сумма НДС, ₽</TableHead>
                                    <TableHead className={styles.textRight}>Всего, ₽</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {purchase.позиции.map((position) => {
                                    const vatSummary = getVatSummary(position);

                                    return (
                                        <TableRow key={position.id}>
                                            <TableCell>
                                                <div className={styles.productName}>{position.товар_название}</div>
                                                <div className={styles.productMeta}>
                                                    {position.товар_артикул || 'Артикул не указан'}
                                                </div>
                                            </TableCell>
                                            <TableCell className={styles.textRight}>
                                                {position.товар_единица_измерения || 'шт'}
                                            </TableCell>
                                            <TableCell className={styles.textRight}>
                                                {position.количество}
                                            </TableCell>
                                            <TableCell className={styles.textRight}>{formatCurrency(position.цена)}</TableCell>
                                            <TableCell className={styles.textRight}>{formatCurrency(vatSummary.net)}</TableCell>
                                            <TableCell className={styles.textRight}>{vatSummary.label}</TableCell>
                                            <TableCell className={styles.textRight}>{formatCurrency(vatSummary.tax)}</TableCell>
                                            <TableCell className={styles.textRight} style={{ fontWeight: 600 }}>
                                                {formatCurrency(vatSummary.total)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                <TableRow className={styles.totalRow}>
                                    <TableCell className={styles.textRight} colSpan={7}>
                                        Сумма товаров:
                                    </TableCell>
                                    <TableCell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                        {formatCurrency(purchaseItemsTotal)}
                                    </TableCell>
                                </TableRow>
                                <TableRow className={styles.totalRow}>
                                    <TableCell className={styles.textRight} colSpan={7}>
                                        Логистика:
                                    </TableCell>
                                    <TableCell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                        {formatCurrency(purchaseLogisticsTotal)}
                                    </TableCell>
                                </TableRow>
                                <TableRow className={styles.totalRow}>
                                    <TableCell className={styles.textRight} colSpan={7}>
                                        Итого по закупке:
                                    </TableCell>
                                    <TableCell className={styles.textRight} style={{ fontWeight: 700, textAlign: 'right' }}>
                                        {formatCurrency(purchaseGrandTotal)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </EntityTableSurface>
                </div>
            </div>

            {documentPreview ? (
                <div className={styles.previewScreen}>
                    <div className={styles.previewBackdrop} />
                    <div
                        className={styles.previewPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-label={documentPreview.title}
                        data-scroll-lock-allow="true"
                    >
                        <div className={styles.previewPanelHeader}>
                            <div className={styles.previewPanelTitleBlock}>
                                <h2 className={styles.previewPanelTitle}>{documentPreview.title}</h2>
                                <Text as="div" size="3" color="gray">
                                    {documentPreview.description}
                                </Text>
                            </div>
                            <button
                                type="button"
                                className={styles.previewCloseButton}
                                onClick={closePurchaseDocumentPreview}
                                aria-label="Закрыть предпросмотр"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.previewToolbar}>
                            {canPrint ? (
                                <EntityActionButton
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={handlePrintDocumentPreview}
                                    disabled={!documentPreviewPdfObjectUrl}
                                >
                                    <FiPrinter className={styles.icon} />
                                    Напечатать
                                </EntityActionButton>
                            ) : null}
                            {canExportPdf ? (
                                <EntityActionButton
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={() => handleDocumentPreviewDownload('pdf')}
                                >
                                    <BsFillFileEarmarkPdfFill className={`${styles.icon} ${styles.pdfIcon}`} />
                                    PDF
                                </EntityActionButton>
                            ) : null}
                            {documentPreview.downloadFormat === 'excel' && canExportExcel ? (
                                <EntityActionButton
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={() => handleDocumentPreviewDownload('excel')}
                                >
                                    <BsFillFileEarmarkExcelFill className={`${styles.icon} ${styles.excelIcon}`} />
                                    Excel
                                </EntityActionButton>
                            ) : null}
                            {documentPreview.downloadFormat === 'word' && canExportWord ? (
                                <EntityActionButton
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={() => handleDocumentPreviewDownload('word')}
                                >
                                    <BsFillFileEarmarkWordFill className={`${styles.icon} ${styles.wordIcon}`} />
                                    Word
                                </EntityActionButton>
                            ) : null}
                            <EntityActionButton
                                className={styles.previewToolbarAction}
                                data-entity-action-layout="print-toolbar"
                                onClick={() => openPurchaseDocumentInNewTab(documentPreview.previewUrl)}
                                disabled={!documentPreview.previewUrl}
                            >
                                <FiExternalLink className={styles.icon} />
                                Открыть
                            </EntityActionButton>
                            {canAttachmentsUpload ? (
                                <EntityActionButton
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={handleDocumentPreviewSave}
                                    disabled={documentPreviewSaving}
                                >
                                    <FiSave className={styles.icon} />
                                    {documentPreviewSaving ? 'Сохранение...' : 'Сохранить'}
                                </EntityActionButton>
                            ) : null}
                            <DocumentPreviewZoomControls
                                className={styles.previewZoomControls}
                                value={documentPreviewZoom}
                                min={PREVIEW_ZOOM_MIN}
                                max={PREVIEW_ZOOM_MAX}
                                step={PREVIEW_ZOOM_STEP}
                                disabled={documentPreviewLoading}
                                onChange={updateDocumentPreviewZoom}
                            />
                        </div>
                        {documentPreviewSaveMessage ? (
                            <div className={styles.previewSaveMessage}>{documentPreviewSaveMessage}</div>
                        ) : null}

                        <div className={styles.previewCanvas}>
                            <div className={styles.previewStage} ref={documentPreviewStageRef}>
                                {documentPreviewLoading ? (
                                    <div className={styles.previewLoading}>Готовим предпросмотр PDF...</div>
                                ) : documentPreviewError ? (
                                    <div className={styles.previewLoading}>{documentPreviewError}</div>
                                ) : (
                                    <div className={styles.previewPages}>
                                        {documentPreviewPages.map((page, index) => (
                                            <Image
                                                key={`${documentPreview.previewUrl}-${index + 1}`}
                                                src={page.src}
                                                alt={`${documentPreview.description}, страница ${index + 1}`}
                                                width={Math.max(1, Math.round(page.width))}
                                                height={Math.max(1, Math.round(page.height))}
                                                unoptimized
                                                sizes={`${Math.max(1, Math.round(page.width))}px`}
                                                className={styles.previewPageImage}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <iframe ref={documentPreviewPrintFrameRef} title="Печать документа" className={styles.hiddenPrintFrame} />
                </div>
            ) : null}

            <EditPurchaseModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                purchase={purchaseForEditModal}
                onSubmit={handleEditPurchase}
            />

            <DeleteConfirmation
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeletePurchase}
                loading={operationLoading}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить эту закупку?"
                warning="Это действие нельзя отменить. Все данные закупки и связанные позиции будут удалены."
                details={(
                    <div className={deleteConfirmationStyles.positionsSection}>
                        <div className={deleteConfirmationStyles.orderTitle}>Закупка #{purchase.id}</div>
                        {purchase.поставщик_название ? (
                            <div className={deleteConfirmationStyles.orderMeta}>
                                Поставщик: {purchase.поставщик_название}
                            </div>
                        ) : null}
                        <div className={deleteConfirmationStyles.orderMeta}>
                            Сумма: {formatCurrency(purchase.общая_сумма || 0)}
                        </div>
                    </div>
                )}
            />
        </div>
    );
}

export default withLayout(PurchaseDetailPage);
