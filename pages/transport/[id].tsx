import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Layout } from '../../layout/Layout';
import { EditTransportModalNew } from '../../components/EditTransportModalNew';
import { CreateShipmentModal } from '../../components/CreateShipmentModal';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import styles from './TransportDetail.module.css';
import { Box, Button, Dialog, Flex, Card, DropdownMenu, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiArrowLeft, FiDownload, FiEdit2, FiFile, FiMoreHorizontal, FiPaperclip, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { RecordDocumentCenter, RecordPrintSheet, type RecordPrintDocument } from '../../components/print/RecordDocumentCenter';

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
    заявка_номер: number;
    клиент_название: string;
    адрес_доставки: string | null;
    сумма_заявки: number | null;
    заявка_статус?: string;
}

interface Performance {
    месяц: string;
    количество_отгрузок: number;
    средняя_стоимость: number;
    общая_выручка: number;
    успешные_доставки: number;
}

interface MonthShipmentRow {
    id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер: number;
    клиент_название: string;
}

interface TransportDetailData {
    transport: TransportCompany;
    shipments: Shipment[];
    performance: Performance[];
    activeShipments: Shipment[];
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

export default function TransportDetail() {
    const [data, setData] = useState<TransportDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'months'>('active');
    const [expandedMonth, setExpandedMonth] = useState<string>('');
    const [monthShipmentsLoading, setMonthShipmentsLoading] = useState(false);
    const [monthShipmentsError, setMonthShipmentsError] = useState<string>('');
    const [monthShipments, setMonthShipments] = useState<MonthShipmentRow[]>([]);
    const router = useRouter();
    const { id } = router.query;
    const [search, setSearch] = useState('');

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

    const { user, loading: authLoading } = useAuth();
    const canView = Boolean(user?.permissions?.includes('transport.view'));
    const canEdit = Boolean(user?.permissions?.includes('transport.edit'));
    const canShipmentsCreate = Boolean(user?.permissions?.includes('shipments.create'));
    const canShipmentsEdit = Boolean(user?.permissions?.includes('shipments.edit'));
    const canDelete = Boolean(user?.permissions?.includes('transport.delete'));
    const canTransportAttachmentsView = Boolean(user?.permissions?.includes('transport.attachments.view'));
    const canTransportAttachmentsUpload = Boolean(user?.permissions?.includes('transport.attachments.upload'));
    const canTransportAttachmentsDelete = Boolean(user?.permissions?.includes('transport.attachments.delete'));

    const canTransportActiveShipmentsView = Boolean(user?.permissions?.includes('transport.active_shipments.view'));
    const canTransportShipmentsHistoryView = Boolean(user?.permissions?.includes('transport.shipments.history.view'));
    const canTransportShipmentsMonthsView = Boolean(user?.permissions?.includes('transport.shipments.months.view'));

    const canCreateShipment = canShipmentsCreate && canShipmentsEdit;
    const canShowShipmentsTabs = canTransportActiveShipmentsView || canTransportShipmentsHistoryView || canTransportShipmentsMonthsView;

    useEffect(() => {
        if (authLoading) return;
        if (!canShowShipmentsTabs) return;
        if (activeTab === 'active' && !canTransportActiveShipmentsView) {
            if (canTransportShipmentsHistoryView) setActiveTab('history');
            else if (canTransportShipmentsMonthsView) setActiveTab('months');
            return;
        }
        if (activeTab === 'history' && !canTransportShipmentsHistoryView) {
            if (canTransportActiveShipmentsView) setActiveTab('active');
            else if (canTransportShipmentsMonthsView) setActiveTab('months');
            return;
        }
        if (activeTab === 'months' && !canTransportShipmentsMonthsView) {
            if (canTransportActiveShipmentsView) setActiveTab('active');
            else if (canTransportShipmentsHistoryView) setActiveTab('history');
        }
    }, [
        activeTab,
        authLoading,
        canShowShipmentsTabs,
        canTransportActiveShipmentsView,
        canTransportShipmentsHistoryView,
        canTransportShipmentsMonthsView,
    ]);

    const fetchAttachments = useCallback(async (transportId: number) => {
        if (!canTransportAttachmentsView) return;
        if (!Number.isInteger(transportId) || transportId <= 0) {
            setAttachments([]);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=transport&entity_id=${encodeURIComponent(String(transportId))}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки вложений');
            }
            const data = (await res.json()) as AttachmentItem[];
            setAttachments(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки вложений');
        } finally {
            setAttachmentsLoading(false);
        }
    }, [canTransportAttachmentsView]);

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`/api/transport/${id}`);
            if (response.ok) {
                const result = await response.json();
                setData(result);

                if (canTransportAttachmentsView) {
                    await fetchAttachments(Number(result?.transport?.id));
                }
            } else {
                console.error('Failed to fetch transport details');
            }
        } catch (error) {
            console.error('Error fetching transport details:', error);
        } finally {
            setLoading(false);
        }
    }, [canTransportAttachmentsView, fetchAttachments, id]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchData();
        }
    }, [authLoading, canView, fetchData, id]);

    const formatBytes = (bytes: number) => {
        const b = Number(bytes) || 0;
        if (b < 1024) return `${b} B`;
        const kb = b / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(1)} GB`;
    };

    const canPreviewInline = (a: AttachmentItem) => {
        const mime = (a.mime_type || '').toLowerCase();
        const name = (a.filename || '').toLowerCase();
        if (mime.includes('pdf') || name.endsWith('.pdf')) return true;
        if (mime.startsWith('image/')) return true;
        if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return true;
        return false;
    };

    const openPreview = (a: AttachmentItem) => {
        if (!canPreviewInline(a)) {
            window.open(`/api/attachments/${encodeURIComponent(a.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const handleUploadAttachment = async (file: File) => {
        if (!canTransportAttachmentsUpload) return;
        const transportId = Number(data?.transport?.id);
        if (!Number.isInteger(transportId) || transportId <= 0) return;

        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'transport');
            form.append('entity_id', String(transportId));

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(transportId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!canTransportAttachmentsDelete) return;
        const transportId = Number(data?.transport?.id);
        if (!Number.isInteger(transportId) || transportId <= 0) return;

        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=transport&entity_id=${encodeURIComponent(String(transportId))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(transportId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const formatCurrency = (amount: number | null) => {
        if (amount == null) return 'Не указано';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getStatusClass = (status: string): string => {
        switch (status.toLowerCase()) {
            case 'получено':
            case 'доставлено':
                return 'completed';
            case 'в пути':
                return 'shipped';
            case 'в обработке':
                return 'processing';
            case 'отменено':
                return 'cancelled';
            default:
                return 'pending';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'в пути': return 'В ПУТИ';
            case 'получено': return 'ПОЛУЧЕНО';
            case 'доставлено': return 'ДОСТАВЛЕНО';
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status?.toUpperCase() || 'НЕИЗВЕСТНО';
        }
    };

    const calculateSuccessRate = (successful: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((successful / total) * 100);
    };

    const handleEditCompany = () => {
        if (!canEdit) return;
        setIsEditModalOpen(true);
    };

    const handleTransportUpdated = () => {
        fetchData(); // Refresh data after update
        setIsEditModalOpen(false);
    };

    const handleRefresh = () => {
        setLoading(true);
        fetchData();
    };

    const handleDeleteTransport = async () => {
        if (!id) return;
        if (!canDelete) return;
        setDeleteLoading(true);
        try {
            const response = await fetch(`/api/transport?id=${encodeURIComponent(String(id))}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Ошибка удаления компании');
            }

            setIsDeleteConfirmOpen(false);
            router.push('/transport');
        } catch (error) {
            console.error('Error deleting transport company:', error);
            alert('Ошибка удаления компании: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setDeleteLoading(false);
        }
    };

    const loadMonthShipments = async (companyId: number, month: string) => {
        if (!canTransportShipmentsMonthsView) return;
        setMonthShipmentsLoading(true);
        setMonthShipmentsError('');

        try {
            const r = await fetch(`/api/transport/stats-month?companyId=${companyId}&month=${encodeURIComponent(month)}`);
            if (!r.ok) {
                const t = await r.json().catch(() => null);
                throw new Error(t?.error || 'Не удалось загрузить отгрузки за месяц');
            }
            const json = (await r.json()) as { shipments: MonthShipmentRow[] };
            setMonthShipments(Array.isArray(json.shipments) ? json.shipments : []);
        } catch (e) {
            setMonthShipmentsError(e instanceof Error ? e.message : 'Не удалось загрузить отгрузки за месяц');
            setMonthShipments([]);
        } finally {
            setMonthShipmentsLoading(false);
        }
    };

    const handleCreateShipment = () => {
        if (!canCreateShipment) return;
        setIsCreateShipmentModalOpen(true);
    };

    const transport = data?.transport;
    const shipments = useMemo(() => data?.shipments ?? [], [data]);
    const performance = useMemo(() => data?.performance ?? [], [data]);
    const activeShipments = useMemo(() => data?.activeShipments ?? [], [data]);

    const summary = useMemo(() => {
        const totalShipments = Number(transport?.общее_количество_отгрузок) || 0;
        const completed = Number(transport?.завершенные_отгрузки) || 0;
        const successRate = totalShipments ? Math.round((completed / totalShipments) * 100) : 0;

        return {
            successRate,
        };
    }, [transport?.общее_количество_отгрузок, transport?.завершенные_отгрузки]);

    const filteredActiveShipments = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return activeShipments;
        return activeShipments.filter((s) => {
            return (
                String(s.id).includes(q) ||
                String(s.номер_отслеживания || '').toLowerCase().includes(q) ||
                String(s.заявка_номер || '').includes(q) ||
                String(s.клиент_название || '').toLowerCase().includes(q) ||
                String(s.адрес_доставки || '').toLowerCase().includes(q) ||
                String(s.статус || '').toLowerCase().includes(q) ||
                String(s.заявка_статус || '').toLowerCase().includes(q)
            );
        });
    }, [activeShipments, search]);

    const filteredShipments = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return shipments;
        return shipments.filter((s) => {
            return (
                String(s.id).includes(q) ||
                String(s.номер_отслеживания || '').toLowerCase().includes(q) ||
                String(s.заявка_номер || '').includes(q) ||
                String(s.клиент_название || '').toLowerCase().includes(q) ||
                String(s.адрес_доставки || '').toLowerCase().includes(q) ||
                String(s.статус || '').toLowerCase().includes(q) ||
                String(s.заявка_статус || '').toLowerCase().includes(q)
            );
        });
    }, [shipments, search]);

    const filteredPerformance = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return performance;
        return performance.filter((m) => formatDate(m.месяц).toLowerCase().includes(q));
    }, [performance, search]);

    if (authLoading) {
        return (
            <Layout>
                <Box p="5">
                    <Text>Загрузка…</Text>
                </Box>
            </Layout>
        );
    }

    if (!canView) {
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
                <div className={styles.error}>Транспортная компания не найдена</div>
            </Layout>
        );
    }

    const transportSafe = data.transport;
    const transportPrintDocuments: RecordPrintDocument[] = (() => {
        if (!data) return [];

        const documents: RecordPrintDocument[] = [
            {
                key: 'transport-card',
                title: 'Карточка транспортной компании',
                fileName: `Карточка транспортной компании № ${transportSafe.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Карточка ТК #${transportSafe.id}`}
                        subtitle={transportSafe.название}
                        meta={
                            <>
                                <div>Активных отгрузок: {transportSafe.активные_отгрузки || 0}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Основная информация',
                                fields: [
                                    { label: 'ID', value: `#${transportSafe.id}` },
                                    { label: 'Название', value: transportSafe.название || '—' },
                                    { label: 'Телефон', value: transportSafe.телефон || '—' },
                                    { label: 'Email', value: transportSafe.email || '—' },
                                    { label: 'Тариф', value: formatCurrency(transportSafe.тариф) },
                                    { label: 'Дата регистрации', value: formatDate(transportSafe.created_at) },
                                ],
                            },
                            {
                                title: 'Показатели',
                                fields: [
                                    { label: 'Всего отгрузок', value: transportSafe.общее_количество_отгрузок || 0 },
                                    { label: 'Активные отгрузки', value: transportSafe.активные_отгрузки || 0 },
                                    { label: 'Завершенные отгрузки', value: transportSafe.завершенные_отгрузки || 0 },
                                    { label: 'Выручка', value: formatCurrency(transportSafe.общая_выручка) },
                                    { label: 'Средняя стоимость', value: formatCurrency(transportSafe.средняя_стоимость) },
                                    { label: 'Успешность', value: `${summary.successRate}%` },
                                ],
                            },
                        ]}
                    />
                ),
            },
        ];

        if (filteredShipments.length) {
            documents.push({
                key: 'transport-shipments',
                title: 'История отгрузок',
                fileName: `История отгрузок транспортной компании № ${transportSafe.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`История отгрузок ТК #${transportSafe.id}`}
                        subtitle={transportSafe.название}
                        meta={
                            <>
                                <div>Отгрузок: {filteredShipments.length}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Отгрузки',
                                table: {
                                    columns: ['№ отгрузки', 'Дата', 'Клиент', 'Статус', 'Трекинг', 'Стоимость'],
                                    rows: filteredShipments.map((shipment) => [
                                        `#${shipment.id}`,
                                        formatDateTime(shipment.дата_отгрузки),
                                        shipment.клиент_название || '—',
                                        getStatusText(shipment.статус),
                                        shipment.номер_отслеживания || '—',
                                        formatCurrency(shipment.стоимость_доставки),
                                    ]),
                                },
                            },
                        ]}
                    />
                ),
            });
        }

        if (data.performance.length) {
            documents.push({
                key: 'transport-performance',
                title: 'Помесячная эффективность',
                fileName: `Помесячная эффективность транспортной компании № ${transportSafe.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Помесячная эффективность ТК #${transportSafe.id}`}
                        subtitle={transportSafe.название}
                        meta={
                            <>
                                <div>Месяцев: {data.performance.length}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Показатели по месяцам',
                                table: {
                                    columns: ['Месяц', 'Отгрузок', 'Средняя стоимость', 'Выручка', 'Успешные доставки'],
                                    rows: data.performance.map((row) => [
                                        row.месяц || '—',
                                        row.количество_отгрузок || 0,
                                        formatCurrency(row.средняя_стоимость),
                                        formatCurrency(row.общая_выручка),
                                        row.успешные_доставки || 0,
                                    ]),
                                },
                            },
                        ]}
                    />
                ),
            });
        }

        return documents;
    })();

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.titleRow}>

                            <h1 className={styles.title}>{transportSafe.название}</h1>
                        </div>
                        <p className={styles.subtitle}>Карточка транспортной компании и история отгрузок</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={() => router.push('/transport')}
                        >
                            <FiArrowLeft className={styles.icon} /> Назад к ТК
                        </Button>
                        <RecordDocumentCenter
                            documents={transportPrintDocuments}
                            buttonClassName={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                        />
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={handleRefresh}
                        >
                            <FiRefreshCw className={styles.icon} /> Обновить
                        </Button>

                        {canEdit ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                onClick={handleEditCompany}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </Button>
                        ) : null}

                        {canCreateShipment ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                onClick={handleCreateShipment}
                            >
                                <FiPlus className={styles.icon} /> Создать отгрузку
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="red"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                onClick={() => setIsDeleteConfirmOpen(true)}
                            >
                                <FiTrash2 className={styles.icon} /> Удалить
                            </Button>
                        ) : null}
                    </div>
                </div>

                <Card className={styles.statsContainer}>
                    <h2 className={styles.statsTitle}>Информация о транспортной компании</h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{transportSafe.общее_количество_отгрузок || 0}</div>
                            <div className={styles.statLabel}>Всего отгрузок</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{transportSafe.активные_отгрузки || 0}</div>
                            <div className={styles.statLabel}>Активные</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{summary.successRate}%</div>
                            <div className={styles.statLabel}>Успешность</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{formatCurrency(transportSafe.общая_выручка)}</div>
                            <div className={styles.statLabel}>Выручка</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <div className={styles.infoKey}>ID</div>
                        <div className={styles.infoVal}>#{transportSafe.id}</div>
                    </div>
                    <div className={styles.infoRow}>
                        <div className={styles.infoKey}>Телефон</div>
                        <div className={styles.infoVal}>{transportSafe.телефон || '—'}</div>
                    </div>
                    <div className={styles.infoRow}>
                        <div className={styles.infoKey}>Email</div>
                        <div className={styles.infoVal}>{transportSafe.email || '—'}</div>
                    </div>
                    <div className={styles.infoRow}>
                        <div className={styles.infoKey}>Тариф</div>
                        <div className={styles.infoVal}>{formatCurrency(transportSafe.тариф)}</div>
                    </div>
                    <div className={styles.infoRow}>
                        <div className={styles.infoKey}>Регистрация</div>
                        <div className={styles.infoVal}>{formatDate(transportSafe.created_at)}</div>
                    </div>
                </Card>

                <div className={styles.tableSection}>
                    {canTransportAttachmentsView ? (
                        <Fragment>
                            <div className={`${styles.sectionBlock} ${styles.sectionBlockNoTop}`}>
                                <div className={styles.sectionHeaderRow}>
                                    <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                        Документы
                                    </Text>
                                    <div className={styles.buttonGroup}>
                                        {canTransportAttachmentsUpload ? (
                                            <>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) void handleUploadAttachment(f);
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={attachmentsUploading}
                                                    variant="surface"
                                                    color="gray"
                                                    highContrast
                                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                >
                                                    <FiUploadCloud className={styles.icon} />
                                                    {attachmentsUploading ? 'Загрузка…' : 'Загрузить файл'}
                                                </Button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                {attachmentsError ? (
                                    <Text as="div" size="2" color="red" style={{ marginLeft: 16 }}>
                                        {attachmentsError}
                                    </Text>
                                ) : null}

                                {attachmentsLoading ? (
                                    <Text as="div" size="2" color="gray" style={{ marginLeft: 16 }}>
                                        Загрузка документов…
                                    </Text>
                                ) : attachments.length === 0 ? (
                                    <Text as="div" size="2" color="gray" style={{ marginLeft: 16 }}>
                                        Нет прикрепленных документов
                                    </Text>
                                ) : (
                                    <Box style={{ paddingLeft: 16, paddingRight: 16 }}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Файл</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Размер</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Действия</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {attachments.map((a) => (
                                                    <Table.Row key={a.id}>
                                                        <Table.Cell>
                                                            <Flex align="center" gap="2">
                                                                <FiPaperclip />
                                                                <Text as="div" size="2" weight="medium">
                                                                    {a.filename}
                                                                </Text>
                                                            </Flex>
                                                            <Text as="div" size="1" color="gray">
                                                                {a.mime_type}
                                                            </Text>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.textRight}>{formatBytes(a.size_bytes)}</Table.Cell>
                                                        <Table.Cell className={styles.textRight}>
                                                            <Flex justify="end" gap="2" wrap="wrap">
                                                                <Button
                                                                    type="button"
                                                                    variant="surface"
                                                                    color="gray"
                                                                    highContrast
                                                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                                    onClick={() => openPreview(a)}
                                                                >
                                                                    <FiFile className={styles.icon} />
                                                                    Открыть
                                                                </Button>
                                                                <a
                                                                    href={`/api/attachments/${encodeURIComponent(a.id)}/download`}
                                                                    style={{ textDecoration: 'none' }}
                                                                >
                                                                    <Button
                                                                        type="button"
                                                                        variant="surface"
                                                                        color="gray"
                                                                        highContrast
                                                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                                    >
                                                                        <FiDownload className={styles.icon} />
                                                                        Скачать
                                                                    </Button>
                                                                </a>
                                                                {canTransportAttachmentsDelete ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="surface"
                                                                        color="red"
                                                                        highContrast
                                                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                                                        onClick={() => void handleDeleteAttachment(a.id)}
                                                                    >
                                                                        <FiTrash2 className={styles.icon} />
                                                                        Удалить
                                                                    </Button>
                                                                ) : null}
                                                            </Flex>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ))}
                                            </Table.Body>
                                        </Table.Root>
                                    </Box>
                                )}

                            </div>

                            <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                                <Dialog.Content style={{ maxWidth: 980, width: '95vw' }}>
                                    <Dialog.Title>{previewAttachment?.filename || 'Документ'}</Dialog.Title>
                                    <Dialog.Description>{previewAttachment?.mime_type || ''}</Dialog.Description>

                                    <Box style={{ marginTop: 12 }}>
                                        {previewAttachment ? (
                                            canPreviewInline(previewAttachment) ? (
                                                previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                                    <Image
                                                        src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                                        alt={previewAttachment.filename}
                                                        width={1600}
                                                        height={1200}
                                                        unoptimized
                                                        style={{ width: '100%', maxHeight: '75vh', height: 'auto', objectFit: 'contain' }}
                                                    />
                                                ) : (
                                                    <iframe
                                                        src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                                        style={{ width: '100%', height: '75vh', border: '1px solid #eee', borderRadius: 8 }}
                                                        title={previewAttachment.filename}
                                                    />
                                                )
                                            ) : (
                                                <Text as="div" size="2" color="gray">
                                                    Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                                                </Text>
                                            )
                                        ) : (
                                            <Text as="div" size="2" color="gray">
                                                Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                                            </Text>
                                        )}
                                    </Box>

                                    <Flex gap="3" mt="4" justify="end">
                                        {previewAttachment ? (
                                            <a href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`} style={{ textDecoration: 'none' }}>
                                                <Button variant="surface" color="gray" highContrast>
                                                    <FiDownload className={styles.icon} /> Скачать
                                                </Button>
                                            </a>
                                        ) : null}
                                        <Dialog.Close>
                                            <Button variant="surface" color="gray" highContrast>Закрыть</Button>
                                        </Dialog.Close>
                                    </Flex>
                                </Dialog.Content>
                            </Dialog.Root>
                        </Fragment>
                    ) : null}

                    {canShowShipmentsTabs ? (
                        <Tabs.Root
                            className={styles.tabsRoot}
                            value={activeTab}
                            onValueChange={(v) => {
                                const next = v as 'active' | 'history' | 'months';
                                if (next === 'active' && !canTransportActiveShipmentsView) return;
                                if (next === 'history' && !canTransportShipmentsHistoryView) return;
                                if (next === 'months' && !canTransportShipmentsMonthsView) return;
                                setActiveTab(next);
                            }}
                        >
                            <Tabs.List className={styles.tabsList}>
                                {canTransportActiveShipmentsView ? (
                                    <Tabs.Trigger value="active">
                                        Активные
                                        {activeShipments.length > 0 ? <span className={styles.tabBadge}>{activeShipments.length}</span> : null}
                                    </Tabs.Trigger>
                                ) : null}
                                {canTransportShipmentsHistoryView ? (
                                    <Tabs.Trigger value="history">
                                        История
                                        {shipments.length > 0 ? <span className={styles.tabBadge}>{shipments.length}</span> : null}
                                    </Tabs.Trigger>
                                ) : null}
                                {canTransportShipmentsMonthsView ? (
                                    <Tabs.Trigger value="months">
                                        По месяцам
                                        {performance.length > 0 ? <span className={styles.tabBadge}>{performance.length}</span> : null}
                                    </Tabs.Trigger>
                                ) : null}
                            </Tabs.List>

                            <div className={styles.tableHeader}>
                                <div>
                                    <h2 className={styles.sectionTitle}>Отгрузки</h2>
                                    <Text size="2" color="gray">Поиск работает по всем вкладкам</Text>
                                </div>
                                <div className={styles.tableHeaderActions}>
                                    <TextField.Root
                                        className={styles.searchInput}
                                        size="3"
                                        radius="large"
                                        variant="surface"
                                        placeholder="Поиск..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    >
                                        <TextField.Slot side="left">
                                            <FiSearch height="16" width="16" />
                                        </TextField.Slot>
                                    </TextField.Root>
                                </div>
                            </div>

                            {canTransportActiveShipmentsView ? (
                                <Tabs.Content value="active">
                                    <div className={styles.tableContainer}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Отгрузка</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Адрес</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Стоимость</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {filteredActiveShipments.length === 0 ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={7}>
                                                            <Text size="2" color="gray">Нет активных отгрузок</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : (
                                                    filteredActiveShipments.map((s) => (
                                                        <Table.Row
                                                            key={s.id}
                                                            className={styles.tableRow}
                                                            onClick={() => router.push(`/shipments/${encodeURIComponent(String(s.id))}`)}
                                                        >
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>#{s.id}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>#{s.номер_отслеживания || s.id}</div>
                                                                <div className={styles.itemSub}>Заявка #{s.заявка_номер}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{s.клиент_название}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{s.адрес_доставки || '—'}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={styles.statusPill} data-status={(s.статус || '').toLowerCase()}>
                                                                    {getStatusText((s.статус || '').toLowerCase())}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{formatDateTime(s.дата_отгрузки)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell className={styles.textRight}>
                                                                <span className={styles.moneyValue}>{formatCurrency(s.стоимость_доставки)}</span>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    ))
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Tabs.Content>
                            ) : null}

                            {canTransportShipmentsHistoryView ? (
                                <Tabs.Content value="history">
                                    <div className={styles.tableContainer}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Отгрузка</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Адрес</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Стоимость</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Сумма заявки</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {filteredShipments.length === 0 ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={8}>
                                                            <Text size="2" color="gray">Нет отгрузок</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : (
                                                    filteredShipments.map((s) => (
                                                        <Table.Row
                                                            key={s.id}
                                                            className={styles.tableRow}
                                                            onClick={() => router.push(`/shipments/${encodeURIComponent(String(s.id))}`)}
                                                        >
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>#{s.id}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>#{s.номер_отслеживания || s.id}</div>
                                                                <div className={styles.itemSub}>Заявка #{s.заявка_номер}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{s.клиент_название}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{s.адрес_доставки || '—'}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={styles.statusPill} data-status={(s.статус || '').toLowerCase()}>
                                                                    {getStatusText((s.статус || '').toLowerCase())}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{formatDateTime(s.дата_отгрузки)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell className={styles.textRight}>
                                                                <span className={styles.moneyValue}>{formatCurrency(s.стоимость_доставки)}</span>
                                                            </Table.Cell>
                                                            <Table.Cell className={styles.textRight}>
                                                                <span className={styles.moneyValue}>{formatCurrency(s.сумма_заявки)}</span>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    ))
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Tabs.Content>
                            ) : null}

                            {canTransportShipmentsMonthsView ? (
                                <Tabs.Content value="months">
                                    <div className={styles.tableContainer}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Месяц</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Отгрузок</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Успешные</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Успешность</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Средняя</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell className={styles.textRight}>Выручка</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {filteredPerformance.length === 0 ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={6}>
                                                            <Text size="2" color="gray">Нет данных</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : (
                                                    filteredPerformance.map((m) => {
                                                        const rate = m.количество_отгрузок ? Math.round((m.успешные_доставки / m.количество_отгрузок) * 100) : 0;
                                                        const isExpanded = expandedMonth === m.месяц;
                                                        return (
                                                            <Fragment key={m.месяц}>
                                                                <Table.Row
                                                                    key={m.месяц}
                                                                    className={styles.tableRow}
                                                                    onClick={() => {
                                                                        if (isExpanded) {
                                                                            setExpandedMonth('');
                                                                            setMonthShipments([]);
                                                                            setMonthShipmentsError('');
                                                                            return;
                                                                        }
                                                                        setExpandedMonth(m.месяц);
                                                                        setMonthShipments([]);
                                                                        setMonthShipmentsError('');
                                                                        loadMonthShipments(transportSafe.id, m.месяц);
                                                                    }}
                                                                >
                                                                    <Table.Cell>
                                                                        <div className={styles.itemTitle}>{formatDate(m.месяц)}</div>
                                                                        <div className={styles.itemSub}>{isExpanded ? 'Нажмите, чтобы свернуть' : 'Нажмите, чтобы раскрыть'}</div>
                                                                    </Table.Cell>
                                                                    <Table.Cell className={styles.textRight}><span className={styles.metricValue}>{m.количество_отгрузок}</span></Table.Cell>
                                                                    <Table.Cell className={styles.textRight}><span className={styles.metricValue}>{m.успешные_доставки}</span></Table.Cell>
                                                                    <Table.Cell className={styles.textRight}><span style={{ fontWeight: 700 }}>{rate}%</span></Table.Cell>
                                                                    <Table.Cell className={styles.textRight}><span className={styles.moneyValue}>{formatCurrency(m.средняя_стоимость)}</span></Table.Cell>
                                                                    <Table.Cell className={styles.textRight}><span className={styles.moneyValue}>{formatCurrency(m.общая_выручка)}</span></Table.Cell>
                                                                </Table.Row>

                                                                {isExpanded ? (
                                                                    <Table.Row>
                                                                        <Table.Cell colSpan={6}>
                                                                            {monthShipmentsLoading ? (
                                                                                <Text size="2" color="gray">Загрузка отгрузок…</Text>
                                                                            ) : monthShipmentsError ? (
                                                                                <Text size="2" color="red">{monthShipmentsError}</Text>
                                                                            ) : monthShipments.length === 0 ? (
                                                                                <Text size="2" color="gray">Нет отгрузок за этот месяц</Text>
                                                                            ) : (
                                                                                <Table.Root variant="surface" className={styles.table}>
                                                                                    <Table.Header>
                                                                                        <Table.Row>
                                                                                            <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                                                            <Table.ColumnHeaderCell>Отгрузка</Table.ColumnHeaderCell>
                                                                                            <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                                                            <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                                                            <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                                                            <Table.ColumnHeaderCell className={styles.textRight}>Стоимость</Table.ColumnHeaderCell>
                                                                                        </Table.Row>
                                                                                    </Table.Header>
                                                                                    <Table.Body>
                                                                                        {monthShipments.map((s) => (
                                                                                            <Table.Row
                                                                                                key={s.id}
                                                                                                className={styles.tableRow}
                                                                                                onClick={() => router.push(`/shipments/${encodeURIComponent(String(s.id))}`)}
                                                                                            >
                                                                                                <Table.Cell>
                                                                                                    <div className={styles.itemTitle}>#{s.id}</div>
                                                                                                </Table.Cell>
                                                                                                <Table.Cell>
                                                                                                    <div className={styles.itemTitle}>#{s.номер_отслеживания || s.id}</div>
                                                                                                    <div className={styles.itemSub}>Заявка #{s.заявка_номер}</div>
                                                                                                </Table.Cell>
                                                                                                <Table.Cell>
                                                                                                    <div className={styles.itemTitle}>{s.клиент_название}</div>
                                                                                                </Table.Cell>
                                                                                                <Table.Cell>
                                                                                                    <span className={styles.statusPill} data-status={(s.статус || '').toLowerCase()}>
                                                                                                        {getStatusText((s.статус || '').toLowerCase())}
                                                                                                    </span>
                                                                                                </Table.Cell>
                                                                                                <Table.Cell>
                                                                                                    <div className={styles.itemTitle}>{formatDateTime(s.дата_отгрузки)}</div>
                                                                                                </Table.Cell>
                                                                                                <Table.Cell className={styles.textRight}>
                                                                                                    <span className={styles.moneyValue}>{formatCurrency(s.стоимость_доставки)}</span>
                                                                                                </Table.Cell>
                                                                                            </Table.Row>
                                                                                        ))}
                                                                                    </Table.Body>
                                                                                </Table.Root>
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
                                </Tabs.Content>
                            ) : null}
                        </Tabs.Root>
                    ) : null}
                </div>

                {canDelete ? (
                    <Dialog.Root
                        open={isDeleteConfirmOpen}
                        onOpenChange={(open) => {
                            if (!open) setIsDeleteConfirmOpen(false);
                        }}
                    >
                        <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                            <Dialog.Title>Подтверждение удаления</Dialog.Title>
                            <Box className={deleteConfirmationStyles.form}>
                                <Flex direction="column" gap="3">
                                    <Text as="div" size="2" color="gray">
                                        Вы уверены, что хотите удалить транспортную компанию? Это действие нельзя отменить.
                                    </Text>

                                    <Box className={deleteConfirmationStyles.positionsSection}>
                                        <Flex direction="column" gap="1">
                                            <Text as="div" weight="bold">{transportSafe.название}</Text>
                                            <Text as="div" size="2" color="gray">Отгрузок: {transportSafe.общее_количество_отгрузок || 0}</Text>
                                        </Flex>
                                    </Box>

                                    <Flex justify="end" gap="3" mt="4" className={deleteConfirmationStyles.modalActions}>
                                        <Button
                                            type="button"
                                            variant="surface"
                                            color="gray"
                                            highContrast
                                            onClick={() => setIsDeleteConfirmOpen(false)}
                                            disabled={deleteLoading}
                                        >
                                            Отмена
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="surface"
                                            color="red"
                                            highContrast
                                            className={deleteConfirmationStyles.modalDeleteButton}
                                            onClick={handleDeleteTransport}
                                            disabled={deleteLoading}
                                        >
                                            Удалить
                                        </Button>
                                    </Flex>
                                </Flex>
                            </Box>
                        </Dialog.Content>
                    </Dialog.Root>
                ) : null}

                {canEdit ? (
                    <EditTransportModalNew
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        onUpdated={handleTransportUpdated}
                        company={transportSafe}
                    />
                ) : null}

                {canCreateShipment ? (
                    <CreateShipmentModal
                        isOpen={isCreateShipmentModalOpen}
                        onClose={() => setIsCreateShipmentModalOpen(false)}
                        onCreated={fetchData}
                        transportId={transportSafe.id}
                    />
                ) : null}
            </div>
        </Layout>
    );
}
