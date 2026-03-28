import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { EditCategoryModal } from '../../components/EditCategoryModal';
import styles from './Categories.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Card, Dialog, Flex, Grid, Separator, Text } from '@radix-ui/themes';
import { FiArrowLeft, FiEdit3, FiRefreshCw, FiSlash, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

interface CategoryDetail {
    id: number;
    название: string;
    описание?: string;
    родительская_категория_id?: number;
    родительская_категория_название?: string;
    активна: boolean;
    created_at: string;
    подкатегории: CategoryDetail[];
    товары: number;
}

function CategoryDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [category, setCategory] = useState<CategoryDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const canView = Boolean(user?.permissions?.includes('categories.view'));
    const canEdit = Boolean(user?.permissions?.includes('categories.edit'));
    const canDelete = Boolean(user?.permissions?.includes('categories.delete'));
    const canDisable = Boolean(user?.permissions?.includes('categories.disable'));

    const fetchCategoryDetail = useCallback(async () => {
        try {
            setError(null);

            if (!canView) {
                setCategory(null);
                return;
            }
            setLoading(true);
            const response = await fetch(`/api/categories?id=${id}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки категории');
            }

            const data = await response.json();
            setCategory(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [canView, id]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchCategoryDetail();
        }
    }, [authLoading, canView, fetchCategoryDetail, id]);

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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const handleToggleCategoryActive = async () => {
        if (!category) {
            return;
        }
        if (!canDisable) {
            return;
        }

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

            await fetchCategoryDetail();
        } catch (err) {
            console.error('Error toggling category active state:', err);
            alert('Ошибка изменения статуса категории: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const handleDelete = async () => {
        if (!category) return;
        if (!canDelete) return;

        try {
            const response = await fetch(`/api/categories?id=${category.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления категории');
            }

            setIsDeleteModalOpen(false);
            router.push('/categories');
        } catch (err) {
            console.error('Error deleting category:', err);
            alert('Ошибка удаления категории: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.pageHeader}>
                    <div className={styles.pageHeaderLeft}>
                        <h1 className={styles.title}>Категория</h1>
                        <p className={styles.subtitle}>Загружаю детали категории...</p>
                    </div>
                </div>
                <div className={styles.loadingState}>
                    <FiRefreshCw className={styles.spinner} />
                    <span>Загрузка категории...</span>
                </div>
            </div>
        );
    }

    if (error || !category) {
        return (
            <div className={styles.container}>
                <div className={styles.pageHeader}>
                    <div className={styles.pageHeaderLeft}>
                        <h1 className={styles.title}>Ошибка</h1>
                        <p className={styles.subtitle}>Не удалось загрузить категорию</p>
                    </div>
                </div>
                <div className={styles.errorState}>
                    <span>{error || 'Категория не найдена'}</span>
                    <Button type="button" className={`${styles.button} ${styles.surfaceButton}`} onClick={() => router.push('/categories')}>
                        <FiArrowLeft /> К списку категорий
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <h1 className={styles.title}>{category.название}</h1>
                    <p className={styles.subtitle}>Детальная карточка категории с иерархией, статусом и быстрыми действиями.</p>
                </div>
                <div className={styles.headerActions}>
                    <Button type="button" variant="surface" color="gray" className={`${styles.button} ${styles.surfaceButton}`} onClick={() => router.push('/categories')}>
                        <FiArrowLeft /> К дереву
                    </Button>
                    <Button type="button" variant="surface" color="gray" className={`${styles.button} ${styles.surfaceButton}`} onClick={fetchCategoryDetail}>
                        <FiRefreshCw /> Обновить
                    </Button>
                </div>
            </div>

            <Grid columns={{ initial: '1', md: '2', lg: '4' }} gap="4" className={styles.statsGrid}>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">#{category.id}</Text>
                    <Text as="div" size="2" color="gray">Идентификатор категории</Text>
                </Card>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{category.подкатегории?.length || 0}</Text>
                    <Text as="div" size="2" color="gray">Подкатегорий</Text>
                </Card>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{category.товары || 0}</Text>
                    <Text as="div" size="2" color="gray">Товаров в категории</Text>
                </Card>
                <Card size="2" className={styles.statCard}>
                    <Text as="div" size="7" weight="bold">{category.активна ? 'Да' : 'Нет'}</Text>
                    <Text as="div" size="2" color="gray">Категория активна</Text>
                </Card>
            </Grid>

            <div className={styles.workspaceLayout}>
                <div className={styles.viewportCard}>
                    <div className={styles.viewportToolbar}>
                        <div>
                            <Text as="div" size="3" weight="bold">Обзор категории</Text>
                            <Text as="div" size="2" color="gray">Ключевая информация, структура и связи категории в системе.</Text>
                        </div>
                    </div>

                    <div className={styles.detailPageBody}>
                        <div className={styles.detailContentGrid}>
                            <div className={styles.detailPanel}>
                                <div className={styles.detailPanelHeader}>
                                    <Text as="div" size="5" weight="bold">{category.название}</Text>
                                    <Flex gap="2" wrap="wrap" mt="2">
                                        <Badge color={category.активна ? 'green' : 'red'} variant="soft">
                                            {category.активна ? 'Активна' : 'Неактивна'}
                                        </Badge>
                                        <Badge color="gray" variant="soft">ID #{category.id}</Badge>
                                    </Flex>
                                </div>

                                <div className={styles.detailPanelRows}>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Описание</span>
                                        <span className={styles.detailValue}>{category.описание || 'Описание отсутствует'}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Дата создания</span>
                                        <span className={styles.detailValue}>{formatDate(category.created_at)}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Статус</span>
                                        <span className={styles.detailValue}>{category.активна ? 'Категория активна' : 'Категория неактивна'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailPanel}>
                                <div className={styles.detailPanelHeader}>
                                    <Text as="div" size="4" weight="bold">Положение в дереве</Text>
                                </div>

                                <div className={styles.detailPanelRows}>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Родительская категория</span>
                                        <span className={styles.detailValue}>
                                            {category.родительская_категория_название || 'Корневая категория'}
                                        </span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Количество подкатегорий</span>
                                        <span className={styles.detailValue}>{category.подкатегории?.length || 0}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Товаров в категории</span>
                                        <span className={styles.detailValue}>{category.товары || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.detailPageSection}>
                            <div className={styles.sectionHeader}>
                                <Text as="div" size="4" weight="bold">Подкатегории</Text>
                                <Text as="div" size="2" color="gray">Дочерние элементы текущей категории.</Text>
                            </div>

                            {category.подкатегории?.length ? (
                                <div className={styles.subcategoryList}>
                                    {category.подкатегории.map((subcategory) => (
                                        <button
                                            key={subcategory.id}
                                            type="button"
                                            className={styles.subcategoryCard}
                                            onClick={() => {
                                                if (!canView) return;
                                                router.push(`/categories/${subcategory.id}`);
                                            }}
                                        >
                                            <div className={styles.treeNodeHeader}>
                                                <Text as="div" size="2" weight="bold">{subcategory.название}</Text>
                                                <Badge color={subcategory.активна ? 'green' : 'red'} variant="soft">
                                                    {subcategory.активна ? 'Активна' : 'Неактивна'}
                                                </Badge>
                                            </div>
                                            <Text as="div" size="1" color="gray" className={styles.treeNodeMeta}>
                                                {subcategory.описание || 'Описание не указано'}
                                            </Text>
                                            <div className={styles.treeNodeFooter}>
                                                <span>#{subcategory.id}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.emptyStateCompact}>
                                    <Text as="div" size="3" weight="medium">Подкатегорий пока нет</Text>
                                    <Text as="div" size="2" color="gray">Можно создать новую категорию и привязать её к этой ветке.</Text>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.sidebarCard}>
                    <div className={styles.sidebarHeader}>
                        <Text as="div" size="3" weight="bold">Действия</Text>
                        <Text as="div" size="2" color="gray">Управление состоянием категории и переходы.</Text>
                    </div>

                    <div className={styles.sidebarBlock}>
                        <Flex gap="2" wrap="wrap">
                            <Badge color={category.активна ? 'green' : 'red'} variant="soft">
                                {category.активна ? 'Активна' : 'Неактивна'}
                            </Badge>
                            <Badge color="gray" variant="soft">Создана {formatDate(category.created_at)}</Badge>
                        </Flex>
                    </div>

                    <Separator size="4" />

                    <div className={styles.sidebarActions}>
                        {canEdit ? (
                            <Button type="button" className={`${styles.sidebarActionButton} ${styles.sidebarOpenButton}`} onClick={() => setIsEditModalOpen(true)}>
                                <FiEdit3 /> Редактировать
                            </Button>
                        ) : null}

                        {canDisable ? (
                            <Button type="button" variant="surface" className={`${styles.sidebarActionButton} ${styles.sidebarToggleButton}`} onClick={handleToggleCategoryActive}>
                                <FiSlash /> {category.активна ? 'Отключить' : 'Включить'}
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button type="button" variant="surface" color="red" className={`${styles.sidebarActionButton} ${styles.sidebarDeleteButton}`} onClick={() => setIsDeleteModalOpen(true)}>
                                <FiTrash2 /> Удалить категорию
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <EditCategoryModal
                category={category}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onCategoryUpdated={fetchCategoryDetail}
            />

            <Dialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <Dialog.Content className={styles.deleteDialog}>
                    <Dialog.Title>Удалить категорию</Dialog.Title>
                    <Dialog.Description className={styles.deleteDescription}>
                        Это действие нельзя отменить. Категория будет полностью удалена из базы и структуры.
                    </Dialog.Description>

                    <Box className={styles.deletePreview}>
                        <Text as="div" size="3" weight="bold">{category.название}</Text>
                        <Text as="div" size="2" color="gray">{category.описание || 'Описание отсутствует'}</Text>
                    </Box>

                    <Flex justify="end" gap="3" mt="5" className={deleteConfirmStyles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={() => setIsDeleteModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="button" variant="surface" color="red" highContrast className={deleteConfirmStyles.modalDeleteButton} onClick={handleDelete}>
                            Удалить
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(CategoryDetailPage);