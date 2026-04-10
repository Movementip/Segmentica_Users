import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './ShipmentDetail.module.css';
import shipmentEditorStyles from './Shipments.module.css';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import { BsFillFileEarmarkExcelFill, BsFillFileEarmarkPdfFill } from 'react-icons/bs';
import { Badge, Box, Button, Card, Dialog, DropdownMenu, Flex, Grid, Select, Separator, Table, Text, TextField } from '@radix-ui/themes';
import {
    FiTruck,
    FiEye,
    FiArrowLeft,
    FiChevronDown,
    FiDownload,
    FiEdit2,
    FiExternalLink,
    FiFile,
    FiMinus,
    FiPaperclip,
    FiPlus,
    FiPrinter,
    FiTrash2,
    FiUploadCloud,
    FiX,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption, VAT_RATE_OPTIONS } from '../../lib/vat';
import modalStyles from '../../components/Modal.module.css';
import { getShipmentDeliveryLabel } from '../../lib/logisticsDeliveryLabels';
import OrderSearchSelect from '../../components/OrderSearchSelect';
import {
    getAvailableShipmentDocumentDefinitions,
    type ShipmentDocumentDefinition,
    type ShipmentDocumentKey,
} from '../../lib/shipmentDocumentDefinitions';

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

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

interface ManualShipmentPosition {
    id?: number;
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
}

