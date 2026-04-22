import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { FiChevronDown, FiFilter, FiSearch } from 'react-icons/fi';
import { withLayout } from '../../layout';
import { RefreshButton } from '../../components/RefreshButton/RefreshButton';
import { Button } from '../../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Pagination } from '../../components/ui/pagination';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '../../components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { useAuth } from '../../context/AuthContext';
import { lockBodyScroll, scheduleForceUnlockBodyScroll } from '../../utils/bodyScrollLock';
import styles from './Audit.module.css';

type AuditItem = Record<string, any>;

type AuditApiResponse = {
    items: AuditItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    columns: string[];
};

type FilterTabKey = 'method' | 'entity' | 'actor';

function formatDateTime(value: any): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value ?? '');
    return parsed.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function pickCell(row: AuditItem, keys: string[]): any {
    for (const key of keys) {
        if (row[key] != null) return row[key];
    }
    return '';
}

function normalizeDetails(raw: unknown): any {
    if (raw == null) return null;
    if (typeof raw !== 'string') return raw;

    const normalized = raw.trim();
    if (!normalized) return '';

    try {
        return JSON.parse(normalized);
    } catch {
        // noop
    }

    if (normalized.includes('""') && normalized.startsWith('{') && normalized.endsWith('}')) {
        try {
            return JSON.parse(normalized.replace(/""/g, '"'));
        } catch {
            // noop
        }
    }

    return raw;
}

function summarizeDetails(details: any): string {
    if (details == null) return '';
    if (typeof details === 'string') return details;

    if (Array.isArray(details?.changes) && details.changes.length > 0) {
        const formatValue = (value: any): string => {
            if (value == null) return 'null';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        };

        const picks = details.changes
            .slice(0, 3)
            .map((change: any) => `${change.field}: ${formatValue(change.from)} → ${formatValue(change.to)}`);
        const suffix = details.changes.length > 3 ? ', …' : '';
        return `Изменения: ${picks.join(', ')}${suffix}`;
    }

    const url = typeof details?.url === 'string' ? details.url : '';
    const sqlRaw = typeof details?.sql === 'string' ? details.sql : '';
    const sql = sqlRaw.replace(/\s+/g, ' ').trim();
    const lower = sql.toLowerCase();
    const params: any[] = Array.isArray(details?.params) ? details.params : [];

    const extractTableName = (): string => {
        let match = sql.match(/insert\s+into\s+"([^"]+)"/i);
        if (match?.[1]) return match[1];

        match = sql.match(/update\s+"([^"]+)"/i);
        if (match?.[1]) return match[1];

        match = sql.match(/delete\s+from\s+"([^"]+)"/i);
        if (match?.[1]) return match[1];

        return '';
    };

    const getUpdateAssignments = (): { column: string; value: any }[] => {
        const match = sql.match(/\bset\b\s+(.+?)\s+\bwhere\b/i);
        if (!match?.[1]) return [];

        return match[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const eqIndex = part.indexOf('=');
                if (eqIndex === -1) return null;

                const left = part.slice(0, eqIndex).trim();
                const right = part.slice(eqIndex + 1).trim();
                const column = left.replace(/^"|"$/g, '');

                const placeholderMatch = right.match(/^\$(\d+)$/);
                if (placeholderMatch?.[1]) {
                    const index = Number(placeholderMatch[1]) - 1;
                    return { column, value: index >= 0 && index < params.length ? params[index] : undefined };
                }

                const stringLiteral = right.match(/^'(.*)'$/);
                if (stringLiteral) return { column, value: stringLiteral[1] };

                const numberLiteral = right.match(/^(-?\d+(?:\.\d+)?)$/);
                if (numberLiteral) return { column, value: Number(numberLiteral[1]) };

                return { column, value: right };
            })
            .filter(Boolean) as Array<{ column: string; value: any }>;
    };

    const formatValue = (value: any): string => {
        if (value == null) return 'null';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    };

    const table = extractTableName();
    let verb = 'SQL';

    if (lower.startsWith('insert')) verb = 'Создание';
    else if (lower.startsWith('update')) verb = 'Изменение';
    else if (lower.startsWith('delete')) verb = 'Удаление';

    let summary = table ? `${verb}: ${table}` : verb;

    if (verb === 'Изменение') {
        const assignments = getUpdateAssignments();
        if (assignments.length > 0) {
            const picks = assignments
                .slice(0, 3)
                .map((assignment) => `${assignment.column} = ${formatValue(assignment.value)}`);
            const suffix = assignments.length > 3 ? ', …' : '';
            summary = `${summary} · ${picks.join(', ')}${suffix}`;
        }
    }

    if (url) return `${summary} · ${url}`;
    return summary;
}

