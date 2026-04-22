import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import pageStyles from './ShipmentsPage.module.css';
import deleteConfirmStyles from '../../components/modals/DeleteConfirmation/DeleteConfirmation.module.css';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import { EntityTableSurface } from '../../components/EntityDataTable/EntityDataTable';
import { ShipmentEditorModal } from '../../components/modals/ShipmentEditorModal/ShipmentEditorModal';
import { OrderAttachmentBadges } from '../../components/orders/OrderAttachmentBadges/OrderAttachmentBadges';
import { ShipmentsFilters } from '../../components/shipments/ShipmentsFilters/ShipmentsFilters';
import { ShipmentsPageHeader } from '../../components/shipments/ShipmentsPageHeader/ShipmentsPageHeader';
import { ShipmentsPageSkeleton } from '../../components/shipments/ShipmentsPageSkeleton/ShipmentsPageSkeleton';
import { ShipmentsStats } from '../../components/shipments/ShipmentsStats/ShipmentsStats';
import { ShipmentsTable } from '../../components/shipments/ShipmentsTable/ShipmentsTable';
import { ShipmentsViewTabs } from '../../components/shipments/ShipmentsViewTabs/ShipmentsViewTabs';
import type { Shipment, ShipmentsTab, StatusFilter } from '../../components/shipments/types';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption } from '../../lib/vat';
import { getShipmentDeliveryLabel } from '../../lib/logisticsDeliveryLabels';

const EMPTY_SELECT_VALUE = '__empty__';

interface Order {
    id: number;
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

interface OrderPositionPreview {
    id: number;
    товар_id: number;
    количество: number;
    цена: number;
    сумма?: number;
    ндс_id?: number;
    ндс_название?: string;
    ндс_ставка?: number;
    сумма_без_ндс?: number;
    сумма_ндс?: number;
    сумма_всего?: number;
    товар_название?: string;
    товар_артикул?: string;
    товар_единица_измерения?: string;
}

interface Transport {
    id: number;
    название: string;
}

interface ManualShipmentPosition {
    id?: number;
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
}

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

const createEmptyManualShipmentPosition = (): ManualShipmentPosition => ({
    товар_id: 0,
    количество: 1,
    цена: 0,
    ндс_id: DEFAULT_VAT_RATE_ID,
});

function ShipmentsPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const lastSyncedQueryRef = useRef<string>('');
    const lastAppliedRouterQueryRef = useRef<string>('');

