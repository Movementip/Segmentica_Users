import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import EditOrderModal from '../../components/EditOrderModal';
import { CreatePurchaseModal, OrderPositionSnapshot } from '../../components/CreatePurchaseModal';
import { CreateShipmentModal } from '../../components/CreateShipmentModal';
import { BsFillFileEarmarkPdfFill, BsFillFileEarmarkWordFill } from 'react-icons/bs';
import styles from './OrderDetail.module.css';
import {
    FiArrowLeft,
    FiCheckCircle,
    FiChevronDown,
    FiDownload,
    FiEdit2,
    FiExternalLink,
    FiFile,
    FiMinus,
    FiPackage,
    FiPaperclip,
    FiPlus,
    FiPrinter,
    FiShoppingCart,
    FiTrash2,
    FiTruck,
    FiUploadCloud,
    FiX,
} from 'react-icons/fi';
import { Button, Table, DropdownMenu, Flex, Box, Text, Card, Grid, Separator, Badge, Dialog } from '@radix-ui/themes';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../lib/vat';
import { getClientContragentTypeLabel, normalizeClientContragentType } from '../../lib/clientContragents';
import {
    getAvailableOrderDocumentDefinitions,
    type OrderDocumentDefinition,
    type OrderDocumentKey,
} from '../../lib/orderDocumentDefinitions';
import type { OrderWorkflowModalSummary } from '../../components/OrderWorkflowModal';
import {
    getOrderExecutionModeLabel,
    getOrderSupplyModeLabel,
    type OrderExecutionMode,
    type OrderSupplyMode,
} from '../../lib/orderModes';