function prettyJson(value: any): string {
    if (value == null) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function AuditPage(): JSX.Element {
    const router = useRouter();
    const { user, loading } = useAuth();
    const isNavigatingRef = useRef(false);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const limit = 50;

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState({
        method: 'all',
        entityType: '',
        actor: '',
    });
    const [activeFilterTab, setActiveFilterTab] = useState<FilterTabKey>('method');
    const [entityQuery, setEntityQuery] = useState('');
    const [entityOptions, setEntityOptions] = useState<string[]>([]);
    const [isFetchingEntitySuggestions, setIsFetchingEntitySuggestions] = useState(false);
    const [actorQuery, setActorQuery] = useState('');
    const [actorOptions, setActorOptions] = useState<string[]>([]);
    const [isFetchingActorSuggestions, setIsFetchingActorSuggestions] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isMethodSelectOpen, setIsMethodSelectOpen] = useState(false);
    const [data, setData] = useState<AuditApiResponse | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRow, setSelectedRow] = useState<AuditItem | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [refreshClickKey, setRefreshClickKey] = useState(0);

    const canView = Boolean(user?.permissions?.includes('admin.audit'));

    useEffect(() => {
        scheduleForceUnlockBodyScroll();
        return () => {
            scheduleForceUnlockBodyScroll();
        };
    }, []);

    useEffect(() => {
        if (!isDetailsOpen) {
            scheduleForceUnlockBodyScroll();
            return;
        }

        const unlockBodyScroll = lockBodyScroll();
        return () => {
            unlockBodyScroll();
            scheduleForceUnlockBodyScroll();
        };
    }, [isDetailsOpen]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
        return () => window.clearTimeout(timeoutId);
    }, [query]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const timeoutId = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(timeoutId);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (isMethodSelectOpen) return;

            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const target = event.target as Node | null;
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean(target && filtersDropdownRef.current?.contains(target));

            if (isInsideDropdown) return;

            const isInSelectPopup = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.hasAttribute('data-audit-filters-select-content')) return true;
                return Boolean(node.closest('[data-audit-filters-select-content]'));
            });

            if (isInSelectPopup) return;
            setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, false);
        return () => document.removeEventListener('pointerdown', handlePointerDown, false);
    }, [isFiltersOpen, isMethodSelectOpen]);

    useEffect(() => {
        const handleRouteStart = () => {
            isNavigatingRef.current = true;
            setIsFiltersOpen(false);
            setIsMethodSelectOpen(false);
            setIsDetailsOpen(false);
            setSelectedRow(null);
            scheduleForceUnlockBodyScroll();
        };

        const handleRouteEnd = () => {
            isNavigatingRef.current = false;
        };

        router.events.on('routeChangeStart', handleRouteStart);
        router.events.on('routeChangeComplete', handleRouteEnd);
        router.events.on('routeChangeError', handleRouteEnd);

        return () => {
            router.events.off('routeChangeStart', handleRouteStart);
            router.events.off('routeChangeComplete', handleRouteEnd);
            router.events.off('routeChangeError', handleRouteEnd);
        };
    }, [router.events]);

    useEffect(() => {
        if (!router.isReady) return;

        const routeQuery = typeof router.query.q === 'string' ? router.query.q : '';
        const method = typeof router.query.method === 'string' ? router.query.method : 'all';
        const entityType = typeof router.query.entity_type === 'string' ? router.query.entity_type : '';
        const actor = typeof router.query.actor === 'string' ? router.query.actor : '';
        const page = Math.max(
            1,
            Number(
                typeof router.query.page === 'string'
                    ? router.query.page
                    : Array.isArray(router.query.page)
                        ? router.query.page[0]
                        : 1
            ) || 1
        );

        setQuery(routeQuery);
        setFilters({
            method: method || 'all',
            entityType,
            actor,
        });
        setEntityQuery(entityType);
        setActorQuery(actor);
        setCurrentPage(page);
    }, [router.isReady, router.query.actor, router.query.entity_type, router.query.method, router.query.page, router.query.q]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const controller = new AbortController();

        const loadActorSuggestions = async () => {
            try {
                setIsFetchingActorSuggestions(true);

                const response = await fetch('/api/admin/audit?q=&page=1&limit=200&method=all&entity_type=&actor=', {
                    signal: controller.signal,
                });
                const json = (await response.json().catch(() => ({}))) as any;
                if (!response.ok) throw new Error(json?.error || 'Ошибка');

                const values = new Set<string>();
                for (const row of Array.isArray(json?.items) ? json.items : []) {
                    const fio = String(row?.actor_fio || '').trim();
                    if (fio) values.add(fio);
                }

                setActorOptions(Array.from(values));
            } catch (errorResponse) {
                if ((errorResponse as any)?.name === 'AbortError') return;
                setActorOptions([]);
            } finally {
                setIsFetchingActorSuggestions(false);
            }
        };

        void loadActorSuggestions();
        return () => controller.abort();
    }, [isFiltersOpen]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const controller = new AbortController();

        const loadEntitySuggestions = async () => {
            try {
                setIsFetchingEntitySuggestions(true);

                const response = await fetch('/api/admin/audit?q=&page=1&limit=200&method=all&entity_type=&actor=', {
                    signal: controller.signal,
                });
                const json = (await response.json().catch(() => ({}))) as any;
                if (!response.ok) throw new Error(json?.error || 'Ошибка');

                const values = new Set<string>();
                for (const row of Array.isArray(json?.items) ? json.items : []) {
                    const entity = String(row?.entity_type || '').trim();
                    if (entity) values.add(entity);
                }

                setEntityOptions(Array.from(values));
            } catch (errorResponse) {
                if ((errorResponse as any)?.name === 'AbortError') return;
                setEntityOptions([]);
            } finally {
                setIsFetchingEntitySuggestions(false);
            }
        };

        void loadEntitySuggestions();
        return () => controller.abort();
    }, [isFiltersOpen]);

    const filteredEntityOptions = useMemo(() => {
        const normalizedQuery = entityQuery.trim().toLowerCase();
        if (!normalizedQuery) return entityOptions;
        return entityOptions.filter((option) => option.toLowerCase().includes(normalizedQuery));
    }, [entityOptions, entityQuery]);

    const filteredActorOptions = useMemo(() => {
        const normalizedQuery = actorQuery.trim().toLowerCase();
        if (!normalizedQuery) return actorOptions;
        return actorOptions.filter((option) => option.toLowerCase().includes(normalizedQuery));
    }, [actorOptions, actorQuery]);

    useEffect(() => {
        if (!router.isReady || isNavigatingRef.current) return;

        const nextQuery: Record<string, any> = {};
        if (debouncedQuery) nextQuery.q = debouncedQuery;
        if (filters.method && filters.method !== 'all') nextQuery.method = filters.method;
        if (filters.entityType.trim()) nextQuery.entity_type = filters.entityType.trim();
        if (filters.actor.trim()) nextQuery.actor = filters.actor.trim();
        if (currentPage > 1) nextQuery.page = currentPage;

        router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }, [currentPage, debouncedQuery, filters.actor, filters.entityType, filters.method, router]);

    useEffect(() => {
        if (!canView || loading || isNavigatingRef.current) return;

        const load = async () => {
            try {
                setIsFetching(true);
                setError(null);

                const url = `/api/admin/audit?q=${encodeURIComponent(debouncedQuery)}&page=${encodeURIComponent(String(currentPage))}&limit=${encodeURIComponent(String(limit))}&method=${encodeURIComponent(String(filters.method || 'all'))}&entity_type=${encodeURIComponent(String(filters.entityType || ''))}&actor=${encodeURIComponent(String(filters.actor || ''))}`;
                const response = await fetch(url);
                const json = (await response.json().catch(() => ({}))) as any;

                if (!response.ok) throw new Error(json?.error || 'Ошибка загрузки');
                setData(json as AuditApiResponse);
            } catch (errorResponse) {
                setError((errorResponse as any)?.message || 'Ошибка');
                setData(null);
            } finally {
                setIsFetching(false);
            }
        };

        void load();
    }, [canView, currentPage, debouncedQuery, filters.actor, filters.entityType, filters.method, loading, refreshClickKey]);

    const rows = data?.items || [];
    const total = data?.total || 0;
    const totalPages = Math.max(1, data?.totalPages || Math.ceil(total / limit) || 1);

    const columns = useMemo(() => {
        const set = new Set(data?.columns || []);
        return {
            createdAt: set.has('created_at') ? 'created_at' : set.has('created') ? 'created' : null,
            action: set.has('action') ? 'action' : set.has('event') ? 'event' : null,
            entityType: set.has('entity_type') ? 'entity_type' : set.has('entity') ? 'entity' : null,
            entityId: set.has('entity_id') ? 'entity_id' : set.has('target_id') ? 'target_id' : null,
            ip: set.has('ip') ? 'ip' : null,
        };
    }, [data?.columns]);

    const closeDetails = () => {
        setIsDetailsOpen(false);
        setSelectedRow(null);
        scheduleForceUnlockBodyScroll();
    };

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canView) {
        return <NoAccessPage title="Нет доступа\nАудит-лог доступен только для роли director." />;
    }

    if (isFetching && !data) {
        return <PageLoader label="Загрузка аудита..." fullPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Аудит-лог</h1>
                    <p className={styles.subtitle}>История действий в системе</p>
                </div>

                <div className={styles.searchSection}>
                    <div className={styles.searchField}>
                        <FiSearch className={styles.searchIcon} />
                        <Input
                            className={styles.searchInput}
                            placeholder="Поиск по аудиту..."
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <div className={styles.filterDropdown} ref={filtersDropdownRef}>
                            <Button
                                type="button"
                                variant="outline"
                                className={styles.filterButton}
                                aria-expanded={isFiltersOpen}
                                aria-controls="audit-filters-panel"
                                aria-haspopup="dialog"
                                onClick={() => setIsFiltersOpen((value) => !value)}
                            >
                                <span className={styles.triggerLabel}>
                                    <FiFilter className={styles.triggerIcon} />
                                    Фильтры
                                </span>
                                <FiChevronDown className={`${styles.chevronIcon} ${isFiltersOpen ? styles.rotateIcon : ''}`} />
                            </Button>

                            {isFiltersOpen ? (
                                <div id="audit-filters-panel" className={styles.filtersDropdownPanel}>
                                    <div className={styles.filtersTabs} role="tablist" aria-label="Фильтры аудита">
                                        {[
                                            { value: 'method', label: 'Метод' },
                                            { value: 'entity', label: 'Сущность' },
                                            { value: 'actor', label: 'Пользователь' },
                                        ].map((tab) => (
                                            <button
                                                key={tab.value}
                                                type="button"
                                                role="tab"
                                                aria-selected={activeFilterTab === tab.value}
                                                data-active={activeFilterTab === tab.value ? 'true' : 'false'}
                                                className={styles.filterTab}
                                                onClick={() => setActiveFilterTab(tab.value as FilterTabKey)}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {activeFilterTab === 'method' ? (
                                        <div className={styles.filterPanelSection}>
                                            <label className={styles.fieldLabel}>Метод</label>
                                            <Select
                                                value={filters.method}
                                                onOpenChange={setIsMethodSelectOpen}
                                                onValueChange={(nextValue) => {
                                                    if (typeof nextValue !== 'string' || !nextValue) return;
                                                    setFilters((previous) => ({ ...previous, method: nextValue }));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <SelectTrigger
                                                    className={styles.selectTrigger}
                                                    placeholder="Все методы"
                                                />
                                                <SelectContent
                                                    className={styles.selectContent}
                                                    data-audit-filters-select-content
                                                >
                                                    <SelectItem value="all">Все методы</SelectItem>
                                                    <SelectItem value="GET">GET</SelectItem>
                                                    <SelectItem value="POST">POST</SelectItem>
                                                    <SelectItem value="PUT">PUT</SelectItem>
                                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : null}

                                    {activeFilterTab === 'entity' ? (
                                        <div className={styles.filterPanelSection}>
                                            <label className={styles.fieldLabel}>Сущность</label>
                                            <Input
                                                className={styles.filterInput}
                                                placeholder="например: transport"
                                                value={entityQuery}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    setEntityQuery(nextValue);
                                                    setFilters((previous) => ({ ...previous, entityType: nextValue }));
                                                    setCurrentPage(1);
                                                }}
                                            />

                                            {entityQuery.trim() ? (
                                                <div className={styles.inlineSuggestList}>
                                                    {filteredEntityOptions.length > 0 ? (
                                                        filteredEntityOptions.slice(0, 10).map((name) => (
                                                            <button
                                                                key={name}
                                                                type="button"
                                                                className={styles.inlineSuggestItem}
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => {
                                                                    setEntityQuery(name);
                                                                    setFilters((previous) => ({ ...previous, entityType: name }));
                                                                    setCurrentPage(1);
                                                                }}
                                                            >
                                                                {name}
                                                            </button>
                                                        ))
                                                    ) : !isFetchingEntitySuggestions && entityOptions.length > 0 ? (
                                                        <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {activeFilterTab === 'actor' ? (
                                        <div className={styles.filterPanelSection}>
                                            <label className={styles.fieldLabel}>Пользователь</label>
                                            <Input
                                                className={styles.filterInput}
                                                placeholder="Начните вводить ФИО"
                                                value={actorQuery}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    setActorQuery(nextValue);
                                                    setFilters((previous) => ({ ...previous, actor: nextValue }));
                                                    setCurrentPage(1);
                                                }}
                                            />

                                            {actorQuery.trim() ? (
                                                <div className={styles.inlineSuggestList}>
                                                    {filteredActorOptions.length > 0 ? (
                                                        filteredActorOptions.slice(0, 10).map((name) => (
                                                            <button
                                                                key={name}
                                                                type="button"
                                                                className={styles.inlineSuggestItem}
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => {
                                                                    setActorQuery(name);
                                                                    setFilters((previous) => ({ ...previous, actor: name }));
                                                                    setCurrentPage(1);
                                                                }}
                                                            >
                                                                {name}
                                                            </button>
                                                        ))
                                                    ) : !isFetchingActorSuggestions && actorOptions.length > 0 ? (
                                                        <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className={styles.filtersDropdownPanelActions}>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={styles.panelButton}
                                            onClick={() => {
                                                setFilters({ method: 'all', entityType: '', actor: '' });
                                                setEntityQuery('');
                                                setActorQuery('');
                                                setCurrentPage(1);
                                            }}
                                        >
                                            Сбросить
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={styles.panelButton}
                                            onClick={() => setIsFiltersOpen(false)}
                                        >
                                            Готово
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <RefreshButton
                            className={styles.refreshButton}
                            isRefreshing={minRefreshSpinActive}
                            refreshKey={refreshClickKey}
                            iconClassName={styles.refreshSpin}
                            onClick={() => {
                                setMinRefreshSpinActive(true);
                                setTableKey((value) => value + 1);
                                setRefreshClickKey((value) => value + 1);
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                {error ? (
                    <div className={styles.state}>{error}</div>
                ) : rows.length === 0 ? (
                    <div className={styles.state}>Записей не найдено</div>
                ) : (
                    <>
                        <div className={styles.tableContainer} key={tableKey}>
                            <Table className={styles.table}>
                                <TableHeader>
                                    <TableRow className={styles.tableHeaderRow}>
                                        <TableHead className={styles.headerCell}>Дата</TableHead>
                                        <TableHead className={styles.headerCell}>Пользователь</TableHead>
                                        <TableHead className={styles.headerCell}>Действие</TableHead>
                                        <TableHead className={styles.headerCell}>Сущность</TableHead>
                                        <TableHead className={styles.headerCell}>Детали</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {rows.map((row, index) => {
                                        const createdAt = columns.createdAt ? formatDateTime(row[columns.createdAt]) : '';
                                        const actor = row.actor_fio || pickCell(row, ['actor', 'user', 'username']);
                                        const action = columns.action ? String(row[columns.action] ?? '') : '';
                                        const entityType = columns.entityType ? String(row[columns.entityType] ?? '') : '';
                                        const entityId = columns.entityId ? String(row[columns.entityId] ?? '') : '';
                                        const detailsRaw = pickCell(row, ['details', 'meta', 'payload', 'data']);
                                        const detailsObject = normalizeDetails(detailsRaw);
                                        const detailsTextFull =
                                            typeof detailsObject === 'string'
                                                ? detailsObject
                                                : detailsObject
                                                    ? JSON.stringify(detailsObject)
                                                    : '';
                                        const detailsTextShort = summarizeDetails(detailsObject) || detailsTextFull;

                                        return (
                                            <TableRow
                                                key={String(row.id ?? index)}
                                                className={styles.row}
                                                onClick={() => {
                                                    setSelectedRow(row);
                                                    setIsDetailsOpen(true);
                                                }}
                                            >
                                                <TableCell className={`${styles.cell} ${styles.dateCell}`}>
                                                    {createdAt || '—'}
                                                </TableCell>
                                                <TableCell className={styles.cell}>{actor || '—'}</TableCell>
                                                <TableCell className={`${styles.cell} ${styles.actionCell}`}>
                                                    <span className={styles.cellEllipsis} title={action || '—'}>
                                                        {action || '—'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className={styles.cell}>
                                                    {entityType ? `${entityType}${entityId ? ` #${entityId}` : ''}` : '—'}
                                                </TableCell>
                                                <TableCell className={styles.cell}>
                                                    <span className={styles.details} title={detailsTextFull}>
                                                        {detailsTextShort || '—'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            isLoading={isFetching}
                            onPageChange={setCurrentPage}
                            summary={`Всего записей: ${total}`}
                            className={styles.pagination}
                            summaryClassName={styles.paginationSummary}
                            controlsClassName={styles.paginationControls}
                            buttonClassName={styles.paginationButton}
                            activeButtonClassName={styles.paginationButtonActive}
                            ellipsisClassName={styles.paginationEllipsis}
                        />
                    </>
                )}
            </div>

            <Dialog
                open={isDetailsOpen}
                onOpenChange={(open) => {
                    if (open) {
                        setIsDetailsOpen(true);
                        return;
                    }
                    closeDetails();
                }}
            >
                <DialogContent
                    className={styles.auditDetailsDialog}
                    data-scroll-lock-allow="true"
                >
                    <DialogHeader className={styles.auditDetailsDialogHeader}>
                        <DialogTitle className={styles.auditDetailsDialogTitle}>Детали события</DialogTitle>
                        <DialogDescription className={styles.auditDetailsDescription}>
                            Подробная информация по выбранной записи
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRow ? (
                        <div className={styles.auditDetailsBody}>
                            {(() => {
                                const createdAt = columns.createdAt ? formatDateTime(selectedRow[columns.createdAt]) : '';
                                const actor = selectedRow.actor_fio || pickCell(selectedRow, ['actor', 'user', 'username']) || '—';
                                const action = columns.action ? String(selectedRow[columns.action] ?? '') : '';
                                const entityType = columns.entityType ? String(selectedRow[columns.entityType] ?? '') : '';
                                const entityId = columns.entityId ? String(selectedRow[columns.entityId] ?? '') : '';
                                const ip = columns.ip ? String(selectedRow[columns.ip] ?? '') : '';

                                const raw = pickCell(selectedRow, ['details', 'meta', 'payload', 'data']);
                                const detailsObject = normalizeDetails(raw);

                                const changes = Array.isArray(detailsObject?.changes) ? detailsObject.changes : [];
                                const before = detailsObject?.before ?? null;
                                const after = detailsObject?.after ?? null;
                                const sql = typeof detailsObject?.sql === 'string' ? detailsObject.sql : '';
                                const params = detailsObject?.params ?? null;
                                const url = typeof detailsObject?.url === 'string' ? detailsObject.url : '';
                                const method = typeof detailsObject?.method === 'string' ? detailsObject.method : '';

                                return (
                                    <>
                                        <div className={styles.auditDetailsHeaderGrid}>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <span className={styles.auditDetailsHeaderLabel}>Дата</span>
                                                <span className={styles.auditDetailsHeaderValue}>{createdAt || '—'}</span>
                                            </div>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <span className={styles.auditDetailsHeaderLabel}>Пользователь</span>
                                                <span className={styles.auditDetailsHeaderValue}>{actor}</span>
                                            </div>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <span className={styles.auditDetailsHeaderLabel}>Действие</span>
                                                <span className={styles.auditDetailsHeaderValue}>{action || '—'}</span>
                                            </div>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <span className={styles.auditDetailsHeaderLabel}>Сущность</span>
                                                <span className={styles.auditDetailsHeaderValue}>
                                                    {entityType ? `${entityType}${entityId ? ` #${entityId}` : ''}` : '—'}
                                                </span>
                                            </div>
                                            {ip ? (
                                                <div className={styles.auditDetailsHeaderItem}>
                                                    <span className={styles.auditDetailsHeaderLabel}>IP</span>
                                                    <span className={styles.auditDetailsHeaderValue}>{ip}</span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {changes.length > 0 ? (
                                            <div className={styles.auditDetailsSection}>
                                                <div className={styles.auditSectionTitle}>Изменения</div>
                                                <div className={styles.auditChangesTable}>
                                                    <Table className={styles.auditNestedTable}>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className={styles.auditNestedHead}>Поле</TableHead>
                                                                <TableHead className={styles.auditNestedHead}>Было</TableHead>
                                                                <TableHead className={styles.auditNestedHead}>Стало</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {changes.map((change: any, index: number) => (
                                                                <TableRow key={String(change?.field ?? index)}>
                                                                    <TableCell className={styles.auditNestedCell}>
                                                                        {String(change?.field ?? '')}
                                                                    </TableCell>
                                                                    <TableCell className={styles.auditNestedCell}>
                                                                        {change?.from == null ? 'null' : String(change.from)}
                                                                    </TableCell>
                                                                    <TableCell className={styles.auditNestedCell}>
                                                                        {change?.to == null ? 'null' : String(change.to)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        ) : null}

                                        {before != null || after != null ? (
                                            <div className={styles.auditDetailsSection}>
                                                <div className={styles.auditSectionTitle}>Before / After</div>
                                                <div className={styles.auditBeforeAfter}>
                                                    <div className={styles.auditJsonBox}>
                                                        <div className={styles.auditJsonLabel}>Было</div>
                                                        <pre className={styles.auditJsonPre}>{prettyJson(before)}</pre>
                                                    </div>
                                                    <div className={styles.auditJsonBox}>
                                                        <div className={styles.auditJsonLabel}>Стало</div>
                                                        <pre className={styles.auditJsonPre}>{prettyJson(after)}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}

                                        {sql || params || url ? (
                                            <div className={styles.auditDetailsSection}>
                                                <div className={styles.auditSectionTitle}>Технические данные</div>
                                                {method || url ? (
                                                    <div className={styles.auditTechnicalLine}>
                                                        {String(method || '')} {String(url || '')}
                                                    </div>
                                                ) : null}
                                                {sql ? <pre className={styles.auditSqlPre}>{sql}</pre> : null}
                                                {params ? <pre className={styles.auditJsonPre}>{prettyJson(params)}</pre> : null}
                                            </div>
                                        ) : null}

                                        <div className={styles.auditDetailsSection}>
                                            <div className={styles.auditSectionTitle}>Raw</div>
                                            <pre className={styles.auditJsonPre}>{prettyJson(detailsObject)}</pre>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : null}

                    <div className={styles.dialogActions}>
                        <Button
                            type="button"
                            variant="outline"
                            className={styles.dialogButton}
                            onClick={closeDetails}
                        >
                            Закрыть
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default withLayout(AuditPage);