    const importFileInputRef = useRef<HTMLInputElement | null>(null);

    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transports, setTransports] = useState<Transport[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<ShipmentsTab>('all');
    const [transportFilter, setTransportFilter] = useState<string>(EMPTY_SELECT_VALUE);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [formData, setFormData] = useState({
        заявка_id: 0,
        использовать_доставку: true,
        без_учета_склада: false,
        транспорт_id: 0,
        статус: 'в пути',
        номер_отслеживания: '',
        стоимость_доставки: 0
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedOrderPositions, setSelectedOrderPositions] = useState<OrderPositionPreview[]>([]);
    const [selectedOrderPositionsLoading, setSelectedOrderPositionsLoading] = useState(false);
    const [manualPositions, setManualPositions] = useState<ManualShipmentPosition[]>([createEmptyManualShipmentPosition()]);
    const [manualPositionsLoading, setManualPositionsLoading] = useState(false);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingShipment, setDeletingShipment] = useState<Shipment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [attachmentsTypesByShipmentId, setAttachmentsTypesByShipmentId] = useState<Record<number, string[]>>({});

    const canList = Boolean(user?.permissions?.includes('shipments.list'));
    const canView = Boolean(user?.permissions?.includes('shipments.view'));
    const canCreate = Boolean(user?.permissions?.includes('shipments.create'));
    const canEdit = Boolean(user?.permissions?.includes('shipments.edit'));
    const canDelete = Boolean(user?.permissions?.includes('shipments.delete'));

    const canOrdersView = Boolean(user?.permissions?.includes('orders.view'));
    const canOrdersList = Boolean(user?.permissions?.includes('orders.list'));

    const canShipmentOrderView = Boolean(user?.permissions?.includes('shipments.order.view'));
    const canShipmentTrack = Boolean(user?.permissions?.includes('shipments.track'));
    const canShipmentPrint = Boolean(user?.permissions?.includes('shipments.print'));
    const canShipmentsExportExcel = Boolean(user?.permissions?.includes('shipments.export.excel'));
    const canShipmentsImportExcel = Boolean(user?.permissions?.includes('shipments.import.excel'));

    const canGoToOrder = canOrdersView && canShipmentOrderView;
    const canOpenCreateModal = canCreate && canEdit;

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

    const orderSelectOptions = useMemo(() => (
        [{ value: '', label: 'Без заявки' }, ...orders.map((order) => ({
            value: String(order.id),
            label: `Заявка #${order.id}`,
        }))]
    ), [orders]);

    const transportSelectOptions = useMemo(() => (
        transports.map((transport) => ({
            value: String(transport.id),
            label: transport.название,
        }))
    ), [transports]);

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
        if (isSubmitting || manualPositionsLoading) return false;
        if (formData.использовать_доставку && formData.транспорт_id <= 0) return false;
        if (formData.заявка_id > 0) return true;
        return normalizedManualPositions.length > 0;
    }, [
        formData.использовать_доставку,
        formData.транспорт_id,
        formData.заявка_id,
        isSubmitting,
        manualPositionsLoading,
        normalizedManualPositions.length,
    ]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean((event.target as Node | null) && filtersDropdownRef.current?.contains(event.target as Node));
            const targetElement = event.target instanceof Element ? event.target : null;
            const isInsideSelectPortal = Boolean(
                targetElement?.closest('[data-slot="select-content"], [data-slot="select-item"]')
            );

            if (isInsideDropdown || isInsideSelectPortal) return;
            setIsFiltersOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFiltersOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFiltersOpen]);

    const getTransportText = useCallback((shipment: Shipment) => {
        if (shipment.использовать_доставку === false) return getShipmentDeliveryLabel(false);
        return shipment.транспорт_название || (shipment.транспорт_id ? `ТК #${shipment.транспорт_id}` : 'Не указана');
    }, []);

    const getCostText = useCallback((shipment: Shipment) => {
        if (shipment.использовать_доставку === false) return 'Не используется';
        return shipment.стоимость_доставки == null ? 'Не указана' : formatCurrency(shipment.стоимость_доставки);
    }, []);

    const getProductSalePrice = useCallback((product?: Product | null) => Number(product?.цена_продажи ?? 0), []);

    const resetShipmentEditor = useCallback(() => {
        setEditingId(null);
        setFormData({
            заявка_id: 0,
            использовать_доставку: true,
            без_учета_склада: false,
            транспорт_id: 0,
            статус: 'в пути',
            номер_отслеживания: '',
            стоимость_доставки: 0,
        });
        setSelectedOrderPositions([]);
        setSelectedOrderPositionsLoading(false);
        setManualPositions([createEmptyManualShipmentPosition()]);
        setManualPositionsLoading(false);
    }, []);

    const handleManualPositionChange = useCallback((index: number, field: keyof ManualShipmentPosition, value: string | number) => {
        setManualPositions((prev) => {
            const next = [...prev];
            const parsedValue = typeof value === 'string' ? (Number(value) || 0) : value;
            next[index] = {
                ...next[index],
                [field]: parsedValue,
            };

            if (field === 'товар_id') {
                const product = productsById.get(Number(parsedValue));
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
    }, [getProductSalePrice, productsById]);

    const addManualPosition = useCallback(() => {
        setManualPositions((prev) => [...prev, createEmptyManualShipmentPosition()]);
    }, []);

    const removeManualPosition = useCallback((index: number) => {
        setManualPositions((prev) => (
            prev.length > 1 ? prev.filter((_, currentIndex) => currentIndex !== index) : prev
        ));
    }, []);

    const fetchOrderPositionsPreview = useCallback(async (orderId: number, shipmentId?: number | null) => {
        if (!orderId || !canOrdersView) {
            setSelectedOrderPositions([]);
            return;
        }

        try {
            setSelectedOrderPositionsLoading(true);
            const endpoint = shipmentId
                ? `/api/shipments/${encodeURIComponent(String(shipmentId))}`
                : `/api/orders/${encodeURIComponent(String(orderId))}/shipment-draft`;
            const response = await fetch(endpoint);
            if (!response.ok) {
                setSelectedOrderPositions([]);
                return;
            }

            const data = await response.json();
            const positions = shipmentId
                ? (Array.isArray(data?.позиции) ? data.позиции : [])
                : (Array.isArray(data) ? data : []);
            setSelectedOrderPositions(positions);
        } catch (previewError) {
            console.error('Error loading shipment order preview:', previewError);
            setSelectedOrderPositions([]);
        } finally {
            setSelectedOrderPositionsLoading(false);
        }
    }, [canOrdersView]);

    useEffect(() => {
        if (!showAddModal) {
            setSelectedOrderPositions([]);
            setSelectedOrderPositionsLoading(false);
            return;
        }

        if (!formData.заявка_id) {
            setSelectedOrderPositions([]);
            return;
        }

        fetchOrderPositionsPreview(formData.заявка_id, editingId);
    }, [showAddModal, formData.заявка_id, editingId, fetchOrderPositionsPreview]);

    const positionsPreviewTotal = useMemo(() => (
        selectedOrderPositions.reduce((sum, position) => {
            if (typeof position.сумма_всего === 'number') return sum + position.сумма_всего;
            return sum + calculateVatAmountsFromLine(position.количество, position.цена, getVatRateOption(position.ндс_id).rate).total;
        }, 0)
    ), [selectedOrderPositions]);

    const syncShipmentsUrl = useCallback((next: {
        tab: ShipmentsTab;
        q: string;
        transport: string;
        status: StatusFilter;
    }) => {
        const query = { ...router.query } as Record<string, string | string[] | undefined>;

        if (next.tab && next.tab !== 'all') query.tab = String(next.tab);
        else delete query.tab;

        if ((next.q || '').trim()) query.q = String(next.q).trim();
        else delete query.q;

        if (next.transport && next.transport !== EMPTY_SELECT_VALUE) query.transport = String(next.transport);
        else delete query.transport;

        if (next.status && next.status !== 'all') query.status = String(next.status);
        else delete query.status;

        router.replace(
            {
                pathname: router.pathname,
                query,
            },
            undefined,
            { shallow: true }
        );
    }, [router]);

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify(router.query);
        if (signature === lastAppliedRouterQueryRef.current) return;
        lastAppliedRouterQueryRef.current = signature;

        const tabRaw = router.query.tab;
        const qRaw = router.query.q;
        const transportRaw = router.query.transport;
        const statusRaw = router.query.status;

        const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
        const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
        const transport = Array.isArray(transportRaw) ? transportRaw[0] : transportRaw;
        const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;

        const nextTab: ShipmentsTab = (tab === 'in_transit' || tab === 'delivered' || tab === 'canceled' || tab === 'all')
            ? (tab as ShipmentsTab)
            : 'all';
        const nextQ = q !== undefined ? String(q) : '';
        const nextTransport = transport !== undefined ? String(transport) : EMPTY_SELECT_VALUE;
        const nextStatus: StatusFilter = (status === 'в пути' || status === 'доставлено' || status === 'получено' || status === 'отменено' || status === 'all')
            ? (status as StatusFilter)
            : 'all';

        setActiveTab(nextTab);
        setSearchTerm(nextQ);
        setTransportFilter(nextTransport || EMPTY_SELECT_VALUE);
        if (nextTab === 'all') setStatusFilter(nextStatus);

        const nextSignature = JSON.stringify({
            tab: nextTab,
            q: nextQ,
            transport: nextTransport,
            status: nextTab === 'all' ? nextStatus : undefined,
        });
        lastSyncedQueryRef.current = nextSignature;
    }, [router.isReady, router.query]);

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify({
            tab: activeTab,
            q: searchTerm,
            transport: transportFilter,
            status: activeTab === 'all' ? statusFilter : undefined,
        });

        if (signature === lastSyncedQueryRef.current) return;
        lastSyncedQueryRef.current = signature;

        syncShipmentsUrl({
            tab: activeTab,
            q: searchTerm,
            transport: transportFilter,
            status: activeTab === 'all' ? statusFilter : 'all',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, activeTab, searchTerm, transportFilter, statusFilter]);

    const getTrackingUrl = useCallback((shipment: Shipment): string | null => {
        const track = (shipment.номер_отслеживания || '').trim();
        if (!track) return null;

        const carrierName = (shipment.транспорт_название || '').toLowerCase();
        if (carrierName.includes('деловые линии') || carrierName.includes('деловые') || carrierName.includes('дл')) {
            return `https://www.dellin.ru/tracker/orders/${encodeURIComponent(track)}/`;
        }
        if (carrierName.includes('сдэк') || carrierName.includes('cdek')) {
            return `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(track)}`;
        }

        return null;
    }, []);

    const handlePrintDocumentsWord = useCallback(async (shipment: Shipment) => {
        const shipDate = shipment.дата_отгрузки ? new Date(shipment.дата_отгрузки).toLocaleDateString('ru-RU') : '-';
        const shipTime = shipment.дата_отгрузки ? new Date(shipment.дата_отгрузки).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        const costText = getCostText(shipment);
        const statusText = getStatusText((shipment.статус || '').toLowerCase());
        const orderText = shipment.заявка_id
            ? (shipment.заявка_номер ? `№${shipment.заявка_номер}` : `#${shipment.заявка_id}`)
            : 'Без заявки';
        const transportText = getTransportText(shipment);
        const trackText = shipment.номер_отслеживания || 'Не указан';

        const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Отгрузка №${shipment.id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #111; }
        h1 { text-align: center; margin: 0 0 20px; }
        .meta { margin: 16px 0 24px; }
        .meta-row { display: flex; gap: 16px; margin: 6px 0; }
        .label { width: 180px; color: #555; }
        .value { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin: 18px 0; }
        th { background-color: #f3f3f3; padding: 10px; text-align: left; border: 1px solid #ddd; }
        td { padding: 10px; border: 1px solid #ddd; }
        .signature { margin-top: 80px; }
        .signature-line { display: inline-block; width: 220px; border-top: 1px solid #000; margin: 5px 20px 0 0; position: relative; top: -5px; }
        .signature-label { display: inline-block; width: 220px; margin-right: 20px; }
      </style>
    </head>
    <body>
      <h1>Отгрузка №${shipment.id}</h1>
      <div class='meta'>
        <div class='meta-row'><div class='label'>Заявка</div><div class='value'>${orderText}</div></div>
        <div class='meta-row'><div class='label'>Транспортная компания</div><div class='value'>${transportText}</div></div>
        <div class='meta-row'><div class='label'>Номер отслеживания</div><div class='value'>${trackText}</div></div>
        <div class='meta-row'><div class='label'>Дата отгрузки</div><div class='value'>${shipDate}${shipTime ? ` ${shipTime}` : ''}</div></div>
        <div class='meta-row'><div class='label'>Стоимость доставки</div><div class='value'>${costText}</div></div>
        <div class='meta-row'><div class='label'>Статус</div><div class='value'>${statusText}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Параметр</th>
            <th>Значение</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>ID отгрузки</td><td>${shipment.id}</td></tr>
          <tr><td>ID заявки</td><td>${shipment.заявка_id || '—'}</td></tr>
          <tr><td>ID ТК</td><td>${shipment.транспорт_id}</td></tr>
        </tbody>
      </table>

      <div class='signature'>
        <div>
          <span class='signature-label'>Ответственный</span>
          <span class='signature-line'></span>
          <span>(______________)</span>
        </div>
      </div>
    </body>
    </html>
  `;

        const blob = new Blob(['\ufeff', htmlContent], {
            type: 'application/msword;charset=utf-8',
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Отгрузка_${shipment.id}_${shipDate.replace(/\./g, '-')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [getCostText, getTransportText]);

    const fetchShipments = useCallback(async () => {
        try {
            if (shipments.length === 0) setLoading(true);
            else setIsRefreshing(true);
            const response = await fetch('/api/shipments');

            if (!response.ok) {
                throw new Error('Ошибка загрузки отгрузок');
            }

            const data = await response.json();
            const nextShipments = Array.isArray(data) ? data : [];
            let nextAttachmentsMap: Record<number, string[]> = {};

            const ids = nextShipments
                .map((shipment) => Number(shipment?.id))
                .filter((n) => Number.isInteger(n) && n > 0);

            if (ids.length > 0) {
                try {
                    const summaryRes = await fetch(
                        `/api/attachments/summary?entity_type=shipment&entity_ids=${encodeURIComponent(ids.join(','))}`
                    );
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as AttachmentSummaryItem[];
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        nextAttachmentsMap = map;
                    }
                } catch (summaryError) {
                    console.error('Error fetching shipment attachments summary:', summaryError);
                }
            }

            setAttachmentsTypesByShipmentId(nextAttachmentsMap);
            setShipments(nextShipments);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [shipments.length]);

    const renderAttachmentBadges = (shipmentId: number) => {
        const types = attachmentsTypesByShipmentId[shipmentId] || [];
        const normalized = Array.from(new Set(types));
        const show = normalized.filter((t) => ['pdf', 'word', 'excel', 'image', 'file'].includes(t));

        return <OrderAttachmentBadges types={show} reserveSpace />;
    };

    const fetchOrders = useCallback(async () => {
        if (!canOrdersList) return;
        try {
            const response = await fetch('/api/orders');

            if (!response.ok) {
                throw new Error('Ошибка загрузки заявок');
            }

            const data = await response.json();
            setOrders(data);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    }, [canOrdersList]);

    const fetchTransports = useCallback(async () => {
        try {
            const response = await fetch('/api/transport');

            if (!response.ok) {
                throw new Error('Ошибка загрузки транспортных компаний');
            }

            const data = await response.json();
            // The transport API returns an object with a 'transport' property
            setTransports(data.transport || []);
        } catch (err) {
            console.error('Error fetching transports:', err);
        }
    }, []);

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
            const positions = Array.isArray(data?.позиции)
                ? data.позиции.map((position: Record<string, unknown>) => ({
                    id: Number(position?.id) || undefined,
                    товар_id: Number(position?.товар_id) || 0,
                    количество: Number(position?.количество) || 1,
                    цена: Number(position?.цена) || 0,
                    ндс_id: Number(position?.ндс_id) || DEFAULT_VAT_RATE_ID,
                }))
                : [];

            setManualPositions(positions.length > 0 ? positions : [createEmptyManualShipmentPosition()]);
        } catch (shipmentPositionsError) {
            console.error('Error loading standalone shipment positions:', shipmentPositionsError);
            setManualPositions([createEmptyManualShipmentPosition()]);
            alert(shipmentPositionsError instanceof Error ? shipmentPositionsError.message : 'Не удалось загрузить состав отгрузки');
        } finally {
            setManualPositionsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!showAddModal) return;
        fetchProducts();
        fetchWarehouseStock();
    }, [showAddModal, fetchProducts, fetchWarehouseStock]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchShipments();
        fetchOrders();
        fetchTransports();
    }, [authLoading, canList, fetchOrders, fetchShipments, fetchTransports]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        if (activeTab === 'all') setStatusFilter('all');
        if (activeTab === 'in_transit') setStatusFilter('в пути');
        if (activeTab === 'delivered') setStatusFilter('доставлено');
        if (activeTab === 'canceled') setStatusFilter('отменено');
    }, [activeTab]);

    useEffect(() => {
        if (!loading) setTableKey((k) => k + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const filteredShipments = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const byTab =
            activeTab === 'in_transit'
                ? shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'в пути')
                : activeTab === 'delivered'
                    ? shipments.filter((s) => ['доставлено', 'получено'].includes((s.статус || '').toLowerCase().trim()))
                    : activeTab === 'canceled'
                        ? shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'отменено')
                        : shipments;
        const byStatus =
            activeTab !== 'all' || statusFilter === 'all'
                ? byTab
                : byTab.filter((s) => (s.статус || '').toLowerCase().trim() === statusFilter);

        const byTransport =
            transportFilter === EMPTY_SELECT_VALUE
                ? byStatus
                : byStatus.filter((s) => String(s.транспорт_id) === String(transportFilter));
        if (!q) return byTransport;
        return byTransport.filter((s) => {
            const id = String(s.id);
            const orderId = String(s.заявка_id);
            const transport = String(s.транспорт_название || '').toLowerCase();
            const tracking = String(s.номер_отслеживания || '').toLowerCase();
            const status = String(s.статус || '').toLowerCase();
            return id.includes(q) || orderId.includes(q) || transport.includes(q) || tracking.includes(q) || status.includes(q);
        });
    }, [activeTab, searchTerm, shipments, statusFilter, transportFilter]);

    const metrics = useMemo(() => {
        const total = shipments.length;
        const inTransit = shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'в пути').length;
        const delivered = shipments.filter((s) => ['доставлено', 'получено'].includes((s.статус || '').toLowerCase().trim())).length;
        const canceled = shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'отменено').length;
        const successRate = total > 0 ? (delivered / total) * 100 : 0;
        return { total, inTransit, delivered, canceled, successRate };
    }, [shipments]);

    const exportCurrentToExcel = () => {
        if (!canShipmentsExportExcel) return;
        const rows = filteredShipments.map((s) => ({
            id: s.id,
            заявка_id: s.заявка_id,
            использовать_доставку: s.использовать_доставку !== false ? 'Да' : 'Нет',
            транспорт_id: s.транспорт_id ?? '',
            статус: s.статус || 'в пути',
            номер_отслеживания: s.номер_отслеживания || '',
            дата_отгрузки: s.дата_отгрузки,
            стоимость_доставки: s.стоимость_доставки ?? '',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Отгрузки');
        const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
        XLSX.writeFile(wb, `Отгрузки_${date}.xlsx`);
    };

    const parseExcelToRows = useCallback(async (file: File): Promise<Record<string, unknown>[]> => {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheetName = wb.SheetNames?.[0];
        const ws = sheetName ? wb.Sheets[sheetName] : null;
        if (!ws) return [];

        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
        return Array.isArray(rows) ? rows : [];
    }, []);

    const handleImportExcelClick = useCallback(() => {
        if (!canShipmentsImportExcel) return;
        importFileInputRef.current?.click();
    }, [canShipmentsImportExcel]);

    const handleImportExcelFile = useCallback(async (file: File) => {
        if (!canShipmentsImportExcel) return;

        try {
            setError(null);
            setIsSubmitting(true);

            const rows = await parseExcelToRows(file);
            if (rows.length === 0) {
                setError('Excel пустой или не распознан');
                return;
            }

            const pick = (row: Record<string, unknown>, keys: string[]) => {
                for (const k of keys) {
                    if (row?.[k] !== undefined) return row[k];
                }
                return undefined;
            };

            const getNum = (v: unknown): number => {
                const n = Number(String(v ?? '').trim());
                return Number.isFinite(n) ? n : 0;
            };

            const importRows = rows.map((r) => {
                const orderId = getNum(pick(r, ['заявка_id', 'Заявка ID', 'Заявка', 'ЗаявкаID', 'Заявка Id']));
                const transportId = getNum(pick(r, ['транспорт_id', 'Транспорт ID', 'ТК ID', 'ТК', 'Транспорт']));
                const status = String(pick(r, ['статус', 'Статус']) ?? 'в пути').trim() || 'в пути';
                const track = String(pick(r, ['номер_отслеживания', 'Номер отслеживания', 'Трек', 'трек']) ?? '').trim();
                const shippedAt = String(pick(r, ['дата_отгрузки', 'Дата отгрузки']) ?? '').trim();
                const costRaw = pick(r, ['стоимость_доставки', 'Стоимость доставки']);
                const cost = costRaw === '' ? null : (Number(String(costRaw).replace(',', '.')) || null);

                return {
                    заявка_id: orderId,
                    транспорт_id: transportId,
                    статус: status,
                    номер_отслеживания: track ? track : null,
                    дата_отгрузки: shippedAt ? shippedAt : null,
                    стоимость_доставки: cost,
                };
            });

            const res = await fetch('/api/shipments/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: importRows }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({} as Record<string, unknown>));
                const msg = String(data?.error || data?.message || '').trim() || 'Ошибка импорта из Excel';

                const details = Array.isArray(data?.details) ? data.details : [];
                if (details.length > 0) {
                    const lines = details.slice(0, 10).map((detail) => {
                        const row = detail as Record<string, unknown>;
                        const idx = Number(row?.index);
                        const rowNo = Number.isFinite(idx) ? idx + 2 : '';
                        const err = String(row?.error || '').trim();
                        return rowNo ? `Строка ${rowNo}: ${err}` : err;
                    });
                    setError([msg, '', ...lines].join('\n'));
                } else {
                    setError(msg);
                }
                return;
            }

            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            await fetchShipments();
            const inserted = Number(data?.inserted);
            alert(`Импорт завершен. Перезаписано строк: ${Number.isFinite(inserted) ? inserted : importRows.length}.`);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка импорта из Excel');
        } finally {
            setIsSubmitting(false);
            if (importFileInputRef.current) importFileInputRef.current.value = '';
        }
    }, [canShipmentsImportExcel, fetchShipments, parseExcelToRows]);

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU', {
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

    const getStatusText = (status: string) => {
        switch (status) {
            case 'в пути': return 'В ПУТИ';
            case 'получено': return 'ПОЛУЧЕНО';
            case 'доставлено': return 'ДОСТАВЛЕНО';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleSubmitShipment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingId) {
            if (!canEdit) return;
        } else {
            if (!canOpenCreateModal) return;
        }

        if (formData.использовать_доставку && formData.транспорт_id <= 0) {
            alert(formData.использовать_доставку
                ? 'Пожалуйста, выберите транспортную компанию'
                : 'Проверьте данные формы');
            return;
        }

        if (!formData.заявка_id && normalizedManualPositions.length === 0) {
            alert('Для самостоятельной отгрузки добавьте хотя бы одну позицию');
            return;
        }

        try {
            setIsSubmitting(true);
            if (!formData.заявка_id && !formData.без_учета_склада) {
                const hasUnavailableProduct = normalizedManualPositions.some((position) => (
                    (warehouseStockByProductId.get(Number(position.товар_id)) || 0) <= 0
                ));
                if (hasUnavailableProduct) {
                    throw new Error('Для отгрузки со склада выберите только товары, которые есть в наличии');
                }
            }

            const payload = {
                заявка_id: formData.заявка_id > 0 ? Number(formData.заявка_id) : null,
                использовать_доставку: formData.использовать_доставку,
                без_учета_склада: formData.заявка_id > 0 ? false : formData.без_учета_склада,
                транспорт_id: formData.использовать_доставку ? Number(formData.транспорт_id) : null,
                статус: formData.статус,
                номер_отслеживания: formData.использовать_доставку && formData.номер_отслеживания.trim() ? formData.номер_отслеживания.trim() : null,
                стоимость_доставки: formData.использовать_доставку && formData.стоимость_доставки ? Number(formData.стоимость_доставки) : null,
                позиции: formData.заявка_id > 0 ? undefined : normalizedManualPositions,
            };

            const response = await fetch('/api/shipments', {
                method: editingId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка добавления отгрузки');
            }

            // Refresh the list
            fetchShipments();
            setShowAddModal(false);
            resetShipmentEditor();

            alert(editingId ? 'Отгрузка успешно обновлена' : 'Отгрузка успешно добавлена');
        } catch (error) {
            alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenDelete = (shipment: Shipment) => {
        if (!canDelete) return;
        setDeletingShipment(shipment);
        setDeleteError(null);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingShipment) return;
        if (!canDelete) return;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(`/api/shipments?id=${deletingShipment.id}`, {
                method: 'DELETE',
            });

            const errorData = await response.json().catch(() => ({} as Record<string, unknown>));

            if (!response.ok) {
                throw new Error(String(errorData?.error || 'Ошибка удаления отгрузки'));
            }

            await fetchShipments();
            setIsDeleteDialogOpen(false);
            setDeletingShipment(null);
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditShipment = useCallback(async (shipment: Shipment) => {
        setError(null);
        setEditingId(shipment.id);
        setFormData({
            заявка_id: shipment.заявка_id == null ? 0 : Number(shipment.заявка_id) || 0,
            использовать_доставку: shipment.использовать_доставку !== false,
            без_учета_склада: shipment.без_учета_склада === true,
            транспорт_id: Number(shipment.транспорт_id) || 0,
            статус: shipment.статус || 'в пути',
            номер_отслеживания: shipment.номер_отслеживания || '',
            стоимость_доставки: Number(shipment.стоимость_доставки) || 0,
        });
        setSelectedOrderPositions([]);
        setManualPositions([createEmptyManualShipmentPosition()]);
        setShowAddModal(true);

        if (shipment.заявка_id == null) {
            await loadDirectShipmentPositions(shipment.id);
        }
    }, [loadDirectShipmentPositions]);

    const handleTrackShipment = useCallback((shipment: Shipment) => {
        const trackingUrl = getTrackingUrl(shipment);
        if (!trackingUrl) return;
        window.open(trackingUrl, '_blank', 'noopener,noreferrer');
    }, [getTrackingUrl]);

    const hasRowActions = canView || canGoToOrder || canShipmentTrack || canEdit || canShipmentPrint || canDelete;

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    if (error) {
        return (
            <div className={pageStyles.container}>
                <div className={pageStyles.card}>
                    <div className={pageStyles.errorState}>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>Ошибка загрузки</div>
                        <div className={pageStyles.errorText}>{error}</div>
                        <button type="button" className={pageStyles.button} onClick={() => void fetchShipments()}>
                            Повторить попытку
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={pageStyles.container}>
            <ShipmentsPageHeader
                canCreate={canOpenCreateModal}
                isRefreshing={loading || isRefreshing || minRefreshSpinActive}
                refreshKey={refreshClickKey}
                onCreate={() => {
                    resetShipmentEditor();
                    setShowAddModal(true);
                }}
                onRefresh={() => {
                    setTableKey((k) => k + 1);
                    setRefreshClickKey((v) => v + 1);
                    setMinRefreshSpinActive(true);
                    void fetchShipments();
                }}
            />

            <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportExcelFile(file);
                }}
            />

            {loading && shipments.length === 0 ? (
                <ShipmentsPageSkeleton />
            ) : (
                <div className={pageStyles.card}>
                    <ShipmentsStats
                        canceledCount={metrics.canceled}
                        deliveredCount={metrics.delivered}
                        inTransitCount={metrics.inTransit}
                        successRate={metrics.successRate}
                    />

                    <div className={pageStyles.tabsSection}>
                        <ShipmentsViewTabs
                            activeTab={activeTab}
                            allCount={metrics.total}
                            canceledCount={metrics.canceled}
                            deliveredCount={metrics.delivered}
                            inTransitCount={metrics.inTransit}
                            onChange={setActiveTab}
                        />
                    </div>

                    <ShipmentsFilters
                        canExport={canShipmentsExportExcel}
                        canImport={canShipmentsImportExcel}
                        filtersDropdownRef={filtersDropdownRef}
                        filterTriggerRef={filterTriggerRef}
                        importDisabled={isSubmitting}
                        isFiltersOpen={isFiltersOpen}
                        searchInputValue={searchTerm}
                        statusFilter={statusFilter}
                        transportFilter={transportFilter}
                        transports={transports}
                        onExport={exportCurrentToExcel}
                        onImport={handleImportExcelClick}
                        onSearchInputChange={setSearchTerm}
                        setIsFiltersOpen={setIsFiltersOpen}
                        onStatusFilterChange={(next) => {
                            setStatusFilter(next);
                            setActiveTab('all');
                        }}
                        onTransportFilterChange={setTransportFilter}
                    />

                    {filteredShipments.length === 0 ? (
                        <EntityTableSurface
                            variant="embedded"
                            clip="bottom"
                            className={pageStyles.tableContainer}
                        >
                            <div className={pageStyles.emptyState}>Отгрузки не найдены.</div>
                        </EntityTableSurface>
                    ) : (
                        <EntityTableSurface
                            variant="embedded"
                            clip="bottom"
                            className={pageStyles.tableContainer}
                            key={tableKey}
                        >
                            <ShipmentsTable
                                canDelete={canDelete}
                                canEdit={canEdit}
                                canGoToOrder={canGoToOrder}
                                canPrint={canShipmentPrint}
                                canTrack={canShipmentTrack}
                                canView={canView}
                                hasRowActions={hasRowActions}
                                shipments={filteredShipments}
                                formatCurrency={formatCurrency}
                                formatDateTime={formatDateTime}
                                getCostText={getCostText}
                                getTrackingUrl={getTrackingUrl}
                                getTransportText={getTransportText}
                                renderAttachmentBadges={renderAttachmentBadges}
                                onDeleteShipment={handleOpenDelete}
                                onEditShipment={handleEditShipment}
                                onOpenOrder={(shipment) => {
                                    if (!shipment.заявка_id) return;
                                    void router.push(`/orders/${encodeURIComponent(String(shipment.заявка_id))}`);
                                }}
                                onOpenShipment={(shipment) => {
                                    void router.push(`/shipments/${encodeURIComponent(String(shipment.id))}`);
                                }}
                                onPrintShipment={async (shipment) => {
                                    try {
                                        await handlePrintDocumentsWord(shipment);
                                    } catch (printError) {
                                        console.error(printError);
                                        setError(printError instanceof Error ? printError.message : 'Ошибка печати документов');
                                    }
                                }}
                                onTrackShipment={handleTrackShipment}
                            />
                        </EntityTableSurface>
                    )}
                </div>
            )}

            <ShipmentEditorModal
                availableManualProducts={availableManualProducts}
                canGoToOrder={canGoToOrder}
                canSubmit={canSubmitShipment}
                editingId={editingId}
                formData={formData}
                isOpen={showAddModal}
                isSubmitting={isSubmitting}
                manualPositions={manualPositions}
                manualPositionsLoading={manualPositionsLoading}
                manualPositionsTotal={manualPositionsTotal}
                onAddManualPosition={addManualPosition}
                onClose={() => {
                    setShowAddModal(false);
                    resetShipmentEditor();
                }}
                onManualPositionChange={handleManualPositionChange}
                onOpenOrder={() => {
                    if (!canGoToOrder || !formData.заявка_id) return;
                    setShowAddModal(false);
                    resetShipmentEditor();
                    void router.push(`/orders/${encodeURIComponent(String(formData.заявка_id))}`);
                }}
                onRemoveManualPosition={removeManualPosition}
                onSubmit={handleSubmitShipment}
                orderSelectOptions={orderSelectOptions}
                positionsPreviewTotal={positionsPreviewTotal}
                productsById={productsById}
                selectedOrderPositions={selectedOrderPositions}
                selectedOrderPositionsLoading={selectedOrderPositionsLoading}
                setFormData={setFormData}
                shipmentDeliveryAmount={shipmentDeliveryAmount}
                transportSelectOptions={transportSelectOptions}
                warehouseStockByProductId={warehouseStockByProductId}
            />

            <DeleteConfirmation
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setDeletingShipment(null);
                    setDeleteError(null);
                }}
                onConfirm={handleDeleteConfirm}
                loading={isDeleting}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить эту отгрузку?"
                warning="Это действие нельзя отменить. Карточка отгрузки и связанные данные будут удалены."
                details={deletingShipment ? (
                    <div className={deleteConfirmStyles.positionsSection}>
                        <div className={deleteConfirmStyles.orderTitle}>Отгрузка #{deletingShipment.id}</div>
                        <div className={deleteConfirmStyles.orderMeta}>
                            {deletingShipment.заявка_id ? `Заявка: #${deletingShipment.заявка_id}` : 'Самостоятельная отгрузка без заявки'}
                        </div>
                        <div className={deleteConfirmStyles.orderMeta}>
                            Способ: {getTransportText(deletingShipment)}
                        </div>
                        {deleteError ? (
                            <div className={pageStyles.errorText}>{deleteError}</div>
                        ) : null}
                    </div>
                ) : null}
            />
        </div>
    );
}

export default withLayout(ShipmentsPage);
