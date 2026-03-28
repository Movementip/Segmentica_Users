import React, { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './Shipments.module.css';
import modalStyles from '../../components/Modal.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Dialog, DropdownMenu, Flex, Table, Text, TextField, Select, Tabs, Card } from '@radix-ui/themes';
import { FiDownload, FiEdit2, FiEye, FiFileText, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiTruck, FiUpload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../lib/vat';

const EMPTY_SELECT_VALUE = '__empty__';

const MotionTableRow = motion(Table.Row);

interface Shipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер?: string | number;
    транспорт_название?: string;
}

interface Order {
    id: number;
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

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

type ShipmentsTab = 'all' | 'in_transit' | 'delivered' | 'canceled';
type StatusFilter = 'all' | 'в пути' | 'доставлено' | 'отменено';

function ShipmentsPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const lastSyncedQueryRef = useRef<string>('');
    const lastAppliedRouterQueryRef = useRef<string>('');

    const importFileInputRef = useRef<HTMLInputElement | null>(null);

    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transports, setTransports] = useState<Transport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [importNotice, setImportNotice] = useState<string | null>(null);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<ShipmentsTab>('all');
    const [transportFilter, setTransportFilter] = useState<string>(EMPTY_SELECT_VALUE);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const tabsListRef = useRef<HTMLDivElement | null>(null);
    const [tabsIndicatorStyle, setTabsIndicatorStyle] = useState<React.CSSProperties>({
        transform: 'translateX(0px)',
        width: 0,
        opacity: 0,
    });
    const [isTabsIndicatorReady, setIsTabsIndicatorReady] = useState(false);
    const [formData, setFormData] = useState({
        заявка_id: 0,
        транспорт_id: 0,
        статус: 'в пути',
        номер_отслеживания: '',
        стоимость_доставки: 0
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedOrderPositions, setSelectedOrderPositions] = useState<OrderPositionPreview[]>([]);
    const [selectedOrderPositionsLoading, setSelectedOrderPositionsLoading] = useState(false);

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

    const canSubmitShipment = useMemo(() => {
        if (isSubmitting) return false;
        return formData.заявка_id > 0 && formData.транспорт_id > 0;
    }, [formData.заявка_id, formData.транспорт_id, isSubmitting]);

    const fetchOrderPositionsPreview = useCallback(async (orderId: number) => {
        if (!orderId || !canOrdersView) {
            setSelectedOrderPositions([]);
            return;
        }

        try {
            setSelectedOrderPositionsLoading(true);
            const response = await fetch(`/api/orders/${encodeURIComponent(String(orderId))}`);
            if (!response.ok) {
                setSelectedOrderPositions([]);
                return;
            }

            const data = await response.json();
            setSelectedOrderPositions(Array.isArray(data?.позиции) ? data.позиции : []);
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

        fetchOrderPositionsPreview(formData.заявка_id);
    }, [showAddModal, formData.заявка_id, fetchOrderPositionsPreview]);

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
        const query = { ...router.query } as Record<string, any>;

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
        const nextStatus: StatusFilter = (status === 'в пути' || status === 'доставлено' || status === 'отменено' || status === 'all')
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
        const costText = shipment.стоимость_доставки ? formatCurrency(shipment.стоимость_доставки) : 'Не указана';
        const statusText = getStatusText((shipment.статус || '').toLowerCase());
        const orderText = shipment.заявка_номер ? `№${shipment.заявка_номер}` : `#${shipment.заявка_id}`;
        const transportText = shipment.транспорт_название || (shipment.транспорт_id ? `ТК #${shipment.транспорт_id}` : '-');
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
          <tr><td>ID заявки</td><td>${shipment.заявка_id}</td></tr>
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
    }, []);

    const fetchShipments = useCallback(async () => {
        try {
            if (shipments.length === 0) setLoading(true);
            else setIsRefreshing(true);
            const response = await fetch('/api/shipments');

            if (!response.ok) {
                throw new Error('Ошибка загрузки отгрузок');
            }

            const data = await response.json();
            setShipments(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [shipments.length]);

    useEffect(() => {
        const ids = shipments.map((s) => Number(s.id)).filter((n) => Number.isInteger(n) && n > 0);
        if (ids.length === 0) {
            setAttachmentsTypesByShipmentId({});
            return;
        }

        const controller = new AbortController();

        const fetchSummary = async () => {
            try {
                const res = await fetch(
                    `/api/attachments/summary?entity_type=shipment&entity_ids=${encodeURIComponent(ids.join(','))}`,
                    { signal: controller.signal }
                );
                if (!res.ok) return;
                const data = (await res.json()) as AttachmentSummaryItem[];
                const map: Record<number, string[]> = {};
                for (const item of Array.isArray(data) ? data : []) {
                    map[Number(item.entity_id)] = Array.isArray(item.types) ? item.types : [];
                }
                setAttachmentsTypesByShipmentId(map);
            } catch (e) {
                if ((e as any)?.name === 'AbortError') return;
                console.error(e);
            }
        };

        void fetchSummary();
        return () => controller.abort();
    }, [shipments]);

    const renderAttachmentBadges = (shipmentId: number) => {
        const types = attachmentsTypesByShipmentId[shipmentId] || [];
        const normalized = Array.from(new Set(types));
        const show = normalized.filter((t) => ['pdf', 'word', 'excel', 'image', 'file'].includes(t));
        if (show.length === 0) return null;

        const badgeFor = (t: string) => {
            switch (t) {
                case 'pdf':
                    return { label: 'PDF', color: 'red' as const };
                case 'word':
                    return { label: 'WORD', color: 'blue' as const };
                case 'excel':
                    return { label: 'EXCEL', color: 'green' as const };
                case 'image':
                    return { label: 'IMG', color: 'orange' as const };
                default:
                    return { label: 'FILE', color: 'gray' as const };
            }
        };

        return (
            <Flex align="center" gap="2" wrap="wrap" style={{ marginTop: 6 }}>
                {show.map((t) => {
                    const b = badgeFor(t);
                    return (
                        <Badge key={t} color={b.color} variant="soft" highContrast>
                            {b.label}
                        </Badge>
                    );
                })}
            </Flex>
        );
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

    const syncTabsIndicator = useCallback(() => {
        const list = tabsListRef.current;
        if (!list) return;

        const active = list.querySelector('[data-state="active"]') as HTMLElement | null;
        if (!active) return;

        const listRect = list.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const listStyle = window.getComputedStyle(list);
        const padLeft = Number.parseFloat(listStyle.paddingLeft || '0') || 0;
        const left = activeRect.left - listRect.left - padLeft;
        const width = activeRect.width;

        setTabsIndicatorStyle({
            transform: `translateX(${Math.max(0, left)}px)`,
            width,
            opacity: 1,
        });
        setIsTabsIndicatorReady(true);
    }, []);

    useLayoutEffect(() => {
        let id2 = 0;
        const id1 = window.requestAnimationFrame(() => {
            id2 = window.requestAnimationFrame(() => syncTabsIndicator());
        });
        const t = window.setTimeout(() => syncTabsIndicator(), 120);
        return () => {
            window.cancelAnimationFrame(id1);
            if (id2) window.cancelAnimationFrame(id2);
            window.clearTimeout(t);
        };
    }, [activeTab, syncTabsIndicator]);

    useEffect(() => {
        let cancelled = false;

        const run = () => {
            if (cancelled) return;
            syncTabsIndicator();
        };

        const onLoad = () => run();
        window.addEventListener('load', onLoad);

        if ('fonts' in document) {

            const fonts = document.fonts as any;
            if (fonts?.ready?.then) {
                fonts.ready.then(() => run()).catch(() => undefined);
            }
        }

        const t = window.setTimeout(() => run(), 350);

        return () => {
            cancelled = true;
            window.removeEventListener('load', onLoad);
            window.clearTimeout(t);
        };
    }, [syncTabsIndicator]);

    useEffect(() => {
        const list = tabsListRef.current;
        if (!list) return;
        const ro = new ResizeObserver(() => syncTabsIndicator());
        ro.observe(list);
        return () => ro.disconnect();
    }, [syncTabsIndicator]);

    useEffect(() => {
        const onResize = () => syncTabsIndicator();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [syncTabsIndicator]);

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
        const byStatus =
            statusFilter === 'all'
                ? shipments
                : shipments.filter((s) => (s.статус || '').toLowerCase().trim() === statusFilter);

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
    }, [searchTerm, shipments, statusFilter, transportFilter]);

    const metrics = useMemo(() => {
        const total = shipments.length;
        const inTransit = shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'в пути').length;
        const delivered = shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'доставлено').length;
        const canceled = shipments.filter((s) => (s.статус || '').toLowerCase().trim() === 'отменено').length;
        const successRate = total > 0 ? (delivered / total) * 100 : 0;
        return { total, inTransit, delivered, canceled, successRate };
    }, [shipments]);

    const exportCurrentToExcel = () => {
        if (!canShipmentsExportExcel) return;
        const rows = filteredShipments.map((s) => ({
            id: s.id,
            заявка_id: s.заявка_id,
            транспорт_id: s.транспорт_id,
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

    const parseExcelToRows = useCallback(async (file: File): Promise<Record<string, any>[]> => {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheetName = wb.SheetNames?.[0];
        const ws = sheetName ? wb.Sheets[sheetName] : null;
        if (!ws) return [];

        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
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
            setImportNotice(null);
            setIsSubmitting(true);

            const rows = await parseExcelToRows(file);
            if (rows.length === 0) {
                setError('Excel пустой или не распознан');
                return;
            }

            const pick = (row: Record<string, any>, keys: string[]) => {
                for (const k of keys) {
                    if (row?.[k] !== undefined) return row[k];
                }
                return undefined;
            };

            const getNum = (v: any): number => {
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
                const data = await res.json().catch(() => ({} as any));
                const msg = String((data as any)?.error || (data as any)?.message || '').trim() || 'Ошибка импорта из Excel';

                const details = Array.isArray((data as any)?.details) ? (data as any).details : [];
                if (details.length > 0) {
                    const lines = details.slice(0, 10).map((d: any) => {
                        const idx = Number(d?.index);
                        const rowNo = Number.isFinite(idx) ? idx + 2 : '';
                        const err = String(d?.error || '').trim();
                        return rowNo ? `Строка ${rowNo}: ${err}` : err;
                    });
                    setError([msg, '', ...lines].join('\n'));
                } else {
                    setError(msg);
                }
                return;
            }

            const data = await res.json().catch(() => ({} as any));
            await fetchShipments();

            const inserted = Number((data as any)?.inserted);
            const header = `Импорт завершен. Перезаписано строк: ${Number.isFinite(inserted) ? inserted : importRows.length}.`;
            setImportNotice(header);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка импорта из Excel');
        } finally {
            setIsSubmitting(false);
            if (importFileInputRef.current) importFileInputRef.current.value = '';
        }
    }, [canShipmentsImportExcel, fetchShipments, parseExcelToRows]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

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
            case 'доставлено': return 'ДОСТАВЛЕНО';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'заявка_id' || name === 'транспорт_id' || name === 'стоимость_доставки' ?
                parseFloat(value) || 0 : value
        }));
    };

    const handleSubmitShipment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingId) {
            if (!canEdit) return;
        } else {
            if (!canOpenCreateModal) return;
        }

        if (formData.заявка_id <= 0 || formData.транспорт_id <= 0) {
            alert('Пожалуйста, выберите заявку и транспортную компанию');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                заявка_id: Number(formData.заявка_id),
                транспорт_id: Number(formData.транспорт_id),
                статус: formData.статус,
                номер_отслеживания: formData.номер_отслеживания.trim() ? formData.номер_отслеживания.trim() : null,
                стоимость_доставки: formData.стоимость_доставки ? Number(formData.стоимость_доставки) : null,
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
            setEditingId(null);
            // Reset form
            setFormData({
                заявка_id: 0,
                транспорт_id: 0,
                статус: 'в пути',
                номер_отслеживания: '',
                стоимость_доставки: 0
            });

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

            const errorData = await response.json().catch(() => ({} as any));

            if (!response.ok) {
                throw new Error(errorData?.error || 'Ошибка удаления отгрузки');
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

    if (authLoading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.pageShell}>
                    <div className={styles.emptyState}>Загрузка отгрузок...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.pageShell}>
                    <div className={styles.errorState}>
                        <Text as="div" size="4" weight="bold">Ошибка загрузки</Text>
                        <Text as="div" size="2" color="red">{error}</Text>
                        <Button onClick={fetchShipments}>Повторить попытку</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>

            <div className={styles.pageShell}>
                <div className={styles.pageHeader}>
                    <div className={styles.headerLeft}>
                        <Text size="7" weight="bold" className={styles.pageTitle}>Отгрузки</Text>
                        <Text as="p" size="2" color="gray" className={styles.pageDescription}>
                            Здесь отображаются все отгрузки товаров клиентам
                        </Text>
                    </div>

                    <div className={styles.pageActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={() => {
                                setIsRefreshing(true);
                                setTableKey((k) => k + 1);
                                setMinRefreshSpinActive(true);
                                setRefreshClickKey((v) => v + 1);
                                fetchShipments();
                            }}
                            className={`${styles.surfaceButton} ${(isRefreshing || minRefreshSpinActive) ? styles.refreshButtonSpinning : ''}`.trim()}
                        >
                            <FiRefreshCw
                                key={refreshClickKey}
                                size={14}
                                className={(isRefreshing || minRefreshSpinActive) ? styles.refreshIconSpinning : undefined}
                            />{' '}
                            Обновить
                        </Button>

                        {canOpenCreateModal ? (
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                onClick={() => {
                                    setEditingId(null);
                                    setFormData({ заявка_id: 0, транспорт_id: 0, статус: 'в пути', номер_отслеживания: '', стоимость_доставки: 0 });
                                    setShowAddModal(true);
                                }}
                                className={styles.addShipmentButton}
                            >
                                <FiPlus size={14} /> Добавить отгрузку
                            </Button>
                        ) : null}
                    </div>
                </div>

                <Card className={styles.statsContainer}>
                    <div className={styles.statsTitle}>Статистика отгрузок</div>
                    <div className={styles.statsGridOrdersStyle}>
                        <div className={styles.statCardOrdersStyle}>
                            <div className={styles.statValueOrdersStyle}>{metrics.inTransit.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabelOrdersStyle}>В пути</div>
                        </div>
                        <div className={styles.statCardOrdersStyle}>
                            <div className={styles.statValueOrdersStyle}>{metrics.delivered.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabelOrdersStyle}>Доставлено</div>
                        </div>
                        <div className={styles.statCardOrdersStyle}>
                            <div className={styles.statValueOrdersStyle}>{metrics.canceled.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabelOrdersStyle}>Отменено</div>
                        </div>
                        <div className={styles.statCardOrdersStyle}>
                            <div className={styles.statValueOrdersStyle}>{metrics.successRate.toFixed(1)}%</div>
                            <div className={styles.statLabelOrdersStyle}>Успешность</div>
                        </div>
                    </div>
                </Card>

                <div className={styles.tableSection}>
                    <Tabs.Root
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as ShipmentsTab)}
                    >
                        <Tabs.List className={styles.tabsList} ref={tabsListRef as any}>
                            <span
                                className={styles.tabsIndicator}
                                style={tabsIndicatorStyle}
                                data-ready={isTabsIndicatorReady ? 'true' : 'false'}
                                aria-hidden="true"
                            />
                            <Tabs.Trigger value="all">Все отгрузки</Tabs.Trigger>
                            <Tabs.Trigger value="in_transit">В пути</Tabs.Trigger>
                            <Tabs.Trigger value="delivered">Доставлено</Tabs.Trigger>
                            <Tabs.Trigger value="canceled">Отменено</Tabs.Trigger>
                        </Tabs.List>

                        <div className={styles.tableHeader}>
                            <TextField.Root
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Поиск по номеру, заявке, ТК, треку..."
                                className={styles.searchInput}
                                size="3"
                                radius="large"
                                variant="surface"
                            >
                                <TextField.Slot side="left">
                                    <FiSearch size={16} />
                                </TextField.Slot>
                            </TextField.Root>

                            <div className={styles.tableHeaderActions}>

                                <Select.Root value={transportFilter} onValueChange={setTransportFilter}>
                                    <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                    <Select.Content className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value={EMPTY_SELECT_VALUE}>Все ТК</Select.Item>
                                        {transports.map((t) => (
                                            <Select.Item key={t.id} value={String(t.id)}>
                                                {t.название}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>

                                <Select.Root
                                    value={statusFilter}
                                    onValueChange={(v) => {
                                        const next = v as StatusFilter;
                                        setStatusFilter(next);
                                        if (next === 'all') setActiveTab('all');
                                        if (next === 'в пути') setActiveTab('in_transit');
                                        if (next === 'доставлено') setActiveTab('delivered');
                                        if (next === 'отменено') setActiveTab('canceled');
                                    }}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                    <Select.Content className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="all">Все статусы</Select.Item>
                                        <Select.Item value="в пути">В пути</Select.Item>
                                        <Select.Item value="доставлено">Доставлено</Select.Item>
                                        <Select.Item value="отменено">Отменено</Select.Item>
                                    </Select.Content>
                                </Select.Root>

                                {canShipmentsExportExcel ? (
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={styles.surfaceButton}
                                        onClick={exportCurrentToExcel}
                                    >
                                        <FiDownload size={16} /> Excel
                                    </Button>
                                ) : null}
                                {canShipmentsImportExcel ? (
                                    <>
                                        <input
                                            ref={importFileInputRef}
                                            type="file"
                                            accept=".xlsx,.xls"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) void handleImportExcelFile(f);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="surface"
                                            color="gray"
                                            highContrast
                                            className={styles.surfaceButton}
                                            onClick={handleImportExcelClick}
                                            disabled={isSubmitting}
                                        >
                                            <FiUpload size={16} /> Excel
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div className={styles.tableCard}>
                            <div className={styles.tableContainer}>
                                <Table.Root key={tableKey} variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Заявка</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Транспорт</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Трек</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Стоимость</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {filteredShipments.length === 0 ? (
                                            <Table.Row>
                                                <Table.Cell colSpan={8}>
                                                    <div className={styles.emptyState}>Отгрузки не найдены.</div>
                                                </Table.Cell>
                                            </Table.Row>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredShipments.map((shipment) => (
                                                    <MotionTableRow
                                                        key={shipment.id}
                                                        className={styles.tableRow}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        transition={{ duration: 0.12 }}
                                                        onClick={() => {
                                                            if (!canView) return;
                                                            router.push(`/shipments/${encodeURIComponent(String(shipment.id))}`);
                                                        }}
                                                    >
                                                        <Table.Cell>
                                                            <div>
                                                                <div className={styles.itemTitle}>#{shipment.id}</div>
                                                                {renderAttachmentBadges(shipment.id)}
                                                            </div>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <div className={styles.itemTitle}>{shipment.заявка_номер || `Заявка #${shipment.заявка_id}`}</div>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <div className={styles.itemTitle}>{shipment.транспорт_название || `ТК #${shipment.транспорт_id}`}</div>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <div className={styles.itemTitle}>{formatDateTime(shipment.дата_отгрузки)}</div>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <div className={styles.itemTitle}>{shipment.номер_отслеживания || 'Не указан'}</div>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.moneyValue}>
                                                                {shipment.стоимость_доставки ? formatCurrency(shipment.стоимость_доставки) : 'Не указана'}
                                                            </span>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <span className={styles.statusPill} data-status={(shipment.статус || '').toLowerCase()}>
                                                                {getStatusText((shipment.статус || '').toLowerCase())}
                                                            </span>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                                                                {(() => {
                                                                    const trackingUrl = getTrackingUrl(shipment);
                                                                    const canTrackThis = Boolean(trackingUrl) && canShipmentTrack;
                                                                    const canGoToOrderThis = Boolean(shipment.заявка_id) && canGoToOrder;
                                                                    const canEditThis = canEdit;
                                                                    const canPrintThis = canShipmentPrint;
                                                                    const canDeleteThis = canDelete;
                                                                    const hasAnyAction = canView || canGoToOrderThis || canTrackThis || canEditThis || canPrintThis || canDeleteThis;

                                                                    if (!hasAnyAction) return null;
                                                                    return (
                                                                        <DropdownMenu.Root>
                                                                            <DropdownMenu.Trigger>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="surface"
                                                                                    color="gray"
                                                                                    highContrast
                                                                                    className={styles.moreButton}
                                                                                    aria-label="Действия"
                                                                                    title="Действия"
                                                                                >
                                                                                    <FiMoreHorizontal />
                                                                                </Button>
                                                                            </DropdownMenu.Trigger>
                                                                            <DropdownMenu.Content>
                                                                                {canView ? (
                                                                                    <DropdownMenu.Item
                                                                                        onSelect={(e) => {
                                                                                            e?.preventDefault?.();
                                                                                            router.push(`/shipments/${encodeURIComponent(String(shipment.id))}`);
                                                                                        }}
                                                                                    >
                                                                                        <FiEye className={styles.rowMenuIcon} />
                                                                                        Открыть
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}

                                                                                {canGoToOrder ? (
                                                                                    <DropdownMenu.Item
                                                                                        onSelect={(e) => {
                                                                                            e?.preventDefault?.();
                                                                                            if (!shipment.заявка_id) return;
                                                                                            router.push(`/orders/${encodeURIComponent(String(shipment.заявка_id))}`);
                                                                                        }}
                                                                                        disabled={!shipment.заявка_id}
                                                                                    >
                                                                                        <FiEye className={styles.rowMenuIcon} />
                                                                                        Перейти к заявке
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}

                                                                                {canShipmentTrack ? (
                                                                                    <DropdownMenu.Item
                                                                                        onSelect={(e) => {
                                                                                            e?.preventDefault?.();
                                                                                            const url = trackingUrl;
                                                                                            if (!url) return;
                                                                                            window.open(url, '_blank', 'noopener,noreferrer');
                                                                                        }}
                                                                                        disabled={!trackingUrl}
                                                                                    >
                                                                                        <FiTruck className={styles.rowMenuIcon} />
                                                                                        Отследить груз
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}

                                                                                {(canEditThis || canPrintThis || canDeleteThis) ? <DropdownMenu.Separator /> : null}
                                                                                {canEditThis ? (
                                                                                    <DropdownMenu.Item
                                                                                        onSelect={(e) => {
                                                                                            e?.preventDefault?.();
                                                                                            setEditingId(shipment.id);
                                                                                            setFormData({
                                                                                                заявка_id: Number(shipment.заявка_id) || 0,
                                                                                                транспорт_id: Number(shipment.транспорт_id) || 0,
                                                                                                статус: shipment.статус || 'в пути',
                                                                                                номер_отслеживания: shipment.номер_отслеживания || '',
                                                                                                стоимость_доставки: Number(shipment.стоимость_доставки) || 0,
                                                                                            });
                                                                                            setShowAddModal(true);
                                                                                        }}
                                                                                    >
                                                                                        <FiEdit2 className={styles.rowMenuIcon} />
                                                                                        Редактировать
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}

                                                                                {canPrintThis ? (
                                                                                    <DropdownMenu.Item
                                                                                        onSelect={async (e) => {
                                                                                            e?.preventDefault?.();
                                                                                            try {
                                                                                                await handlePrintDocumentsWord(shipment);
                                                                                            } catch (err) {
                                                                                                console.error(err);
                                                                                                setError(err instanceof Error ? err.message : 'Ошибка печати документов');
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <FiFileText className={styles.rowMenuIcon} />
                                                                                        Печать документов
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}

                                                                                {canDeleteThis ? <DropdownMenu.Separator /> : null}

                                                                                {canDeleteThis ? (
                                                                                    <DropdownMenu.Item
                                                                                        className={styles.rowMenuItemDanger}
                                                                                        color="red"
                                                                                        onSelect={(e) => {
                                                                                            e?.preventDefault?.();
                                                                                            handleOpenDelete(shipment);
                                                                                        }}
                                                                                    >
                                                                                        <FiTrash2 className={styles.rowMenuIconDel} />
                                                                                        Удалить
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                            </DropdownMenu.Content>
                                                                        </DropdownMenu.Root>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </Table.Cell>
                                                    </MotionTableRow>
                                                ))}
                                            </AnimatePresence>
                                        )}
                                    </Table.Body>
                                </Table.Root>
                            </div>
                        </div>
                    </Tabs.Root>
                </div>
            </div>

            <Dialog.Root
                open={showAddModal}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowAddModal(false);
                        setEditingId(null);
                    }
                }}
            >
                <Dialog.Content className={`${modalStyles.radixDialogWide} ${styles.shipmentEditorDialog}`}>
                    <Dialog.Title>{editingId ? 'Редактировать отгрузку' : 'Добавить отгрузку'}</Dialog.Title>
                    <Dialog.Description className={modalStyles.radixDescription}>
                        Заполните данные отгрузки.
                    </Dialog.Description>

                    <form onSubmit={handleSubmitShipment} className={modalStyles.radixForm}>
                        <Flex direction="column" gap="4">
                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Заявка</Text>
                                <Select.Root
                                    value={formData.заявка_id ? String(formData.заявка_id) : EMPTY_SELECT_VALUE}
                                    onValueChange={(v) => setFormData((p) => ({ ...p, заявка_id: v === EMPTY_SELECT_VALUE ? 0 : Number(v) || 0 }))}
                                    disabled={!canOrdersList}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={modalStyles.radixSelectTrigger} placeholder="Выберите заявку" />
                                    <Select.Content position="popper" className={modalStyles.radixSelectContent}>
                                        <Select.Item value={EMPTY_SELECT_VALUE} disabled>
                                            Выберите заявку
                                        </Select.Item>
                                        {orders.map((o) => (
                                            <Select.Item key={o.id} value={String(o.id)}>
                                                Заявка #{o.id}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Транспортная компания</Text>
                                <Select.Root
                                    value={formData.транспорт_id ? String(formData.транспорт_id) : EMPTY_SELECT_VALUE}
                                    onValueChange={(v) => setFormData((p) => ({ ...p, транспорт_id: v === EMPTY_SELECT_VALUE ? 0 : Number(v) || 0 }))}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={modalStyles.radixSelectTrigger} placeholder="Выберите ТК" />
                                    <Select.Content position="popper" className={modalStyles.radixSelectContent}>
                                        <Select.Item value={EMPTY_SELECT_VALUE} disabled>
                                            Выберите ТК
                                        </Select.Item>
                                        {transports.map((t) => (
                                            <Select.Item key={t.id} value={String(t.id)}>
                                                {t.название}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Статус</Text>
                                <Select.Root value={formData.статус} onValueChange={(v) => setFormData((p) => ({ ...p, статус: v }))}>
                                    <Select.Trigger variant="surface" color="gray" className={modalStyles.radixSelectTrigger} />
                                    <Select.Content position="popper" className={modalStyles.radixSelectContent}>
                                        <Select.Item value="в пути">В пути</Select.Item>
                                        <Select.Item value="доставлено">Доставлено</Select.Item>
                                        <Select.Item value="отменено">Отменено</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Номер отслеживания (опц.)</Text>
                                <TextField.Root
                                    value={formData.номер_отслеживания}
                                    name="номер_отслеживания"
                                    onChange={handleInputChange}
                                    placeholder="TRACK-001"
                                    size="2"
                                />
                            </Box>

                            <Box className={modalStyles.radixField}>
                                <Text as="label" size="2" weight="medium">Стоимость доставки (опц.)</Text>
                                <TextField.Root
                                    value={String(formData.стоимость_доставки ?? '')}
                                    name="стоимость_доставки"
                                    onChange={handleInputChange}
                                    placeholder="400.00"
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.modalPreviewSection}>
                                <Flex align="center" justify="between" gap="3" wrap="wrap">
                                    <Text as="div" size="3" weight="medium" className={styles.modalPreviewTitle}>
                                        Позиции заявки
                                    </Text>
                                    {selectedOrderPositionsLoading ? (
                                        <Text size="2" color="gray">Загружаем состав заявки...</Text>
                                    ) : null}
                                </Flex>

                                {!formData.заявка_id ? (
                                    <Text as="div" size="2" color="gray" className={styles.modalPreviewHint}>
                                        Выберите заявку, чтобы увидеть состав отгрузки.
                                    </Text>
                                ) : null}

                                {formData.заявка_id && !selectedOrderPositionsLoading && selectedOrderPositions.length === 0 ? (
                                    <Text as="div" size="2" color="gray" className={styles.modalPreviewHint}>
                                        У выбранной заявки пока нет позиций или они недоступны для просмотра.
                                    </Text>
                                ) : null}

                                {selectedOrderPositions.length > 0 ? (
                                    <>
                                        <div className={styles.modalPreviewTableWrap}>
                                            <Table.Root variant="surface" className={styles.modalPreviewTable}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Ед.изм</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Кол-во</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Цена, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Сумма без НДС, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>НДС</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Сумма НДС, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Всего, ₽</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {selectedOrderPositions.map((position) => {
                                                        const vatOption = getVatRateOption(position.ндс_id);
                                                        const fallbackAmounts = calculateVatAmountsFromLine(position.количество, position.цена, position.ндс_ставка ?? vatOption.rate);

                                                        return (
                                                            <Table.Row key={position.id}>
                                                                <Table.Cell>
                                                                    <div className={styles.productCellTitle}>{position.товар_название || `Товар #${position.товар_id}`}</div>
                                                                    {position.товар_артикул ? (
                                                                        <div className={styles.productCellMeta}>{position.товар_артикул}</div>
                                                                    ) : null}
                                                                </Table.Cell>
                                                                <Table.Cell>{position.товар_единица_измерения || 'шт'}</Table.Cell>
                                                                <Table.Cell>{position.количество}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{(position.цена || 0).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{(position.сумма_без_ндс ?? fallbackAmounts.net).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</Table.Cell>
                                                                <Table.Cell>{position.ндс_название || vatOption.label}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{(position.сумма_ндс ?? fallbackAmounts.tax).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{(position.сумма_всего ?? fallbackAmounts.total).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</Table.Cell>
                                                            </Table.Row>
                                                        );
                                                    })}
                                                </Table.Body>
                                            </Table.Root>
                                        </div>

                                        <Flex justify="end" className={styles.modalPreviewTotal}>
                                            <Text weight="bold">
                                                Итого: {positionsPreviewTotal.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                            </Text>
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
                                    disabled={!formData.заявка_id || isSubmitting}
                                    style={{ marginRight: 'auto' }}
                                    className={modalStyles.secondaryButton}
                                    onClick={() => {
                                        if (!canGoToOrder) return;
                                        if (!formData.заявка_id) return;
                                        setShowAddModal(false);
                                        setEditingId(null);
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
                                    className={modalStyles.secondaryButton}
                                    disabled={isSubmitting}
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setEditingId(null);
                                    }}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="submit"
                                    variant="solid"
                                    color="gray"
                                    highContrast
                                    className={modalStyles.primaryButton}
                                    disabled={!canSubmitShipment}
                                    loading={isSubmitting}
                                >
                                    {editingId ? 'Сохранить' : 'Добавить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </form>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDeleteDialogOpen(false);
                        setDeletingShipment(null);
                        setDeleteError(null);
                    }
                }}
            >
                <Dialog.Content className={deleteConfirmStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить эту отгрузку? Это действие нельзя отменить.
                            </Text>

                            {deletingShipment ? (
                                <Box className={deleteConfirmStyles.positionsSection}>
                                    <Flex direction="column" gap="1">
                                        <Text as="div" weight="bold">Отгрузка #{deletingShipment.id}</Text>
                                        <Text as="div" size="2" color="gray">Заявка: #{deletingShipment.заявка_id}</Text>
                                        <Text as="div" size="2" color="gray">ТК: {deletingShipment.транспорт_название || `#${deletingShipment.транспорт_id}`}</Text>
                                    </Flex>
                                </Box>
                            ) : null}

                            {deleteError ? (
                                <Box mt="3">
                                    <Text as="div" color="red" size="2">
                                        {deleteError}
                                    </Text>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    disabled={isDeleting}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmStyles.modalDeleteButton}
                                    onClick={handleDeleteConfirm}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(ShipmentsPage);
