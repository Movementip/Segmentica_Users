import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import { Box, Button, Dialog, Flex, Select, Table, Tabs, Text, TextArea, TextField } from '@radix-ui/themes';
import { FiChevronDown, FiCopy, FiFilter, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';
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

function formatDateTime(v: any): string {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v ?? '');
    return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function pickCell(row: AuditItem, keys: string[]): any {
    for (const k of keys) {
        if (row[k] != null) return row[k];
    }
    return '';
}

function normalizeDetails(raw: unknown): any {
    if (raw == null) return null;
    if (typeof raw !== 'string') return raw;

    const s = raw.trim();
    if (!s) return '';

    try {
        return JSON.parse(s);
    } catch {
    }

    // Sometimes JSON is stored as text with doubled quotes: {""sql"": ...}
    if (s.includes('""') && s.startsWith('{') && s.endsWith('}')) {
        try {
            return JSON.parse(s.replace(/""/g, '"'));
        } catch {
        }
    }

    return raw;
}

function summarizeDetails(details: any): string {
    if (details == null) return '';
    if (typeof details === 'string') return details;

    if (Array.isArray(details?.changes) && details.changes.length > 0) {
        const formatV = (v: any): string => {
            if (v == null) return 'null';
            if (typeof v === 'string') return v;
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            try {
                return JSON.stringify(v);
            } catch {
                return String(v);
            }
        };

        const picks = details.changes.slice(0, 3).map((c: any) => `${c.field}: ${formatV(c.from)} → ${formatV(c.to)}`);
        const suffix = details.changes.length > 3 ? ', …' : '';
        return `Изменения: ${picks.join(', ')}${suffix}`;
    }

    const url = typeof details?.url === 'string' ? details.url : '';
    const sqlRaw = typeof details?.sql === 'string' ? details.sql : '';

    const sql = sqlRaw.replace(/\s+/g, ' ').trim();
    const lower = sql.toLowerCase();

    const params: any[] = Array.isArray(details?.params) ? details.params : [];

    const extractTableName = (): string => {
        // INSERT INTO "X" ...
        let m = sql.match(/insert\s+into\s+"([^"]+)"/i);
        if (m?.[1]) return m[1];

        // UPDATE "X" ...
        m = sql.match(/update\s+"([^"]+)"/i);
        if (m?.[1]) return m[1];

        // DELETE FROM "X" ...
        m = sql.match(/delete\s+from\s+"([^"]+)"/i);
        if (m?.[1]) return m[1];

        return '';
    };

    const table = extractTableName();

    let verb = '';
    if (lower.startsWith('insert')) verb = 'Создание';
    else if (lower.startsWith('update')) verb = 'Изменение';
    else if (lower.startsWith('delete')) verb = 'Удаление';
    else verb = 'SQL';

    const getUpdateAssignments = (): { col: string; value: any }[] => {
        // UPDATE "X" SET "a"=$1, "b"='x' WHERE ...
        const m = sql.match(/\bset\b\s+(.+?)\s+\bwhere\b/i);
        if (!m?.[1]) return [];
        const setPart = m[1];

        const parts = setPart
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

        const out: { col: string; value: any }[] = [];
        for (const p of parts) {
            const eq = p.indexOf('=');
            if (eq === -1) continue;
            const left = p.slice(0, eq).trim();
            const right = p.slice(eq + 1).trim();

            const col = left.replace(/^"|"$/g, '');

            const ph = right.match(/^\$(\d+)$/);
            if (ph?.[1]) {
                const idx = Number(ph[1]) - 1;
                out.push({ col, value: idx >= 0 && idx < params.length ? params[idx] : undefined });
                continue;
            }

            const strLit = right.match(/^'(.*)'$/);
            if (strLit) {
                out.push({ col, value: strLit[1] });
                continue;
            }

            const numLit = right.match(/^(-?\d+(?:\.\d+)?)$/);
            if (numLit) {
                out.push({ col, value: Number(numLit[1]) });
                continue;
            }

            out.push({ col, value: right });
        }
        return out;
    };

    const formatValue = (v: any): string => {
        if (v == null) return 'null';
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    };

    let main = table ? `${verb}: ${table}` : verb;
    if (verb === 'Изменение') {
        const assigns = getUpdateAssignments();
        if (assigns.length > 0) {
            const picks = assigns.slice(0, 3).map((a) => `${a.col} = ${formatValue(a.value)}`);
            const suffix = assigns.length > 3 ? ', …' : '';
            main = `${main} · ${picks.join(', ')}${suffix}`;
        }
    }

    if (url) return `${main} · ${url}`;
    return main;
}

