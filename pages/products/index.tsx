import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { withLayout } from '../../layout/Layout';
import { CreateProductModal } from '../../components/CreateProductModal';
import { EditProductModal } from '../../components/EditProductModal';
import { ProductPriceHistoryModal } from '../../components/ProductPriceHistoryModal';
import { ReferenceDataActions } from '../../components/ReferenceDataActions';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import styles from './Products.module.css';
import * as XLSX from 'xlsx';
import { Badge, Box, Button, Dialog, DropdownMenu, Flex, Select, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiDownload, FiEdit2, FiEye, FiFilter, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiTrendingUp, FiUpload } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

const MotionTableRow = motion(Table.Row);

interface Product {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    цена_закупки?: number;
    цена_продажи: number;
    единица_измерения: string;
    минимальный_остаток: number;
    created_at: string;
}

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

function ProductsPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [importNotice, setImportNotice] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isFiltersSelectOpen, setIsFiltersSelectOpen] = useState(false);
    const [isSortSelectOpen, setIsSortSelectOpen] = useState(false);
    const [filters, setFilters] = useState({
        category: 'all',
        unit: 'all',
        sortBy: 'date-desc'
    });
    const filtersDropdownRef = useRef<HTMLDivElement | null>(null);
    const filtersPanelRef = useRef<HTMLDivElement | null>(null);
    const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
    const sortTriggerRef = useRef<HTMLButtonElement | null>(null);
    const sortDropdownRef = useRef<HTMLDivElement | null>(null);

    const importFileInputRef = useRef<HTMLInputElement | null>(null);

    const [attachmentsTypesByProductId, setAttachmentsTypesByProductId] = useState<Record<number, string[]>>({});

    const canList = Boolean(user?.permissions?.includes('products.list'));
    const canView = Boolean(user?.permissions?.includes('products.view'));
    const canCreate = Boolean(user?.permissions?.includes('products.create'));
    const canEdit = Boolean(user?.permissions?.includes('products.edit'));
    const canDelete = Boolean(user?.permissions?.includes('products.delete'));
    const canPriceHistoryView = Boolean(user?.permissions?.includes('products.price_history.view'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('products.attachments.view'));
    const canImportExcel = Boolean(user?.permissions?.includes('products.import'));
    const canExportExcel = Boolean(user?.permissions?.includes('products.export.excel'));

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchProducts();
    }, [authLoading, canList]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        if (!router.isReady) return;

        const q = router.query;
        const nextSearch = Array.isArray(q.search) ? q.search[0] : q.search;
        const nextCategory = Array.isArray(q.category) ? q.category[0] : q.category;
        const nextUnit = Array.isArray(q.unit) ? q.unit[0] : q.unit;
        const nextSortBy = Array.isArray(q.sort) ? q.sort[0] : q.sort;

        if (typeof nextSearch === 'string') {
            setSearch(nextSearch);
            setDebouncedSearch(nextSearch);
        }

        setFilters((prev) => ({
            category: typeof nextCategory === 'string' ? nextCategory : prev.category,
            unit: typeof nextUnit === 'string' ? nextUnit : prev.unit,
            sortBy: typeof nextSortBy === 'string' ? nextSortBy : prev.sortBy,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), 250);
        return () => window.clearTimeout(t);
    }, [search]);

    useEffect(() => {
        if (!router.isReady) return;

        const query: Record<string, string> = {};

        if (debouncedSearch.trim()) query.search = debouncedSearch;
        if (filters.category !== 'all') query.category = filters.category;
        if (filters.unit !== 'all') query.unit = filters.unit;
        if (filters.sortBy !== 'date-desc') query.sort = filters.sortBy;

        const currentQuery = router.query;
        const currentSearch = Array.isArray(currentQuery.search) ? currentQuery.search[0] : currentQuery.search;
        const currentCategory = Array.isArray(currentQuery.category) ? currentQuery.category[0] : currentQuery.category;
        const currentUnit = Array.isArray(currentQuery.unit) ? currentQuery.unit[0] : currentQuery.unit;
        const currentSort = Array.isArray(currentQuery.sort) ? currentQuery.sort[0] : currentQuery.sort;

        const unchanged =
            String(currentSearch || '') === String(query.search || '') &&
            String(currentCategory || '') === String(query.category || '') &&
            String(currentUnit || '') === String(query.unit || '') &&
            String(currentSort || '') === String(query.sort || '');

        if (unchanged) return;

        router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    }, [debouncedSearch, filters, router, router.isReady, router.pathname, router.query]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (isFiltersSelectOpen || isSortSelectOpen) return;

            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? Boolean(
                    (filtersDropdownRef.current && path.includes(filtersDropdownRef.current as unknown as EventTarget)) ||
                    (sortDropdownRef.current && path.includes(sortDropdownRef.current as unknown as EventTarget))
                )
                : Boolean(
                    (e.target as Node | null) &&
                    ((filtersDropdownRef.current && filtersDropdownRef.current.contains(e.target as Node)) ||
                        (sortDropdownRef.current && sortDropdownRef.current.contains(e.target as Node)))
                );

            if (isInsideDropdown) return;

            const isInSelectPortal = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                return Boolean(
                    node.closest('.rt-SelectContent') ||
                    node.closest('[data-radix-select-content]') ||
                    node.closest('[role="listbox"]')
                );
            });

            if (isInSelectPortal) return;

            setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [isFiltersOpen, isFiltersSelectOpen, isSortSelectOpen]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFiltersOpen(false);
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isFiltersOpen]);

    const fetchProducts = async () => {
        try {
            if (products.length === 0) {
                setLoading(true);
            } else {
                setIsFetching(true);
            }
            const response = await fetch('/api/products');

            if (!response.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const data = await response.json();
            setProducts(data);

            const ids = (Array.isArray(data) ? data : []).map((p: Product) => Number(p.id)).filter((n: number) => Number.isInteger(n) && n > 0);
            if (ids.length > 0 && canAttachmentsView) {
                try {
                    const summaryRes = await fetch(`/api/attachments/summary?entity_type=product&entity_ids=${encodeURIComponent(ids.join(','))}`);
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as AttachmentSummaryItem[];
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesByProductId(map);
                    }
                } catch (e) {
                    console.error('Error fetching products attachments summary:', e);
                }
            } else {
                setAttachmentsTypesByProductId({});
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const renderAttachmentBadges = (productId: number) => {
        const types = attachmentsTypesByProductId[productId] || [];
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const handleCreateProduct = () => {
        if (!canCreate) return;
        setIsCreateModalOpen(true);
    };

    const handleDeleteProduct = (product: Product, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canDelete) return;
        setSelectedProduct(product);
        setIsDeleteModalOpen(true);
    };

    const handleEditProduct = (product: Product) => {
        if (!canEdit) return;
        setSelectedProduct(product);
        setIsEditProductModalOpen(true);
    };

    const handleOpenPriceHistory = (product: Product) => {
        if (!canPriceHistoryView) return;
        setSelectedProduct(product);
        setIsPriceHistoryModalOpen(true);
    };

    const handleOpenProduct = (productId: number) => {
        if (!canView) return;
        router.push(`/products/${productId}`);
    };

    const handleConfirmDelete = async () => {
        if (!selectedProduct) return;
        if (!canDelete) return;

        try {
            setIsDeleting(true);
            const response = await fetch(`/api/products?id=${selectedProduct.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления товара');
            }

            await fetchProducts();
            setIsDeleteModalOpen(false);
            setSelectedProduct(null);
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleProductCreated = () => {
        fetchProducts();
        setIsCreateModalOpen(false);
    };

    const handleProductUpdated = () => {
        fetchProducts();
        setIsEditProductModalOpen(false);
        setSelectedProduct(null);
    };

    const parseExcelToRows = async (file: File): Promise<any[]> => {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheetName = wb.SheetNames?.[0];
        const ws = sheetName ? wb.Sheets[sheetName] : null;
        if (!ws) return [];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        return Array.isArray(json) ? json : [];
    };

    const mapExcelRowToImportRow = (row: any) => {
        const pick = (keys: string[]) => {
            for (const k of keys) {
                if (row?.[k] !== undefined) return row[k];
            }
            return undefined;
        };

        return {
            артикул: String(pick(['Артикул', 'артикул', 'SKU']) ?? '').trim(),
            название: String(pick(['Название', 'название', 'Наименование']) ?? '').trim(),
            категория: String(pick(['Категория', 'категория']) ?? '').trim() || null,
            единица_измерения: String(pick(['Ед. измерения', 'Ед. изм.', 'Ед изм', 'единица_измерения', 'Единица']) ?? '').trim() || 'шт',
            минимальный_остаток: pick(['Мин. остаток', 'минимальный_остаток', 'Минимальный остаток']),
            цена_закупки: pick(['Цена закупки', 'цена_закупки']),
            цена_продажи: pick(['Цена продажи', 'цена_продажи']),
        };
    };

    const handleImportExcelClick = () => {
        if (!canImportExcel) return;
        importFileInputRef.current?.click();
    };

    const handleImportExcelFileSelected = async (file: File) => {
        if (!canImportExcel) return;
        try {
            setError(null);
            setImportNotice(null);
            const rows = await parseExcelToRows(file);
            const mapped = rows.map(mapExcelRowToImportRow).filter((r) => String(r.артикул || '').trim());
            if (mapped.length === 0) {
                alert('Файл не содержит строк для импорта');
                return;
            }

            const resp = await fetch('/api/products/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: mapped }),
            });

            if (!resp.ok) {
                const data = await resp.json().catch(() => null);
                throw new Error((data && (data.error || data.message)) || 'Ошибка импорта');
            }

            const json = await resp.json().catch(() => null);

            await fetchProducts();

            const created = Number((json as any)?.created_count);
            const updated = Number((json as any)?.updated_count);
            const skipped = Number((json as any)?.skipped_count);
            const msg = Number.isFinite(created) || Number.isFinite(updated) || Number.isFinite(skipped)
                ? `Импорт завершен. Создано: ${Number.isFinite(created) ? created : 0}. Обновлено: ${Number.isFinite(updated) ? updated : 0}. Пропущено: ${Number.isFinite(skipped) ? skipped : 0}.`
                : 'Импорт завершен.';

            setImportNotice(msg);
            alert(msg);
        } catch (e) {
            console.error('Import excel error:', e);
            setError('Ошибка импорта: ' + (e instanceof Error ? e.message : 'Unknown error'));
            alert('Ошибка импорта: ' + (e instanceof Error ? e.message : 'Unknown error'));
        }
    };

    const formatNumber = (n: number) => n.toLocaleString('ru-RU');

    const categoryOptions = useMemo(
        () => Array.from(new Set(products.map((p) => (p.категория || 'Не указана').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru')),
        [products]
    );

    const unitOptions = useMemo(
        () => Array.from(new Set(products.map((p) => (p.единица_измерения || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru')),
        [products]
    );

    const filteredProducts = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        let result = products.filter((p) => {
            const matchesSearch = !q ||
                (p.название || '').toLowerCase().includes(q) ||
                (p.артикул || '').toLowerCase().includes(q);

            const productCategory = p.категория || 'Не указана';
            const matchesCategory = filters.category === 'all' || productCategory === filters.category;
            const matchesUnit = filters.unit === 'all' || p.единица_измерения === filters.unit;

            return matchesSearch && matchesCategory && matchesUnit;
        });

        result = [...result].sort((a, b) => {
            switch (filters.sortBy) {
                case 'date-asc':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'price-purchase-asc':
                    return (a.цена_закупки || 0) - (b.цена_закупки || 0);
                case 'price-purchase-desc':
                    return (b.цена_закупки || 0) - (a.цена_закупки || 0);
                case 'price-sale-asc':
                    return a.цена_продажи - b.цена_продажи;
                case 'price-sale-desc':
                    return b.цена_продажи - a.цена_продажи;
                case 'name-asc':
                    return (a.название || '').localeCompare(b.название || '', 'ru');
                case 'name-desc':
                    return (b.название || '').localeCompare(a.название || '', 'ru');
                case 'date-desc':
                default:
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

        return result;
    }, [products, debouncedSearch, filters]);

    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.цена_закупки || 0), 0);

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

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Товары</h1>
                        <p className={styles.subtitle}>Каталог товаров и управление номенклатурой</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.surfaceButton} ${styles.headerActionButton}`}
                            onClick={(e) => {
                                e.currentTarget.blur();
                                if (isFetching) return;
                                setRefreshClickKey((k) => k + 1);
                                setMinRefreshSpinActive(true);
                                setTableKey((k) => k + 1);
                                fetchProducts();
                            }}
                        >
                            <FiRefreshCw
                                key={refreshClickKey}
                                size={14}
                                className={isFetching || minRefreshSpinActive ? styles.spin : ''}
                            />{' '}
                            Обновить
                        </Button>
                        <ReferenceDataActions
                            catalogKey="products"
                            permissions={user?.permissions}
                            onImported={fetchProducts}
                        />

                        {canCreate ? (
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.primaryButton} ${styles.headerActionButtonDel}`}
                                onClick={handleCreateProduct}
                            >
                                <FiPlus size={14} /> Добавить товар
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.statsContainer}>
                    <h2 className={styles.statsTitle}>Статистика товаров</h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{formatNumber(totalProducts)}</div>
                            <div className={styles.statLabel}>Всего товаров</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{formatNumber(totalProducts)}</div>
                            <div className={styles.statLabel}>Активных</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>0</div>
                            <div className={styles.statLabel}>Низкий остаток</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{formatCurrency(totalValue)}</div>
                            <div className={styles.statLabel}>Стоимость остатков</div>
                        </div>
                    </div>
                </div>

                <div className={styles.searchSection}>
                    <TextField.Root
                        className={styles.searchInput}
                        size="3"
                        radius="large"
                        variant="surface"
                        placeholder="Поиск по названию или артикулу..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
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
                                ref={filterTriggerRef}
                                onClick={() => {
                                    setIsSortSelectOpen(false);
                                    sortTriggerRef.current?.blur();
                                    (document.activeElement as HTMLElement | null)?.blur?.();
                                    setIsFiltersOpen((v) => !v);
                                }}
                                aria-expanded={isFiltersOpen}
                                data-state={isFiltersOpen ? 'open' : 'closed'}
                            >
                                <span className={styles.triggerLabel}>
                                    <FiFilter />
                                    Фильтры
                                </span>
                            </Button>

                            {isFiltersOpen ? (
                                <Box className={styles.filtersDropdownPanel} ref={filtersPanelRef}>
                                    <Tabs.Root defaultValue="category">
                                        <Tabs.List className={styles.filtersTabs}>
                                            <Tabs.Trigger value="category">Категория</Tabs.Trigger>
                                            <Tabs.Trigger value="unit">Ед. изм.</Tabs.Trigger>
                                        </Tabs.List>

                                        <Box pt="3">
                                            <Tabs.Content value="category">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Категория</Text>
                                                    <Select.Root
                                                        value={filters.category}
                                                        onOpenChange={setIsFiltersSelectOpen}
                                                        onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
                                                    >
                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                            <Select.Item value="all">Все категории</Select.Item>
                                                            {categoryOptions.map((category) => (
                                                                <Select.Item key={category} value={category}>{category}</Select.Item>
                                                            ))}
                                                        </Select.Content>
                                                    </Select.Root>
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="unit">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Единица измерения</Text>
                                                    <Select.Root
                                                        value={filters.unit}
                                                        onOpenChange={setIsFiltersSelectOpen}
                                                        onValueChange={(value) => setFilters((prev) => ({ ...prev, unit: value }))}
                                                    >
                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                            <Select.Item value="all">Все единицы</Select.Item>
                                                            {unitOptions.map((unit) => (
                                                                <Select.Item key={unit} value={unit}>{unit}</Select.Item>
                                                            ))}
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
                                            onClick={() => setFilters((prev) => ({ ...prev, category: 'all', unit: 'all' }))}
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

                        <div className={styles.sortDropdown} ref={sortDropdownRef}>
                            <span>Сортировка: </span>
                            <Select.Root
                                value={filters.sortBy}
                                open={isSortSelectOpen}
                                onOpenChange={(open) => {
                                    setIsSortSelectOpen(open);
                                    if (open) {
                                        setIsFiltersOpen(false);
                                    }
                                    if (!open) {
                                        sortTriggerRef.current?.blur();
                                        (document.activeElement as HTMLElement | null)?.blur?.();
                                    }
                                }}
                                onValueChange={(value) => {
                                    setFilters((prev) => ({ ...prev, sortBy: value }));
                                    sortTriggerRef.current?.blur();
                                    (document.activeElement as HTMLElement | null)?.blur?.();
                                }}
                            >
                                <Select.Trigger
                                    className={styles.sortSelectTrigger}
                                    ref={sortTriggerRef}
                                    variant="surface"
                                    color="gray"
                                />
                                <Select.Content className={styles.sortSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="date-desc">По дате (новые сначала)</Select.Item>
                                    <Select.Item value="date-asc">По дате (старые сначала)</Select.Item>
                                    <Select.Item value="name-asc">По названию (А-Я)</Select.Item>
                                    <Select.Item value="name-desc">По названию (Я-А)</Select.Item>
                                    <Select.Item value="price-purchase-asc">По закупке (по возрастанию)</Select.Item>
                                    <Select.Item value="price-purchase-desc">По закупке (по убыванию)</Select.Item>
                                    <Select.Item value="price-sale-asc">По продаже (по возрастанию)</Select.Item>
                                    <Select.Item value="price-sale-desc">По продаже (по убыванию)</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </div>

                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={styles.surfaceButton}
                            onClick={() => {
                                if (!canExportExcel) return;
                                const ws = XLSX.utils.json_to_sheet(filteredProducts.map(p => ({
                                    'ID': p.id,
                                    'Название': p.название,
                                    'Артикул': p.артикул,
                                    'Категория': p.категория || '',
                                    'Цена закупки': p.цена_закупки || 0,
                                    'Цена продажи': p.цена_продажи,
                                    'Ед. измерения': p.единица_измерения,
                                    'Мин. остаток': p.минимальный_остаток,
                                    'Дата создания': new Date(p.created_at).toLocaleDateString('ru-RU')
                                })));
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, 'Товары');
                                const date = new Date().toISOString().split('T')[0];
                                XLSX.writeFile(wb, `Товары_${date}.xlsx`);
                            }}
                            style={!canExportExcel ? { display: 'none' } : undefined}
                        >
                            <FiDownload size={16} /> Excel
                        </Button>

                        {canImportExcel ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={styles.surfaceButton}
                                onClick={handleImportExcelClick}
                            >
                                <FiUpload size={16} /> Excel
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className={styles.tableContainer} key={tableKey}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Артикул</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Категория</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell align="right">Цена закупки</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell align="right">Цена продажи</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Ед. изм.</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell align="right"></Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {loading ? (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <Text size="2" color="gray">Загрузка товаров...</Text>
                                    </Table.Cell>
                                </Table.Row>
                            ) : error ? (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <Text size="2" color="red">{error}</Text>
                                    </Table.Cell>
                                </Table.Row>
                            ) : filteredProducts.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <Text size="2" color="gray">Товары не найдены</Text>
                                    </Table.Cell>
                                </Table.Row>
                            ) : (
                                <AnimatePresence>
                                    {filteredProducts.map((product) => (
                                        <MotionTableRow
                                            key={product.id}
                                            className={styles.tableRow}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            onClick={() => handleOpenProduct(product.id)}
                                        >
                                            <Table.Cell>
                                                <div>
                                                    <div className={styles.itemTitle}>#{product.id}</div>
                                                    {renderAttachmentBadges(product.id)}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <div className={styles.itemTitle}>{product.название}</div>
                                            </Table.Cell>
                                            <Table.Cell>{product.артикул}</Table.Cell>
                                            <Table.Cell>{product.категория || 'Не указана'}</Table.Cell>
                                            <Table.Cell align="right">{product.цена_закупки ? formatCurrency(product.цена_закупки) : '—'}</Table.Cell>
                                            <Table.Cell align="right">{formatCurrency(product.цена_продажи)}</Table.Cell>
                                            <Table.Cell>{product.единица_измерения}</Table.Cell>
                                            <Table.Cell align="right" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu.Root>
                                                    <DropdownMenu.Trigger>
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="gray"
                                                            highContrast
                                                            className={styles.moreButton}
                                                        >
                                                            <FiMoreHorizontal size={18} />
                                                        </Button>
                                                    </DropdownMenu.Trigger>
                                                    <DropdownMenu.Content>
                                                        {canView ? (
                                                            <DropdownMenu.Item onSelect={() => handleOpenProduct(product.id)}>
                                                                <FiEye size={16} className={styles.rowMenuIcon} />
                                                                Просмотреть
                                                            </DropdownMenu.Item>
                                                        ) : null}

                                                        {canEdit ? (
                                                            <DropdownMenu.Item onSelect={() => handleEditProduct(product)}>
                                                                <FiEdit2 size={16} className={styles.rowMenuIcon} />
                                                                Редактировать
                                                            </DropdownMenu.Item>
                                                        ) : null}

                                                        {canPriceHistoryView ? (
                                                            <DropdownMenu.Item onSelect={() => handleOpenPriceHistory(product)}>
                                                                <FiTrendingUp size={16} className={styles.rowMenuIcon} />
                                                                История цен
                                                            </DropdownMenu.Item>
                                                        ) : null}

                                                        {canDelete ? (
                                                            <>
                                                                <DropdownMenu.Separator />
                                                                <DropdownMenu.Item
                                                                    color="red"
                                                                    className={styles.rowMenuItemDanger}
                                                                    onSelect={(e) =>
                                                                        handleDeleteProduct(product, e as unknown as React.MouseEvent)
                                                                    }
                                                                >
                                                                    <FiTrash2 className={styles.rowMenuIconDel} size={16} /> Удалить
                                                                </DropdownMenu.Item>
                                                            </>
                                                        ) : null}
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
            </div>

            <CreateProductModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onProductCreated={handleProductCreated}
            />

            <EditProductModal
                isOpen={isEditProductModalOpen}
                onClose={() => {
                    setIsEditProductModalOpen(false);
                    setSelectedProduct(null);
                }}
                onProductUpdated={handleProductUpdated}
                product={selectedProduct}
            />

            <ProductPriceHistoryModal
                isOpen={isPriceHistoryModalOpen}
                onClose={() => {
                    setIsPriceHistoryModalOpen(false);
                    setSelectedProduct(null);
                }}
                productId={selectedProduct?.id ?? null}
                productName={selectedProduct?.название}
            />

            <Dialog.Root
                open={isDeleteModalOpen && !!selectedProduct}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDeleteModalOpen(false);
                        setSelectedProduct(null);
                    }
                }}
            >
                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmationStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить.
                            </Text>

                            {selectedProduct ? (
                                <Box className={deleteConfirmationStyles.positionsSection}>
                                    <Flex direction="column" gap="1">
                                        <Text as="div" weight="bold">{selectedProduct.название}</Text>
                                        <Text as="div" size="2" color="gray">Артикул: {selectedProduct.артикул || '-'}</Text>
                                        <Text as="div" size="2" color="gray">Цена продажи: {formatCurrency(selectedProduct.цена_продажи || 0)}</Text>
                                    </Flex>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmationStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setSelectedProduct(null);
                                    }}
                                    disabled={isDeleting}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmationStyles.modalDeleteButton}
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>

            <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    handleImportExcelFileSelected(f);
                }}
            />
        </div >
    );
}

export default withLayout(ProductsPage);
