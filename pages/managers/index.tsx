import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { CreateManagerModalV2 } from '../../components/CreateManagerModalV2';
import { EditManagerModalV2 } from '../../components/EditManagerModalV2';
import { ReferenceDataActions } from '../../components/ReferenceDataActions';
import styles from './Managers.module.css';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Button, Card, Dialog, DropdownMenu, Flex, Select, Table, Text, TextField } from '@radix-ui/themes';
import { FiEdit2, FiEye, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/PageLoader';

interface Manager {
    id: number;
    фио: string;
    должность: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен: boolean;
    created_at: string;
}

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

type ActivityFilter = 'all' | 'active' | 'inactive';
type SortOption = 'id-desc' | 'id-asc' | 'name-asc' | 'name-desc' | 'hire-desc' | 'hire-asc';

const MotionTableRow = motion(Table.Row);

function ManagersPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingManager, setEditingManager] = useState<Manager | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
    const [positionFilter, setPositionFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<SortOption>('id-desc');

    const [attachmentsTypesByManagerId, setAttachmentsTypesByManagerId] = useState<Record<number, string[]>>({});

    const canList = Boolean(user?.permissions?.includes('managers.list'));
    const canView = Boolean(user?.permissions?.includes('managers.view'));
    const canCreate = Boolean(user?.permissions?.includes('managers.create'));
    const canEdit = Boolean(user?.permissions?.includes('managers.edit'));
    const canDelete = Boolean(user?.permissions?.includes('managers.delete'));
    const canViewAttachments = Boolean(user?.permissions?.includes('managers.attachments.view'));

    const fetchManagers = useCallback(async ({ showPageLoader }: { showPageLoader: boolean }) => {
        try {
            if (showPageLoader) setLoading(true);
            const response = await fetch('/api/managers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки сотрудников');
            }

            const data = await response.json();
            setManagers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            if (showPageLoader) setLoading(false);
            setIsInitialLoad(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchManagers({ showPageLoader: true });
    }, [authLoading, canList, fetchManagers]);

    useEffect(() => {
        if (!canViewAttachments) {
            setAttachmentsTypesByManagerId({});
            return;
        }

        const ids = managers.map((m) => Number(m.id)).filter((n) => Number.isInteger(n) && n > 0);
        if (ids.length === 0) {
            setAttachmentsTypesByManagerId({});
            return;
        }

        const controller = new AbortController();

        const fetchSummary = async () => {
            try {
                const res = await fetch(
                    `/api/attachments/summary?entity_type=manager&entity_ids=${encodeURIComponent(ids.join(','))}`,
                    { signal: controller.signal }
                );
                if (!res.ok) return;
                const data = (await res.json()) as AttachmentSummaryItem[];
                const map: Record<number, string[]> = {};
                for (const item of Array.isArray(data) ? data : []) {
                    map[Number(item.entity_id)] = Array.isArray(item.types) ? item.types : [];
                }
                setAttachmentsTypesByManagerId(map);
            } catch (e) {
                if ((e as any)?.name === 'AbortError') return;
                console.error(e);
            }
        };

        void fetchSummary();
        return () => controller.abort();
    }, [managers, canViewAttachments]);

    const renderAttachmentBadges = (managerId: number) => {
        const types = attachmentsTypesByManagerId[managerId] || [];
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

    const handleCreateManager = () => {
        if (!canCreate) return;
        setIsCreateModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedManager) return;
        if (!canDelete) return;

        try {
            setIsDeleting(true);
            const response = await fetch(`/api/managers?id=${selectedManager.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления сотрудника');
            }

            await fetchManagers({ showPageLoader: false });
            setIsDeleteModalOpen(false);
            setSelectedManager(null);
        } catch (error) {
            console.error('Error deleting manager:', error);
            setError('Ошибка удаления сотрудника: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleManagerCreated = () => {
        fetchManagers({ showPageLoader: false });
        setIsCreateModalOpen(false);
    };

    const handleManagerUpdated = () => {
        fetchManagers({ showPageLoader: false });
        setIsEditModalOpen(false);
        setEditingManager(null);
    };

    const positions = React.useMemo(() => {
        const set = new Set<string>();
        managers.forEach((m) => {
            const v = String(m.должность || '').trim();
            if (v) set.add(v);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [managers]);

    const filteredManagers = React.useMemo(() => {
        const q = searchTerm.trim().toLowerCase();

        const byQuery = !q
            ? managers
            : managers.filter((m) => {
                const id = String(m.id);
                const fio = String(m.фио || '').toLowerCase();
                const role = String(m.должность || '').toLowerCase();
                const phone = String(m.телефон || '').toLowerCase();
                const email = String(m.email || '').toLowerCase();
                return id.includes(q) || fio.includes(q) || role.includes(q) || phone.includes(q) || email.includes(q);
            });

        const byActive = activityFilter === 'all'
            ? byQuery
            : byQuery.filter((m) => (activityFilter === 'active' ? !!m.активен : !m.активен));

        const byPosition = positionFilter === 'all'
            ? byActive
            : byActive.filter((m) => String(m.должность || '').trim() === positionFilter);

        const dateValue = (m: Manager) => {
            const raw = m.дата_приема ? String(m.дата_приема) : '';
            const t = raw ? new Date(raw).getTime() : 0;
            return Number.isFinite(t) ? t : 0;
        };

        const bySort = [...byPosition].sort((a, b) => {
            if (sortBy === 'id-asc') return a.id - b.id;
            if (sortBy === 'id-desc') return b.id - a.id;
            if (sortBy === 'name-asc') return String(a.фио || '').localeCompare(String(b.фио || ''), 'ru');
            if (sortBy === 'name-desc') return String(b.фио || '').localeCompare(String(a.фио || ''), 'ru');
            if (sortBy === 'hire-asc') return dateValue(a) - dateValue(b);
            if (sortBy === 'hire-desc') return dateValue(b) - dateValue(a);
            return 0;
        });

        return bySort;
    }, [activityFilter, managers, positionFilter, searchTerm, sortBy]);

    const formatDate = (value?: string) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('ru-RU');
    };

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return (
            <div className={styles.container}>
                <div className={styles.pageShell}>
                    <div className={styles.emptyState}>Нет доступа</div>
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
                        <Button onClick={() => fetchManagers({ showPageLoader: true })} variant="surface" color="gray" highContrast className={styles.surfaceButton}>
                            Повторить попытку
                        </Button>
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
                        <Text size="7" weight="bold" className={styles.pageTitle}>
                            Сотрудники
                        </Text>
                        <Text as="p" size="2" color="gray" className={styles.pageDescription}>
                            Нажмите на сотрудника для просмотра подробностей
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
                                fetchManagers({ showPageLoader: false });
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
                        <ReferenceDataActions
                            catalogKey="managers"
                            permissions={user?.permissions}
                            onImported={() => fetchManagers({ showPageLoader: false })}
                        />

                        {canCreate ? (
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                onClick={handleCreateManager}
                                className={styles.addManagerButton}
                            >
                                <FiPlus size={14} /> Добавить сотрудника
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className={styles.tableSection}>
                    <div className={styles.tableHeader}>
                        <TextField.Root
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Поиск по ФИО, должности, телефону, email..."
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
                            <Select.Root value={positionFilter} onValueChange={setPositionFilter}>
                                <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                <Select.Content align="start" className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="all">Все должности</Select.Item>
                                    {positions.map((p) => (
                                        <Select.Item key={p} value={p}>
                                            {p}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>

                            <Select.Root value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityFilter)}>
                                <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                <Select.Content align="start" className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="all">Все статусы</Select.Item>
                                    <Select.Item value="active">Активен</Select.Item>
                                    <Select.Item value="inactive">Неактивен</Select.Item>
                                </Select.Content>
                            </Select.Root>

                            <Select.Root value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                                <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                <Select.Content align="start" className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="id-desc">ID (сначала больше)</Select.Item>
                                    <Select.Item value="id-asc">ID (сначала меньше)</Select.Item>
                                    <Select.Item value="name-asc">ФИО (А-Я)</Select.Item>
                                    <Select.Item value="name-desc">ФИО (Я-А)</Select.Item>
                                    <Select.Item value="hire-desc">Дата приёма (сначала новые)</Select.Item>
                                    <Select.Item value="hire-asc">Дата приёма (сначала старые)</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </div>
                    </div>

                    <Card className={styles.tableCard}>
                        <div className={styles.tableContainer}>
                            {loading && isInitialLoad ? (
                                <PageLoader label="Загрузка сотрудников..." />
                            ) : (
                            <Table.Root key={tableKey} variant="surface" className={styles.table}>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>ФИО</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Должность</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Дата приёма</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Контакты</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell />
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {filteredManagers.length === 0 ? (
                                        <Table.Row>
                                            <Table.Cell colSpan={7}>
                                                <div className={styles.emptyState}>Сотрудники не найдены.</div>
                                            </Table.Cell>
                                        </Table.Row>
                                    ) : (
                                        <AnimatePresence>
                                            {filteredManagers.map((manager) => (
                                                <MotionTableRow
                                                    key={manager.id}
                                                    className={styles.tableRow}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    transition={{ duration: 0.12 }}
                                                    onClick={canView ? () => router.push(`/managers/${manager.id}`) : undefined}
                                                >
                                                    <Table.Cell className={styles.idCell}>
                                                        <div>
                                                            <div>#{manager.id}</div>
                                                            {renderAttachmentBadges(manager.id)}
                                                        </div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className={styles.itemTitle}>{manager.фио}</div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className={styles.itemTitle}>{manager.должность}</div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className={styles.itemTitle}>{formatDate(manager.дата_приема)}</div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {manager.телефон ? <div className={styles.itemTitle}>{manager.телефон}</div> : <div className={styles.itemTitle}>—</div>}
                                                        {manager.email ? <div className={styles.itemSub}>{manager.email}</div> : null}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span className={styles.statusPill} data-active={manager.активен ? 'true' : 'false'}>
                                                            {manager.активен ? 'Активен' : 'Неактивен'}
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {(canView || canEdit || canDelete) ? (
                                                            <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
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
                                                                            <FiMoreHorizontal size={18} />
                                                                        </Button>
                                                                    </DropdownMenu.Trigger>
                                                                    <DropdownMenu.Content>
                                                                        {canView ? (
                                                                            <DropdownMenu.Item
                                                                                onSelect={(e) => {
                                                                                    e?.preventDefault?.();
                                                                                    router.push(`/managers/${manager.id}`);
                                                                                }}
                                                                            >
                                                                                <FiEye className={styles.rowMenuIcon} />
                                                                                Открыть
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                        {canEdit ? (
                                                                            <DropdownMenu.Item
                                                                                onSelect={(e) => {
                                                                                    e?.preventDefault?.();
                                                                                    setEditingManager(manager);
                                                                                    setIsEditModalOpen(true);
                                                                                }}
                                                                            >
                                                                                <FiEdit2 className={styles.rowMenuIcon} />
                                                                                Редактировать
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                        {canEdit && canDelete ? <DropdownMenu.Separator /> : null}
                                                                        {canDelete ? (
                                                                            <DropdownMenu.Item
                                                                                className={styles.rowMenuItemDanger}
                                                                                color="red"
                                                                                onSelect={(e) => {
                                                                                    e?.preventDefault?.();
                                                                                    setSelectedManager(manager);
                                                                                    setIsDeleteModalOpen(true);
                                                                                }}
                                                                            >
                                                                                <FiTrash2 className={styles.rowMenuIconDel} />
                                                                                Удалить
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                    </DropdownMenu.Content>
                                                                </DropdownMenu.Root>
                                                            </div>
                                                        ) : null}
                                                    </Table.Cell>
                                                </MotionTableRow>
                                            ))}
                                        </AnimatePresence>
                                    )}
                                </Table.Body>
                            </Table.Root>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            <CreateManagerModalV2
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onManagerCreated={handleManagerCreated}
                canCreate={canCreate}
            />

            <EditManagerModalV2
                isOpen={isEditModalOpen}
                manager={editingManager}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingManager(null);
                }}
                onManagerUpdated={handleManagerUpdated}
                canEdit={canEdit}
            />

            <Dialog.Root open={isDeleteModalOpen && !!selectedManager} onOpenChange={(open) => (!open ? setIsDeleteModalOpen(false) : undefined)}>
                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>

                    <Flex direction="column" gap="3" className={deleteConfirmationStyles.form}>
                        <Text as="div" size="2" color="gray">
                            Вы уверены, что хотите удалить сотрудника? Это действие нельзя отменить.
                        </Text>

                        {selectedManager ? (
                            <div className={deleteConfirmationStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" size="2" weight="bold">{selectedManager.фио}</Text>
                                    <Text as="div" size="2" color="gray">Должность: {selectedManager.должность}</Text>
                                    {selectedManager.телефон ? <Text as="div" size="2" color="gray">Телефон: {selectedManager.телефон}</Text> : null}
                                    {selectedManager.email ? <Text as="div" size="2" color="gray">Email: {selectedManager.email}</Text> : null}
                                </Flex>
                            </div>
                        ) : null}

                        <Flex justify="end" gap="3" mt="4" className={deleteConfirmationStyles.modalActions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => setIsDeleteModalOpen(false)}
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
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(ManagersPage);