type ShipmentDocumentPreviewState = {
    key: ShipmentDocumentKey;
    title: string;
    description: string;
    fileNameBase: string;
    previewUrl: string;
    excelUrl: string;
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

const PREVIEW_ZOOM_MIN = 0.6;
const PREVIEW_ZOOM_MAX = 2;
const PREVIEW_ZOOM_STEP = 0.2;

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
    const [positionsLoading, setPositionsLoading] = useState(false);
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
    const [documentPreviewPages, setDocumentPreviewPages] = useState<PreviewPageImage[]>([]);
    const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
    const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
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
    const canShipmentExportPdf = Boolean(user?.permissions?.includes('shipments.export.pdf'));
    const canShipmentExportExcel = Boolean(user?.permissions?.includes('shipments.export.excel'));

    const canShipmentsAttachmentsView = Boolean(user?.permissions?.includes('shipments.attachments.view'));
    const canShipmentsAttachmentsUpload = Boolean(user?.permissions?.includes('shipments.attachments.upload'));
    const canShipmentsAttachmentsDelete = Boolean(user?.permissions?.includes('shipments.attachments.delete'));

    const canShipmentsPositionsView = Boolean(user?.permissions?.includes('shipments.positions.view'));

    const canGoToOrder = canOrdersView && canShipmentOrderView;
    const canPreviewShipmentDocuments = canShipmentPrint || canShipmentExportPdf;
    const canUseShipmentDocumentCenter = canPreviewShipmentDocuments || canShipmentExportExcel;

    const availableShipmentDocuments = useMemo<ShipmentDocumentDefinition[]>(() => {
        if (!shipment) return [];
        return getAvailableShipmentDocumentDefinitions({
            nomenclatureTypes: (positions || []).map((position) => position.товар_тип_номенклатуры || ''),
            usesDelivery: shipment.использовать_доставку !== false,
        });
    }, [positions, shipment]);

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

    const fetchShipmentPositions = useCallback(async (orderId: number) => {
        if (!orderId) {
            setPositions([]);
            return;
        }

        if (!canShipmentsPositionsView) {
            setPositions([]);
            return;
        }

        if (!canOrdersView) {
            setPositions([]);
            return;
        }

        try {
            setPositionsLoading(true);
            const res = await fetch(`/api/orders/${encodeURIComponent(String(orderId))}`);
            if (!res.ok) {
                setPositions([]);
                return;
            }

            const data = await res.json();
            setPositions(Array.isArray(data?.позиции) ? data.позиции : []);
        } catch {
            setPositions([]);
        } finally {
            setPositionsLoading(false);
        }
    }, [canOrdersView, canShipmentsPositionsView]);

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
                ? data.позиции.map((position: any) => ({
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

    const getStatusPillClass = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'в пути':
                return styles.statusPillBlue;
            case 'получено':
            case 'доставлено':
                return styles.statusPillGreen;
            case 'отменено':
                return styles.statusPillRed;
            default:
                return '';
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
            if (!canShipmentPrint && !canShipmentExportPdf) {
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
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canView) {
        return <NoAccessPage />;
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <Text as="div" size="2" color="gray">Загрузка…</Text>
                </div>
            </div>
        );
    }

    if (error || !shipment) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <Text as="div" size="3" weight="bold">Ошибка</Text>
                    <Text as="div" color="red" mt="2">{error || 'Отгрузка не найдена'}</Text>
                    <div className={styles.buttonGroup} style={{ marginTop: 16 }}>
                        <Link href="/shipments" style={{ textDecoration: 'none' }}>
                            <Button variant="surface" color="gray" highContrast className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}>
                                Назад к списку отгрузок
                            </Button>
                        </Link>
                    </div>
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

    return (
        <div className={`${styles.container} print-shipment-detail`}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Отгрузка #{shipment.id}</h1>
                        <p className={styles.subtitle}>Детали отгрузки и документы</p>
                        <div className={`${styles.statusPill} ${getStatusPillClass(shipment.статус)}`}>
                            <Text as="span" size="1" weight="medium">{getStatusText(shipment.статус)}</Text>
                        </div>
                    </div>

                    <div className={styles.headerActions}>
                        <Link href="/shipments" className={styles.noPrint} style={{ textDecoration: 'none' }}>
                            <Button variant="surface" color="gray" highContrast className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}>
                                <FiArrowLeft className={styles.icon} /> Назад
                            </Button>
                        </Link>

                        {canUseShipmentDocumentCenter && availableShipmentDocuments.length ? (
                            <DropdownMenu.Root open={isShipmentPrintMenuOpen} onOpenChange={setIsShipmentPrintMenuOpen}>
                                <DropdownMenu.Trigger>
                                    <Button
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                    >
                                        <FiPrinter className={styles.icon} />
                                        Печать
                                        <FiChevronDown className={styles.icon} />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content align="end" sideOffset={8}>
                                    {availableShipmentDocuments.map((documentDefinition) => (
                                        <DropdownMenu.Item
                                            key={documentDefinition.key}
                                            onSelect={() => {
                                                setIsShipmentPrintMenuOpen(false);
                                                openShipmentDocumentPreview(documentDefinition);
                                            }}
                                        >
                                            {documentDefinition.title}
                                        </DropdownMenu.Item>
                                    ))}
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                        ) : null}

                        {canGoToOrder ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                onClick={() => {
                                    if (!shipment.заявка_id) return;
                                    router.push(`/orders/${encodeURIComponent(String(shipment.заявка_id))}`);
                                }}
                                disabled={!shipment.заявка_id}
                            >
                                <FiEye className={styles.icon} />
                                Перейти к заявке
                            </Button>
                        ) : null}

                        {canShipmentTrack ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                onClick={() => {
                                    if (!trackingUrl) return;
                                    window.open(trackingUrl, '_blank', 'noopener,noreferrer');
                                }}
                                disabled={!trackingUrl}
                            >
                                <FiTruck className={styles.icon} />
                                Отследить
                            </Button>
                        ) : null}

                        {canEdit ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                onClick={() => {
                                    setError(null);
                                    syncFormWithShipment(shipment);
                                    setManualPositions([createEmptyManualShipmentPosition()]);
                                    setIsEditModalOpen(true);
                                }}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                variant="surface"
                                color="red"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} ${styles.noPrint}`}
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
                        Детали отгрузки
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Отгрузка от {formatDateTime(shipment.дата_отгрузки)}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Основная информация
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                <Text as="div" size="1" color="gray">Заявка</Text>
                                    <Text as="div" size="2" weight="medium">
                                        {shipment.заявка_id
                                            ? (shipment.заявка_номер ? `№${shipment.заявка_номер}` : `#${shipment.заявка_id}`)
                                            : 'Без заявки'}
                                    </Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Способ передачи</Text>
                                    <Text as="div" size="2">{getTransportText(shipment)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Номер отслеживания</Text>
                                    <Text as="div" size="2">{shipment.использовать_доставку === false ? 'Не используется' : (shipment.номер_отслеживания || 'Не указан')}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Финансы и статус
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Стоимость доставки</Text>
                                    <Text as="div" size="2" weight="medium">{getCostText(shipment)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Сумма товаров</Text>
                                    <Text as="div" size="2">{formatCurrency(positionsTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Логистика</Text>
                                    <Text as="div" size="2">{formatCurrency(shipmentLogisticsTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Итого по отгрузке</Text>
                                    <Text as="div" size="2" weight="medium">{formatCurrency(shipmentGrandTotal)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Статус</Text>
                                    <Text as="div" size="2">{getStatusText(shipment.статус)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата отгрузки</Text>
                                    <Text as="div" size="2">{formatDateTime(shipment.дата_отгрузки)}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>

                <div className={styles.actions}>
                    {trackingUrl && canShipmentTrack ? (
                        <Button
                            onClick={() => window.open(trackingUrl, '_blank', 'noopener,noreferrer')}
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                        >
                            <FiTruck className={styles.icon} />
                            Отследить груз
                        </Button>
                    ) : null}
                </div>
            </div>

            {canShipmentsAttachmentsView ? (
                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Документы
                        </Text>
                        {canShipmentsAttachmentsUpload ? (
                            <div className={styles.buttonGroup}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleUploadAttachment(f);
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={attachmentsUploading}
                                >
                                    <FiUploadCloud className={styles.icon} />
                                    {attachmentsUploading ? 'Загрузка…' : 'Загрузить файл'}
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {attachmentsError ? (
                        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 12 }}>
                            <Text as="div" size="2" color="red">{attachmentsError}</Text>
                        </Box>
                    ) : null}

                    {attachmentsLoading ? (
                        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 12 }}>
                            <Text as="div" size="2" color="gray">Загрузка документов…</Text>
                        </Box>
                    ) : attachments.length === 0 ? (
                        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 12 }}>
                            <Text as="div" size="2" color="gray">Нет прикрепленных документов</Text>
                        </Box>
                    ) : (
                        <Box style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
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
                                                <div style={{ fontWeight: 600 }}>{a.filename}</div>
                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.mime_type}</div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatBytes(a.size_bytes)}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>
                                                <Flex justify="end" gap="2" wrap="wrap">
                                                    <Button
                                                        type="button"
                                                        variant="surface"
                                                        color="gray"
                                                        highContrast
                                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                        onClick={() => openPreview(a)}
                                                    >
                                                        <FiFile className={styles.icon} />  Открыть
                                                    </Button>
                                                    <a
                                                        href={`/api/attachments/${encodeURIComponent(a.id)}/download`}
                                                        style={{ textDecoration: 'none' }}
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="gray"
                                                            highContrast
                                                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                        >
                                                            <FiDownload className={styles.icon} /> Скачать
                                                        </Button>
                                                    </a>
                                                    {canShipmentsAttachmentsDelete ? (
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="red"
                                                            highContrast
                                                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} ${styles.noPrint}`}
                                                            onClick={() => void handleDeleteAttachment(a.id)}
                                                        >
                                                            <FiTrash2 className={styles.icon} /> Удалить
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
                    <Dialog.Description>{previewAttachment?.mime_type || ''}</Dialog.Description>

                    <Box style={{ marginTop: 12 }}>
                        {previewAttachment && canPreviewInline(previewAttachment) ? (
                            previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                <Image
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    alt={previewAttachment.filename}
                                    width={1600}
                                    height={1200}
                                    unoptimized
                                    style={{ width: '100%', maxHeight: '75vh', height: 'auto', objectFit: 'contain' }}
                                />
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
                            <a href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`} style={{ textDecoration: 'none' }}>
                                <Button variant="surface" color="gray" highContrast>
                                    <FiDownload className={styles.icon} /> Скачать
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
                            {canShipmentPrint ? (
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
                            {canPreviewShipmentDocuments ? (
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
                            {canShipmentExportExcel ? (
                                <Button
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    onClick={() => handleDocumentPreviewDownload('excel')}
                                >
                                    <BsFillFileEarmarkExcelFill className={`${styles.icon} ${styles.excelIcon}`} />
                                    Excel
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

            {canShipmentsPositionsView ? (
                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Состав отгрузки
                        </Text>
                        {positionsLoading ? (
                            <Text as="div" size="1" color="gray">Загрузка...</Text>
                        ) : null}
                    </div>

                    <div className={styles.tableWrapper}>
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
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
                                {positions.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={8}>
                                            <Text as="div" size="2" color="gray">Нет данных о составе отгрузки</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : (
                                    positions.map((position) => {
                                        const vatSummary = getVatSummary(position);

                                        return (
                                            <Table.Row key={position.id}>
                                                <Table.Cell>
                                                    <div className={styles.productName}>{position.товар_название}</div>
                                                    <div className={styles.productMeta}>
                                                        {position.товар_артикул} • {position.товар_категория || 'Без категории'}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    {position.товар_единица_измерения || 'шт'}
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    {position.количество}
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatCurrency(Number(position.цена) || 0)}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.net)}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>{vatSummary.label}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.tax)}</Table.Cell>
                                                <Table.Cell className={styles.textRight} style={{ fontWeight: 600 }}>
                                                    {formatCurrency(vatSummary.total)}
                                                </Table.Cell>
                                            </Table.Row>
                                        );
                                    })
                                )}

                                {positions.length > 0 ? (
                                    <>
                                        <Table.Row className={styles.totalRow as any}>
                                            <Table.Cell className={styles.textRight} colSpan={7}>
                                                Сумма товаров:
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                                {formatCurrency(positionsTotal)}
                                            </Table.Cell>
                                        </Table.Row>
                                        <Table.Row className={styles.totalRow as any}>
                                            <Table.Cell className={styles.textRight} colSpan={7}>
                                                Логистика:
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                                {formatCurrency(shipmentLogisticsTotal)}
                                            </Table.Cell>
                                        </Table.Row>
                                        <Table.Row className={styles.totalRow as any}>
                                            <Table.Cell className={styles.textRight} colSpan={7}>
                                                Итого по отгрузке:
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight} style={{ fontWeight: 700, textAlign: 'right' }}>
                                                {formatCurrency(shipmentGrandTotal)}
                                            </Table.Cell>
                                        </Table.Row>
                                    </>
                                ) : null}
                            </Table.Body>
                        </Table.Root>
                    </div>
                </div>
            ) : null}

            <Dialog.Root open={isDeleteConfirmOpen} onOpenChange={(open) => (!open ? setIsDeleteConfirmOpen(false) : undefined)}>
                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>

                    <Box className={deleteConfirmationStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить эту отгрузку? Это действие нельзя отменить.
                            </Text>

                            <Box className={deleteConfirmationStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" weight="bold">Отгрузка #{shipment.id}</Text>
                                    <Text as="div" size="2" color="gray">
                                        {shipment.заявка_id ? `Заявка: #${shipment.заявка_id}` : 'Самостоятельная отгрузка без заявки'}
                                    </Text>
                                    <Text as="div" size="2" color="gray">Способ: {getTransportText(shipment)}</Text>
                                </Flex>
                            </Box>

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmationStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    disabled={operationLoading}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmationStyles.modalDeleteButton}
                                    onClick={handleDeleteShipment}
                                    disabled={operationLoading}
                                >
                                    {operationLoading ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={isEditModalOpen} onOpenChange={(open) => (!open ? setIsEditModalOpen(false) : undefined)}>
                <Dialog.Content className={`${modalStyles.radixDialogWide} ${shipmentEditorStyles.shipmentEditorDialog}`}>
                    <Dialog.Title>Редактировать отгрузку</Dialog.Title>
                    <Dialog.Description className={modalStyles.radixDescription}>
                        Заполните данные отгрузки.
                    </Dialog.Description>

                    <form onSubmit={handleSubmitEdit} className={modalStyles.radixForm}>
                        <Flex direction="column" gap="4">
                            <Box className={modalStyles.radixField}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                                    <input
                                        type="checkbox"
                                        style={{ accentColor: '#111111', width: 16, height: 16 }}
                                        checked={formData.использовать_доставку}
                                        onChange={(e) => setFormData((p) => ({
                                            ...p,
                                            использовать_доставку: e.target.checked,
                                            транспорт_id: e.target.checked ? p.транспорт_id : 0,
                                            номер_отслеживания: e.target.checked ? p.номер_отслеживания : '',
                                            стоимость_доставки: e.target.checked ? p.стоимость_доставки : 0,
                                        }))}
                                    />
                                    <Text as="span" size="2" weight="medium">Использовать доставку</Text>
                                </label>
                                <Text as="div" size="1" color="gray">
                                    Если выключено, отгрузка оформляется как передача без доставки.
                                </Text>
                            </Box>

                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Заявка</Text>
                                <OrderSearchSelect
                                    value={formData.заявка_id ? String(formData.заявка_id) : ''}
                                    onValueChange={(nextValue) => setFormData((p) => ({
                                        ...p,
                                        заявка_id: nextValue ? Number(nextValue) || 0 : 0,
                                        без_учета_склада: nextValue ? false : p.без_учета_склада,
                                    }))}
                                    options={orderSelectOptions}
                                    placeholder="Без заявки"
                                    disabled={!canOrdersList}
                                />
                                {!formData.заявка_id ? (
                                    <Text as="div" size="1" color="gray">
                                        Если заявку не выбирать, отгрузка будет оформлена как самостоятельная отгрузка со склада.
                                    </Text>
                                ) : null}
                            </Box>

                            {!formData.заявка_id ? (
                                <Box className={modalStyles.radixField}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                                        <input
                                            type="checkbox"
                                            style={{ accentColor: '#111111', width: 16, height: 16 }}
                                            checked={formData.без_учета_склада}
                                            onChange={(e) => setFormData((p) => ({ ...p, без_учета_склада: e.target.checked }))}
                                        />
                                        <Text as="span" size="2" weight="medium">Без учета склада</Text>
                                    </label>
                                    <Text as="div" size="1" color="gray">
                                        Доступно только для самостоятельной отгрузки. Документ будет создан без проверки остатков и без списания со склада.
                                    </Text>
                                </Box>
                            ) : null}

                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Статус</Text>
                                <Select.Root value={formData.статус} onValueChange={(v) => setFormData((p) => ({ ...p, статус: v }))}>
                                    <Select.Trigger variant="surface" color="gray" className={modalStyles.radixSelectTrigger} />
                                    <Select.Content position="popper" className={modalStyles.radixSelectContent}>
                                        <Select.Item value="в пути">В пути</Select.Item>
                                        <Select.Item value="доставлено">Доставлено</Select.Item>
                                        <Select.Item value="получено">Получено</Select.Item>
                                        <Select.Item value="отменено">Отменено</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            {formData.использовать_доставку ? (
                                <>
                                    <Box className={modalStyles.radixField}>
                                        <Text as="label" size="2" weight="medium">Транспортная компания</Text>
                                        <OrderSearchSelect
                                            value={formData.транспорт_id ? String(formData.транспорт_id) : ''}
                                            onValueChange={(nextValue) => setFormData((p) => ({
                                                ...p,
                                                транспорт_id: nextValue ? Number(nextValue) || 0 : 0,
                                            }))}
                                            options={transportSelectOptions}
                                            placeholder="Выберите ТК"
                                        />
                                    </Box>

                                    <Box className={modalStyles.radixField}>
                                        <Text as="label" size="2" weight="medium">Номер отслеживания (опц.)</Text>
                                        <TextField.Root
                                            value={formData.номер_отслеживания}
                                            onChange={(ev) => setFormData((p) => ({ ...p, номер_отслеживания: ev.target.value }))}
                                            placeholder="TRACK-001"
                                            size="2"
                                        />
                                    </Box>

                                    <Box className={modalStyles.radixField}>
                                        <Text as="label" size="2" weight="medium">Стоимость доставки (опц.)</Text>
                                        <TextField.Root
                                            value={String(formData.стоимость_доставки ?? '')}
                                            onChange={(ev) => {
                                                const value = ev.target.value;
                                                const next = value === '' ? 0 : Number(value);
                                                setFormData((p) => ({
                                                    ...p,
                                                    стоимость_доставки: Number.isFinite(next) ? next : p.стоимость_доставки,
                                                }));
                                            }}
                                            placeholder="400.00"
                                            size="2"
                                        />
                                    </Box>
                                </>
                            ) : null}

                            <Box className={shipmentEditorStyles.modalPreviewSection}>
                                <Flex align="center" justify="between" gap="3" wrap="wrap">
                                    <Text as="div" size="3" weight="medium" className={shipmentEditorStyles.modalPreviewTitle}>
                                        {'Позиции отгрузки'}
                                    </Text>
                                    {formData.заявка_id && editPreviewLoading ? (
                                        <Text size="2" color="gray">Загружаем состав отгрузки...</Text>
                                    ) : null}
                                    {!formData.заявка_id ? (
                                        <Button
                                            type="button"
                                            variant="surface"
                                            color="gray"
                                            highContrast
                                            onClick={addManualPosition}
                                            className={shipmentEditorStyles.shipmentAddPositionButton}
                                            disabled={manualPositionsLoading}
                                        >
                                            Добавить позицию
                                        </Button>
                                    ) : null}
                                </Flex>

                                {!formData.заявка_id ? (
                                    <Text as="div" size="2" color="gray" className={shipmentEditorStyles.modalPreviewHint}>
                                        {formData.без_учета_склада
                                            ? 'Без заявки выберите товары вручную: это будет самостоятельная отгрузка без учета склада.'
                                            : 'Без заявки выберите товары вручную: в списке доступны только товары, которые есть на складе.'}
                                    </Text>
                                ) : null}

                                {!formData.заявка_id && !formData.без_учета_склада && availableManualProducts.length === 0 ? (
                                    <Text as="div" size="2" color="gray" className={shipmentEditorStyles.modalPreviewHint}>
                                        На складе нет товаров, доступных для самостоятельной отгрузки.
                                    </Text>
                                ) : null}

                                {formData.заявка_id && !editPreviewLoading && editPreviewPositions.length === 0 ? (
                                    <Text as="div" size="2" color="gray" className={shipmentEditorStyles.modalPreviewHint}>
                                        Для этой отгрузки сейчас нет позиций или они недоступны для просмотра.
                                    </Text>
                                ) : null}

                                {!formData.заявка_id ? (
                                    <>
                                        {manualPositionsLoading ? (
                                            <Text as="div" size="2" color="gray" className={shipmentEditorStyles.modalPreviewHint}>
                                                Загружаем состав самостоятельной отгрузки...
                                            </Text>
                                        ) : null}

                                        {!manualPositionsLoading ? (
                                            <>
                                                <div className={shipmentEditorStyles.modalPreviewTableWrap}>
                                                    <div className={shipmentEditorStyles.shipmentPositionsScroller}>
                                                        <Box className={shipmentEditorStyles.shipmentPositionsTable}>
                                                            {manualPositions.length > 0 ? (
                                                                <Box className={shipmentEditorStyles.shipmentPositionHeaderRow}>
                                                                    <Text as="span" size="1" color="gray" className={shipmentEditorStyles.shipmentPositionHeaderCell}>Товар</Text>
                                                                    <Text as="span" size="1" color="gray" className={shipmentEditorStyles.shipmentPositionHeaderCell}>Ед.изм</Text>
                                                                    <Text as="span" size="1" color="gray" className={shipmentEditorStyles.shipmentPositionHeaderCell}>Кол-во</Text>
                                                                    <Text as="span" size="1" color="gray" className={shipmentEditorStyles.shipmentPositionHeaderCell}>Цена, ₽</Text>
                                                                    <Text as="span" size="1" color="gray" className={shipmentEditorStyles.shipmentPositionHeaderCell}>НДС</Text>
                                                                    <Text as="span" size="1" color="gray" className={`${shipmentEditorStyles.shipmentPositionHeaderCell} ${shipmentEditorStyles.shipmentPositionHeaderCellRight}`}>Всего, ₽</Text>
                                                                    <Text as="span" size="1" color="gray" className={`${shipmentEditorStyles.shipmentPositionHeaderCell} ${shipmentEditorStyles.shipmentPositionHeaderCellCenter}`} />
                                                                </Box>
                                                            ) : null}

                                                            <Flex direction="column" gap="2">
                                                                {manualPositions.map((position, index) => {
                                                                    const selectedProduct = productsById.get(position.товар_id);
                                                                    const total = calculateVatAmountsFromLine(
                                                                        position.количество,
                                                                        position.цена,
                                                                        getVatRateOption(position.ндс_id).rate
                                                                    ).total;
                                                                    const productOptions = availableManualProducts.map((product) => ({
                                                                        value: String(product.id),
                                                                        label: `${product.артикул} - ${product.название}${!formData.без_учета_склада ? ` · в наличии: ${warehouseStockByProductId.get(product.id) || 0}` : ''}`,
                                                                    }));

                                                                    return (
                                                                        <Box key={position.id ?? `manual-${index}`} className={shipmentEditorStyles.shipmentPositionRow}>
                                                                            <OrderSearchSelect
                                                                                value={position.товар_id ? String(position.товар_id) : ''}
                                                                                onValueChange={(nextValue) => handleManualPositionChange(index, 'товар_id', nextValue ? Number(nextValue) : 0)}
                                                                                options={productOptions}
                                                                                placeholder="Выберите товар"
                                                                                compact
                                                                                inputClassName={shipmentEditorStyles.shipmentPositionSearchSelectInput}
                                                                                menuClassName={shipmentEditorStyles.shipmentPositionSearchSelectMenu}
                                                                            />

                                                                            <Text as="span" size="2" className={shipmentEditorStyles.shipmentUnitValue}>
                                                                                {selectedProduct?.единица_измерения || 'шт'}
                                                                            </Text>

                                                                            <TextField.Root
                                                                                type="number"
                                                                                min={1}
                                                                                step={1}
                                                                                value={String(position.количество)}
                                                                                onChange={(event) => handleManualPositionChange(index, 'количество', event.target.value)}
                                                                                size="2"
                                                                                className={shipmentEditorStyles.shipmentPositionInput}
                                                                            />

                                                                            <TextField.Root
                                                                                type="number"
                                                                                min={0}
                                                                                step={0.01}
                                                                                value={String(position.цена)}
                                                                                onChange={(event) => handleManualPositionChange(index, 'цена', event.target.value)}
                                                                                size="2"
                                                                                className={shipmentEditorStyles.shipmentPositionInput}
                                                                            />

                                                                            <Select.Root
                                                                                value={String(position.ндс_id || DEFAULT_VAT_RATE_ID)}
                                                                                onValueChange={(nextValue) => handleManualPositionChange(index, 'ндс_id', Number(nextValue) || DEFAULT_VAT_RATE_ID)}
                                                                            >
                                                                                <Select.Trigger
                                                                                    variant="surface"
                                                                                    color="gray"
                                                                                    className={`${modalStyles.radixSelectTrigger} ${shipmentEditorStyles.shipmentVatField}`}
                                                                                />
                                                                                <Select.Content position="popper" className={modalStyles.radixSelectContent}>
                                                                                    {VAT_RATE_OPTIONS.map((option) => (
                                                                                        <Select.Item key={option.id} value={String(option.id)}>
                                                                                            {option.label}
                                                                                        </Select.Item>
                                                                                    ))}
                                                                                </Select.Content>
                                                                            </Select.Root>

                                                                            <Text as="span" size="2" weight="medium" className={shipmentEditorStyles.shipmentPositionTotal}>
                                                                                {formatCurrency(total)}
                                                                            </Text>

                                                                            <Button
                                                                                type="button"
                                                                                variant="surface"
                                                                                color="gray"
                                                                                highContrast
                                                                                onClick={() => removeManualPosition(index)}
                                                                                disabled={manualPositions.length === 1}
                                                                                className={shipmentEditorStyles.shipmentRemovePositionButton}
                                                                            >
                                                                                ×
                                                                            </Button>
                                                                        </Box>
                                                                    );
                                                                })}
                                                            </Flex>
                                                        </Box>
                                                    </div>
                                                </div>

                                                <Flex justify="end" className={shipmentEditorStyles.modalPreviewTotal}>
                                                    <Flex direction="column" align="end" gap="1">
                                                        <Text size="2" color="gray">
                                                            Стоимость доставки: {formatCurrency(shipmentDeliveryAmount)}
                                                        </Text>
                                                        <Text weight="bold">
                                                            Итого: {formatCurrency(manualPositionsTotal + shipmentDeliveryAmount)}
                                                        </Text>
                                                    </Flex>
                                                </Flex>
                                            </>
                                        ) : null}
                                    </>
                                ) : null}

                                {formData.заявка_id && editPreviewPositions.length > 0 ? (
                                    <>
                                        <div className={shipmentEditorStyles.modalPreviewTableWrap}>
                                            <Table.Root variant="surface" className={shipmentEditorStyles.modalPreviewTable}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Ед.изм</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Кол-во</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={shipmentEditorStyles.textRight}>Цена, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={shipmentEditorStyles.textRight}>Сумма без НДС, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>НДС</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={shipmentEditorStyles.textRight}>Сумма НДС, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={shipmentEditorStyles.textRight}>Всего, ₽</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {editPreviewPositions.map((position) => {
                                                        const vatOption = getVatRateOption(position.ндс_id);
                                                        const fallbackAmounts = calculateVatAmountsFromLine(position.количество, position.цена, position.ндс_ставка ?? vatOption.rate);

                                                        return (
                                                            <Table.Row key={position.id}>
                                                                <Table.Cell>
                                                                    <div className={shipmentEditorStyles.productCellTitle}>{position.товар_название || `Товар #${position.товар_id}`}</div>
                                                                    {position.товар_артикул ? (
                                                                        <div className={shipmentEditorStyles.productCellMeta}>{position.товар_артикул}</div>
                                                                    ) : null}
                                                                </Table.Cell>
                                                                <Table.Cell>{position.товар_единица_измерения || 'шт'}</Table.Cell>
                                                                <Table.Cell>{position.количество}</Table.Cell>
                                                                <Table.Cell className={shipmentEditorStyles.textRight}>{formatCurrency(position.цена || 0)}</Table.Cell>
                                                                <Table.Cell className={shipmentEditorStyles.textRight}>{formatCurrency(position.сумма_без_ндс ?? fallbackAmounts.net)}</Table.Cell>
                                                                <Table.Cell>{position.ндс_название || vatOption.label}</Table.Cell>
                                                                <Table.Cell className={shipmentEditorStyles.textRight}>{formatCurrency(position.сумма_ндс ?? fallbackAmounts.tax)}</Table.Cell>
                                                                <Table.Cell className={shipmentEditorStyles.textRight}>{formatCurrency(position.сумма_всего ?? fallbackAmounts.total)}</Table.Cell>
                                                            </Table.Row>
                                                        );
                                                    })}
                                                </Table.Body>
                                            </Table.Root>
                                        </div>

                                        <Flex justify="end" className={shipmentEditorStyles.modalPreviewTotal}>
                                            <Flex direction="column" align="end" gap="1">
                                                <Text size="2" color="gray">
                                                    Стоимость доставки: {formatCurrency(shipmentDeliveryAmount)}
                                                </Text>
                                                <Text weight="bold">
                                                    Итого: {formatCurrency(editPreviewTotal + shipmentDeliveryAmount)}
                                                </Text>
                                            </Flex>
                                        </Flex>
                                    </>
                                ) : null}
                            </Box>

                            <Flex gap="3" justify="end" className={modalStyles.radixActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    disabled={!formData.заявка_id || operationLoading}
                                    style={{ marginRight: 'auto' }}
                                    className={modalStyles.secondaryButton}
                                    onClick={() => {
                                        if (!canGoToOrder) return;
                                        if (!formData.заявка_id) return;
                                        setIsEditModalOpen(false);
                                        router.push(`/orders/${encodeURIComponent(String(formData.заявка_id))}`);
                                    }}
                                >
                                    Перейти к заявке
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsEditModalOpen(false)}
                                    disabled={operationLoading}
                                    className={modalStyles.secondaryButton}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="submit"
                                    variant="solid"
                                    color="gray"
                                    highContrast
                                    disabled={operationLoading || manualPositionsLoading}
                                    className={modalStyles.primaryButton}
                                >
                                    {operationLoading ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </form>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(ShipmentDetailPage);
