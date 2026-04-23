import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import styles from './ShipmentDetail.module.css';
import { BsFillFileEarmarkExcelFill, BsFillFileEarmarkPdfFill } from 'react-icons/bs';
import {
    FiTruck,
    FiEye,
    FiArrowLeft,
    FiChevronDown,
    FiDownload,
    FiEdit2,
    FiExternalLink,
    FiFile,
    FiPaperclip,
    FiPrinter,
    FiSave,
    FiTrash2,
    FiUploadCloud,
    FiX,
} from 'react-icons/fi';
import { DocumentPreviewZoomControls } from '../../components/DocumentPreviewControls/DocumentPreviewControls';
import { EntityActionButton } from '../../components/EntityActionButton/EntityActionButton';
import { EntityStatusBadge } from '../../components/EntityStatusBadge/EntityStatusBadge';
import { EntityTableSurface, entityTableClassName } from '../../components/EntityDataTable/EntityDataTable';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import { ShipmentEditorModal } from '../../components/modals/ShipmentEditorModal/ShipmentEditorModal';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '../../components/ui/dialog';
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
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption } from '../../lib/vat';
import { getShipmentDeliveryLabel } from '../../lib/logisticsDeliveryLabels';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { fetchGeneratedBlob, saveGeneratedAttachments, type GeneratedAttachmentFile } from '../../utils/generatedAttachments';
import { cn } from '../../lib/utils';
import {
    getAvailableShipmentDocumentDefinitions,
    type ShipmentDocumentDefinition,
    type ShipmentDocumentKey,
} from '../../lib/shipmentDocumentDefinitions';
import type { AttachmentItem } from '../../types/attachments';
import type { DocumentPreviewPageImage, DocumentPreviewStateBase, PdfJsModule } from '../../types/document-preview';

interface ShipmentDetail {
    id: number;
    заявка_id: number | null;
    использовать_доставку?: boolean;
    без_учета_склада?: boolean;
    транспорт_id: number | null;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер?: string | number;
    транспорт_название?: string;
}

interface Order {
    id: number;
    клиент_название?: string;
}

interface Transport {
    id: number;
    название: string;
}

interface Product {
    id: number;
    название: string;
    артикул: string;
    единица_измерения: string;
    цена_продажи: number;
}

interface WarehouseStockItem {
    товар_id: number;
    количество: number;
}

interface OrderPosition {
    id: number;
    товар_id: number;
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
    товар_тип_номенклатуры?: string;
    товар_единица_измерения: string;
}

interface ManualShipmentPosition {
    id?: number;
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
}

type ShipmentDocumentPreviewState = DocumentPreviewStateBase & {
    key: ShipmentDocumentKey;
    excelUrl: string;
};