interface OrderPosition {
    id: number;
    товар_id: number;
    товар_тип_номенклатуры?: string;
    способ_обеспечения?: OrderSupplyMode;
    количество: number;
    цена: number;
    сумма: number;
    ндс_id?: number;
    ндс_название?: string;
    ндс_ставка?: number;
    сумма_без_ндс?: number;
    сумма_ндс?: number;
    сумма_всего?: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

interface MissingProduct {
    id: number;
    заявка_id: number;
    товар_id: number;
    необходимое_количество: number;
    недостающее_количество: number;
    статус: string;
    товар_название?: string;
    товар_артикул?: string;
}

interface OrderDetail {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    режим_исполнения?: OrderExecutionMode;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    сумма_товаров: number;
    сумма_логистики: number;
    адрес_доставки?: string;
    клиент_название?: string;
    клиент_телефон?: string;
    клиент_email?: string;
    клиент_адрес?: string;
    клиент_тип?: string;
    клиент_краткое_название?: string;
    клиент_полное_название?: string;
    клиент_фамилия?: string;
    клиент_имя?: string;
    клиент_отчество?: string;
    клиент_инн?: string;
    клиент_кпп?: string;
    клиент_огрн?: string;
    клиент_огрнип?: string;
    клиент_окпо?: string;
    клиент_адрес_регистрации?: string;
    клиент_адрес_печати?: string;
    клиент_комментарий?: string;
    менеджер_фио?: string;
    менеджер_телефон?: string;
    позиции: OrderPosition[];
    недостающие_товары?: MissingProduct[];
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

type OrderDocumentPreviewState = {
    key: OrderDocumentKey;
    title: string;
    description: string;
    fileNameBase: string;
    previewUrl: string;
    wordUrl: string;
};

type PreviewPageImage = {
    src: string;
    width: number;
    height: number;
};

type PdfJsModule = {
    GlobalWorkerOptions: {
        workerSrc: string;
    };
    getDocument: (source: { data: Uint8Array }) => {
        promise: Promise<{
            numPages: number;
            getPage: (pageNumber: number) => Promise<{
                getViewport: (params: { scale: number }) => { width: number; height: number };
                render: (params: {
                    canvasContext: CanvasRenderingContext2D;
                    viewport: { width: number; height: number };
                    background: string;
                }) => { promise: Promise<void> };
            }>;
        }>;
    };
};

const formatDateRu = (value: Date): string => {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}.${month}.${year}`;
};

const PREVIEW_ZOOM_MIN = 0.6;
const PREVIEW_ZOOM_MAX = 2;
const PREVIEW_ZOOM_STEP = 0.2;

function OrderDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreatePurchaseOpen, setIsCreatePurchaseOpen] = useState(false);
    const [createPurchaseModalKey, setCreatePurchaseModalKey] = useState(0);
    const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [createPurchaseOrderPositions, setCreatePurchaseOrderPositions] = useState<OrderPositionSnapshot[]>([]);
    const [workflow, setWorkflow] = useState<OrderWorkflowModalSummary | null>(null);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
    const [documentPreview, setDocumentPreview] = useState<OrderDocumentPreviewState | null>(null);
    const [documentPreviewPages, setDocumentPreviewPages] = useState<PreviewPageImage[]>([]);
    const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
    const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
    const [documentPreviewPdfObjectUrl, setDocumentPreviewPdfObjectUrl] = useState<string | null>(null);
    const [documentPreviewZoom, setDocumentPreviewZoom] = useState(1);
    const [isOrderPrintMenuOpen, setIsOrderPrintMenuOpen] = useState(false);
    const documentPreviewPrintFrameRef = useRef<HTMLIFrameElement | null>(null);
    const documentPreviewStageRef = useRef<HTMLDivElement | null>(null);
    const documentPreviewPdfBytesRef = useRef<Uint8Array | null>(null);
    const documentPreviewPdfSourceUrlRef = useRef<string | null>(null);

    const isDirectOrder = order?.режим_исполнения === 'direct';
    const activeMissingProducts = isDirectOrder
        ? []
        : (order?.недостающие_товары || []).filter((item) => item.статус !== 'получено' && item.недостающее_количество > 0);
    const closedMissingProducts = isDirectOrder
        ? []
        : (order?.недостающие_товары || []).filter((item) => item.статус === 'получено' || item.недостающее_количество <= 0);

    const canView = Boolean(user?.permissions?.includes('orders.view'));
    const canEdit = Boolean(user?.permissions?.includes('orders.edit'));
    const canDelete = Boolean(user?.permissions?.includes('orders.delete'));
    const canPrint = Boolean(user?.permissions?.includes('orders.print'));
    const canExportPdf = Boolean(user?.permissions?.includes('orders.export.pdf'));
    const canExportWord = Boolean(user?.permissions?.includes('orders.export.word'));
    const canManageMissingProducts = Boolean(user?.permissions?.includes('orders.missing_products.manage'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('orders.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('orders.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('orders.attachments.delete'));
    const canCreatePurchaseFromOrders = Boolean(user?.permissions?.includes('purchases.create'));
    const canCreateShipment = Boolean(user?.permissions?.includes('shipments.create'));
    const canAssembleOrder = canEdit;
    const canCompleteOrder = canEdit;
    const canPreviewOrderDocuments = canPrint || canExportPdf;
    const canUseOrderDocumentCenter = canPreviewOrderDocuments || canExportWord;

    const availableOrderDocuments = useMemo<OrderDocumentDefinition[]>(() => {
        if (!order) return [];
        return getAvailableOrderDocumentDefinitions({
            nomenclatureTypes: (order.позиции || []).map((position) => position.товар_тип_номенклатуры || ''),
        }).filter((documentDefinition) => {
            const canPreviewDocument = documentDefinition.outputFormats.includes('pdf') && canPreviewOrderDocuments;
            const canDownloadWord = documentDefinition.outputFormats.includes('word') && canExportWord;
            return canPreviewDocument || canDownloadWord;
        });
    }, [order, canPreviewOrderDocuments, canExportWord]);

    const buildOrderDocumentFileNameBase = useCallback((documentDefinition: OrderDocumentDefinition) => {
        const orderId = Number(order?.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return documentDefinition.title;
        }

        return `${documentDefinition.title} № ${orderId} от ${formatDateRu(new Date())}`;
    }, [order?.id]);

    const buildOrderDocumentUrl = useCallback(
        (
            documentKey: OrderDocumentKey,
            format: 'pdf' | 'word',
            disposition: 'inline' | 'attachment',
            fileNameBase?: string
        ) => {
            const orderId = Number(order?.id);
            if (!Number.isInteger(orderId) || orderId <= 0) return '';
            const params = new URLSearchParams({
                format,
                disposition,
            });
            const extension = format === 'word' ? 'docx' : 'pdf';
            const readableTail = fileNameBase
                ? `/${encodeURIComponent(`${fileNameBase}.${extension}`)}`
                : '';
            return `/api/orders/${orderId}/documents/${documentKey}${readableTail}?${params.toString()}`;
        },
        [order?.id]
    );

    useEffect(() => {
        if (!documentPreview) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [documentPreview]);

    useEffect(() => {
        if (!documentPreview) {
            setDocumentPreviewPages([]);
            setDocumentPreviewLoading(false);
            setDocumentPreviewError(null);
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
                setDocumentPreviewPages([]);

                const loadPdfJs = Function('return import("/pdfjs/pdf.mjs")') as () => Promise<PdfJsModule>;
                const pdfjs = await loadPdfJs();
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
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

                const loadingTask = pdfjs.getDocument({ data: fileBytes.slice() });
                const pdf = await loadingTask.promise;

                const availableWidth = Math.max((documentPreviewStageRef.current?.clientWidth ?? 1200) - 8, 320);
                const pages: PreviewPageImage[] = [];

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

                    await page.render({
                        canvasContext: context,
                        viewport,
                        background: 'rgb(255,255,255)',
                    }).promise;

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

    const fetchAttachments = useCallback(async (orderId: number) => {
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            if (!canAttachmentsView) {
                setAttachments([]);
                return;
            }
            const res = await fetch(`/api/attachments?entity_type=order&entity_id=${encodeURIComponent(String(orderId))}`);
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

    const fetchOrderWorkflow = useCallback(async (orderId: number) => {
        try {
            const response = await fetch(`/api/orders/${orderId}/workflow`);
            if (!response.ok) {
                throw new Error('Не удалось загрузить workflow заявки');
            }
            const data = await response.json();
            setWorkflow(data);
            setOrder((prev) => (prev ? { ...prev, статус: data.currentStatus || prev.статус } : prev));
        } catch (err) {
            console.error('Error fetching order workflow:', err);
            setWorkflow(null);
        }
    }, []);

    const fetchOrderDetail = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch order details
            const orderResponse = await fetch(`/api/orders/${id}`);

            if (!orderResponse.ok) {
                throw new Error('Ошибка загрузки заявки');
            }

            const orderData = await orderResponse.json();

            // Fetch missing products for this order
            const missingResponse = await fetch(`/api/missing-products?order_id=${id}`);

            if (missingResponse.ok) {
                const missingData = await missingResponse.json();
                orderData.недостающие_товары = missingData;
            }

            setOrder(orderData);

            if (orderData?.id) {
                await fetchAttachments(Number(orderData.id));
                await fetchOrderWorkflow(Number(orderData.id));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [fetchAttachments, fetchOrderWorkflow, id]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            void fetchOrderDetail();
        }
    }, [authLoading, canView, id, fetchOrderDetail]);

    if (authLoading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canView) {
        return <NoAccessPage />;
    }

    const handleAssembleOrder = async () => {
        if (!order) return;

        try {
            setOperationLoading(true);
            setError(null);

            const response = await fetch(`/api/orders/${order.id}/assemble`, {
                method: 'POST',
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось собрать заявку');
            }

            await fetchOrderDetail();
        } catch (err) {
            console.error('Error assembling order:', err);
            setError(err instanceof Error ? err.message : 'Не удалось собрать заявку');
        } finally {
            setOperationLoading(false);
        }
    };

    const openCreatePurchaseFromOrder = () => {
        if (!order) return;
        const remainingDirectPurchaseByProductId = new Map<number, number>(
            (workflow?.positions || []).map((position) => [
                Number(position.товар_id) || 0,
                Number(position.осталось_закупить) || 0,
            ])
        );
        const remainingWarehousePurchaseByProductId = new Map<number, number>(
            (workflow?.positions || []).map((position) => [
                Number(position.товар_id) || 0,
                Math.max(
                    0,
                    (Number(position.активная_недостача) || 0) - (Number(position.закуплено_количество) || 0)
                ),
            ])
        );
        const positions = isDirectOrder
            ? (order.позиции || [])
                .filter((position) => position.способ_обеспечения === 'purchase')
                .map((position) => ({
                    товар_id: Number(position.товар_id) || 0,
                    количество: remainingDirectPurchaseByProductId.get(Number(position.товар_id) || 0) || 0,
                    ндс_id: position.ндс_id == null ? undefined : Number(position.ндс_id),
                    цена: Number(position.цена) || 0,
                }))
                .filter((position) => position.товар_id > 0 && position.количество > 0)
            : activeMissingProducts.map((missing) => {
                const orderPosition = order.позиции?.find((position) => position.товар_id === missing.товар_id);
                return {
                    товар_id: Number(missing.товар_id) || 0,
                    количество: remainingWarehousePurchaseByProductId.get(Number(missing.товар_id) || 0) || 0,
                    ндс_id: orderPosition?.ндс_id == null ? undefined : Number(orderPosition.ндс_id),
                    цена: Number(orderPosition?.цена) || 0,
                };
            }).filter((position) => position.товар_id > 0 && position.количество > 0);

        if (positions.length === 0) {
            setError(
                isDirectOrder
                    ? 'По этой заявке больше нет необеспеченных позиций для закупки'
                    : 'По этой заявке нет активных недостающих позиций для закупки'
            );
            return;
        }

        setCreatePurchaseOrderPositions(positions);
        setCreatePurchaseModalKey((prev) => prev + 1);
        setIsCreatePurchaseOpen(true);
    };

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

    const getVatSummary = (position: OrderPosition) => {
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

    const handlePickFile = () => {
        if (!canAttachmentsUpload) {
            setAttachmentsError('Нет доступа');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleUploadFile = async (file: File) => {
        if (!order) return;
        if (!canAttachmentsUpload) {
            setAttachmentsError('Нет доступа');
            return;
        }
        try {
            setUploadLoading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('entity_type', 'order');
            form.append('entity_id', String(order.id));
            form.append('file', file);

            const res = await fetch('/api/attachments', {
                method: 'POST',
                body: form,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(order.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!order) return;
        if (!canAttachmentsDelete) {
            setAttachmentsError('Нет доступа');
            return;
        }
        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=order&entity_id=${encodeURIComponent(String(order.id))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(order.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
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

    const getOrderClientIdentity = () => {
        const type = normalizeClientContragentType(order?.клиент_тип);
        if (type === 'Организация') {
            return formatTextValue(order?.клиент_полное_название || order?.клиент_краткое_название || order?.клиент_название);
        }
        const fullName = [order?.клиент_фамилия, order?.клиент_имя, order?.клиент_отчество]
            .map((item) => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)
            .join(' ');
        return fullName || formatTextValue(order?.клиент_название);
    };

    const purchaseDeliveryTotal = (workflow?.purchases || []).reduce(
        (sum, purchase) => sum + (purchase.использовать_доставку ? Number(purchase.стоимость_доставки || 0) : 0),
        0
    );
    const shipmentDeliveryTotal = (workflow?.shipments || []).reduce(
        (sum, shipment) => sum + Number(shipment.стоимость_доставки || 0),
        0
    );
    const purchasesTotal = (workflow?.purchases || []).reduce(
        (sum, purchase) => sum + Number(purchase.общая_сумма || 0),
        0
    );
    const logisticsTotal = purchaseDeliveryTotal + shipmentDeliveryTotal;
    const orderItemsTotal = Number(order?.сумма_товаров || 0);
    const orderGrandTotal = Number(order?.общая_сумма || 0);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'новая': return '#2196f3';
            case 'в обработке': return '#ff9800';
            case 'досборка': return '#8d6e63';
            case 'собрана': return '#9c27b0';
            case 'доотгрузка': return '#00897b';
            case 'отгружена': return '#4caf50';
            case 'выполнена': return '#4caf50';
            case 'отменена': return '#f44336';
            default: return '#666';
        }
    };

    const getMissingStatusColor = (status: string) => {
        switch (status) {
            case 'в обработке': return '#2196f3';
            case 'заказано': return '#ff9800';
            case 'получено': return '#4caf50';
            default: return '#666';
        }
    };

    const getMissingStatusText = (status: string) => {
        switch (status) {
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'заказано': return 'ЗАКАЗАНО';
            case 'получено': return 'ПОЛУЧЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;

        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            setError(null); // Clear any previous errors

            console.log('Changing status to:', newStatus); // Debug log

            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: order.id,
                    клиент_id: order.клиент_id,
                    менеджер_id: order.менеджер_id,
                    адрес_доставки: order.адрес_доставки,
                    статус: newStatus
                }),
            });

            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData); // Debug log
                throw new Error(errorData.error || 'Ошибка изменения статуса');
            }

            const result = await response.json();
            console.log('Status changed successfully:', result); // Debug log

            await fetchOrderDetail(); // Refresh order data
        } catch (error) {
            console.error('Error changing status:', error);
            setError('Ошибка изменения статуса заявки: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setOperationLoading(false);
        }
    };

    const handleEditOrder = async (orderData: any) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error || 'Ошибка обновления заявки');
            }

            await fetchOrderDetail(); // Refresh order data
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!order) return;

        try {
            if (!canDelete) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            const response = await fetch(`/api/orders?id=${order.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления заявки');
            }

