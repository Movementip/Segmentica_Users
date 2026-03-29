import { Fragment, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../../layout/Layout';
import { CreateTransportModalNew } from '../../components/CreateTransportModalNew';
import { EditTransportModalNew } from '../../components/EditTransportModalNew';
import { NoAccessPage } from '../../components/NoAccessPage';
import styles from './Transport.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
    Badge,
    Box,
    Button,
    Card,
    Dialog,
    DropdownMenu,
    Flex,
    Heading,
    Table,
    Tabs,
    Text,
    TextArea,
    TextField,
    Select,
} from '@radix-ui/themes';
import { FiEdit2, FiEye, FiFilter, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiArchive } from 'react-icons/fi';

const MotionTableRow = motion(Table.Row);

interface TransportCompany {
    id: number;
    название: string;
    телефон: string | null;
    email: string | null;
    тариф: number | null;
    created_at: string;
    общее_количество_отгрузок: number;
    активные_отгрузки: number;
    завершенные_отгрузки: number;
    средняя_стоимость: number | null;
    общая_выручка: number | null;
}

interface Shipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    транспорт_название: string;
    заявка_номер: number;
    клиент_название: string;
    заявка_статус: string;
}

interface TransportData {
    transport: TransportCompany[];
    recentShipments: Shipment[];
    activeShipments: Shipment[];
}

type TransportPerformanceRow = {
    месяц: string;
    количество_отгрузок: number;
    успешные_доставки: number;
    средняя_стоимость: number;
    общая_выручка: number;
};

type TransportMonthShipmentRow = {
    id: number;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер: number | null;
    заявка_статус: string;
    клиент_название: string;
};

type TransportStatsResponse = {
    transport: TransportCompany;
    performance: TransportPerformanceRow[];
    periodTotals: {
        количество_отгрузок: number;
        успешные_доставки: number;
        средняя_стоимость: number;
        общая_выручка: number;
    };
};

type FiltersState = {
    companyName: string;
    rate: 'all' | 'lt-1000' | '1000-5000' | 'gt-5000';
    totalShipments: 'all' | '0' | '1-9' | '10+';
    activeShipments: 'all' | '0' | '1-4' | '5+';
    sortBy: 'shipments-desc' | 'shipments-asc' | 'revenue-desc' | 'revenue-asc' | 'created-desc' | 'created-asc';
};

