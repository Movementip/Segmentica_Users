import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { CreateCategoryModal } from '../../components/CreateCategoryModal';
import { EditCategoryModal } from '../../components/EditCategoryModal';
import { ReferenceDataActions } from '../../components/ReferenceDataActions';
import styles from './Categories.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Card, Dialog, Flex, Grid, IconButton, Separator, Text, TextField } from '@radix-ui/themes';
import { FiChevronDown, FiChevronRight, FiEdit3, FiExternalLink, FiFolderPlus, FiMove, FiRefreshCw, FiSearch, FiSlash, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';

interface Category {
    id: number;
    название: string;
    описание?: string;
    родительская_категория_id?: number;
    родительская_категория_название?: string;
    активна: boolean;
    created_at: string;
}

interface CategoryTreeNode extends Category {
    children: CategoryTreeNode[];
    depth: number;
    productCount: number;
}

interface TreeColumn {
    parentId: number | null;
    level: number;
    nodes: CategoryTreeNode[];
}

function CategoriesPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [panOffset, setPanOffset] = useState({ x: 72, y: 36 });
    const [isPanning, setIsPanning] = useState(false);
    const [expandedPath, setExpandedPath] = useState<number[]>([]);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

    const canList = Boolean(user?.permissions?.includes('categories.list'));
    const canView = Boolean(user?.permissions?.includes('categories.view'));
    const canCreate = Boolean(user?.permissions?.includes('categories.create'));
    const canEdit = Boolean(user?.permissions?.includes('categories.edit'));
    const canDelete = Boolean(user?.permissions?.includes('categories.delete'));
    const canDisable = Boolean(user?.permissions?.includes('categories.disable'));

    const fetchCategories = useCallback(async () => {
        try {
            setError(null);

            if (!canList) {
                setCategories([]);
                return;
            }
            if (categories.length === 0) {
                setLoading(true);
            } else {
                setIsFetching(true);
            }
            const response = await fetch('/api/categories');

            if (!response.ok) {
                throw new Error('Ошибка загрузки категорий');
            }

            const data = await response.json();
            setCategories(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    }, [canList, categories.length]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchCategories();
    }, [authLoading, canList, fetchCategories]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const handleCreateCategory = () => {
        if (!canCreate) return;
        setIsCreateModalOpen(true);
    };

    const handleCategorySelect = (category: Category) => {
        setSelectedCategory(category);
        const selectedNode = nodeMap.get(category.id);
        expandCategory(category.id, selectedNode?.depth ?? 0);
    };

    const expandCategory = (categoryId: number, level: number) => {
        setExpandedPath((current) => {
            const nextPath = current.slice(0, level);
            nextPath[level] = categoryId;
            return nextPath;
        });
    };

    const collapseFromLevel = (level: number) => {
        setExpandedPath((current) => current.slice(0, Math.max(0, level)));
    };

    const openDeleteDialog = (category: Category) => {
        if (!canDelete) return;
        setSelectedCategory(category);
        setIsDeleteModalOpen(true);
    };

    const openEditDialog = (category: Category) => {
        if (!canEdit) return;
        setSelectedCategory(category);
        setIsEditModalOpen(true);
    };

    const handleToggleCategoryActive = async (category: Category) => {
        if (!canDisable) return;
        try {
            const response = await fetch('/api/categories', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: category.id,
                    активна: !category.активна,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка изменения статуса категории');
            }

            await fetchCategories();
        } catch (error) {
            console.error('Error toggling category active state:', error);
            alert('Ошибка изменения статуса категории: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedCategory) return;
        if (!canDelete) return;

        try {
            const response = await fetch(`/api/categories?id=${selectedCategory.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления категории');
            }

            await fetchCategories();
            setIsDeleteModalOpen(false);
            setSelectedCategory(null);
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Ошибка удаления категории: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleCategoryCreated = () => {
        fetchCategories();
        setIsCreateModalOpen(false);
    };

    useEffect(() => {
        if (!selectedCategory) {
            return;
        }

        const nextSelectedCategory = categories.find((category) => category.id === selectedCategory.id) || null;
        setSelectedCategory(nextSelectedCategory);
    }, [categories, selectedCategory]);

    useEffect(() => {
        if (selectedCategory) {
            return;
        }

        const firstRootCategory = categories.find((category) => !category.родительская_категория_id) || categories[0] || null;
        if (firstRootCategory) {
            setSelectedCategory(firstRootCategory);
        }
    }, [categories, selectedCategory]);

    useEffect(() => {
        if (!selectedCategory) {
            setExpandedPath([]);
            return;
        }

        const pathIds: number[] = [];
        let current = categories.find((category) => category.id === selectedCategory.id) || null;

        while (current) {
            pathIds.unshift(current.id);
            current = current.родительская_категория_id
                ? categories.find((category) => category.id === current!.родительская_категория_id) || null
                : null;
        }

        setExpandedPath(pathIds);
    }, [categories, selectedCategory]);

    const filteredCategories = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        if (!normalizedSearch) {
            return categories;
        }

        return categories.filter((category) => {
            const haystack = [
                category.название,
                category.описание,
                category.родительская_категория_название,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedSearch);
        });
    }, [categories, searchTerm]);

    const treeRoots = useMemo(() => {
        const nodeMap = new Map<number, CategoryTreeNode>();

        filteredCategories.forEach((category) => {
            nodeMap.set(category.id, {
                ...category,
                children: [],
                depth: 0,
                productCount: 0,
            });
        });

        const roots: CategoryTreeNode[] = [];

        nodeMap.forEach((node) => {
            if (node.родительская_категория_id && nodeMap.has(node.родительская_категория_id)) {
                const parent = nodeMap.get(node.родительская_категория_id)!;
                node.depth = parent.depth + 1;
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        });

        const assignDepth = (nodes: CategoryTreeNode[], depth: number) => {
            nodes.forEach((node) => {
                node.depth = depth;
                assignDepth(node.children, depth + 1);
            });
        };

        assignDepth(roots, 0);

        return roots;
    }, [filteredCategories]);

    const nodeMap = useMemo(() => {
        const map = new Map<number, CategoryTreeNode>();

        const walk = (nodes: CategoryTreeNode[]) => {
            nodes.forEach((node) => {
                map.set(node.id, node);
                if (node.children.length > 0) {
                    walk(node.children);
                }
            });
        };

        walk(treeRoots);
        return map;
    }, [treeRoots]);

    const activePath = useMemo(() => {
        if (expandedPath.length === 0) {
            return [] as CategoryTreeNode[];
        }

        const path: CategoryTreeNode[] = [];
        expandedPath.forEach((categoryId) => {
            const node = nodeMap.get(categoryId);
            if (node) {
                path.push(node);
            }
        });

        return path;
    }, [expandedPath, nodeMap]);

    const treeColumns = useMemo(() => {
        const columns: TreeColumn[] = [];
        let currentNodes = treeRoots;
        let parentId: number | null = null;
        let level = 0;

        while (currentNodes.length > 0) {
            columns.push({
                parentId,
                level,
                nodes: currentNodes,
            });

            const expandedForLevel = activePath[level];
            const selectedForLevel = expandedForLevel && currentNodes.some((node) => node.id === expandedForLevel.id)
                ? expandedForLevel
                : null;

            if (!selectedForLevel || selectedForLevel.children.length === 0) {
                break;
            }

            parentId = selectedForLevel.id;
            currentNodes = selectedForLevel.children;
            level += 1;
        }

        return columns;
    }, [activePath, treeRoots]);

    const totalRootCategories = categories.filter((category) => !category.родительская_категория_id).length;
    const totalSubcategories = categories.filter((category) => category.родительская_категория_id).length;

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest(`.${styles.treeNodeBody}`)) {
            return;
        }

        setIsPanning(true);
        dragStateRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            x: panOffset.x,
            y: panOffset.y,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStateRef.current) {
            return;
        }

        const deltaX = event.clientX - dragStateRef.current.startX;
        const deltaY = event.clientY - dragStateRef.current.startY;

        setPanOffset({
            x: dragStateRef.current.x + deltaX,
            y: dragStateRef.current.y + deltaY,
        });
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        dragStateRef.current = null;
        setIsPanning(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    if (!loading && error) {
        return (
            <div className={styles.container}>
                <div className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.title}>Категории</h1>
                        <p className={styles.subtitle}>Не удалось загрузить структуру категорий</p>
                    </div>
                </div>
                <div className={styles.errorState}>
                    <span>{error}</span>
                    <Button type="button" onClick={fetchCategories} className={styles.primaryButton}>
                        Повторить попытку
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <h1 className={styles.title}>Категории товаров</h1>
                    <p className={styles.subtitle}>Древовидная карта категорий слева направо с обзором всей структуры.</p>
                </div>
                <div className={styles.headerActions}>
                    <Button
                        type="button"
                        variant="surface"
                        color="gray"
                        className={`${styles.button} ${styles.surfaceButton}`}
                        onClick={(e) => {
                            e.currentTarget.blur();
                            if (isFetching) return;
                            setRefreshClickKey((k) => k + 1);
                            setMinRefreshSpinActive(true);
                            fetchCategories();
                        }}
                    >
                        <FiRefreshCw
                            key={refreshClickKey}
                            className={isFetching || minRefreshSpinActive ? styles.spin : ''}
                        />
                        Обновить
                    </Button>
                    <ReferenceDataActions
                        catalogKey="categories"
                        permissions={user?.permissions}
                        onImported={fetchCategories}
                    />
                    {canCreate ? (
                        <Button type="button" className={`${styles.button} ${styles.primaryButton}`} onClick={handleCreateCategory}>
                            <FiFolderPlus /> Добавить категорию
                        </Button>
                    ) : null}
                </div>
            </div>

            <Grid columns={{ initial: '1', md: '2', lg: '4' }} gap="4" className={styles.statsGrid}>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{categories.length}</Text>
                    <Text as="div" size="2" color="gray">Всего категорий</Text>
                </Card>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{totalRootCategories}</Text>
                    <Text as="div" size="2" color="gray">Корневых узлов</Text>
                </Card>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{totalSubcategories}</Text>
                    <Text as="div" size="2" color="gray">Подкатегорий</Text>
                </Card>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{treeColumns.length}</Text>
                    <Text as="div" size="2" color="gray">Колонок дерева</Text>
                </Card>
            </Grid>

            <div className={styles.workspaceLayout}>
                <div className={styles.viewportCard}>
                    <div className={styles.viewportToolbar}>
                        <div>
                            <Text as="div" size="3" weight="bold">Карта категорий</Text>
                            <Text as="div" size="2" color="gray">Выбирайте узел слева направо: следующая колонка показывает его подкатегории.</Text>
                        </div>
                        <div className={styles.toolbarActions}>
                            <div className={styles.searchFieldWrap}>
                                <FiSearch className={styles.searchIcon} />
                                <TextField.Root
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Поиск по названию или описанию"
                                    size="3"
                                    className={styles.searchField}
                                />
                            </div>
                            <Button type="button" variant="surface" color="gray" className={`${styles.button} ${styles.surfaceButton}`} onClick={() => setPanOffset({ x: 72, y: 36 })}>
                                <FiMove /> Сбросить вид
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <PageLoader label="Загрузка категорий..." />
                    ) : filteredCategories.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Text as="div" size="4" weight="medium">Ничего не найдено</Text>
                            <Text as="div" size="2" color="gray">Попробуйте изменить поисковый запрос или создать новую категорию.</Text>
                        </div>
                    ) : (
                        <div
                            ref={viewportRef}
                            className={styles.treeViewport}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                        >
                            <div className={styles.viewportHint}>{isPanning ? 'Panning…' : 'Drag to pan'}</div>
                            <div
                                className={`${styles.treeCanvas} ${isPanning ? styles.treeCanvasPanning : ''}`}
                                style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
                            >
                                {treeColumns.map((column, columnIndex) => {
                                    const columnParent = column.parentId ? nodeMap.get(column.parentId) || null : null;

                                    return (
                                        <div key={`column-${columnIndex}`} className={styles.treeColumn}>
                                            <div className={styles.treeColumnHeader}>
                                                <Text as="div" size="1" weight="bold">
                                                    {columnIndex === 0 ? 'Корневые категории' : `Подкатегории: ${columnParent?.название || ''}`}
                                                </Text>
                                            </div>
                                            <div className={styles.treeColumnNodes}>
                                                {column.nodes.map((category) => {
                                                    const isSelected = selectedCategory?.id === category.id;
                                                    const isInActivePath = activePath.some((pathNode) => pathNode.id === category.id);

                                                    return (
                                                        <div
                                                            key={category.id}
                                                            className={`${styles.treeNode} ${isSelected ? styles.treeNodeActive : ''} ${isInActivePath ? styles.treeNodeInPath : ''} ${!category.активна ? styles.treeNodeInactive : ''}`}
                                                            data-level={column.level}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={styles.treeNodeBody}
                                                                onClick={() => handleCategorySelect(category)}
                                                                onDoubleClick={() => {
                                                                    if (!canView) return;
                                                                    router.push(`/categories/${category.id}`);
                                                                }}
                                                            >
                                                                <div className={styles.treeNodeHeader}>
                                                                    <Text as="div" size="2" weight="bold">{category.название}</Text>
                                                                    <Badge color={category.активна ? 'green' : 'red'} variant="soft">
                                                                        {category.активна ? 'Активна' : 'Неактивна'}
                                                                    </Badge>
                                                                </div>
                                                                <Text as="div" size="1" color="gray" className={styles.treeNodeMeta}>
                                                                    {category.описание || 'Описание не указано'}
                                                                </Text>
                                                                <div className={styles.treeNodeFooter}>
                                                                    <span>#{category.id}</span>
                                                                    <span>{category.children.length} доч.</span>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.sidebarCard}>
                    <div className={styles.sidebarHeader}>
                        <Text as="div" size="3" weight="bold">Детали категории</Text>
                        <Text as="div" size="2" color="gray">Выберите узел на карте, чтобы посмотреть детали и действия.</Text>
                    </div>
                    {selectedCategory ? (
                        <>
                            <div className={styles.sidebarBlock}>
                                <Text as="div" size="5" weight="bold">{selectedCategory.название}</Text>
                                <Flex gap="2" wrap="wrap" mt="2">
                                    <Badge color={selectedCategory.активна ? 'green' : 'red'} variant="soft">
                                        {selectedCategory.активна ? 'Активна' : 'Неактивна'}
                                    </Badge>
                                    <Badge color="gray" variant="soft">ID #{selectedCategory.id}</Badge>
                                </Flex>
                            </div>

                            <Separator size="4" />

                            <div className={styles.sidebarBlock}>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Родитель</span>
                                    <span className={styles.detailValue}>
                                        {selectedCategory.родительская_категория_название || 'Корневая категория'}
                                    </span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Дата создания</span>
                                    <span className={styles.detailValue}>{formatDate(selectedCategory.created_at)}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Описание</span>
                                    <span className={styles.detailValue}>{selectedCategory.описание || 'Не указано'}</span>
                                </div>
                            </div>

                            <Separator size="4" />

                            <div className={styles.sidebarActions}>
                                {canView ? (
                                    <Button type="button" className={`${styles.sidebarActionButton} ${styles.sidebarOpenButton}`} onClick={() => router.push(`/categories/${selectedCategory.id}`)}>
                                        <FiExternalLink /> Открыть категорию
                                    </Button>
                                ) : null}

                                {canEdit ? (
                                    <Button type="button" className={`${styles.sidebarActionButton} ${styles.sidebarOpenButton}`} onClick={() => openEditDialog(selectedCategory)}>
                                        <FiEdit3 /> Редактировать
                                    </Button>
                                ) : null}

                                {canDisable ? (
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color={selectedCategory.активна ? 'amber' : 'green'}
                                        className={`${styles.sidebarActionButton} ${styles.sidebarToggleButton}`}
                                        onClick={() => handleToggleCategoryActive(selectedCategory)}
                                    >
                                        <FiSlash /> {selectedCategory.активна ? 'Отключить' : 'Включить'}
                                    </Button>
                                ) : null}

                                {canDelete ? (
                                    <Button type="button" variant="surface" color="red" className={`${styles.sidebarActionButton} ${styles.sidebarDeleteButton}`} onClick={() => openDeleteDialog(selectedCategory)}>
                                        <FiTrash2 /> Удалить
                                    </Button>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptySidebar}>
                            <Text as="div" size="3" weight="medium">Ничего не выбрано</Text>
                            <Text as="div" size="2" color="gray">Кликните по узлу на древе, чтобы увидеть подробности категории.</Text>
                        </div>
                    )}
                </div>
            </div>

            <CreateCategoryModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCategoryCreated={handleCategoryCreated}
            />

            <EditCategoryModal
                category={selectedCategory}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onCategoryUpdated={fetchCategories}
            />

            <Dialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <Dialog.Content className={styles.deleteDialog}>
                    <Dialog.Title>Удалить категорию</Dialog.Title>
                    <Dialog.Description className={styles.deleteDescription}>
                        Это действие нельзя отменить. Категория будет полностью удалена из базы и структуры.
                    </Dialog.Description>

                    {selectedCategory ? (
                        <Box className={styles.deletePreview}>
                            <Text as="div" size="3" weight="bold">{selectedCategory.название}</Text>
                            <Text as="div" size="2" color="gray">{selectedCategory.описание || 'Описание отсутствует'}</Text>
                        </Box>
                    ) : null}

                    <Flex justify="end" gap="3" mt="5" className={deleteConfirmStyles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={() => setIsDeleteModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="button" variant="surface" color="red" highContrast className={deleteConfirmStyles.modalDeleteButton} onClick={handleConfirmDelete}>
                            Удалить
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div >
    );
}

export default withLayout(CategoriesPage);