            router.push('/orders');
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка удаления заявки');
        } finally {
            setOperationLoading(false);
            setIsDeleteConfirmOpen(false);
        }
    };

    const openOrderDocumentPreview = (documentDefinition: OrderDocumentDefinition) => {
        if (!canPreviewOrderDocuments) {
            if (canExportWord) {
                const wordUrl = buildOrderDocumentUrl(documentDefinition.key, 'word', 'attachment');
                if (wordUrl) {
                    void downloadDocumentFile(wordUrl, `${buildOrderDocumentFileNameBase(documentDefinition)}.docx`)
                        .catch((downloadError) => {
                            setError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать Word-документ');
                        });
                }
                return;
            }
            setError('Нет доступа');
            return;
        }

        const fileNameBase = buildOrderDocumentFileNameBase(documentDefinition);
        const previewUrl = buildOrderDocumentUrl(documentDefinition.key, 'pdf', 'inline', fileNameBase);
        const wordUrl = buildOrderDocumentUrl(documentDefinition.key, 'word', 'attachment', fileNameBase);
        if (!previewUrl || !wordUrl) return;

        setDocumentPreviewZoom(1);
        setDocumentPreview({
            key: documentDefinition.key,
            title: 'Предпросмотр 1 документа',
            description: documentDefinition.title,
            fileNameBase,
            previewUrl,
            wordUrl,
        });
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

        window.open(documentPreviewPdfObjectUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDocumentPreviewDownload = (format: 'pdf' | 'word') => {
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
                buildOrderDocumentUrl(documentPreview.key, 'pdf', 'attachment'),
                `${documentPreview.fileNameBase}.pdf`
            )
                .catch((downloadError) => {
                    setDocumentPreviewError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать PDF');
                });
            return;
        }

        if (!canExportWord) {
            setDocumentPreviewError('Нет доступа');
            return;
        }

        void downloadDocumentFile(documentPreview.wordUrl, `${documentPreview.fileNameBase}.docx`)
            .catch((downloadError) => {
                setDocumentPreviewError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать Word-документ');
            });
    };

    if (loading) {
        return (
            <div className={styles.container}>

            </div>
        );
    }

    if (error || !order) {
        return (
            <div className={styles.container}>
                <Htag tag="h1">Ошибка</Htag>
                <div className={styles.card}>
                    <p style={{ color: '#f44336' }}>{error || 'Заявка не найдена'}</p>
                    <div className={styles.buttonGroup} style={{ marginTop: '16px' }}>
                        <Link
                            href="/orders"
                            className={`${styles.button} ${styles.buttonPrimary}`}
                        >
                            Назад к списку заявок
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.container} print-order-detail`}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Заявка #{order.id}</h1>
                        <p className={styles.subtitle}>Детали заявки и позиции</p>
                    </div>
                    <div className={styles.headerActions}>
                        <Link href="/orders" className={styles['no-print']} style={{ textDecoration: 'none' }}>
                            <Button variant="surface" color="gray" highContrast className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}>
                                <FiArrowLeft className={styles.icon} />
                                Назад
                            </Button>
                        </Link>
                        {canUseOrderDocumentCenter && availableOrderDocuments.length ? (
                            <DropdownMenu.Root open={isOrderPrintMenuOpen} onOpenChange={setIsOrderPrintMenuOpen}>
                                <DropdownMenu.Trigger>
                                    <Button
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles['no-print']}`}
                                    >
                                        <FiPrinter className={styles.icon} />
                                        Печать
                                        <FiChevronDown className={styles.icon} />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content align="end" sideOffset={8}>
                                    {availableOrderDocuments.map((documentDefinition) => (
                                        <DropdownMenu.Item
                                            key={documentDefinition.key}
                                            onSelect={() => {
                                                setIsOrderPrintMenuOpen(false);
                                                openOrderDocumentPreview(documentDefinition);
                                            }}
                                        >
                                            {documentDefinition.title}
                                        </DropdownMenu.Item>
                                    ))}
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                        ) : null}

                        {canEdit ? (
                            <Button
                                onClick={() => setIsEditModalOpen(true)}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles['no-print']}`}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </Button>
                        ) : null}

                        {canCreatePurchaseFromOrders && (workflow ? workflow.canCreatePurchase : activeMissingProducts.length > 0) ? (
                            <Button
                                onClick={openCreatePurchaseFromOrder}
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.primaryButton} ${styles['no-print']}`}
                            >
                                <FiShoppingCart className={styles.icon} />
                                Создать закупку
                            </Button>
                        ) : null}

                        {canAssembleOrder && workflow?.canAssemble ? (
                            <Button
                                onClick={handleAssembleOrder}
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.primaryButton} ${styles['no-print']}`}
                                disabled={operationLoading}
                            >
                                <FiPackage className={styles.icon} />
                                {workflow?.nextAssemblyActionLabel || 'Собрать заявку'}
                            </Button>
                        ) : null}

                        {canCreateShipment && workflow?.canCreateShipment ? (
                            <Button
                                onClick={() => setIsCreateShipmentOpen(true)}
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles['no-print']}`}
                            >
                                <FiTruck className={styles.icon} />
                                {workflow?.nextShipmentActionLabel || 'Создать отгрузку'}
                            </Button>
                        ) : null}

                        {canCompleteOrder && workflow?.canComplete && order.статус.toLowerCase() !== 'выполнена' ? (
                            <Button
                                onClick={() => handleStatusChange('выполнена')}
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.primaryButton} ${styles['no-print']}`}
                                disabled={operationLoading}
                            >
                                <FiCheckCircle className={styles.icon} />
                                Завершить заявку
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                variant="surface"
                                color="red"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} ${styles['no-print']}`}
                            >
                                <FiTrash2 className={styles.icon} />
                                Удалить
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.sectionHeader}>
                    <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                        Детали заявки
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Заявка от {formatDate(order.дата_создания)}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Информация о клиенте
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Клиент</Text>
                                    <Text as="div" size="2" weight="medium">{order.клиент_название || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Тип контрагента</Text>
                                    <Text as="div" size="2">{getClientContragentTypeLabel(order.клиент_тип)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Полное имя / название</Text>
                                    <Text as="div" size="2">{getOrderClientIdentity()}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Телефон</Text>
                                    <Text as="div" size="2">{order.клиент_телефон || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Email</Text>
                                    <Text as="div" size="2">{order.клиент_email || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Адрес</Text>
                                    <Text as="div" size="2">{order.клиент_адрес || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">ИНН / КПП</Text>
                                    <Text as="div" size="2">{`${formatTextValue(order.клиент_инн)} / ${formatTextValue(order.клиент_кпп)}`}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">ОГРН / ОГРНИП</Text>
                                    <Text as="div" size="2">{formatTextValue(order.клиент_огрн || order.клиент_огрнип)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">ОКПО</Text>
                                    <Text as="div" size="2">{formatTextValue(order.клиент_окпо)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Адрес регистрации</Text>
                                    <Text as="div" size="2">{formatTextValue(order.клиент_адрес_регистрации)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Адрес для документов</Text>
                                    <Text as="div" size="2">{formatTextValue(order.клиент_адрес_печати || order.клиент_адрес)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Комментарий</Text>
                                    <Text as="div" size="2">{formatTextValue(order.клиент_комментарий)}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Информация о заявке
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Flex direction="column" align="start" style={{ flexDirection: 'column', alignItems: 'flex-start', }}>
                                    <Text as="div" size="1" color="gray">Статус</Text>
                                    <Badge
                                        color={order.статус.toLowerCase() === 'отменена' ? 'red' : order.статус.toLowerCase() === 'в обработке' || order.статус.toLowerCase() === 'досборка' ? 'amber' : order.статус.toLowerCase() === 'отгружена' || order.статус.toLowerCase() === 'выполнена' || order.статус.toLowerCase() === 'доотгрузка' ? 'green' : 'blue'}
                                        variant="soft"
                                        highContrast
                                        className={`${styles.statusPill} ${order.статус.toLowerCase() === 'отменена'
                                            ? styles.statusPillRed
                                            : order.статус.toLowerCase() === 'в обработке' || order.статус.toLowerCase() === 'подтверждена' || order.статус.toLowerCase() === 'досборка'
                                                ? styles.statusPillOrange
                                                : order.статус.toLowerCase() === 'отгружена' || order.статус.toLowerCase() === 'выполнена' || order.статус.toLowerCase() === 'доотгрузка'
                                                    ? styles.statusPillGreen
                                                    : styles.statusPillBlue
                                            }`}
                                    >
                                        {order.статус.toUpperCase()}
                                    </Badge>
                                </Flex>
                                <Box>
                                    <Text as="div" size="1" color="gray">Режим исполнения</Text>
                                    <Text as="div" size="2">{getOrderExecutionModeLabel(order.режим_исполнения)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Менеджер</Text>
                                    <Text as="div" size="2">{order.менеджер_фио || 'Не назначен'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Адрес доставки</Text>
                                    <Text as="div" size="2">{order.адрес_доставки || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата создания</Text>
                                    <Text as="div" size="2">{formatDate(order.дата_создания)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Сумма товаров</Text>
                                    <Text as="div" size="2">{formatCurrency(orderItemsTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Сумма закупок</Text>
                                    <Text as="div" size="2">{formatCurrency(purchasesTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Доставка закупок</Text>
                                    <Text as="div" size="2">{formatCurrency(purchaseDeliveryTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Доставка отгрузок</Text>
                                    <Text as="div" size="2">{formatCurrency(shipmentDeliveryTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Логистика всего</Text>
                                    <Text as="div" size="2">{formatCurrency(logisticsTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Итого по заявке</Text>
                                    <Text as="div" size="2" weight="medium">{formatCurrency(orderGrandTotal)}</Text>
                                </Box>
                                {order.дата_выполнения && (
                                    <Box>
                                        <Text as="div" size="1" color="gray">Дата выполнения</Text>
                                        <Text as="div" size="2">{formatDate(order.дата_выполнения)}</Text>
                                    </Box>
                                )}
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>

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
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleUploadFile(f);
                                    }}
                                />
                                {canAttachmentsUpload ? (
                                    <Button
                                        type="button"
                                        onClick={handlePickFile}
                                        disabled={uploadLoading}
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles['no-print']}`}
                                    >
                                        <FiUploadCloud className={styles.icon} />
                                        {uploadLoading ? 'Загрузка…' : 'Загрузить файл'}
                                    </Button>
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
                            <Box style={{ paddingLeft: 16, paddingRight: 16 }}>
                                <Table.Root variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>Файл</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Размер</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Действия</Table.ColumnHeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {attachments.map((a) => (
                                            <Table.Row key={a.id}>
                                                <Table.Cell>
                                                    <Flex align="center" gap="2">
                                                        <FiPaperclip />
                                                        <Text as="div" size="2" weight="medium">
                                                            {a.filename}
                                                        </Text>
                                                    </Flex>
                                                    <Text as="div" size="1" color="gray">
                                                        {a.mime_type}
                                                    </Text>
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatBytes(a.size_bytes)}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    <Flex justify="end" gap="2" wrap="wrap">
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="gray"
                                                            highContrast
                                                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles['no-print']}`}
                                                            onClick={() => openPreview(a)}
                                                        >
                                                            <FiFile className={styles.icon} />
                                                            Открыть
                                                        </Button>
                                                        <a
                                                            href={`/api/attachments/${encodeURIComponent(a.id)}/download`}
                                                            style={{ textDecoration: 'none' }}
                                                            className={styles['no-print']}
                                                        >
                                                            <Button
                                                                type="button"
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                            >
                                                                <FiDownload className={styles.icon} />
                                                                Скачать
                                                            </Button>
                                                        </a>
                                                        {canAttachmentsDelete ? (
                                                            <Button
                                                                type="button"
                                                                variant="surface"
                                                                color="red"
                                                                highContrast
                                                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} ${styles['no-print']}`}
                                                                onClick={() => void handleDeleteAttachment(a.id)}
                                                            >
                                                                <FiTrash2 className={styles.icon} />
                                                                Удалить
                                                            </Button>
                                                        ) : null}
                                                    </Flex>
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            </Box>
                        )}
                    </div>
                ) : null}

                <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <Dialog.Content style={{ maxWidth: 980, width: '95vw' }}>
                        <Dialog.Title>{previewAttachment?.filename || 'Документ'}</Dialog.Title>
                        <Dialog.Description>
                            {previewAttachment?.mime_type || ''}
                        </Dialog.Description>

                        <Box style={{ marginTop: 12 }}>
                            {previewAttachment && canPreviewInline(previewAttachment) ? (
                                previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                    <div style={{ position: 'relative', width: '100%', height: '75vh' }}>
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
                                        style={{ width: '100%', height: '75vh', border: '1px solid #eee', borderRadius: 8 }}
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
                                    <Button variant="surface" color="gray" highContrast>
                                        <FiDownload className={styles.icon} />
                                        Скачать
                                    </Button>
                                </a>
                            ) : null}
                            <Dialog.Close>
                                <Button variant="surface" color="gray" highContrast>
                                    Закрыть
                                </Button>
                            </Dialog.Close>
                        </Flex>
                    </Dialog.Content>
                </Dialog.Root>

                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Позиции заявки
                        </Text>

                    </div>

                    <div className={styles.tableWrapper}>
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Обеспечение</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Ед.изм</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Количество</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Цена, ₽</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Сумма без НДС, ₽</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>НДС</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Сумма НДС, ₽</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Всего, ₽</Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {order.позиции.map((position) => {
                                    const vatSummary = getVatSummary(position);

                                    return (
                                        <Table.Row key={position.id}>
                                            <Table.Cell>
                                                <div className={styles.productName}>{position.товар_название}</div>
                                                <div className={styles.productMeta}>
                                                    {position.товар_артикул} • {position.товар_категория || 'Без категории'}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {isDirectOrder
                                                    ? getOrderSupplyModeLabel(position.способ_обеспечения || 'purchase')
                                                    : getOrderSupplyModeLabel('auto')}
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>
                                                {position.товар_единица_измерения || 'шт'}
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>
                                                {position.количество}
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatCurrency(position.цена)}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.net)}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>{vatSummary.label}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.tax)}</Table.Cell>
                                            <Table.Cell className={styles.textRight} style={{ fontWeight: 600 }}>
                                                {formatCurrency(vatSummary.total)}
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                                <Table.Row className={styles.totalRow as any}>
                                    <Table.Cell className={styles.textRight} colSpan={8}>
                                        Сумма товаров:
                                    </Table.Cell>
                                    <Table.Cell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                        {formatCurrency(orderItemsTotal)}
                                    </Table.Cell>
                                </Table.Row>
                                <Table.Row className={styles.totalRow as any}>
                                    <Table.Cell className={styles.textRight} colSpan={8}>
                                        Логистика:
                                    </Table.Cell>
                                    <Table.Cell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                        {formatCurrency(Number(order?.сумма_логистики || 0))}
                                    </Table.Cell>
                                </Table.Row>
                                <Table.Row className={styles.totalRow as any}>
                                    <Table.Cell className={styles.textRight} colSpan={8}>
                                        Итого по заявке:
                                    </Table.Cell>
                                    <Table.Cell className={styles.textRight} style={{ fontWeight: 700, textAlign: 'right' }}>
                                        {formatCurrency(orderGrandTotal)}
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        </Table.Root>
                    </div>
                </div>

                {/* Missing Products Section */}
                {!isDirectOrder && order.недостающие_товары && order.недостающие_товары.length > 0 && (
                    <div className={styles.missingProducts}>
                        <div className={styles.sectionHeaderRow}>
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle} style={{ color: '#dc3545' }}>
                                Недостающие товары
                            </Text>
                        </div>

                        {activeMissingProducts.length > 0 ? (
                            <div className={styles.tableWrapper}>
                                <Table.Root variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Необходимо</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Недостает</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Статус</Table.ColumnHeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {activeMissingProducts.map((missing) => (
                                            <Table.Row key={missing.id}>
                                                <Table.Cell>
                                                    <div className={styles.productName}>
                                                        {missing.товар_название || `Товар #${missing.товар_id}`}
                                                    </div>
                                                    {missing.товар_артикул ? (
                                                        <div className={styles.productMeta}>
                                                            {missing.товар_артикул}
                                                        </div>
                                                    ) : null}
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    {missing.необходимое_количество}
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    {missing.недостающее_количество}
                                                </Table.Cell>
                                                <Table.Cell style={{ textAlign: 'right' }}>
                                                    <Badge
                                                        variant="soft"
                                                        highContrast
                                                        className={`${styles.statusPill} ${missing.статус === 'получено'
                                                            ? styles.statusPillGreen
                                                            : missing.статус === 'в обработке'
                                                                ? styles.statusPillBlue
                                                                : styles.statusPillOrange
                                                            }`}
                                                    >
                                                        {getMissingStatusText(missing.статус)}
                                                    </Badge>
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            </div>
                        ) : (
                            <Text as="div" size="2" color="gray" style={{ paddingLeft: 16 }}>Активных недостающих товаров по этой заявке сейчас нет.</Text>
                        )}

                        {closedMissingProducts.length > 0 ? (
                            <>
                                <div className={styles.sectionHeaderRow} style={{ marginTop: '20px' }}>
                                    <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                        Закрытые недостачи
                                    </Text>
                                </div>

                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell className={styles.textRight}>Необходимо</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell className={styles.textRight}>Недостает</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Статус</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {closedMissingProducts.map((missing) => (
                                                <Table.Row key={`closed-${missing.id}`}>
                                                    <Table.Cell>
                                                        <div className={styles.productName}>
                                                            {missing.товар_название || `Товар #${missing.товар_id}`}
                                                        </div>
                                                        {missing.товар_артикул ? (
                                                            <div className={styles.productMeta}>
                                                                {missing.товар_артикул}
                                                            </div>
                                                        ) : null}
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.textRight}>
                                                        {missing.необходимое_количество}
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.textRight}>
                                                        {missing.недостающее_количество}
                                                    </Table.Cell>
                                                    <Table.Cell style={{ textAlign: 'right' }}>
                                                        <Badge
                                                            variant="soft"
                                                            highContrast
                                                            className={`${styles.statusPill} ${styles.statusPillGreen}`}
                                                        >
                                                            {getMissingStatusText(missing.статус)}
                                                        </Badge>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </>
                        ) : null}

                        {canManageMissingProducts ? (
                            <Flex className={styles.actions} justify="end">
                                <Link href={`/missing-products?orderId=${order.id}`} className={styles['no-print']} style={{ textDecoration: 'none' }}>
                                    <Button variant="soft" color="gray" highContrast className={styles.surfaceButton}>
                                        Перейти к управлению недостающими товарами
                                    </Button>
                                </Link>
                            </Flex>
                        ) : null}
                    </div>
                )}
            </div>

            {documentPreview ? (
                <div className={styles.previewScreen}>
                    <div className={styles.previewBackdrop} />
                    <div className={styles.previewPanel} role="dialog" aria-modal="true" aria-label={documentPreview.title}>
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
                                onClick={() => setDocumentPreview(null)}
                                aria-label="Закрыть предпросмотр"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.previewToolbar}>
                            {canPrint ? (
                                <Button
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    onClick={handlePrintDocumentPreview}
                                    disabled={!documentPreviewPdfObjectUrl}
                                >
                                    <FiPrinter className={styles.icon} />
                                    Напечатать
                                </Button>
                            ) : null}
                            {canExportPdf ? (
                                <Button
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    onClick={() => handleDocumentPreviewDownload('pdf')}
                                >
                                    <BsFillFileEarmarkPdfFill className={`${styles.icon} ${styles.pdfIcon}`} />
                                    PDF
                                </Button>
                            ) : null}
                            {canExportWord ? (
                                <Button
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    onClick={() => handleDocumentPreviewDownload('word')}
                                >
                                    <BsFillFileEarmarkWordFill className={`${styles.icon} ${styles.wordIcon}`} />
                                    Word
                                </Button>
                            ) : null}
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                onClick={() => window.open(documentPreview.previewUrl, '_blank', 'noopener,noreferrer')}
                                disabled={!documentPreview.previewUrl}
                            >
                                <FiExternalLink className={styles.icon} />
                                Открыть
                            </Button>
                            <div className={styles.previewZoomControls}>
                                <button
                                    type="button"
                                    className={styles.previewZoomButton}
                                    onClick={() => updateDocumentPreviewZoom(documentPreviewZoom - PREVIEW_ZOOM_STEP)}
                                    disabled={documentPreviewLoading || documentPreviewZoom <= PREVIEW_ZOOM_MIN}
                                    aria-label="Уменьшить масштаб"
                                >
                                    <FiMinus />
                                </button>
                                <button
                                    type="button"
                                    className={styles.previewZoomValue}
                                    onClick={() => updateDocumentPreviewZoom(1)}
                                    disabled={documentPreviewLoading || documentPreviewZoom === 1}
                                    aria-label="Сбросить масштаб"
                                >
                                    {Math.round(documentPreviewZoom * 100)}%
                                </button>
                                <button
                                    type="button"
                                    className={styles.previewZoomButton}
                                    onClick={() => updateDocumentPreviewZoom(documentPreviewZoom + PREVIEW_ZOOM_STEP)}
                                    disabled={documentPreviewLoading || documentPreviewZoom >= PREVIEW_ZOOM_MAX}
                                    aria-label="Увеличить масштаб"
                                >
                                    <FiPlus />
                                </button>
                            </div>
                        </div>

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

            <CreatePurchaseModal
                key={`order-detail-purchase-${createPurchaseModalKey}`}
                isOpen={isCreatePurchaseOpen}
                onClose={() => {
                    setIsCreatePurchaseOpen(false);
                    setCreatePurchaseOrderPositions([]);
                }}
                onPurchaseCreated={async () => {
                    setIsCreatePurchaseOpen(false);
                    setCreatePurchaseOrderPositions([]);
                    await fetchOrderDetail();
                }}
                поставщик_id={0}
                поставщик_название=""
                заявка_id={order?.id}
                lockOrderId
                initialOrderPositions={createPurchaseOrderPositions}
            />

            <CreateShipmentModal
                isOpen={isCreateShipmentOpen}
                onClose={() => setIsCreateShipmentOpen(false)}
                onCreated={async () => {
                    setIsCreateShipmentOpen(false);
                    await fetchOrderDetail();
                }}
                initialOrderId={order?.id ?? null}
                lockOrderId
            />

            <DeleteConfirmation
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeleteOrder}
                order={order as any}
                loading={operationLoading}
            />

            <EditOrderModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                order={order}
                onSubmit={handleEditOrder}
            />
        </div >
    );
}

export default withLayout(OrderDetailPage);