export default function Transport() {
    const { user, loading: authLoading } = useAuth();
    const canList = Boolean(user?.permissions?.includes('transport.list'));
    const canView = Boolean(user?.permissions?.includes('transport.view'));
    const canCreate = Boolean(user?.permissions?.includes('transport.create'));
    const canEdit = Boolean(user?.permissions?.includes('transport.edit'));
    const canDelete = Boolean(user?.permissions?.includes('transport.delete'));
    const canTransportStatsView = Boolean(user?.permissions?.includes('transport.stats.view'));
    const canTransportActiveShipmentsView = Boolean(user?.permissions?.includes('transport.active_shipments.view'));
    const canTransportRecentShipmentsView = Boolean(user?.permissions?.includes('transport.recent_shipments.view'));
    const canShowCompanyRowMenu = canView || canTransportStatsView || canEdit || canDelete;
    const [data, setData] = useState<TransportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [filters, setFilters] = useState<FiltersState>({
        companyName: '',
        rate: 'all',
        totalShipments: 'all',
        activeShipments: 'all',
        sortBy: 'shipments-desc',
    });

    const [activeTab, setActiveTab] = useState<'companies' | 'activeShipments' | 'recentShipments'>('companies');
    const tabsListRef = useRef<HTMLDivElement | null>(null);
    const [tabsIndicatorStyle, setTabsIndicatorStyle] = useState<React.CSSProperties>({
        transform: 'translateX(0px)',
        width: 0,
        opacity: 0,
    });
    const [isTabsIndicatorReady, setIsTabsIndicatorReady] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<TransportCompany | null>(null);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [statsCompany, setStatsCompany] = useState<TransportCompany | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string>('');
    const [statsPerformance, setStatsPerformance] = useState<TransportPerformanceRow[]>([]);
    const [statsPeriodTotals, setStatsPeriodTotals] = useState<TransportStatsResponse['periodTotals'] | null>(null);
    const [expandedMonth, setExpandedMonth] = useState<string>('');
    const [monthShipmentsLoading, setMonthShipmentsLoading] = useState(false);
    const [monthShipmentsError, setMonthShipmentsError] = useState<string>('');
    const [monthShipments, setMonthShipments] = useState<TransportMonthShipmentRow[]>([]);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editCompany, setEditCompany] = useState<TransportCompany | null>(null);
    const router = useRouter();

    const [attachmentsTypesByCompanyId, setAttachmentsTypesByCompanyId] = useState<Record<number, string[]>>({});

    const lastSyncedQueryRef = useRef<string>('');
    const lastAppliedRouterQueryRef = useRef<string>('');

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);

    const [isSortSelectOpen, setIsSortSelectOpen] = useState(false);
    const sortTriggerRef = useRef<HTMLButtonElement | null>(null);

    const syncTransportUrl = (next: {
        tab: string;
        q: string;
        companyName: string;
        rate: FiltersState['rate'];
        totalShipments: FiltersState['totalShipments'];
        activeShipments: FiltersState['activeShipments'];
        sort: FiltersState['sortBy'];
    }) => {
        const query = { ...router.query } as Record<string, any>;

        if (next.tab && next.tab !== 'companies') query.tab = String(next.tab);
        else delete query.tab;

        if ((next.q || '').trim()) query.q = String(next.q).trim();
        else delete query.q;

        if ((next.companyName || '').trim()) query.company = String(next.companyName).trim();
        else delete query.company;

        if (next.rate && next.rate !== 'all') query.rate = String(next.rate);
        else delete query.rate;

        if (next.totalShipments && next.totalShipments !== 'all') query.total = String(next.totalShipments);
        else delete query.total;

        if (next.activeShipments && next.activeShipments !== 'all') query.active = String(next.activeShipments);
        else delete query.active;

        if (next.sort && next.sort !== 'shipments-desc') query.sort = String(next.sort);
        else delete query.sort;

        router.replace(
            {
                pathname: router.pathname,
                query,
            },
            undefined,
            { shallow: true }
        );
    };

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify(router.query);
        if (signature === lastAppliedRouterQueryRef.current) return;
        lastAppliedRouterQueryRef.current = signature;

        const tabRaw = router.query.tab;
        const qRaw = router.query.q;
        const companyRaw = router.query.company;
        const rateRaw = router.query.rate;
        const totalRaw = router.query.total;
        const activeRaw = router.query.active;
        const sortRaw = router.query.sort;

        const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
        const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
        const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
        const rate = Array.isArray(rateRaw) ? rateRaw[0] : rateRaw;
        const total = Array.isArray(totalRaw) ? totalRaw[0] : totalRaw;
        const active = Array.isArray(activeRaw) ? activeRaw[0] : activeRaw;
        const sort = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        const tabCandidate = (tab === 'activeShipments' || tab === 'recentShipments' || tab === 'companies') ? tab : 'companies';
        const nextTab = (
            tabCandidate === 'activeShipments' && canTransportActiveShipmentsView
                ? 'activeShipments'
                : tabCandidate === 'recentShipments' && canTransportRecentShipmentsView
                    ? 'recentShipments'
                    : 'companies'
        );
        const nextQ = q !== undefined ? String(q) : '';
        const nextCompany = company !== undefined ? String(company) : '';
        const nextRate = (rate === 'lt-1000' || rate === '1000-5000' || rate === 'gt-5000' || rate === 'all') ? (rate as FiltersState['rate']) : 'all';
        const nextTotal = (total === '0' || total === '1-9' || total === '10+' || total === 'all') ? (total as FiltersState['totalShipments']) : 'all';
        const nextActive = (active === '0' || active === '1-4' || active === '5+' || active === 'all') ? (active as FiltersState['activeShipments']) : 'all';
        const nextSort = (sort === 'shipments-desc' || sort === 'shipments-asc' || sort === 'revenue-desc' || sort === 'revenue-asc' || sort === 'created-desc' || sort === 'created-asc')
            ? (sort as FiltersState['sortBy'])
            : 'shipments-desc';

        setActiveTab(nextTab as any);
        setSearchInputValue(nextQ);
        setFilters((prev) => ({
            ...prev,
            companyName: nextCompany,
            rate: nextRate,
            totalShipments: nextTotal,
            activeShipments: nextActive,
            sortBy: nextSort,
        }));

        const nextSignature = JSON.stringify({
            tab: nextTab,
            q: nextQ,
            company: nextCompany,
            rate: nextRate,
            total: nextTotal,
            active: nextActive,
            sort: nextSort,
        });
        lastSyncedQueryRef.current = nextSignature;
    }, [router.isReady, router.query, canTransportActiveShipmentsView, canTransportRecentShipmentsView]);

    useEffect(() => {
        if (activeTab === 'activeShipments' && !canTransportActiveShipmentsView) {
            setActiveTab('companies');
        }
        if (activeTab === 'recentShipments' && !canTransportRecentShipmentsView) {
            setActiveTab('companies');
        }
    }, [activeTab, canTransportActiveShipmentsView, canTransportRecentShipmentsView]);

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify({
            tab: activeTab,
            q: searchInputValue,
            company: filters.companyName,
            rate: filters.rate,
            total: filters.totalShipments,
            active: filters.activeShipments,
            sort: filters.sortBy,
        });

        if (signature === lastSyncedQueryRef.current) return;
        lastSyncedQueryRef.current = signature;

        syncTransportUrl({
            tab: activeTab,
            q: searchInputValue,
            companyName: filters.companyName,
            rate: filters.rate,
            totalShipments: filters.totalShipments,
            activeShipments: filters.activeShipments,
            sort: filters.sortBy,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, activeTab, searchInputValue, filters.companyName, filters.rate, filters.totalShipments, filters.activeShipments, filters.sortBy]);

    const syncTabsIndicator = () => {
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
    };

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, data?.activeShipments?.length, data?.recentShipments?.length]);

    useEffect(() => {
        const list = tabsListRef.current;
        if (!list) return;

        const ro = new ResizeObserver(() => syncTabsIndicator());
        ro.observe(list);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, canList]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        // Match Warehouse UX: show brief loading state on tab switch
        if (loading) return;
        setIsFetching(true);
        setTableKey((k) => k + 1);
        const t = window.setTimeout(() => setIsFetching(false), 180);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearchQuery(searchInputValue), 250);
        return () => window.clearTimeout(t);
    }, [searchInputValue]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const onDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            const popperWrapper = target.closest?.('[data-radix-popper-content-wrapper]');
            if (popperWrapper) return;

            const dropdown = filtersDropdownRef.current;
            const trigger = filterTriggerRef.current;
            const panel = filtersPanelRef.current;

            if (dropdown && dropdown.contains(target)) return;
            if (trigger && trigger.contains(target)) return;
            if (panel && panel.contains(target)) return;

            const panelRect = panel?.getBoundingClientRect();
            const withinPanelRect = Boolean(
                panelRect &&
                e.clientX >= panelRect.left &&
                e.clientX <= panelRect.right &&
                e.clientY >= panelRect.top &&
                e.clientY <= panelRect.bottom
            );
            if (withinPanelRect) return;

            setIsFiltersOpen(false);
        };

        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [isFiltersOpen]);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/transport');
            const result = await response.json();
            setData(result);

            const companyIds = (result?.transport || [])
                .map((c: TransportCompany) => Number(c.id))
                .filter((n: number) => Number.isInteger(n) && n > 0);

            if (companyIds.length > 0) {
                try {
                    const summaryRes = await fetch(
                        `/api/attachments/summary?entity_type=transport&entity_ids=${encodeURIComponent(companyIds.join(','))}`
                    );
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as Array<{ entity_id: number; types: string[] }>;
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesByCompanyId(map);
                    }
                } catch (e) {
                    console.error('Error fetching transport attachments summary:', e);
                }
            } else {
                setAttachmentsTypesByCompanyId({});
            }
        } catch (error) {
            console.error('Error fetching transport data:', error);
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const renderAttachmentBadges = (companyId: number) => {
        const types = attachmentsTypesByCompanyId[companyId] || [];
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
                    return { label: 'IMG', color: 'gray' as const };
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

    const loadMonthShipments = async (companyId: number, month: string) => {
        if (!canTransportStatsView) return;
        setMonthShipmentsLoading(true);
        setMonthShipmentsError('');
        try {
            const r = await fetch(`/api/transport/stats-month?companyId=${companyId}&month=${encodeURIComponent(month)}`);
            if (!r.ok) {
                const t = await r.json().catch(() => null);
                throw new Error(t?.error || 'Не удалось загрузить отгрузки за месяц');
            }
            const json = (await r.json()) as { shipments: TransportMonthShipmentRow[] };
            setMonthShipments(Array.isArray(json.shipments) ? json.shipments : []);
        } catch (e) {
            setMonthShipmentsError(e instanceof Error ? e.message : 'Не удалось загрузить отгрузки за месяц');
            setMonthShipments([]);
        } finally {
            setMonthShipmentsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const formatMonth = (dateString: string) => {
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return dateString;
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatCurrency = (amount: number | null) => {
        if (amount == null || Number.isNaN(Number(amount))) return 'Не указано';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(Number(amount));
    };

    const getStatusColor = (status: string) => {
        if (!status) return '#666';

        // Normalize the status for comparison
        const normalizedStatus = status.toLowerCase().trim();

        // Direct mapping for the specific order statuses we have in the system
        switch (normalizedStatus) {
            case 'новая':
                return '#2196F3'; // Blue
            case 'в обработке':
                return '#ff9800'; // Orange
            case 'подтверждена':
            case 'подтверждено':
                return '#2196F3'; // Blue
            case 'в работе':
                return '#2196F3'; // Blue
            case 'собрана':
                return '#9c27b0'; // Purple
            case 'отгружена':
                return '#4caf50'; // Green
            case 'получено':
            case 'доставлено':
                return '#4CAF50'; // Green
            case 'выполнена':
            case 'выполнено':
                return '#4CAF50'; // Green
            case 'отменена':
            case 'отменено':
                return '#f44336'; // Red
            default:
                return '#666'; // Gray
        }
    };

    const getStatusText = (status: string) => {
        if (!status) return 'НЕОПРЕДЕЛЕНО';

        // Normalize the status for comparison
        const normalizedStatus = status.toLowerCase().trim();

        // Direct mapping for display text
        switch (normalizedStatus) {
            case 'новая':
                return 'НОВАЯ';
            case 'в обработке':
                return 'В ОБРАБОТКЕ';
            case 'подтверждена':
            case 'подтверждено':
                return 'ПОДТВЕРЖДЕНА';
            case 'в работе':
                return 'В РАБОТЕ';
            case 'собрана':
                return 'СОБРАНА';
            case 'отгружена':
                return 'ОТГРУЖЕНА';
            case 'в пути':
                return 'В ПУТИ';
            case 'получено':
                return 'ПОЛУЧЕНО';
            case 'доставлено':
                return 'ДОСТАВЛЕНО';
            case 'выполнена':
            case 'выполнено':
                return 'ВЫПОЛНЕНА';
            case 'отменена':
            case 'отменено':
                return 'ОТМЕНЕНА';
            default:
                return status.toUpperCase();
        }
    };

    const filteredTransport = useMemo(() => {
        const list = data?.transport || [];
        const q = debouncedSearchQuery.trim().toLowerCase();
        const companyQ = (filters.companyName || '').trim().toLowerCase();

        const filtered = list
            .filter((company) => {
                const matchesSearch = !q ||
                    (company.название || '').toLowerCase().includes(q) ||
                    (company.email || '').toLowerCase().includes(q);

                if (!matchesSearch) return false;

                if (companyQ) {
                    const name = (company.название || '').toLowerCase();
                    if (!name.includes(companyQ)) return false;
                }

                const rate = Number(company.тариф) || 0;
                if (filters.rate === 'lt-1000' && !(rate < 1000)) return false;
                if (filters.rate === '1000-5000' && !(rate >= 1000 && rate <= 5000)) return false;
                if (filters.rate === 'gt-5000' && !(rate > 5000)) return false;

                const total = Number(company.общее_количество_отгрузок) || 0;
                if (filters.totalShipments === '0' && total !== 0) return false;
                if (filters.totalShipments === '1-9' && !(total >= 1 && total <= 9)) return false;
                if (filters.totalShipments === '10+' && !(total >= 10)) return false;

                const active = Number(company.активные_отгрузки) || 0;
                if (filters.activeShipments === '0' && active !== 0) return false;
                if (filters.activeShipments === '1-4' && !(active >= 1 && active <= 4)) return false;
                if (filters.activeShipments === '5+' && !(active >= 5)) return false;

                return true;
            });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            if (filters.sortBy === 'shipments-desc') return (b.общее_количество_отгрузок || 0) - (a.общее_количество_отгрузок || 0);
            if (filters.sortBy === 'shipments-asc') return (a.общее_количество_отгрузок || 0) - (b.общее_количество_отгрузок || 0);
            if (filters.sortBy === 'revenue-desc') return (Number(b.общая_выручка) || 0) - (Number(a.общая_выручка) || 0);
            if (filters.sortBy === 'revenue-asc') return (Number(a.общая_выручка) || 0) - (Number(b.общая_выручка) || 0);
            if (filters.sortBy === 'created-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return sorted;
    }, [
        data?.transport,
        debouncedSearchQuery,
        filters.companyName,
        filters.rate,
        filters.totalShipments,
        filters.activeShipments,
        filters.sortBy,
    ]);

    const summary = useMemo(() => {
        const companies = data?.transport || [];
        const companiesCount = companies.length;
        const activeShipmentsCount = data?.activeShipments?.length || 0;
        const totalShipments = companies.reduce((sum, c) => sum + (Number(c.общее_количество_отгрузок) || 0), 0);
        const avgCost = companiesCount
            ? companies.reduce((sum, c) => sum + (Number(c.средняя_стоимость) || 0), 0) / companiesCount
            : 0;
        const successRate = totalShipments
            ? (companies.reduce((sum, c) => sum + (Number(c.завершенные_отгрузки) || 0), 0) / totalShipments) * 100
            : 0;

        return {
            companiesCount,
            activeShipmentsCount,
            totalShipments,
            avgCost,
            successRate,
        };
    }, [data?.transport, data?.activeShipments]);

    // Action handlers
    const handleCreateTransport = () => {
        if (!canCreate) return;
        setIsCreateModalOpen(true);
    };

    const handleDeleteTransport = (company: TransportCompany) => {
        if (!canDelete) return;
        setSelectedCompany(company);
        setIsDeleteModalOpen(true);
    };

    const handleOpenStats = (company: TransportCompany) => {
        if (!canTransportStatsView) return;
        setStatsCompany(company);
        setIsStatsModalOpen(true);
    };

    const handleOpenEdit = (company: TransportCompany) => {
        if (!canEdit) return;
        setEditCompany(company);
        setIsEditModalOpen(true);
    };

    const loadCompanyStats = async (companyId: number) => {
        if (!canTransportStatsView) return;
        setStatsLoading(true);
        setStatsError('');
        try {
            const r = await fetch(`/api/transport/stats?companyId=${companyId}`);
            if (!r.ok) {
                const t = await r.json().catch(() => null);
                throw new Error(t?.error || 'Не удалось загрузить статистику');
            }
            const json = (await r.json()) as TransportStatsResponse;
            setStatsCompany(json.transport || null);
            setStatsPerformance(Array.isArray(json.performance) ? json.performance : []);
            setStatsPeriodTotals(json.periodTotals || null);
        } catch (e) {
            setStatsError(e instanceof Error ? e.message : 'Не удалось загрузить статистику');
            setStatsPerformance([]);
            setStatsPeriodTotals(null);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        if (!isStatsModalOpen || !statsCompany) return;
        loadCompanyStats(statsCompany.id);
        setExpandedMonth('');
        setMonthShipments([]);
        setMonthShipmentsError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStatsModalOpen, statsCompany?.id]);

    const handleConfirmDelete = async () => {
        if (!selectedCompany) return;
        if (!canDelete) return;

        try {
            const response = await fetch(`/api/transport?id=${selectedCompany.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления компании');
            }

            await fetchData();
            setIsDeleteModalOpen(false);
            setSelectedCompany(null);
        } catch (error) {
            console.error('Error deleting transport company:', error);
            alert('Ошибка удаления компании: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleTransportCreated = () => {
        fetchData();
        setIsCreateModalOpen(false);
    };

    if (authLoading) {
        return (
            <Layout>
                <Box p="5">
                    <Text>Загрузка…</Text>
                </Box>
            </Layout>
        );
    }

    if (!canList) {
        return (
            <Layout>
                <NoAccessPage />
            </Layout>
        );
    }

    if (loading) {
        return (
            <Layout>
                <div className={styles.loading}>Загрузка...</div>
            </Layout>
        );
    }

    if (!data) {
        return (
            <Layout>
                <div className={styles.error}>Ошибка загрузки данных</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Транспортные компании</h1>
                        <p className={styles.subtitle}>Управление ТК и отгрузками</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.surfaceButton} ${styles.headerActionButton}`}
                            onClick={() => {
                                setIsFetching(true);
                                setTableKey((k) => k + 1);
                                setRefreshClickKey((k) => k + 1);
                                setMinRefreshSpinActive(true);
                                fetchData();
                            }}
                        >
                            <FiRefreshCw
                                key={refreshClickKey}
                                size={14}
                                className={loading || isFetching || minRefreshSpinActive ? styles.spin : ''}
                            />
                            Обновить
                        </Button>

                        {canCreate ? (
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.addTransportButton} ${styles.headerActionButton}`}
                                onClick={handleCreateTransport}
                            >
                                <FiPlus size={14} /> Добавить ТК
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className={styles.statsContainer}>
                    <h2 className={styles.statsTitle}>Статистика</h2>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <div className={styles.statNumber}>{summary.companiesCount.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabel}>Компаний</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statNumber}>{summary.activeShipmentsCount.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabel}>Активных отгрузок</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statNumber}>{formatCurrency(summary.avgCost)}</div>
                            <div className={styles.statLabel}>Средняя стоимость</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statNumber}>{summary.successRate.toFixed(1)}%</div>
                            <div className={styles.statLabel}>Успешность (завершенные/все)</div>
                        </div>
                    </div>
                </div>

                <div className={styles.tableSection}>
                    <Tabs.Root
                        value={activeTab}
                        onValueChange={(v) => {
                            const next = v as any;
                            if (next === 'activeShipments' && !canTransportActiveShipmentsView) return;
                            if (next === 'recentShipments' && !canTransportRecentShipmentsView) return;
                            setActiveTab(next);
                        }}
                    >
                        <Tabs.List className={styles.tabsList} ref={tabsListRef as any}>
                            <span
                                className={styles.tabsIndicator}
                                style={tabsIndicatorStyle}
                                data-ready={isTabsIndicatorReady ? 'true' : 'false'}
                                aria-hidden="true"
                            />
                            <Tabs.Trigger value="companies">Транспортные компании</Tabs.Trigger>
                            {canTransportActiveShipmentsView ? (
                                <Tabs.Trigger value="activeShipments">
                                    Активные отгрузки
                                    {(data?.activeShipments?.length || 0) > 0 ? <span className={styles.tabBadge}>{data?.activeShipments?.length || 0}</span> : null}
                                </Tabs.Trigger>
                            ) : null}
                            {canTransportRecentShipmentsView ? (
                                <Tabs.Trigger value="recentShipments">
                                    Последние отгрузки
                                    {(data?.recentShipments?.length || 0) > 0 ? <span className={styles.tabBadge}>{data?.recentShipments?.length || 0}</span> : null}
                                </Tabs.Trigger>
                            ) : null}
                        </Tabs.List>

                        <div className={styles.tableHeader}>
                            <TextField.Root
                                className={styles.searchInput}
                                size="3"
                                radius="large"
                                variant="surface"
                                placeholder={activeTab === 'companies' ? 'Поиск по названию или email...' : 'Поиск по отгрузкам...'}
                                value={searchInputValue}
                                onChange={(e) => setSearchInputValue(e.target.value)}
                            >
                                <TextField.Slot side="left">
                                    <FiSearch height="16" width="16" />
                                </TextField.Slot>
                            </TextField.Root>

                            <div className={styles.tableHeaderActions}>
                                {activeTab === 'companies' ? (
                                    <>
                                        <div className={styles.filterDropdown} ref={filtersDropdownRef}>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                className={styles.filterSelectTrigger}
                                                onClick={() => {
                                                    setIsSortSelectOpen(false);
                                                    sortTriggerRef.current?.blur();
                                                    (document.activeElement as HTMLElement | null)?.blur?.();
                                                    setIsFiltersOpen((v) => !v);
                                                }}
                                                ref={filterTriggerRef}
                                                aria-expanded={isFiltersOpen}
                                            >
                                                <span className={styles.triggerLabel}>
                                                    <FiFilter className={styles.icon} />
                                                    Фильтры
                                                </span>
                                            </Button>

                                            {isFiltersOpen ? (
                                                <Box ref={filtersPanelRef} className={styles.filtersDropdownPanel} data-transport-filters-dropdown>
                                                    <Tabs.Root defaultValue="company">
                                                        <Tabs.List className={styles.filtersTabs}>
                                                            <Tabs.Trigger value="company">Компания</Tabs.Trigger>
                                                            <Tabs.Trigger value="rate">Тариф</Tabs.Trigger>
                                                            <Tabs.Trigger value="total">Всего</Tabs.Trigger>
                                                            <Tabs.Trigger value="active">Активные</Tabs.Trigger>
                                                        </Tabs.List>

                                                        <Box pt="3">
                                                            <Tabs.Content value="company">
                                                                <Box>
                                                                    <Text as="label" size="2" weight="medium">Компания</Text>
                                                                    <TextArea
                                                                        size="2"
                                                                        variant="surface"
                                                                        resize="none"
                                                                        radius="large"
                                                                        placeholder="Начни вводить название компании…"
                                                                        value={filters.companyName}
                                                                        onChange={(e) => {
                                                                            const v = e.target.value;
                                                                            setFilters((prev) => ({ ...prev, companyName: v }));
                                                                        }}
                                                                        className={styles.filterTextArea}
                                                                    />
                                                                </Box>
                                                            </Tabs.Content>

                                                            <Tabs.Content value="rate">
                                                                <Box>
                                                                    <Text as="label" size="2" weight="medium">Тариф</Text>
                                                                    <Select.Root
                                                                        value={filters.rate}
                                                                        onValueChange={(value) => setFilters((prev) => ({ ...prev, rate: value as FiltersState['rate'] }))}
                                                                    >
                                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                                            <Select.Item value="all">Все</Select.Item>
                                                                            <Select.Item value="lt-1000">Меньше 1 000 ₽</Select.Item>
                                                                            <Select.Item value="1000-5000">1 000–5 000 ₽</Select.Item>
                                                                            <Select.Item value="gt-5000">Больше 5 000 ₽</Select.Item>
                                                                        </Select.Content>
                                                                    </Select.Root>
                                                                </Box>
                                                            </Tabs.Content>

                                                            <Tabs.Content value="total">
                                                                <Box>
                                                                    <Text as="label" size="2" weight="medium">Кол-во всего</Text>
                                                                    <Select.Root
                                                                        value={filters.totalShipments}
                                                                        onValueChange={(value) =>
                                                                            setFilters((prev) => ({ ...prev, totalShipments: value as FiltersState['totalShipments'] }))
                                                                        }
                                                                    >
                                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                                            <Select.Item value="all">Все</Select.Item>
                                                                            <Select.Item value="0">0</Select.Item>
                                                                            <Select.Item value="1-9">1–9</Select.Item>
                                                                            <Select.Item value="10+">10+</Select.Item>
                                                                        </Select.Content>
                                                                    </Select.Root>
                                                                </Box>
                                                            </Tabs.Content>

                                                            <Tabs.Content value="active">
                                                                <Box>
                                                                    <Text as="label" size="2" weight="medium">Кол-во активных</Text>
                                                                    <Select.Root
                                                                        value={filters.activeShipments}
                                                                        onValueChange={(value) =>
                                                                            setFilters((prev) => ({ ...prev, activeShipments: value as FiltersState['activeShipments'] }))
                                                                        }
                                                                    >
                                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                                            <Select.Item value="all">Все</Select.Item>
                                                                            <Select.Item value="0">0</Select.Item>
                                                                            <Select.Item value="1-4">1–4</Select.Item>
                                                                            <Select.Item value="5+">5+</Select.Item>
                                                                        </Select.Content>
                                                                    </Select.Root>
                                                                </Box>
                                                            </Tabs.Content>
                                                        </Box>
                                                    </Tabs.Root>

                                                    <Flex justify="between" gap="3" className={styles.filtersDropdownPanelActions}>
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="gray"
                                                            highContrast
                                                            onClick={() =>
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    companyName: '',
                                                                    rate: 'all',
                                                                    totalShipments: 'all',
                                                                    activeShipments: 'all',
                                                                }))
                                                            }
                                                        >
                                                            Сбросить
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="gray"
                                                            highContrast
                                                            onClick={() => setIsFiltersOpen(false)}
                                                        >
                                                            Закрыть
                                                        </Button>
                                                    </Flex>
                                                </Box>
                                            ) : null}
                                        </div>

                                        <div className={styles.sortDropdown}>
                                            <span>Сортировка: </span>
                                            <Select.Root
                                                value={filters.sortBy}
                                                open={isSortSelectOpen}
                                                onOpenChange={(open) => {
                                                    setIsSortSelectOpen(open);
                                                    if (open) setIsFiltersOpen(false);
                                                    if (!open) {
                                                        sortTriggerRef.current?.blur();
                                                        (document.activeElement as HTMLElement | null)?.blur?.();
                                                    }
                                                }}
                                                onValueChange={(value) => setFilters((p) => ({ ...p, sortBy: value as FiltersState['sortBy'] }))}
                                            >
                                                <Select.Trigger
                                                    variant="surface"
                                                    color="gray"
                                                    className={styles.sortSelectTrigger}
                                                    ref={sortTriggerRef}
                                                />
                                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                    <Select.Item value="shipments-desc">По отгрузкам (сначала больше)</Select.Item>
                                                    <Select.Item value="shipments-asc">По отгрузкам (сначала меньше)</Select.Item>
                                                    <Select.Item value="revenue-desc">По выручке (сначала больше)</Select.Item>
                                                    <Select.Item value="revenue-asc">По выручке (сначала меньше)</Select.Item>
                                                    <Select.Item value="created-desc">По дате (сначала новые)</Select.Item>
                                                    <Select.Item value="created-asc">По дате (сначала старые)</Select.Item>
                                                </Select.Content>
                                            </Select.Root>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <Tabs.Content value="companies">
                            <div className={styles.tableContainer}>
                                <Table.Root key={tableKey} variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>Компания</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Контакты</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Тариф</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Всего</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Активные</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Завершенные</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Средняя</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Выручка</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Регистрация</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell />
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {filteredTransport.length === 0 ? (
                                            <Table.Row>
                                                <Table.Cell colSpan={10}>
                                                    <Text size="2" color="gray">Компании не найдены</Text>
                                                </Table.Cell>
                                            </Table.Row>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredTransport.map((company) => (
                                                    <MotionTableRow
                                                        key={company.id}
                                                        className={styles.tableRow}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        transition={{ duration: 0.12 }}
                                                        onClick={() => {
                                                            if (!canView) return;
                                                            router.push(`/transport/${company.id}`);
                                                        }}
                                                    >
                                                        <Table.Cell>
                                                            <div className={styles.itemTitle}>{company.название}</div>
                                                            {renderAttachmentBadges(company.id)}
                                                            <div className={styles.itemSub}>ID: {company.id}</div>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <div className={styles.contacts}>
                                                                {company.телефон ? <div className={styles.phone}>{company.телефон}</div> : <div className={styles.itemSub}>—</div>}
                                                                {company.email ? <div className={styles.email}>{company.email}</div> : null}
                                                            </div>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.moneyValue}>{formatCurrency(company.тариф)}</span>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.metricValue}>{company.общее_количество_отгрузок || 0}</span>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.metricValue}>{company.активные_отгрузки || 0}</span>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.metricValue}>{company.завершенные_отгрузки || 0}</span>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.moneyValue}>{formatCurrency(company.средняя_стоимость)}</span>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <span className={styles.moneyValue}>{formatCurrency(company.общая_выручка)}</span>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <span className={styles.itemSub}>{formatDate(company.created_at)}</span>
                                                        </Table.Cell>
                                                        <Table.Cell onClick={(e) => e.stopPropagation()}>
                                                            {canShowCompanyRowMenu ? (
                                                                <DropdownMenu.Root>
                                                                    <DropdownMenu.Trigger>
                                                                        <Button type="button" variant="surface" color="gray" highContrast className={styles.dotsButton}>
                                                                            <FiMoreHorizontal size={18} />
                                                                        </Button>
                                                                    </DropdownMenu.Trigger>
                                                                    <DropdownMenu.Content align="end">
                                                                        {canView ? (
                                                                            <DropdownMenu.Item onClick={() => router.push(`/transport/${company.id}`)}>
                                                                                <FiEye size={14} className={styles.rowMenuIcon} /> Посмотреть
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                        {canTransportStatsView ? (
                                                                            <DropdownMenu.Item onClick={() => handleOpenStats(company)}>
                                                                                <FiArchive size={14} className={styles.rowMenuIcon} /> Статистика
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                        {canEdit ? (
                                                                            <DropdownMenu.Item onClick={() => handleOpenEdit(company)}>
                                                                                <FiEdit2 size={14} className={styles.rowMenuIcon} /> Редактировать
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                        {canDelete ? (
                                                                            <>
                                                                                <DropdownMenu.Separator />
                                                                                <DropdownMenu.Item className={styles.rowMenuItemDanger} color="red" onClick={() => handleDeleteTransport(company)}>
                                                                                    <FiTrash2 className={styles.rowMenuIconDel} size={14} /> Удалить
                                                                                </DropdownMenu.Item>
                                                                            </>
                                                                        ) : null}
                                                                    </DropdownMenu.Content>
                                                                </DropdownMenu.Root>
                                                            ) : null}
                                                        </Table.Cell>
                                                    </MotionTableRow>
                                                ))}
                                            </AnimatePresence>
                                        )}
                                    </Table.Body>
                                </Table.Root>
                            </div>
                        </Tabs.Content>

                        {canTransportActiveShipmentsView ? (
                            <Tabs.Content value="activeShipments">
                                <div className={styles.tableContainer}>
                                    <Table.Root key={tableKey} variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Отгрузка</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Компания</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell />
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {!data?.activeShipments || data.activeShipments.length === 0 ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={6}>
                                                        <Text size="2" color="gray">Нет активных отгрузок</Text>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ) : (
                                                <AnimatePresence>
                                                    {data.activeShipments.slice(0, 50).map((shipment) => (
                                                        <MotionTableRow
                                                            key={shipment.id}
                                                            className={styles.tableRow}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            transition={{ duration: 0.12 }}
                                                        >
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>#{shipment.номер_отслеживания || shipment.id}</div>
                                                                <div className={styles.itemSub}>Заявка #{shipment.заявка_номер}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{shipment.транспорт_название}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{shipment.клиент_название}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{formatDateTime(shipment.дата_отгрузки)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span
                                                                    className={styles.statusPill}
                                                                    data-status={shipment.заявка_статус}
                                                                >
                                                                    {getStatusText(shipment.заявка_статус)}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <DropdownMenu.Root>
                                                                    <DropdownMenu.Trigger>
                                                                        <Button type="button" variant="surface" color="gray" highContrast className={styles.dotsButton}>
                                                                            <FiMoreHorizontal size={18} />
                                                                        </Button>
                                                                    </DropdownMenu.Trigger>
                                                                    <DropdownMenu.Content align="end">
                                                                        <DropdownMenu.Item onClick={() => router.push(`/orders/${shipment.заявка_номер}`)}>
                                                                            <FiEye size={14} /> Открыть заявку
                                                                        </DropdownMenu.Item>
                                                                    </DropdownMenu.Content>
                                                                </DropdownMenu.Root>
                                                            </Table.Cell>
                                                        </MotionTableRow>
                                                    ))}
                                                </AnimatePresence>

                                            )}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </Tabs.Content>
                        ) : null}

                        {canTransportRecentShipmentsView ? (
                            <Tabs.Content value="recentShipments">
                                <div className={styles.tableContainer}>
                                    <Table.Root key={tableKey} variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Отгрузка</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Компания</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell />
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {!data?.recentShipments || data.recentShipments.length === 0 ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={6}>
                                                        <Text size="2" color="gray">Нет последних отгрузок</Text>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ) : (
                                                <AnimatePresence>
                                                    {data.recentShipments.slice(0, 50).map((shipment) => (
                                                        <MotionTableRow
                                                            key={shipment.id}
                                                            className={styles.tableRow}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            transition={{ duration: 0.12 }}
                                                        >
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>#{shipment.номер_отслеживания || shipment.id}</div>
                                                                <div className={styles.itemSub}>Заявка #{shipment.заявка_номер}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{shipment.транспорт_название}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{shipment.клиент_название}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{formatDateTime(shipment.дата_отгрузки)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={styles.statusPill} data-status={shipment.заявка_статус}>
                                                                    {getStatusText(shipment.заявка_статус)}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <DropdownMenu.Root>
                                                                    <DropdownMenu.Trigger>
                                                                        <Button type="button" variant="surface" color="gray" highContrast className={styles.dotsButton}>
                                                                            <FiMoreHorizontal size={18} />
                                                                        </Button>
                                                                    </DropdownMenu.Trigger>
                                                                    <DropdownMenu.Content align="end">
                                                                        <DropdownMenu.Item onClick={() => router.push(`/orders/${shipment.заявка_номер}`)}>
                                                                            <FiEye size={14} /> Открыть заявку
                                                                        </DropdownMenu.Item>
                                                                    </DropdownMenu.Content>
                                                                </DropdownMenu.Root>
                                                            </Table.Cell>
                                                        </MotionTableRow>
                                                    ))}
                                                </AnimatePresence>
                                            )}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </Tabs.Content>
                        ) : null}
                    </Tabs.Root>
                </div>

                {/* Модальные окна */}
                {canCreate ? (
                    <CreateTransportModalNew
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        onCreated={handleTransportCreated}
                    />
                ) : null}

                {canEdit ? (
                    <EditTransportModalNew
                        isOpen={isEditModalOpen}
                        onClose={() => {
                            setIsEditModalOpen(false);
                            setEditCompany(null);
                        }}
                        onUpdated={() => fetchData()}
                        company={editCompany}
                    />
                ) : null}

                {canDelete ? (
                    <Dialog.Root open={isDeleteModalOpen} onOpenChange={(open) => (!open ? setIsDeleteModalOpen(false) : undefined)}>
                        <Dialog.Content className={deleteConfirmStyles.modalContent}>
                            <Dialog.Title>Подтверждение удаления</Dialog.Title>
                            <Box className={deleteConfirmStyles.form}>
                                <Flex direction="column" gap="3">
                                    <Text as="div" size="2" color="gray">
                                        Вы уверены, что хотите удалить транспортную компанию? Это действие нельзя отменить.
                                    </Text>

                                    {selectedCompany ? (
                                        <Box className={deleteConfirmStyles.positionsSection}>
                                            <Flex direction="column" gap="1">
                                                <Text as="div" weight="bold">{selectedCompany.название}</Text>
                                                <Text as="div" size="2" color="gray">Отгрузок: {selectedCompany.общее_количество_отгрузок || 0}</Text>
                                            </Flex>
                                        </Box>
                                    ) : null}

                                    <Flex gap="3" justify="end" mt="4" className={deleteConfirmStyles.modalActions}>
                                        <Button variant="surface" color="gray" highContrast onClick={() => setIsDeleteModalOpen(false)}>
                                            Отмена
                                        </Button>
                                        <Button
                                            color="red"
                                            variant="surface"
                                            highContrast
                                            className={deleteConfirmStyles.modalDeleteButton}
                                            onClick={handleConfirmDelete}
                                        >
                                            Удалить
                                        </Button>
                                    </Flex>
                                </Flex>
                            </Box>
                        </Dialog.Content>
                    </Dialog.Root>
                ) : null}

                {canTransportStatsView ? (
                    <Dialog.Root
                        open={isStatsModalOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setIsStatsModalOpen(false);
                                setStatsCompany(null);
                                setStatsError('');
                                setStatsPerformance([]);
                                setStatsPeriodTotals(null);
                                setExpandedMonth('');
                                setMonthShipments([]);
                                setMonthShipmentsError('');
                            }
                        }}
                    >
                        <Dialog.Content style={{ maxWidth: 980 }}>
                            <Dialog.Title>Статистика</Dialog.Title>
                            <Dialog.Description>
                                {statsCompany ? statsCompany.название : ''}
                            </Dialog.Description>

                            {statsCompany ? (
                                <Box mt="4">
                                    <Flex gap="3" wrap="wrap">
                                        <Card style={{ width: 210 }}>
                                            <Text size="2" color="gray">Тариф</Text>
                                            <div className={styles.statNumber}>{formatCurrency(statsCompany.тариф)}</div>
                                        </Card>
                                        <Card style={{ width: 210 }}>
                                            <Text size="2" color="gray">Всего отгрузок</Text>
                                            <div className={styles.statNumber}>{statsCompany.общее_количество_отгрузок || 0}</div>
                                        </Card>
                                        <Card style={{ width: 210 }}>
                                            <Text size="2" color="gray">Активные</Text>
                                            <div className={styles.statNumber}>{statsCompany.активные_отгрузки || 0}</div>
                                        </Card>
                                        <Card style={{ width: 210 }}>
                                            <Text size="2" color="gray">Завершенные</Text>
                                            <div className={styles.statNumber}>{statsCompany.завершенные_отгрузки || 0}</div>
                                        </Card>
                                        <Card style={{ width: 210 }}>
                                            <Text size="2" color="gray">Средняя стоимость</Text>
                                            <div className={styles.statNumber}>{formatCurrency(statsCompany.средняя_стоимость)}</div>
                                        </Card>
                                        <Card style={{ width: 210 }}>
                                            <Text size="2" color="gray">Выручка</Text>
                                            <div className={styles.statNumber}>{formatCurrency(statsCompany.общая_выручка)}</div>
                                        </Card>
                                    </Flex>

                                    <Box mt="5">
                                        <Text as="div" weight="bold">Итоги за период (последние 12 месяцев)</Text>

                                        {statsLoading ? (
                                            <Box mt="2">
                                                <Text size="2" color="gray">Загрузка…</Text>
                                            </Box>
                                        ) : statsError ? (
                                            <Box mt="2">
                                                <Text size="2" color="red">{statsError}</Text>
                                            </Box>
                                        ) : statsPeriodTotals ? (
                                            <Flex gap="3" wrap="wrap" mt="3">
                                                <Card style={{ width: 210 }}>
                                                    <Text size="2" color="gray">Количество отгрузок</Text>
                                                    <div className={styles.statNumber}>{Number(statsPeriodTotals.количество_отгрузок) || 0}</div>
                                                </Card>
                                                <Card style={{ width: 210 }}>
                                                    <Text size="2" color="gray">Успешные доставки</Text>
                                                    <div className={styles.statNumber}>{Number(statsPeriodTotals.успешные_доставки) || 0}</div>
                                                </Card>
                                                <Card style={{ width: 210 }}>
                                                    <Text size="2" color="gray">Процент успешности</Text>
                                                    <div className={styles.statNumber}>
                                                        {(() => {
                                                            const total = Number(statsPeriodTotals.количество_отгрузок) || 0;
                                                            const ok = Number(statsPeriodTotals.успешные_доставки) || 0;
                                                            return total ? `${Math.round((ok / total) * 100)}%` : '0%';
                                                        })()}
                                                    </div>
                                                </Card>
                                                <Card style={{ width: 210 }}>
                                                    <Text size="2" color="gray">Средняя стоимость</Text>
                                                    <div className={styles.statNumber}>{formatCurrency(Number(statsPeriodTotals.средняя_стоимость) || 0)}</div>
                                                </Card>
                                                <Card style={{ width: 210 }}>
                                                    <Text size="2" color="gray">Общая выручка</Text>
                                                    <div className={styles.statNumber}>{formatCurrency(Number(statsPeriodTotals.общая_выручка) || 0)}</div>
                                                </Card>
                                            </Flex>
                                        ) : (
                                            <Box mt="2">
                                                <Text size="2" color="gray">Нет данных</Text>
                                            </Box>
                                        )}
                                    </Box>

                                    <Box mt="5">
                                        <Text as="div" weight="bold">Статистика по месяцам</Text>

                                        {statsLoading ? (
                                            <Box mt="2">
                                                <Text size="2" color="gray">Загрузка…</Text>
                                            </Box>
                                        ) : statsError ? (
                                            <Box mt="2">
                                                <Text size="2" color="red">{statsError}</Text>
                                            </Box>
                                        ) : (
                                            <div className={styles.tableContainer} style={{ marginTop: 12 }}>
                                                <Table.Root variant="surface" className={styles.table}>
                                                    <Table.Header>
                                                        <Table.Row>
                                                            <Table.ColumnHeaderCell>Месяц</Table.ColumnHeaderCell>
                                                            <Table.ColumnHeaderCell className={styles.textRight}>Количество отгрузок</Table.ColumnHeaderCell>
                                                            <Table.ColumnHeaderCell className={styles.textRight}>Успешные доставки</Table.ColumnHeaderCell>
                                                            <Table.ColumnHeaderCell className={styles.textRight}>Процент успешности</Table.ColumnHeaderCell>
                                                            <Table.ColumnHeaderCell className={styles.textRight}>Средняя стоимость</Table.ColumnHeaderCell>
                                                            <Table.ColumnHeaderCell className={styles.textRight}>Общая выручка</Table.ColumnHeaderCell>
                                                        </Table.Row>
                                                    </Table.Header>
                                                    <Table.Body>
                                                        {statsPerformance.length === 0 ? (
                                                            <Table.Row>
                                                                <Table.Cell colSpan={6}>
                                                                    <Text size="2" color="gray">Нет данных</Text>
                                                                </Table.Cell>
                                                            </Table.Row>
                                                        ) : (
                                                            statsPerformance.map((row) => {
                                                                const total = Number(row.количество_отгрузок) || 0;
                                                                const ok = Number(row.успешные_доставки) || 0;
                                                                const rate = total ? Math.round((ok / total) * 100) : 0;
                                                                const isExpanded = expandedMonth === row.месяц;

                                                                return (
                                                                    <Fragment key={row.месяц}>
                                                                        <Table.Row
                                                                            className={styles.tableRow}
                                                                            onClick={() => {
                                                                                if (!statsCompany) return;
                                                                                if (isExpanded) {
                                                                                    setExpandedMonth('');
                                                                                    setMonthShipments([]);
                                                                                    setMonthShipmentsError('');
                                                                                    return;
                                                                                }
                                                                                setExpandedMonth(row.месяц);
                                                                                setMonthShipments([]);
                                                                                setMonthShipmentsError('');
                                                                                loadMonthShipments(statsCompany.id, row.месяц);
                                                                            }}
                                                                            style={{ cursor: 'pointer' }}
                                                                        >
                                                                            <Table.Cell>
                                                                                <div className={styles.itemTitle}>{formatMonth(row.месяц)}</div>
                                                                                <div className={styles.itemSub}>{isExpanded ? 'Нажми, чтобы свернуть' : 'Нажми, чтобы раскрыть'}</div>
                                                                            </Table.Cell>
                                                                            <Table.Cell className={styles.textRight}>
                                                                                <span className={styles.metricValue}>{total}</span>
                                                                            </Table.Cell>
                                                                            <Table.Cell className={styles.textRight}>
                                                                                <span className={styles.metricValue}>{ok}</span>
                                                                            </Table.Cell>
                                                                            <Table.Cell className={styles.textRight}>
                                                                                <span style={{ color: rate >= 95 ? '#16a34a' : undefined, fontWeight: 700 }}>{rate}%</span>
                                                                            </Table.Cell>
                                                                            <Table.Cell className={styles.textRight}>
                                                                                <span className={styles.moneyValue}>{formatCurrency(Number(row.средняя_стоимость) || 0)}</span>
                                                                            </Table.Cell>
                                                                            <Table.Cell className={styles.textRight}>
                                                                                <span className={styles.moneyValue}>{formatCurrency(Number(row.общая_выручка) || 0)}</span>
                                                                            </Table.Cell>
                                                                        </Table.Row>

                                                                        {isExpanded ? (
                                                                            <Table.Row>
                                                                                <Table.Cell colSpan={6}>
                                                                                    {monthShipmentsLoading ? (
                                                                                        <Text size="2" color="gray">Загрузка отгрузок…</Text>
                                                                                    ) : monthShipmentsError ? (
                                                                                        <Text size="2" color="red">{monthShipmentsError}</Text>
                                                                                    ) : (
                                                                                        <div className={styles.tableContainer} style={{ marginTop: 10 }}>
                                                                                            <Table.Root variant="surface" className={styles.table}>
                                                                                                <Table.Header>
                                                                                                    <Table.Row>
                                                                                                        <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                                                                        <Table.ColumnHeaderCell>Трек</Table.ColumnHeaderCell>
                                                                                                        <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                                                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                                                                        <Table.ColumnHeaderCell className={styles.textRight}>Стоимость</Table.ColumnHeaderCell>
                                                                                                        <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                                                                    </Table.Row>
                                                                                                </Table.Header>
                                                                                                <Table.Body>
                                                                                                    {monthShipments.length === 0 ? (
                                                                                                        <Table.Row>
                                                                                                            <Table.Cell colSpan={6}>
                                                                                                                <Text size="2" color="gray">Нет отгрузок</Text>
                                                                                                            </Table.Cell>
                                                                                                        </Table.Row>
                                                                                                    ) : (
                                                                                                        monthShipments.map((s) => (
                                                                                                            <Table.Row key={s.id} className={styles.tableRow}>
                                                                                                                <Table.Cell>{`#${s.id}`}</Table.Cell>
                                                                                                                <Table.Cell>{s.номер_отслеживания || '—'}</Table.Cell>
                                                                                                                <Table.Cell>{s.клиент_название}</Table.Cell>
                                                                                                                <Table.Cell>
                                                                                                                    <span className={styles.statusPill} data-status={s.заявка_статус}>
                                                                                                                        {getStatusText(s.заявка_статус)}
                                                                                                                    </span>
                                                                                                                </Table.Cell>
                                                                                                                <Table.Cell className={styles.textRight}>
                                                                                                                    <span className={styles.moneyValue}>{formatCurrency(s.стоимость_доставки)}</span>
                                                                                                                </Table.Cell>
                                                                                                                <Table.Cell>{formatDateTime(s.дата_отгрузки)}</Table.Cell>
                                                                                                            </Table.Row>
                                                                                                        ))
                                                                                                    )}
                                                                                                </Table.Body>
                                                                                            </Table.Root>
                                                                                        </div>
                                                                                    )}
                                                                                </Table.Cell>
                                                                            </Table.Row>
                                                                        ) : null}
                                                                    </Fragment>
                                                                );
                                                            })
                                                        )}
                                                    </Table.Body>
                                                </Table.Root>
                                            </div>
                                        )}
                                    </Box>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4">
                                <Button type="submit"
                                    variant="surface"
                                    color="gray"

                                    disabled={loading}
                                    loading={loading}
                                    className={styles.secondaryButton} highContrast onClick={() => setIsStatsModalOpen(false)}>
                                    Закрыть
                                </Button>
                            </Flex>
                        </Dialog.Content>
                    </Dialog.Root>
                ) : null}
            </div>
        </Layout>
    );
}