function prettyJson(v: any): string {
    if (v == null) return '';
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
}

function buildPagination(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const normalized = Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);

    const result: Array<number | 'ellipsis'> = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const page = normalized[index];
        const previous = normalized[index - 1];
        if (index > 0 && previous != null && page - previous > 1) {
            result.push('ellipsis');
        }
        result.push(page);
    }

    return result;
}

function AuditPage(): JSX.Element {
    const router = useRouter();
    const { user, loading } = useAuth();

    const isNavigatingRef = React.useRef(false);

    useEffect(() => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.documentElement.style.pointerEvents = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.position = '';
        return () => {
            document.body.style.pointerEvents = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.documentElement.style.pointerEvents = '';
            document.documentElement.style.overflow = '';
            document.documentElement.style.position = '';
        };
    }, []);

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [limit] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    const [filters, setFilters] = useState({
        method: 'all',
        entityType: '',
        actor: '',
    });

    const [entityQuery, setEntityQuery] = useState('');
    const [entityOptions, setEntityOptions] = useState<string[]>([]);
    const [isFetchingEntitySuggestions, setIsFetchingEntitySuggestions] = useState(false);

    const [actorQuery, setActorQuery] = useState('');
    const [debouncedActorQuery, setDebouncedActorQuery] = useState('');
    const [actorOptions, setActorOptions] = useState<string[]>([]);
    const [isFetchingActorSuggestions, setIsFetchingActorSuggestions] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isMethodSelectOpen, setIsMethodSelectOpen] = useState(false);

    const filtersDropdownRef = React.useRef<HTMLDivElement>(null);

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
        if (isDetailsOpen) return;
        if (isFiltersOpen) return;
        if (isMethodSelectOpen) return;
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.documentElement.style.pointerEvents = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.position = '';
    }, [isDetailsOpen, isFiltersOpen, isMethodSelectOpen]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
        return () => window.clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedActorQuery(actorQuery.trim()), 250);
        return () => window.clearTimeout(t);
    }, [actorQuery]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (isMethodSelectOpen) return;

            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean((e.target as Node | null) && filtersDropdownRef.current?.contains(e.target as Node));

            if (isInsideDropdown) return;

            const isInSelectPortal = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.hasAttribute('data-audit-filters-select-content')) return true;
                return Boolean(node.closest('[data-audit-filters-select-content]') || node.closest('.rt-SelectContent') || node.closest('[data-radix-select-content]'));
            });

            if (isInSelectPortal) return;

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
        const q = typeof router.query.q === 'string' ? router.query.q : '';
        const method = typeof router.query.method === 'string' ? router.query.method : 'all';
        const entityType = typeof router.query.entity_type === 'string' ? router.query.entity_type : '';
        const actor = typeof router.query.actor === 'string' ? router.query.actor : '';
        const page = Math.max(1, Number(typeof router.query.page === 'string' ? router.query.page : Array.isArray(router.query.page) ? router.query.page[0] : 1) || 1);
        setQuery(q);
        setFilters({
            method: method || 'all',
            entityType,
            actor,
        });
        setEntityQuery(entityType);
        setActorQuery(actor);
        setCurrentPage(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const controller = new AbortController();
        const load = async () => {
            try {
                setIsFetchingActorSuggestions(true);
                const res = await fetch(`/api/admin/audit?q=&page=1&limit=200&method=all&entity_type=&actor=`, {
                    signal: controller.signal,
                });
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка');

                const f = new Set<string>();
                for (const row of Array.isArray(json?.items) ? json.items : []) {
                    const fio = String((row as any)?.actor_fio || '').trim();
                    if (fio) f.add(fio);
                }
                setActorOptions(Array.from(f));
            } catch (e) {
                if ((e as any)?.name === 'AbortError') return;
                setActorOptions([]);
            } finally {
                setIsFetchingActorSuggestions(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [isFiltersOpen]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const controller = new AbortController();
        const load = async () => {
            try {
                setIsFetchingEntitySuggestions(true);
                const res = await fetch(`/api/admin/audit?q=&page=1&limit=200&method=all&entity_type=&actor=`, {
                    signal: controller.signal,
                });
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка');

                const f = new Set<string>();
                for (const row of Array.isArray(json?.items) ? json.items : []) {
                    const ent = String((row as any)?.entity_type || '').trim();
                    if (ent) f.add(ent);
                }
                setEntityOptions(Array.from(f));
            } catch (e) {
                if ((e as any)?.name === 'AbortError') return;
                setEntityOptions([]);
            } finally {
                setIsFetchingEntitySuggestions(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [isFiltersOpen]);

    const filteredEntityOptions = useMemo((): string[] => {
        const qLower = entityQuery.trim().toLowerCase();
        if (!qLower) return entityOptions;
        return entityOptions.filter((name) => name.toLowerCase().includes(qLower));
    }, [entityOptions, entityQuery]);

    const filteredActorOptions = useMemo((): string[] => {
        const qLower = actorQuery.trim().toLowerCase();
        if (!qLower) return actorOptions;
        return actorOptions.filter((name) => name.toLowerCase().includes(qLower));
    }, [actorOptions, actorQuery]);

    useEffect(() => {
        if (!router.isReady) return;
        if (isNavigatingRef.current) return;
        const nextQuery: Record<string, any> = {};
        if (debouncedQuery) nextQuery.q = debouncedQuery;
        if (filters.method && filters.method !== 'all') nextQuery.method = filters.method;
        if (filters.entityType.trim()) nextQuery.entity_type = filters.entityType.trim();
        if (filters.actor.trim()) nextQuery.actor = filters.actor.trim();
        if (currentPage > 1) nextQuery.page = currentPage;
        router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }, [currentPage, debouncedQuery, filters.actor, filters.entityType, filters.method, router]);

    useEffect(() => {
        if (!canView || loading) return;
        if (isNavigatingRef.current) return;

        const load = async () => {
            try {
                setIsFetching(true);
                setError(null);
                const url = `/api/admin/audit?q=${encodeURIComponent(debouncedQuery)}&page=${encodeURIComponent(String(currentPage))}&limit=${encodeURIComponent(String(limit))}&method=${encodeURIComponent(String(filters.method || 'all'))}&entity_type=${encodeURIComponent(String(filters.entityType || ''))}&actor=${encodeURIComponent(String(filters.actor || ''))}`;
                const res = await fetch(url);
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка загрузки');
                setData(json as AuditApiResponse);
            } catch (e) {
                setError((e as any)?.message || 'Ошибка');
                setData(null);
            } finally {
                setIsFetching(false);
            }
        };

        void load();
    }, [canView, currentPage, debouncedQuery, limit, loading, refreshClickKey, filters.method, filters.entityType, filters.actor]);

    const rows = data?.items || [];
    const total = data?.total || 0;
    const totalPages = Math.max(1, data?.totalPages || Math.ceil(total / limit) || 1);
    const paginationItems = useMemo(() => buildPagination(currentPage, totalPages), [currentPage, totalPages]);

    const columns = useMemo(() => {
        const set = new Set(data?.columns || []);
        return {
            hasCreatedAt: set.has('created_at') ? 'created_at' : set.has('created') ? 'created' : null,
            hasAction: set.has('action') ? 'action' : set.has('event') ? 'event' : null,
            hasEntityType: set.has('entity_type') ? 'entity_type' : set.has('entity') ? 'entity' : null,
            hasEntityId: set.has('entity_id') ? 'entity_id' : set.has('target_id') ? 'target_id' : null,
            hasIp: set.has('ip') ? 'ip' : null,
        };
    }, [data?.columns]);

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canView) {
        return (
            <>
                <NoAccessPage title="Нет доступа\nАудит-лог доступен только для роли director." />
            </>
        );
    }

    if (isFetching && !data) {
        return <PageLoader label="Загрузка аудита..." fullPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Аудит-лог</h1>
                        <p className={styles.subtitle}>История действий в системе</p>
                    </div>

                    <div className={styles.searchSection}>
                        <TextField.Root
                            className={styles.searchInput}
                            size="3"
                            radius="large"
                            variant="surface"
                            placeholder="Поиск по аудиту..."
                            value={query}
                            onChange={(e) => {
                                setQuery((e.target as HTMLInputElement).value);
                                setCurrentPage(1);
                            }}
                        >
                            <TextField.Slot side="left">
                                <FiSearch height="16" width="16" />
                            </TextField.Slot>
                        </TextField.Root>

                        <div className={styles.filterGroup}>
                            <div className={styles.filterDropdown} ref={filtersDropdownRef}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={styles.filterSelectTrigger}
                                    aria-expanded={isFiltersOpen}
                                    aria-controls="audit-filters-panel"
                                    aria-haspopup="dialog"
                                    onClick={() => setIsFiltersOpen((v) => !v)}
                                >
                                    <span className={styles.triggerLabel}>
                                        <FiFilter height="16" width="16" />
                                        Фильтры
                                    </span>
                                    <FiChevronDown className={`${styles.icon} ${isFiltersOpen ? styles.rotateIcon : ''}`} />
                                </Button>

                                {isFiltersOpen ? (
                                    <Box id="audit-filters-panel" className={styles.filtersDropdownPanel} data-orders-filters-dropdown>
                                        <Tabs.Root defaultValue="method">
                                            <Tabs.List className={styles.filtersTabs}>
                                                <Tabs.Trigger value="method">Метод</Tabs.Trigger>
                                                <Tabs.Trigger value="entity">Сущность</Tabs.Trigger>
                                                <Tabs.Trigger value="actor">Пользователь</Tabs.Trigger>
                                            </Tabs.List>

                                            <Tabs.Content value="method">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">
                                                        Метод
                                                    </Text>
                                                    <Select.Root
                                                        value={filters.method}
                                                        onOpenChange={setIsMethodSelectOpen}
                                                        onValueChange={(v) => {
                                                            setFilters((p) => ({ ...p, method: v }));
                                                            setCurrentPage(1);
                                                        }}
                                                    >
                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast data-audit-filters-select-content>
                                                            <Select.Item value="all">Все</Select.Item>
                                                            <Select.Item value="POST">POST</Select.Item>
                                                            <Select.Item value="PUT">PUT</Select.Item>
                                                            <Select.Item value="PATCH">PATCH</Select.Item>
                                                            <Select.Item value="DELETE">DELETE</Select.Item>
                                                        </Select.Content>
                                                    </Select.Root>
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="entity">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">
                                                        Сущность
                                                    </Text>
                                                    <TextArea
                                                        size="2"
                                                        variant="surface"
                                                        resize="none"
                                                        radius="large"
                                                        placeholder="например: transport"
                                                        value={entityQuery}
                                                        onChange={(e) => {
                                                            const v = (e.target as HTMLTextAreaElement).value;
                                                            setEntityQuery(v);
                                                            setFilters((p) => ({ ...p, entityType: v }));
                                                            setCurrentPage(1);
                                                        }}
                                                        className={styles.filterTextArea}
                                                    />

                                                    {entityQuery.trim() ? (
                                                        <div className={styles.inlineSuggestList}>
                                                            {filteredEntityOptions.length > 0 ? (
                                                                filteredEntityOptions.slice(0, 10).map((name) => (
                                                                    <button
                                                                        key={name}
                                                                        type="button"
                                                                        className={styles.inlineSuggestItem}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => {
                                                                            setEntityQuery(name);
                                                                            setFilters((p) => ({ ...p, entityType: name }));
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
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="actor">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">
                                                        Пользователь
                                                    </Text>
                                                    <TextArea
                                                        size="2"
                                                        variant="surface"
                                                        resize="none"
                                                        radius="large"
                                                        placeholder="Начните вводить ФИО"
                                                        value={actorQuery}
                                                        onChange={(e) => {
                                                            const v = (e.target as HTMLTextAreaElement).value;
                                                            setActorQuery(v);
                                                            setFilters((p) => ({ ...p, actor: v }));
                                                            setCurrentPage(1);
                                                        }}
                                                        className={styles.filterTextArea}
                                                    />

                                                    {actorQuery.trim() ? (
                                                        <div className={styles.inlineSuggestList}>
                                                            {filteredActorOptions.length > 0 ? (
                                                                filteredActorOptions.slice(0, 10).map((name) => (
                                                                    <button
                                                                        key={name}
                                                                        type="button"
                                                                        className={styles.inlineSuggestItem}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => {
                                                                            setActorQuery(name);
                                                                            setFilters((p) => ({ ...p, actor: name }));
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
                                                </Box>
                                            </Tabs.Content>
                                        </Tabs.Root>

                                        <Flex justify="between" gap="3" className={styles.filtersDropdownPanelActions}>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
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
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => setIsFiltersOpen(false)}
                                            >
                                                Готово
                                            </Button>
                                        </Flex>
                                    </Box>
                                ) : null}
                            </div>

                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={styles.surfaceButton}
                                onClick={() => {
                                    setMinRefreshSpinActive(true);
                                    setTableKey((k) => k + 1);
                                    setRefreshClickKey((k) => k + 1);
                                }}
                                aria-label="Обновить"
                            >
                                <FiRefreshCw className={minRefreshSpinActive ? styles.refreshSpin : undefined} />Обновить
                            </Button>

                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                {error ? (
                    <Box className={styles.state}>
                        <Text color="red">{error}</Text>
                    </Box>
                ) : rows.length === 0 ? (
                    <Box className={styles.state}>
                        <Text color="gray">Записей не найдено</Text>
                    </Box>
                ) : (
                    <>
                        <div className={styles.tableContainer} key={tableKey}>
                            <Table.Root variant="surface" className={styles.table}>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Пользователь</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Действие</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Сущность</Table.ColumnHeaderCell>

                                        <Table.ColumnHeaderCell>Детали</Table.ColumnHeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {rows.map((r, idx) => {
                                        const dt = columns.hasCreatedAt ? formatDateTime(r[columns.hasCreatedAt]) : '';
                                        const actor = r.actor_fio || pickCell(r, ['actor', 'user', 'username']);
                                        const act = columns.hasAction ? String(r[columns.hasAction] ?? '') : '';
                                        const ent = columns.hasEntityType ? String(r[columns.hasEntityType] ?? '') : '';
                                        const entId = columns.hasEntityId ? String(r[columns.hasEntityId] ?? '') : '';
                                        const ip = columns.hasIp ? String(r[columns.hasIp] ?? '') : '';

                                        const detailsRaw = pickCell(r, ['details', 'meta', 'payload', 'data']);
                                        const detailsObj = normalizeDetails(detailsRaw);
                                        const detailsTextFull = typeof detailsObj === 'string' ? detailsObj : detailsObj ? JSON.stringify(detailsObj) : '';
                                        const detailsTextShort = summarizeDetails(detailsObj) || detailsTextFull;

                                        return (
                                            <Table.Row
                                                key={String(r.id ?? idx)}
                                                className={styles.row}
                                                onClick={() => {
                                                    setSelectedRow(r);
                                                    setIsDetailsOpen(true);
                                                }}
                                            >
                                                <Table.Cell className={styles.cell}>{dt}</Table.Cell>
                                                <Table.Cell className={styles.cell}>{actor || '—'}</Table.Cell>
                                                <Table.Cell className={styles.cell}>{act || '—'}</Table.Cell>
                                                <Table.Cell className={styles.cell}>
                                                    {ent ? (
                                                        <span>
                                                            {ent}
                                                            {entId ? ` #${entId}` : ''}
                                                        </span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </Table.Cell>

                                                <Table.Cell className={styles.cell}>
                                                    <span className={styles.details} title={detailsTextFull}>
                                                        {detailsTextShort || '—'}
                                                    </span>
                                                </Table.Cell>
                                            </Table.Row>
                                        );
                                    })}
                                </Table.Body>
                            </Table.Root>
                        </div>

                        {totalPages > 1 ? (
                            <Flex direction="column" align="center" gap="3" className={styles.pagination}>
                                <Text size="2" color="gray" className={styles.paginationSummary}>
                                    Всего записей: {total}
                                </Text>

                                <Flex align="center" justify="center" gap="2" wrap="wrap" className={styles.paginationControls}>
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={styles.paginationButton}
                                        disabled={currentPage <= 1 || isFetching}
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    >
                                        Назад
                                    </Button>

                                    {paginationItems.map((item, index) => (
                                        item === 'ellipsis' ? (
                                            <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>…</span>
                                        ) : (
                                            <Button
                                                key={item}
                                                type="button"
                                                variant={item === currentPage ? 'solid' : 'surface'}
                                                color="gray"
                                                highContrast
                                                className={styles.paginationButton}
                                                disabled={isFetching}
                                                onClick={() => setCurrentPage(item)}
                                            >
                                                {item}
                                            </Button>
                                        )
                                    ))}

                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={styles.paginationButton}
                                        disabled={currentPage >= totalPages || isFetching}
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    >
                                        Вперёд
                                    </Button>
                                </Flex>
                            </Flex>
                        ) : null}
                    </>
                )}
            </div>

            <Dialog.Root
                open={isDetailsOpen}
                onOpenChange={(open) => {
                    setIsDetailsOpen(open);
                    if (!open) setSelectedRow(null);
                }}
            >
                <Dialog.Content className={styles.auditDetailsDialog} style={{ maxWidth: 980, width: '95vw' }}>
                    <Dialog.Title>Детали события</Dialog.Title>
                    <Dialog.Description className={styles.auditDetailsDescription}>Подробная информация по выбранной записи</Dialog.Description>

                    {selectedRow ? (
                        <Box className={styles.auditDetailsBody}>
                            {(() => {
                                const createdAt = columns.hasCreatedAt ? formatDateTime(selectedRow[columns.hasCreatedAt]) : '';
                                const actorFio = selectedRow.actor_fio || pickCell(selectedRow, ['actor', 'user', 'username']) || '—';
                                const action = columns.hasAction ? String(selectedRow[columns.hasAction] ?? '') : '';
                                const entity = columns.hasEntityType ? String(selectedRow[columns.hasEntityType] ?? '') : '';
                                const entityId = columns.hasEntityId ? String(selectedRow[columns.hasEntityId] ?? '') : '';

                                const raw = pickCell(selectedRow, ['details', 'meta', 'payload', 'data']);
                                const obj = normalizeDetails(raw);

                                const changes = Array.isArray((obj as any)?.changes) ? (obj as any).changes : [];
                                const before = (obj as any)?.before ?? null;
                                const after = (obj as any)?.after ?? null;
                                const sql = typeof (obj as any)?.sql === 'string' ? (obj as any).sql : '';
                                const params = (obj as any)?.params ?? null;
                                const url = typeof (obj as any)?.url === 'string' ? (obj as any).url : '';
                                const method = typeof (obj as any)?.method === 'string' ? (obj as any).method : '';

                                return (
                                    <>
                                        <Box className={styles.auditDetailsHeaderGrid}>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <Text size="2" color="gray">
                                                    Дата
                                                </Text>
                                                <Text size="2">{createdAt || '—'}</Text>
                                            </div>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <Text size="2" color="gray">
                                                    Пользователь
                                                </Text>
                                                <Text size="2">{actorFio}</Text>
                                            </div>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <Text size="2" color="gray">
                                                    Действие
                                                </Text>
                                                <Text size="2">{action || '—'}</Text>
                                            </div>
                                            <div className={styles.auditDetailsHeaderItem}>
                                                <Text size="2" color="gray">
                                                    Сущность
                                                </Text>
                                                <Text size="2">
                                                    {entity ? `${entity}${entityId ? ` #${entityId}` : ''}` : '—'}
                                                </Text>
                                            </div>
                                        </Box>

                                        {Array.isArray(changes) && changes.length > 0 ? (
                                            <Box className={styles.auditDetailsSection}>
                                                <Text weight="medium">Изменения</Text>
                                                <div className={styles.auditChangesTable}>
                                                    <Table.Root variant="surface">
                                                        <Table.Header>
                                                            <Table.Row>
                                                                <Table.ColumnHeaderCell>Поле</Table.ColumnHeaderCell>
                                                                <Table.ColumnHeaderCell>Было</Table.ColumnHeaderCell>
                                                                <Table.ColumnHeaderCell>Стало</Table.ColumnHeaderCell>
                                                            </Table.Row>
                                                        </Table.Header>
                                                        <Table.Body>
                                                            {changes.map((c: any, i: number) => (
                                                                <Table.Row key={String(c?.field ?? i)}>
                                                                    <Table.Cell>{String(c?.field ?? '')}</Table.Cell>
                                                                    <Table.Cell>{c?.from == null ? 'null' : String(c.from)}</Table.Cell>
                                                                    <Table.Cell>{c?.to == null ? 'null' : String(c.to)}</Table.Cell>
                                                                </Table.Row>
                                                            ))}
                                                        </Table.Body>
                                                    </Table.Root>
                                                </div>
                                            </Box>
                                        ) : null}

                                        {before != null || after != null ? (
                                            <Box className={styles.auditDetailsSection}>
                                                <Text weight="medium">Before / After</Text>
                                                <Flex gap="3" className={styles.auditBeforeAfter}>
                                                    <Box className={styles.auditJsonBox}>
                                                        <Text size="2" color="gray">
                                                            Было
                                                        </Text>
                                                        <pre className={styles.auditJsonPre}>{prettyJson(before)}</pre>
                                                    </Box>
                                                    <Box className={styles.auditJsonBox}>
                                                        <Text size="2" color="gray">
                                                            Стало
                                                        </Text>
                                                        <pre className={styles.auditJsonPre}>{prettyJson(after)}</pre>
                                                    </Box>
                                                </Flex>
                                            </Box>
                                        ) : null}

                                        {sql || params || url ? (
                                            <Box className={styles.auditDetailsSection}>
                                                <Text weight="medium">Технические данные</Text>
                                                {method || url ? (
                                                    <Text size="2" color="gray">
                                                        {String(method || '')} {String(url || '')}
                                                    </Text>
                                                ) : null}
                                                {sql ? <pre className={styles.auditSqlPre}>{sql}</pre> : null}
                                                {params ? <pre className={styles.auditJsonPre}>{prettyJson(params)}</pre> : null}
                                            </Box>
                                        ) : null}

                                        <Box className={styles.auditDetailsSection}>
                                            <Text weight="medium">Raw</Text>
                                            <pre className={styles.auditJsonPre}>{prettyJson(obj)}</pre>
                                        </Box>
                                    </>
                                );
                            })()}
                        </Box>
                    ) : null}

                    <Flex justify="end" mt="4">
                        <Dialog.Close>
                            <Button type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={styles.surfaceButtonClose}>
                                Закрыть
                            </Button>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(AuditPage);