const PREVIEW_ZOOM_MIN = 0.6;
const PREVIEW_ZOOM_MAX = 2;
const formatDateRu = (value: Date): string => {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}.${month}.${year}`;
};

const createEmptyManualShipmentPosition = (): ManualShipmentPosition => ({
    товар_id: 0,
    количество: 1,
    цена: 0,
    ндс_id: DEFAULT_VAT_RATE_ID,
});

function InfoItem({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className={styles.infoItem}>
            <div className={styles.infoLabel}>{label}</div>
            <div className={styles.infoValue}>{value}</div>
        </div>
    );
}

function ShipmentDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;

    const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transports, setTransports] = useState<Transport[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([]);
    const [positions, setPositions] = useState<OrderPosition[]>([]);
    const [positionsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [operationLoading, setOperationLoading] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
    const [documentPreview, setDocumentPreview] = useState<ShipmentDocumentPreviewState | null>(null);
    const [documentPreviewPages, setDocumentPreviewPages] = useState<DocumentPreviewPageImage[]>([]);
    const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
    const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
    const [documentPreviewSaveMessage, setDocumentPreviewSaveMessage] = useState<string | null>(null);
    const [documentPreviewSaving, setDocumentPreviewSaving] = useState(false);
    const [documentPreviewPdfObjectUrl, setDocumentPreviewPdfObjectUrl] = useState<string | null>(null);
    const [documentPreviewZoom, setDocumentPreviewZoom] = useState(1);
    const [isShipmentPrintMenuOpen, setIsShipmentPrintMenuOpen] = useState(false);
    const documentPreviewPrintFrameRef = useRef<HTMLIFrameElement | null>(null);
    const documentPreviewStageRef = useRef<HTMLDivElement | null>(null);
    const documentPreviewPdfBytesRef = useRef<Uint8Array | null>(null);
    const documentPreviewPdfSourceUrlRef = useRef<string | null>(null);
    const [formData, setFormData] = useState({
        заявка_id: 0,
        использовать_доставку: true,
        без_учета_склада: false,
        транспорт_id: 0,
        статус: 'в пути',
        номер_отслеживания: '',
        стоимость_доставки: 0,
    });
    const [editPreviewPositions, setEditPreviewPositions] = useState<OrderPosition[]>([]);
    const [editPreviewLoading, setEditPreviewLoading] = useState(false);
    const [manualPositions, setManualPositions] = useState<ManualShipmentPosition[]>([createEmptyManualShipmentPosition()]);
    const [manualPositionsLoading, setManualPositionsLoading] = useState(false);

    const canView = Boolean(user?.permissions?.includes('shipments.view'));
    const canEdit = Boolean(user?.permissions?.includes('shipments.edit'));
    const canDelete = Boolean(user?.permissions?.includes('shipments.delete'));

    const canOrdersView = Boolean(user?.permissions?.includes('orders.view'));
    const canOrdersList = Boolean(user?.permissions?.includes('orders.list'));

    const canShipmentOrderView = Boolean(user?.permissions?.includes('shipments.order.view'));
    const canShipmentTrack = Boolean(user?.permissions?.includes('shipments.track'));
    const canShipmentPrint = Boolean(user?.permissions?.includes('shipments.print'));
    const canShipmentExportExcel = Boolean(user?.permissions?.includes('shipments.export.excel'));

    const canShipmentsAttachmentsView = Boolean(user?.permissions?.includes('shipments.attachments.view'));
    const canShipmentsAttachmentsUpload = Boolean(user?.permissions?.includes('shipments.attachments.upload'));
    const canShipmentsAttachmentsDelete = Boolean(user?.permissions?.includes('shipments.attachments.delete'));

    const canShipmentsPositionsView = Boolean(user?.permissions?.includes('shipments.positions.view'));

    const canGoToOrder = canOrdersView && canShipmentOrderView;
    const canPreviewShipmentDocuments = canShipmentPrint;
    const canUseShipmentDocumentCenter = canPreviewShipmentDocuments || canShipmentExportExcel;

    const availableShipmentDocuments = useMemo<ShipmentDocumentDefinition[]>(() => {
        if (!shipment) return [];
        return getAvailableShipmentDocumentDefinitions({
            nomenclatureTypes: (positions || []).map((position) => position.товар_тип_номенклатуры || ''),
            usesDelivery: shipment.использовать_доставку !== false,
        }).filter((documentDefinition) => {
            const canPreviewDocument = documentDefinition.outputFormats.includes('pdf') && canPreviewShipmentDocuments;
            const canDownloadExcel = documentDefinition.outputFormats.includes('excel') && canShipmentExportExcel;
            return canPreviewDocument || canDownloadExcel;
        });
    }, [positions, shipment, canPreviewShipmentDocuments, canShipmentExportExcel]);

    const buildShipmentDocumentUrl = useCallback(
        (
            documentKey: ShipmentDocumentKey,
            format: 'pdf' | 'excel',
            disposition: 'inline' | 'attachment',
            fileNameBase?: string
        ) => {
            const shipmentId = Number(shipment?.id);
            if (!Number.isInteger(shipmentId) || shipmentId <= 0) return '';
            const params = new URLSearchParams({ format, disposition });
            const extension = format === 'excel' ? 'xlsx' : 'pdf';
            const readableTail = fileNameBase
                ? `/${encodeURIComponent(`${fileNameBase}.${extension}`)}`
                : '';
            return `/api/shipments/${shipmentId}/documents/${documentKey}${readableTail}?${params.toString()}`;
        },
        [shipment?.id]
    );

    const buildShipmentDocumentFileNameBase = useCallback((documentDefinition: ShipmentDocumentDefinition) => {
        const shipmentId = Number(shipment?.id);
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
            return documentDefinition.title;
        }

        const shipmentDate = shipment?.дата_отгрузки ? new Date(shipment.дата_отгрузки) : new Date();
        return `${documentDefinition.title} № ${shipmentId} от ${formatDateRu(shipmentDate)}`;
    }, [shipment?.id, shipment?.дата_отгрузки]);

    const formatDateTime = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const syncFormWithShipment = useCallback((s: ShipmentDetail) => {
        setFormData({
            заявка_id: Number(s.заявка_id) || 0,
            использовать_доставку: s.использовать_доставку !== false,
            без_учета_склада: s.без_учета_склада === true,
            транспорт_id: Number(s.транспорт_id) || 0,
            статус: (s.статус || 'в пути').toLowerCase(),
            номер_отслеживания: s.номер_отслеживания || '',
            стоимость_доставки: Number(s.стоимость_доставки) || 0,
        });
    }, []);

    const getTransportText = useCallback((item: ShipmentDetail) => {
        if (item.использовать_доставку === false) return getShipmentDeliveryLabel(false);
        return item.транспорт_название || (item.транспорт_id ? `ТК #${item.транспорт_id}` : 'Не указана');
    }, []);

    const getCostText = useCallback((item: ShipmentDetail) => {
        if (item.использовать_доставку === false) return 'Не используется';
        return item.стоимость_доставки == null ? 'Не указана' : formatCurrency(item.стоимость_доставки);
    }, []);

    const fetchEditPreviewPositions = useCallback(async (orderId: number, shipmentId?: number | null) => {
        if (!orderId || !canOrdersView || !canShipmentsPositionsView) {
            setEditPreviewPositions([]);
            return;
        }

        try {
            setEditPreviewLoading(true);
            const endpoint = shipmentId
                ? `/api/shipments/${encodeURIComponent(String(shipmentId))}`
                : `/api/orders/${encodeURIComponent(String(orderId))}/shipment-draft`;
            const res = await fetch(endpoint);
            if (!res.ok) {
                setEditPreviewPositions([]);
                return;
            }

            const data = await res.json();
            const positions = shipmentId
                ? (Array.isArray(data?.позиции) ? data.позиции : [])
                : (Array.isArray(data) ? data : []);
            setEditPreviewPositions(positions);
        } catch {
            setEditPreviewPositions([]);
        } finally {
            setEditPreviewLoading(false);
        }
    }, [canOrdersView, canShipmentsPositionsView]);

    const fetchProducts = useCallback(async () => {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const data = await response.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (productsError) {
            console.error('Error fetching products for shipment editor:', productsError);
            setProducts([]);
        }
    }, []);

    const fetchWarehouseStock = useCallback(async () => {
        try {
            const response = await fetch('/api/warehouse');
            if (!response.ok) {
                throw new Error('Ошибка загрузки остатков склада');
            }

            const data = await response.json();
            setWarehouseStock(Array.isArray(data?.warehouse) ? data.warehouse : []);
        } catch (warehouseError) {
            console.error('Error fetching warehouse stock for shipment editor:', warehouseError);
            setWarehouseStock([]);
        }
    }, []);

    const loadDirectShipmentPositions = useCallback(async (shipmentId: number) => {
        try {
            setManualPositionsLoading(true);
            const response = await fetch(`/api/shipments/${encodeURIComponent(String(shipmentId))}`);
            if (!response.ok) {
                throw new Error('Не удалось загрузить состав отгрузки');
            }

            const data = await response.json();
            const loadedPositions = Array.isArray(data?.позиции)
                ? data.позиции.map((position: Record<string, unknown>) => ({
                    id: Number(position?.id) || undefined,
                    товар_id: Number(position?.товар_id) || 0,
                    количество: Number(position?.количество) || 1,
                    цена: Number(position?.цена) || 0,
                    ндс_id: Number(position?.ндс_id) || DEFAULT_VAT_RATE_ID,
                }))
                : [];

            setManualPositions(loadedPositions.length > 0 ? loadedPositions : [createEmptyManualShipmentPosition()]);
        } catch (shipmentPositionsError) {
            console.error('Error loading standalone shipment positions:', shipmentPositionsError);
            setManualPositions([createEmptyManualShipmentPosition()]);
            setError(shipmentPositionsError instanceof Error ? shipmentPositionsError.message : 'Не удалось загрузить состав отгрузки');
        } finally {
            setManualPositionsLoading(false);
        }
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
        }).format(amount);
    };

    useEffect(() => {
        if (!isEditModalOpen) {
            setEditPreviewPositions([]);
            setEditPreviewLoading(false);
            setManualPositionsLoading(false);
            return;
        }

        fetchProducts();
        fetchWarehouseStock();

        if (!formData.заявка_id) {
            setEditPreviewPositions([]);
            if (shipment?.id) {
                loadDirectShipmentPositions(shipment.id);
            } else {
                setManualPositions([createEmptyManualShipmentPosition()]);
            }
            return;
        }

        setManualPositions([createEmptyManualShipmentPosition()]);
        const currentShipmentId = shipment?.заявка_id === formData.заявка_id ? shipment?.id : null;
        fetchEditPreviewPositions(formData.заявка_id, currentShipmentId);
    }, [
        fetchEditPreviewPositions,
        fetchProducts,
        fetchWarehouseStock,
        formData.заявка_id,
        isEditModalOpen,
        loadDirectShipmentPositions,
        shipment?.id,
        shipment?.заявка_id,
    ]);

    const editPreviewTotal = editPreviewPositions.reduce((sum, position) => {
        if (typeof position.сумма_всего === 'number') return sum + position.сумма_всего;
        return sum + calculateVatAmountsFromLine(position.количество, position.цена, getVatRateOption(position.ндс_id).rate).total;
    }, 0);

    const getProductSalePrice = useCallback((product?: Product | null) => Number(product?.цена_продажи ?? 0), []);

    const handleManualPositionChange = useCallback((index: number, field: keyof ManualShipmentPosition, value: string | number) => {
        setManualPositions((prev) => {
            const next = [...prev];
            const parsedValue = typeof value === 'string' ? (Number(value) || 0) : value;
            next[index] = {
                ...next[index],
                [field]: parsedValue,
            };

            if (field === 'товар_id') {
                const product = products.find((item) => item.id === Number(parsedValue));
                const price = getProductSalePrice(product);
                if (price > 0) {
                    next[index].цена = price;
                }
                if (!next[index].ндс_id) {
                    next[index].ндс_id = DEFAULT_VAT_RATE_ID;
                }
            }

            return next;
        });
    }, [getProductSalePrice, products]);

    const addManualPosition = useCallback(() => {
        setManualPositions((prev) => [...prev, createEmptyManualShipmentPosition()]);
    }, []);

    const removeManualPosition = useCallback((index: number) => {
        setManualPositions((prev) => (
            prev.length > 1 ? prev.filter((_, currentIndex) => currentIndex !== index) : prev
        ));
    }, []);

    const orderSelectOptions = useMemo(
        () => [
            { value: '', label: 'Без заявки' },
            ...orders.map((order) => ({
                value: String(order.id),
                label: `Заявка #${order.id}`,
            })),
        ],
        [orders]
    );

    const transportSelectOptions = useMemo(
        () => transports.map((transport) => ({
            value: String(transport.id),
            label: transport.название || `ТК #${transport.id}`,
        })),
        [transports]
    );

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        for (const product of products) {
            map.set(product.id, product);
        }
        return map;
    }, [products]);

    const warehouseStockByProductId = useMemo(() => {
        const map = new Map<number, number>();
        for (const item of warehouseStock) {
            map.set(Number(item.товар_id), Number(item.количество) || 0);
        }
        return map;
    }, [warehouseStock]);

    const selectedManualProductIds = useMemo(() => (
        new Set(
            manualPositions
                .map((position) => Number(position.товар_id) || 0)
                .filter((productId) => productId > 0)
        )
    ), [manualPositions]);

    const availableManualProducts = useMemo(() => {
        if (formData.без_учета_склада) return products;
        return products.filter((product) => (
            (warehouseStockByProductId.get(product.id) || 0) > 0
            || selectedManualProductIds.has(product.id)
        ));
    }, [formData.без_учета_склада, products, selectedManualProductIds, warehouseStockByProductId]);

    const normalizedManualPositions = useMemo(() => (
        manualPositions.filter((position) => (
            Number(position.товар_id) > 0
            && Number(position.количество) > 0
            && Number(position.цена) > 0
        ))
    ), [manualPositions]);

    const manualPositionsTotal = useMemo(() => (
        normalizedManualPositions.reduce((sum, position) => (
            sum + calculateVatAmountsFromLine(
                position.количество,
                position.цена,
                getVatRateOption(position.ндс_id).rate
            ).total
        ), 0)
    ), [normalizedManualPositions]);

    const shipmentDeliveryAmount = useMemo(() => (
        formData.использовать_доставку ? Number(formData.стоимость_доставки || 0) : 0
    ), [formData.использовать_доставку, formData.стоимость_доставки]);

    const canSubmitShipment = useMemo(() => {
        if (operationLoading || manualPositionsLoading) return false;
        if (formData.использовать_доставку && formData.транспорт_id <= 0) return false;
        if (formData.заявка_id > 0) return true;
        return normalizedManualPositions.length > 0;
    }, [
        formData.использовать_доставку,
        formData.транспорт_id,
        formData.заявка_id,
        manualPositionsLoading,
        normalizedManualPositions.length,
        operationLoading,
    ]);

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
        if (!canPreviewInline(a)) {
            window.open(`/api/attachments/${encodeURIComponent(a.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const fetchAttachments = useCallback(async (shipmentId: number) => {
        if (!canShipmentsAttachmentsView) return;
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
            setAttachments([]);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=shipment&entity_id=${encodeURIComponent(String(shipmentId))}`);
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
    }, [canShipmentsAttachmentsView]);

    const handleUploadAttachment = useCallback(async (file: File) => {
        if (!canShipmentsAttachmentsUpload) return;
        const shipmentId = Number(shipment?.id);
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) return;

        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'shipment');
            form.append('entity_id', String(shipmentId));

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(shipmentId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [canShipmentsAttachmentsUpload, fetchAttachments, shipment?.id]);

    const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
        if (!canShipmentsAttachmentsDelete) return;
        const shipmentId = Number(shipment?.id);
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) return;

        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=shipment&entity_id=${encodeURIComponent(String(shipmentId))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(shipmentId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    }, [canShipmentsAttachmentsDelete, fetchAttachments, shipment?.id]);

    const getStatusText = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'в пути':
                return 'В пути';
            case 'получено':
                return 'Получено';
            case 'доставлено':
                return 'Доставлено';
            case 'отменено':
                return 'Отменено';
            default:
                return status || '-';
        }
    };

    const getStatusTone = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'в пути':
                return 'warning' as const;
            case 'получено':
            case 'доставлено':
                return 'success' as const;
            case 'отменено':
                return 'danger' as const;
            default:
                return 'muted' as const;
        }
    };

    const getTrackingUrl = useCallback((s: ShipmentDetail): string | null => {
        const track = (s.номер_отслеживания || '').trim();
        if (!track) return null;
        const carrierName = (s.транспорт_название || '').toLowerCase();
        if (carrierName.includes('деловые линии') || carrierName.includes('деловые') || carrierName.includes('дл')) {
            return `https://www.dellin.ru/tracker/orders/${encodeURIComponent(track)}/`;
        }
        if (carrierName.includes('сдэк') || carrierName.includes('cdek')) {
            return `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(track)}`;
        }
        return null;
    }, []);

    const openShipmentDocumentPreview = (documentDefinition: ShipmentDocumentDefinition) => {
        const fileNameBase = buildShipmentDocumentFileNameBase(documentDefinition);

        if (!canPreviewShipmentDocuments) {
            if (canShipmentExportExcel) {
                const excelUrl = buildShipmentDocumentUrl(documentDefinition.key, 'excel', 'attachment', fileNameBase);
                if (excelUrl) {
                    void downloadDocumentFile(excelUrl, `${fileNameBase}.xlsx`)
                        .catch((downloadError) => {
                            setError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать Excel-документ');
                        });
                }
                return;
            }
            setError('Нет доступа');
            return;
        }

        const previewUrl = buildShipmentDocumentUrl(documentDefinition.key, 'pdf', 'inline', fileNameBase);
        const excelUrl = buildShipmentDocumentUrl(documentDefinition.key, 'excel', 'attachment', fileNameBase);
        if (!previewUrl || !excelUrl) return;

        setDocumentPreviewZoom(1);
        setDocumentPreview({
            key: documentDefinition.key,
            title: 'Предпросмотр документа',
            description: documentDefinition.title,
            fileNameBase,
            previewUrl,
            excelUrl,
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

    const handleDocumentPreviewDownload = (format: 'pdf' | 'excel') => {
        if (!documentPreview) return;

        if (format === 'pdf') {
            if (!canShipmentPrint) {
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
                buildShipmentDocumentUrl(documentPreview.key, 'pdf', 'attachment', documentPreview.fileNameBase),
                `${documentPreview.fileNameBase}.pdf`
            )
                .catch((downloadError) => {
                    setDocumentPreviewError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать PDF');
                });
            return;
        }

        if (!canShipmentExportExcel) {
            setDocumentPreviewError('Нет доступа');
            return;
        }

        void downloadDocumentFile(documentPreview.excelUrl, `${documentPreview.fileNameBase}.xlsx`)
            .catch((downloadError) => {
                setDocumentPreviewError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать Excel-документ');
            });
    };

    const handleDocumentPreviewSave = async () => {
        if (!documentPreview || !shipment?.id) return;

        if (!canShipmentsAttachmentsUpload) {
            setDocumentPreviewError('Нет доступа на сохранение документов отгрузки');
            return;
        }

        try {
            setDocumentPreviewSaving(true);
            setDocumentPreviewError(null);
            setDocumentPreviewSaveMessage(null);

            const files: GeneratedAttachmentFile[] = [];

            if (canShipmentPrint) {
                const sourcePdfBytes = documentPreviewPdfBytesRef.current;
                let pdfBlob: Blob;

                if (sourcePdfBytes) {
                    const pdfArrayBuffer = new ArrayBuffer(sourcePdfBytes.byteLength);
                    new Uint8Array(pdfArrayBuffer).set(sourcePdfBytes);
                    pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
                } else {
                    pdfBlob = await fetchGeneratedBlob(
                        buildShipmentDocumentUrl(documentPreview.key, 'pdf', 'attachment', documentPreview.fileNameBase)
                    );
                }

                files.push({
                    blob: pdfBlob,
                    fileName: `${documentPreview.fileNameBase}.pdf`,
                    mimeType: 'application/pdf',
                });
            }

            if (canShipmentExportExcel && documentPreview.excelUrl) {
                files.push({
                    blob: await fetchGeneratedBlob(documentPreview.excelUrl),
                    fileName: `${documentPreview.fileNameBase}.xlsx`,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
            }

            if (!files.length) {
                throw new Error('Нет доступных форматов для сохранения');
            }

            const savedCount = await saveGeneratedAttachments(
                { entityType: 'shipment', entityId: shipment.id },
                files
            );

            if (canShipmentsAttachmentsView) {
                await fetchAttachments(Number(shipment.id));
            }

            setDocumentPreviewSaveMessage(`Сохранено в документы отгрузки: ${savedCount}`);
        } catch (saveError) {
            setDocumentPreviewError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить документы');
        } finally {
            setDocumentPreviewSaving(false);
        }
    };

    const fetchShipment = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/shipments/${encodeURIComponent(String(id))}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Ошибка загрузки отгрузки');
            }
            const data = await res.json();
            setShipment(data);
            setPositions(Array.isArray(data?.позиции) ? data.позиции : []);
            syncFormWithShipment(data);

            if (data?.id) {
                await fetchAttachments(Number(data.id));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [fetchAttachments, id, syncFormWithShipment]);

    const fetchOrdersAndTransports = useCallback(async () => {
        try {
            const [ordersRes, transportsRes] = await Promise.all([
                canOrdersList ? fetch('/api/orders') : Promise.resolve(null),
                fetch('/api/transport'),
            ]);

            if (ordersRes && ordersRes.ok) {
                const o = await ordersRes.json();
                setOrders(Array.isArray(o) ? o : []);
            } else {
                setOrders([]);
            }

            if (transportsRes.ok) {
                const t = await transportsRes.json();
                setTransports(Array.isArray(t?.transport) ? t.transport : []);
            } else {
                setTransports([]);
            }
        } catch {
            // ignore
        }
    }, [canOrdersList]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        fetchShipment();
    }, [authLoading, canView, fetchShipment]);

    useEffect(() => {
        fetchOrdersAndTransports();
    }, [fetchOrdersAndTransports]);

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

    const handleSubmitEdit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shipment) return;
        if (formData.использовать_доставку && formData.транспорт_id <= 0) {
            setError('Выберите транспортную компанию для доставки');
            return;
        }
        if (!formData.заявка_id && normalizedManualPositions.length === 0) {
            setError('Для самостоятельной отгрузки добавьте хотя бы одну позицию');
            return;
        }

        try {
            setOperationLoading(true);
            setError(null);

            if (!formData.заявка_id && !formData.без_учета_склада) {
                const hasUnavailableProduct = normalizedManualPositions.some((position) => (
                    (warehouseStockByProductId.get(Number(position.товар_id)) || 0) <= 0
                ));
                if (hasUnavailableProduct) {
                    throw new Error('Для отгрузки со склада выберите только товары, которые есть в наличии');
                }
            }

            const response = await fetch('/api/shipments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: shipment.id,
                    заявка_id: formData.заявка_id > 0 ? formData.заявка_id : null,
                    использовать_доставку: formData.использовать_доставку,
                    без_учета_склада: formData.заявка_id > 0 ? false : formData.без_учета_склада,
                    транспорт_id: formData.использовать_доставку ? formData.транспорт_id : null,
                    статус: formData.статус,
                    номер_отслеживания: formData.использовать_доставку && formData.номер_отслеживания.trim() ? formData.номер_отслеживания.trim() : null,
                    стоимость_доставки: formData.использовать_доставку && formData.стоимость_доставки ? formData.стоимость_доставки : null,
                    позиции: formData.заявка_id > 0 ? undefined : normalizedManualPositions,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления отгрузки');
            }

            await fetchShipment();
            setIsEditModalOpen(false);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Ошибка обновления отгрузки');
        } finally {
            setOperationLoading(false);
        }
    }, [fetchShipment, formData, normalizedManualPositions, shipment, warehouseStockByProductId]);

    const handleDeleteShipment = useCallback(async () => {
        if (!shipment) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/shipments?id=${shipment.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления отгрузки');
            }

            router.push('/shipments');
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка удаления отгрузки');
        } finally {
            setOperationLoading(false);
            setIsDeleteConfirmOpen(false);
        }
    }, [router, shipment]);

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canView) {
        return <NoAccessPage />;
    }

    if (loading) {
        return <PageLoader label="Загрузка отгрузки..." fullPage />;
    }

    if (error || !shipment) {
        return (
            <div className={styles.container}>
                <div className={styles.errorCard}>
                    <h1 className={styles.errorTitle}>Отгрузка не найдена</h1>
                    <p className={styles.errorText}>{error || 'Не удалось загрузить карточку отгрузки'}</p>
                    <EntityActionButton type="button" onClick={() => void router.push('/shipments')}>
                        Вернуться к отгрузкам
                    </EntityActionButton>
                </div>
            </div>
        );
    }

    const trackingUrl = getTrackingUrl(shipment);
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

    const positionsTotal = positions.reduce((sum, p) => sum + getVatSummary(p).total, 0);
    const shipmentLogisticsTotal = shipment.использовать_доставку ? Number(shipment.стоимость_доставки || 0) : 0;
    const shipmentGrandTotal = positionsTotal + shipmentLogisticsTotal;
    const shipmentStatusLabel = getStatusText(shipment.статус);

    return (
        <div className={`${styles.container} print-shipment-detail`}>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <div className={styles.titleRow}>
                            <h1 className={styles.title}>Отгрузка #{shipment.id}</h1>
                            <EntityStatusBadge
                                value={shipment.статус}
                                label={shipmentStatusLabel}
                                tone={getStatusTone(shipment.статус)}
                                className={styles.statusBadge}
                            />
                        </div>
                        <p className={styles.subtitle}>Детали отгрузки, документы и состав поставки</p>
                    </div>

                    <div className={styles.headerActions}>
                        <EntityActionButton
                            type="button"
                            className={cn(styles.actionButton, styles.noPrint)}
                            onClick={() => void router.push('/shipments')}
                        >
                            <FiArrowLeft />
                            Назад
                        </EntityActionButton>

                        {canUseShipmentDocumentCenter && availableShipmentDocuments.length ? (
                            <DropdownMenu open={isShipmentPrintMenuOpen} onOpenChange={setIsShipmentPrintMenuOpen}>
                                <DropdownMenuTrigger
                                    render={(
                                        <EntityActionButton
                                            type="button"
                                            className={cn(styles.actionButton, styles.noPrint)}
                                        />
                                    )}
                                >
                                        <FiPrinter />
                                        Печать
                                        <FiChevronDown />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={8}>
                                    {availableShipmentDocuments.map((documentDefinition) => (
                                        <DropdownMenuItem
                                            key={documentDefinition.key}
                                            onClick={() => {
                                                setIsShipmentPrintMenuOpen(false);
                                                openShipmentDocumentPreview(documentDefinition);
                                            }}
                                        >
                                            {documentDefinition.title}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}

                        {canGoToOrder ? (
                            <EntityActionButton
                                type="button"
                                className={cn(styles.actionButton, styles.noPrint)}
                                onClick={() => {
                                    if (!shipment.заявка_id) return;
                                    router.push(`/orders/${encodeURIComponent(String(shipment.заявка_id))}`);
                                }}
                                disabled={!shipment.заявка_id}
                            >
                                <FiEye />
                                Перейти к заявке
                            </EntityActionButton>
                        ) : null}

                        {canShipmentTrack ? (
                            <EntityActionButton
                                type="button"
                                className={cn(styles.actionButton, styles.noPrint)}
                                onClick={() => {
                                    if (!trackingUrl) return;
                                    window.open(trackingUrl, '_blank', 'noopener,noreferrer');
                                }}
                                disabled={!trackingUrl}
                            >
                                <FiTruck />
                                Отследить
                            </EntityActionButton>
                        ) : null}

                        {canEdit ? (
                            <EntityActionButton
                                type="button"
                                className={cn(styles.actionButton, styles.noPrint)}
                                onClick={() => {
                                    setError(null);
                                    syncFormWithShipment(shipment);
                                    setManualPositions([createEmptyManualShipmentPosition()]);
                                    setIsEditModalOpen(true);
                                }}
                            >
                                <FiEdit2 />
                                Редактировать
                            </EntityActionButton>
                        ) : null}

                        {canDelete ? (
                            <EntityActionButton
                                type="button"
                                tone="danger"
                                className={cn(styles.actionButton, styles.noPrint)}
                                onClick={() => setIsDeleteConfirmOpen(true)}
                            >
                                <FiTrash2 />
                                Удалить
                            </EntityActionButton>
                        ) : null}
                    </div>
                </div>
            </header>

            <section className={styles.detailsCard}>
                <div className={`${styles.sectionHeader} ${styles.detailsHeader}`}>
                    <h2 className={styles.sectionTitle}>Детали отгрузки</h2>
                    <p className={styles.sectionMeta}>
                        Отгрузка от {formatDateTime(shipment.дата_отгрузки)}
                    </p>
                </div>

                <div className={styles.detailsGrid}>
                    <section className={styles.detailPanel}>
                        <h3 className={styles.detailPanelTitle}>Основная информация</h3>
                        <div className={styles.detailSeparator} />
                        <div className={styles.panelRows}>
                            <InfoItem label="ID" value={`#${shipment.id}`} />
                            <InfoItem
                                label="Заявка"
                                value={
                                    shipment.заявка_id
                                        ? (shipment.заявка_номер ? `№${shipment.заявка_номер}` : `#${shipment.заявка_id}`)
                                        : 'Без заявки'
                                }
                            />
                            <InfoItem
                                label="Способ передачи"
                                value={shipment.использовать_доставку === false ? 'Без доставки' : 'С доставкой'}
                            />
                            <InfoItem label="Транспортная компания" value={getTransportText(shipment)} />
                            <InfoItem
                                label="Номер отслеживания"
                                value={shipment.использовать_доставку === false ? 'Не используется' : (shipment.номер_отслеживания || 'Не указан')}
                            />
                            <InfoItem label="Дата отгрузки" value={formatDateTime(shipment.дата_отгрузки)} />
                        </div>
                    </section>

                    <section className={styles.detailPanel}>
                        <h3 className={styles.detailPanelTitle}>Финансы и статус</h3>
                        <div className={styles.detailSeparator} />
                        <div className={styles.panelRows}>
                            <div className={styles.infoItem}>
                                <div className={styles.infoLabel}>Статус</div>
                                <div className={styles.infoValue}>
                                    <EntityStatusBadge
                                        value={shipment.статус}
                                        label={shipmentStatusLabel}
                                        tone={getStatusTone(shipment.статус)}
                                        compact
                                    />
                                </div>
                            </div>
                            <InfoItem label="Стоимость доставки" value={getCostText(shipment)} />
                            <InfoItem label="Сумма товаров" value={formatCurrency(positionsTotal)} />
                            <InfoItem label="Логистика" value={formatCurrency(shipmentLogisticsTotal)} />
                            <InfoItem label="Итого по отгрузке" value={formatCurrency(shipmentGrandTotal)} />
                            <InfoItem label="Режим склада" value={shipment.без_учета_склада ? 'Без учета склада' : 'Со складом'} />
                        </div>
                    </section>
                </div>
            </section>

            {canShipmentsAttachmentsView ? (
                <section className={styles.card}>
                    <div className={styles.sectionHeaderWithActions}>
                        <h2 className={styles.sectionTitle}>Документы</h2>
                        {canShipmentsAttachmentsUpload ? (
                            <div className={styles.sectionActions}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleUploadAttachment(f);
                                    }}
                                />
                                <EntityActionButton
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={attachmentsUploading}
                                >
                                    <FiUploadCloud />
                                    {attachmentsUploading ? 'Загрузка...' : 'Загрузить файл'}
                                </EntityActionButton>
                            </div>
                        ) : null}
                    </div>

                    {attachmentsError ? <div className={styles.inlineError}>{attachmentsError}</div> : null}

                    {attachmentsLoading ? (
                        <div className={styles.emptyState}>Загрузка документов...</div>
                    ) : attachments.length === 0 ? (
                        <div className={styles.emptyState}>Нет прикрепленных документов</div>
                    ) : (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                            <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                                <colgroup>
                                    <col className={styles.colDocFile} />
                                    <col className={styles.colDocSize} />
                                    <col className={styles.colDocActions} />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Файл</TableHead>
                                        <TableHead className={styles.textRight}>Размер</TableHead>
                                        <TableHead className={styles.textRight}>Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {attachments.map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className={styles.tableCell}>
                                                <div className={styles.fileCell}>
                                                    <div className={styles.fileTitleRow}>
                                                        <FiPaperclip className={styles.fileIcon} />
                                                        <span className={styles.fileName}>{a.filename}</span>
                                                    </div>
                                                    <span className={styles.fileMeta}>{a.mime_type}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>{formatBytes(a.size_bytes)}</TableCell>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                <div className={styles.rowActions}>
                                                    <EntityActionButton
                                                        type="button"
                                                        className={styles.inlineAction}
                                                        onClick={() => openPreview(a)}
                                                    >
                                                        <FiFile />
                                                        Открыть
                                                    </EntityActionButton>
                                                    <EntityActionButton
                                                        type="button"
                                                        className={styles.inlineAction}
                                                        onClick={() => {
                                                            window.open(
                                                                `/api/attachments/${encodeURIComponent(a.id)}/download`,
                                                                '_blank',
                                                                'noopener,noreferrer'
                                                            );
                                                        }}
                                                    >
                                                        <FiDownload />
                                                        Скачать
                                                    </EntityActionButton>
                                                    {canShipmentsAttachmentsDelete ? (
                                                        <EntityActionButton
                                                            type="button"
                                                            tone="danger"
                                                            className={styles.inlineAction}
                                                            onClick={() => void handleDeleteAttachment(a.id)}
                                                        >
                                                            <FiTrash2 />
                                                            Удалить
                                                        </EntityActionButton>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </EntityTableSurface>
                    )}
                </section>
            ) : null}

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className={styles.previewDialog}>
                    <div className={styles.previewHeader}>
                        <div>
                            <DialogTitle className={styles.previewTitle}>{previewAttachment?.filename || 'Документ'}</DialogTitle>
                            <DialogDescription className={styles.previewDescription}>{previewAttachment?.mime_type || ''}</DialogDescription>
                        </div>
                    </div>

                    <div className={styles.previewBody}>
                        {previewAttachment && canPreviewInline(previewAttachment) ? (
                            previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                <div className={styles.previewImageWrap}>
                                    <Image
                                        src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                        alt={previewAttachment.filename}
                                        fill
                                        unoptimized
                                        sizes="100vw"
                                        className={styles.previewImage}
                                    />
                                </div>
                            ) : (
                                <iframe
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    className={styles.previewFrame}
                                    title={previewAttachment.filename}
                                />
                            )
                        ) : (
                            <div className={styles.emptyState}>
                                Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                            </div>
                        )}
                    </div>

                    <div className={styles.previewActions}>
                        {previewAttachment ? (
                            <EntityActionButton
                                type="button"
                                className={styles.actionButton}
                                onClick={() => {
                                    window.open(
                                        `/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`,
                                        '_blank',
                                        'noopener,noreferrer'
                                    );
                                }}
                            >
                                <FiDownload />
                                Скачать
                            </EntityActionButton>
                        ) : null}
                        <EntityActionButton type="button" className={styles.actionButton} onClick={() => setIsPreviewOpen(false)}>
                            Закрыть
                        </EntityActionButton>
                    </div>
                </DialogContent>
            </Dialog>

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
                                    <div className={styles.previewPanelDescription}>{documentPreview.description}</div>
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
                            {canShipmentPrint ? (
                                <EntityActionButton
                                    type="button"
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={handlePrintDocumentPreview}
                                    disabled={!documentPreviewPdfObjectUrl}
                                >
                                    <FiPrinter className={styles.icon} />
                                    Напечатать
                                </EntityActionButton>
                            ) : null}
                            {canPreviewShipmentDocuments ? (
                                <EntityActionButton
                                    type="button"
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={() => handleDocumentPreviewDownload('pdf')}
                                >
                                    <BsFillFileEarmarkPdfFill className={`${styles.icon} ${styles.pdfIcon}`} />
                                    PDF
                                </EntityActionButton>
                            ) : null}
                            {canShipmentExportExcel ? (
                                <EntityActionButton
                                    type="button"
                                    className={styles.previewToolbarAction}
                                    data-entity-action-layout="print-toolbar"
                                    onClick={() => handleDocumentPreviewDownload('excel')}
                                >
                                    <BsFillFileEarmarkExcelFill className={`${styles.icon} ${styles.excelIcon}`} />
                                    Excel
                                </EntityActionButton>
                            ) : null}
                            <EntityActionButton
                                type="button"
                                className={styles.previewToolbarAction}
                                data-entity-action-layout="print-toolbar"
                                onClick={() => window.open(documentPreview.previewUrl, '_blank', 'noopener,noreferrer')}
                                disabled={!documentPreview.previewUrl}
                            >
                                <FiExternalLink className={styles.icon} />
                                Открыть
                            </EntityActionButton>
                            {canShipmentsAttachmentsUpload ? (
                                <EntityActionButton
                                    type="button"
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
                                onChange={updateDocumentPreviewZoom}
                            />
                        </div>
                        {documentPreviewSaveMessage ? (
                            <div className={styles.previewSuccess}>{documentPreviewSaveMessage}</div>
                        ) : null}
                        {documentPreviewError ? (
                            <div className={styles.previewError}>{documentPreviewError}</div>
                        ) : null}

                        <div className={styles.previewCanvas}>
                            <div className={styles.previewStage} ref={documentPreviewStageRef}>
                                {documentPreviewLoading ? (
                                    <div className={styles.previewLoading}>Готовим предпросмотр PDF...</div>
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
                                {!documentPreviewLoading && !documentPreviewPages.length && !documentPreviewError ? (
                                    <div className={styles.previewLoading}>Не удалось подготовить страницы документа.</div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <iframe ref={documentPreviewPrintFrameRef} title="Печать документа" className={styles.hiddenPrintFrame} />
                </div>
            ) : null}

            {canShipmentsPositionsView ? (
                <section className={styles.card}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Состав отгрузки</h2>
                        {positionsLoading ? <p className={styles.sectionMeta}>Загрузка...</p> : null}
                    </div>

                    <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                        <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                            <colgroup>
                                <col className={styles.colShipmentName} />
                                <col className={styles.colShipmentUnit} />
                                <col className={styles.colShipmentQuantity} />
                                <col className={styles.colShipmentPrice} />
                                <col className={styles.colShipmentNet} />
                                <col className={styles.colShipmentVat} />
                                <col className={styles.colShipmentTax} />
                                <col className={styles.colShipmentTotal} />
                            </colgroup>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Название</TableHead>
                                    <TableHead className={styles.textRight}>Ед. изм.</TableHead>
                                    <TableHead className={styles.textRight}>Количество</TableHead>
                                    <TableHead className={styles.textRight}>Цена, ₽</TableHead>
                                    <TableHead className={styles.textRight}>Сумма без НДС, ₽</TableHead>
                                    <TableHead className={styles.textRight}>НДС</TableHead>
                                    <TableHead className={styles.textRight}>Сумма НДС, ₽</TableHead>
                                    <TableHead className={styles.textRight}>Всего, ₽</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {positions.length === 0 ? (
                                    <TableRow>
                                        <TableCell className={styles.tableCell} colSpan={8}>
                                            <span className={styles.mutedText}>Нет данных о составе отгрузки</span>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    positions.map((position) => {
                                        const vatSummary = getVatSummary(position);

                                        return (
                                            <TableRow key={position.id}>
                                                <TableCell className={styles.tableCell}>
                                                    <div className={styles.itemTitle}>{position.товар_название}</div>
                                                    <div className={styles.itemSub}>
                                                        {position.товар_артикул} • {position.товар_категория || 'Без категории'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                    {position.товар_единица_измерения || 'шт'}
                                                </TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                    {position.количество}
                                                </TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>{formatCurrency(Number(position.цена) || 0)}</TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>{formatCurrency(vatSummary.net)}</TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>{vatSummary.label}</TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>{formatCurrency(vatSummary.tax)}</TableCell>
                                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                    <span className={styles.itemTitle}>{formatCurrency(vatSummary.total)}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}

                                {positions.length > 0 ? (
                                    <>
                                        <TableRow className={styles.totalRow}>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`} colSpan={7}>
                                                Сумма товаров:
                                            </TableCell>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                <span className={styles.itemTitle}>{formatCurrency(positionsTotal)}</span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className={styles.totalRow}>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`} colSpan={7}>
                                                Логистика:
                                            </TableCell>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                <span className={styles.itemTitle}>{formatCurrency(shipmentLogisticsTotal)}</span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className={styles.totalRow}>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`} colSpan={7}>
                                                Итого по отгрузке:
                                            </TableCell>
                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                <span className={styles.itemTitle}>{formatCurrency(shipmentGrandTotal)}</span>
                                            </TableCell>
                                        </TableRow>
                                    </>
                                ) : null}
                            </TableBody>
                        </Table>
                    </EntityTableSurface>
                </section>
            ) : null}

            <DeleteConfirmation
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeleteShipment}
                loading={operationLoading}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить эту отгрузку?"
                warning="Это действие нельзя отменить. Все данные отгрузки и связанные документы будут удалены."
                details={(
                    <div className={styles.deleteDetails}>
                        <div className={styles.deleteDetailsTitle}>Отгрузка #{shipment.id}</div>
                        <div className={styles.deleteDetailsMeta}>
                            {shipment.заявка_id ? `Заявка: #${shipment.заявка_id}` : 'Самостоятельная отгрузка без заявки'}
                        </div>
                        <div className={styles.deleteDetailsMeta}>Способ: {getTransportText(shipment)}</div>
                    </div>
                )}
            />

            <ShipmentEditorModal
                availableManualProducts={availableManualProducts}
                canGoToOrder={canGoToOrder}
                canSubmit={canSubmitShipment}
                editingId={shipment?.id ?? null}
                formData={formData}
                isOpen={isEditModalOpen}
                isSubmitting={operationLoading}
                manualPositions={manualPositions}
                manualPositionsLoading={manualPositionsLoading}
                manualPositionsTotal={manualPositionsTotal}
                onAddManualPosition={addManualPosition}
                onClose={() => setIsEditModalOpen(false)}
                onManualPositionChange={handleManualPositionChange}
                onOpenOrder={() => {
                    if (!canGoToOrder || !formData.заявка_id) return;
                    setIsEditModalOpen(false);
                    router.push(`/orders/${encodeURIComponent(String(formData.заявка_id))}`);
                }}
                onRemoveManualPosition={removeManualPosition}
                onSubmit={handleSubmitEdit}
                orderSelectOptions={orderSelectOptions}
                positionsPreviewTotal={editPreviewTotal}
                productsById={productsById}
                selectedOrderPositions={editPreviewPositions}
                selectedOrderPositionsLoading={editPreviewLoading}
                setFormData={setFormData}
                shipmentDeliveryAmount={shipmentDeliveryAmount}
                transportSelectOptions={transportSelectOptions}
                warehouseStockByProductId={warehouseStockByProductId}
            />
        </div>
    );
}

export default withLayout(ShipmentDetailPage);
