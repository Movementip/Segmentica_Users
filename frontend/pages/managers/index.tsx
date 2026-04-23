import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { CreateManagerModal } from '../../components/modals/CreateManagerModal/CreateManagerModal';
import { EditManagerModal } from '../../components/modals/EditManagerModal/EditManagerModal';
import styles from './ManagersPage.module.css';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { EntityTableSurface } from '../../components/EntityDataTable/EntityDataTable';
import { ManagersFilters } from '../../components/managers/ManagersFilters/ManagersFilters';
import { ManagersPageHeader } from '../../components/managers/ManagersPageHeader/ManagersPageHeader';
import { ManagersPageSkeleton } from '../../components/managers/ManagersPageSkeleton/ManagersPageSkeleton';
import { ManagersStats } from '../../components/managers/ManagersStats/ManagersStats';
import { ManagersTable } from '../../components/managers/ManagersTable/ManagersTable';
import type { ActivityFilter, Manager, SortOption } from '../../types/pages/managers';
import { Button as UiButton } from '../../components/ui/button';
import { formatRuDate } from '../../utils/formatters';

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

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
            const nextManagers = Array.isArray(data) ? data : [];
            let nextAttachmentsMap: Record<number, string[]> = {};

            if (!canViewAttachments) {
                setAttachmentsTypesByManagerId({});
                setManagers(nextManagers);
                return;
            }

            const ids = nextManagers
                .map((manager) => Number(manager?.id))
                .filter((n) => Number.isInteger(n) && n > 0);

            if (ids.length > 0) {
                try {
                    const summaryRes = await fetch(
                        `/api/attachments/summary?entity_type=manager&entity_ids=${encodeURIComponent(ids.join(','))}`
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
                    console.error('Error fetching manager attachments summary:', summaryError);
                }
            }

            setAttachmentsTypesByManagerId(nextAttachmentsMap);
            setManagers(nextManagers);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            if (showPageLoader) setLoading(false);
            setIsInitialLoad(false);
            setIsRefreshing(false);
        }
    }, [canViewAttachments]);

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

    const formatDate = (value?: string) => formatRuDate(value);

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <ManagersPageHeader
                canCreate={canCreate}
                isRefreshing={loading || isRefreshing || minRefreshSpinActive}
                refreshKey={refreshClickKey}
                permissions={user?.permissions}
                onRefresh={() => {
                    setIsRefreshing(true);
                    setTableKey((value) => value + 1);
                    setMinRefreshSpinActive(true);
                    setRefreshClickKey((value) => value + 1);
                    void fetchManagers({ showPageLoader: false });
                }}
                onCreate={handleCreateManager}
                onImported={() => fetchManagers({ showPageLoader: false })}
            />

            {loading && isInitialLoad ? (
                <ManagersPageSkeleton />
            ) : (
                <div className={styles.card}>
                    <ManagersStats managers={managers} />

                    <ManagersFilters
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        positionFilter={positionFilter}
                        onPositionFilterChange={setPositionFilter}
                        activityFilter={activityFilter}
                        onActivityFilterChange={setActivityFilter}
                        sortBy={sortBy}
                        onSortByChange={setSortBy}
                        positions={positions}
                    />

                    {error ? (
                        <div className={styles.errorState}>
                            <p className={styles.errorText}>{error}</p>
                            <UiButton type="button" className={styles.button} onClick={() => void fetchManagers({ showPageLoader: true })}>
                                Повторить попытку
                            </UiButton>
                        </div>
                    ) : filteredManagers.length === 0 ? (
                        <div className={styles.emptyState}>Сотрудники не найдены.</div>
                    ) : (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableContainer} key={tableKey}>
                            <ManagersTable
                                managers={filteredManagers}
                                attachmentsTypesByManagerId={attachmentsTypesByManagerId}
                                canView={canView}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                formatDate={formatDate}
                                onOpenManager={(manager) => router.push(`/managers/${manager.id}`)}
                                onEditManager={(manager) => {
                                    setEditingManager(manager);
                                    setIsEditModalOpen(true);
                                }}
                                onDeleteManager={(manager) => {
                                    setSelectedManager(manager);
                                    setIsDeleteModalOpen(true);
                                }}
                            />
                        </EntityTableSurface>
                    )}
                </div>
            )}

            <CreateManagerModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onManagerCreated={handleManagerCreated}
                canCreate={canCreate}
            />

            <EditManagerModal
                isOpen={isEditModalOpen}
                manager={editingManager}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingManager(null);
                }}
                onManagerUpdated={handleManagerUpdated}
                canEdit={canEdit}
            />

            <DeleteConfirmation
                isOpen={isDeleteModalOpen && !!selectedManager}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                loading={isDeleting}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить сотрудника?"
                warning="Это действие нельзя отменить. Карточка сотрудника и связанные с ней данные будут удалены."
                details={selectedManager ? (
                    <div>
                        <div className={styles.deleteTitle}>{selectedManager.фио}</div>
                        <div className={styles.deleteMeta}>Должность: {selectedManager.должность}</div>
                        {selectedManager.телефон ? <div className={styles.deleteMeta}>Телефон: {selectedManager.телефон}</div> : null}
                        {selectedManager.email ? <div className={styles.deleteMeta}>Email: {selectedManager.email}</div> : null}
                    </div>
                ) : null}
            />
        </div>
    );
}

export default withLayout(ManagersPage);
