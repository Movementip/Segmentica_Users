import { useRouter } from 'next/router';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { Layout } from '../../layout/Layout';
import { EditProductModal } from '../../components/EditProductModal';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import styles from './WarehouseDetail.module.css';
import { Box, Button, Card, Dialog, Flex, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiArrowLeft, FiDownload, FiEdit2, FiFile, FiPaperclip, FiSearch, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { RecordDocumentCenter, RecordPrintSheet, type RecordPrintDocument } from '../../components/print/RecordDocumentCenter';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
    товар: 'Товар',
    материал: 'Материал',
    продукция: 'Продукция',
    входящая_услуга: 'Входящая услуга',
    исходящая_услуга: 'Исходящая услуга',
    внеоборотный_актив: 'Внеоборотный актив',
};

const PRODUCT_VAT_LABELS: Record<number, string> = {
    1: 'Без НДС',
    4: '10%',
    5: '22%',
};

const ACCOUNT_LABELS: Record<string, string> = {
    '10.мат': '10.мат Материалы и сырье',
    '10.дет': '10.дет Детали, комплектующие и полуфабрикаты',
    '10.см': '10.см Топливо',
    '10.зап': '10.зап Запасные части',
    '10.стр': '10.стр Строительные материалы',
    '10.хоз': '10.хоз Хозяйственные принадлежности и инвентарь',
    '10.спец': '10.спец Специальная одежда',
    '10.тара': '10.тара Тара',
    '10.пр': '10.пр Прочие материалы',
    '20': '20 Основное производство',
    '23': '23 Вспомогательные производства',
    '25': '25 Общепроизводственные расходы',
    '26': '26 Общехозяйственные (управленческие) расходы',
    '29': '29 Обслуживающие производства и хозяйства',
    '44': '44 Расходы на продажу (коммерческие расходы)',
    '91.02': '91.02 Прочие расходы',
    '97': '97 Расходы будущих периодов',
};

interface WarehouseItem {
    id: number;
    товар_id: number;
    количество: number;
    дата_последнего_поступления: string | null;
    updated_at: string;
    товар_название: string;
    товар_артикул: string;
    товар_категория: string;
    товар_тип_номенклатуры?: string;
    товар_счет_учета?: string;
    товар_счет_затрат?: string;
    товар_ндс_id?: number;
    товар_комментарий?: string;
    товар_единица: string;
    товар_мин_остаток: number;
    товар_цена_закупки: number;
    товар_цена_продажи: number;
    stock_status: 'critical' | 'low' | 'normal';
}

interface Movement {
    id: number;
    товар_id: number;
    тип_операции: string;
    количество: number;
    дата_операции: string;
    заявка_id: number | null;
    закупка_id: number | null;
    комментарий: string | null;
    заявка_номер: number | null;
    закупка_номер: number | null;
    отгрузка_номер: number | null;
    клиент_название: string | null;
    поставщик_название: string | null;
}

interface WaitingOrder {
    id: number;
    заявка_id: number;
    товар_id: number;
    количество: number;
    цена: number;
    заявка_номер: number;
    заявка_статус: string;
    клиент_название: string;
    заявка_дата: string;
}

interface PendingPurchase {
    id: number;
    закупка_id: number;
    товар_id: number;
    количество: number;
    цена: number;
    закупка_номер: number;
    закупка_статус: string;
    поставщик_название: string;
    закупка_дата: string;
    ожидаемая_дата: string | null;
}

interface WarehouseDetailData {
    item: WarehouseItem;
    movements: Movement[];
    waitingOrders: WaitingOrder[];
    pendingPurchases: PendingPurchase[];
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

const EMPTY_MOVEMENTS: Movement[] = [];
const EMPTY_WAITING_ORDERS: WaitingOrder[] = [];
const EMPTY_PENDING_PURCHASES: PendingPurchase[] = [];

export default function WarehouseDetail() {
    const [data, setData] = useState<WarehouseDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<'movements' | 'waitingOrders' | 'pendingPurchases'>('movements');
    const [search, setSearch] = useState('');
    const router = useRouter();
    const { id } = router.query;

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useState<{ current: HTMLInputElement | null }>({ current: null })[0];
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

    const { user, loading: authLoading } = useAuth();
    const canView = Boolean(user?.permissions?.includes('warehouse.view'));
    const canEdit = Boolean(user?.permissions?.includes('warehouse.edit'));
    const canDelete = Boolean(user?.permissions?.includes('warehouse.delete'));
    const canMovementsView = Boolean(user?.permissions?.includes('warehouse.movements.view'));
    const canWaitingOrdersView = Boolean(user?.permissions?.includes('warehouse.waiting_orders.view'));
    const canPendingPurchasesView = Boolean(user?.permissions?.includes('warehouse.pending_purchases.view'));
    const canOrdersView = Boolean(user?.permissions?.includes('orders.view'));
    const canPurchasesView = Boolean(user?.permissions?.includes('purchases.view'));
    const canShipmentsView = Boolean(user?.permissions?.includes('shipments.view'));
    const canWarehouseProductAttachmentsView =
        Boolean(user?.permissions?.includes('warehouse-products.attachments.view'));
    const canWarehouseProductAttachmentsUpload =
        Boolean(user?.permissions?.includes('warehouse-products.attachments.upload'));
    const canWarehouseProductAttachmentsDelete =
        Boolean(user?.permissions?.includes('warehouse-products.attachments.delete'));

    const canShowTableSection = canMovementsView || canWaitingOrdersView || canPendingPurchasesView;

    const fetchAttachments = useCallback(async (productId: number) => {
        if (!canWarehouseProductAttachmentsView) return;
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments?entity_type=product&entity_id=${encodeURIComponent(String(productId))}&perm_scope=warehouse`
            );
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
    }, [canWarehouseProductAttachmentsView]);

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`/api/warehouse/${id}`);
            if (response.ok) {
                const result = await response.json();
                setData(result);

                if (result?.item?.товар_id) {
                    if (canWarehouseProductAttachmentsView) {
                        await fetchAttachments(Number(result.item.товар_id));
                    }
                }
            } else {
                console.error('Failed to fetch warehouse item details');
            }
        } catch (error) {
            console.error('Error fetching warehouse item details:', error);
        } finally {
            setLoading(false);
        }
    }, [canWarehouseProductAttachmentsView, fetchAttachments, id]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchData();
        }
    }, [authLoading, canView, fetchData, id]);

    useEffect(() => {
        if (authLoading) return;

        // Ensure activeTab is always permitted
        if (activeTab === 'movements' && !canMovementsView) {
            if (canWaitingOrdersView) setActiveTab('waitingOrders');
            else if (canPendingPurchasesView) setActiveTab('pendingPurchases');
        }
        if (activeTab === 'waitingOrders' && !canWaitingOrdersView) {
            if (canMovementsView) setActiveTab('movements');
            else if (canPendingPurchasesView) setActiveTab('pendingPurchases');
        }
        if (activeTab === 'pendingPurchases' && !canPendingPurchasesView) {
            if (canMovementsView) setActiveTab('movements');
            else if (canWaitingOrdersView) setActiveTab('waitingOrders');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, activeTab, canMovementsView, canWaitingOrdersView, canPendingPurchasesView]);

    const handleUploadAttachment = async (file: File) => {
        if (!data?.item?.товар_id) return;
        if (!canWarehouseProductAttachmentsUpload) return;
        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const productId = Number(data.item.товар_id);
            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'product');
            form.append('entity_id', String(productId));
            form.append('perm_scope', 'warehouse');

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const responseData = await res.json().catch(() => ({}));
                throw new Error(responseData?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(productId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

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
            window.open(
                `/api/attachments/${encodeURIComponent(a.id)}/download?perm_scope=warehouse`,
                '_blank',
                'noopener,noreferrer'
            );
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!data?.item?.товар_id) return;
        if (!canWarehouseProductAttachmentsDelete) return;
        try {
            setAttachmentsError(null);
            const productId = Number(data.item.товар_id);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=product&entity_id=${encodeURIComponent(String(productId))}&perm_scope=warehouse`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(productId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const getPlural = (n: number, one: string, few: string, many: string) => {
        const abs = Math.abs(n);
        const mod10 = abs % 10;
        const mod100 = abs % 100;
        if (mod100 >= 11 && mod100 <= 14) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    };

    const getStatusBadgeClass = (status: WarehouseItem['stock_status']) => {
        if (status === 'critical') return styles.badgeCritical;
        if (status === 'low') return styles.badgeLow;
        return styles.badgeNormal;
    };

    const handleEditProduct = () => {
        if (!canEdit) return;
        setIsEditModalOpen(true);
    };

    const handleDeleteProduct = () => {
        if (!canDelete) return;
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!data?.item) return;

        try {
            setIsDeleting(true);
            const response = await fetch(`/api/warehouse?id=${data.item.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления товара');
            }

            // Navigate back to warehouse page after successful deletion
            router.push('/warehouse');
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const handleProductUpdated = () => {
        fetchData();
        setIsEditModalOpen(false);
    };

    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU');
    }, []);

    const formatDateTime = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU');
    }, []);

    const formatCurrency = useCallback((amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    }, []);

    const getStockStatusText = useCallback((status: string) => {
        switch (status) {
            case 'critical': return 'Критический';
            case 'low': return 'Низкий';
            default: return 'Нормальный';
        }
    }, []);

    const getOperationTypeColor = (type: string) => {
        switch (type) {
            case 'поступление': return '#4CAF50';
            case 'отгрузка': return '#ff4444';
            case 'списание': return '#ff8800';
            case 'инвентаризация': return '#2196F3';
            default: return '#666';
        }
    };

    const getDocStatusClass = (status: string) => {
        const s = (status || '').trim().toLowerCase();
        if (s === 'новая') return styles.docStatusNew;
        if (s === 'в обработке') return styles.docStatusInProgress;
        if (s === 'выполнена') return styles.docStatusDone;
        if (s === 'отменена') return styles.docStatusCanceled;
        if (s === 'заказано') return styles.docStatusOrdered;
        if (s === 'в пути') return styles.docStatusInTransit;
        if (s === 'получено') return styles.docStatusReceived;
        return styles.docStatusDefault;
    };

    const item = data?.item;
    const movements = data?.movements ?? EMPTY_MOVEMENTS;
    const waitingOrders = data?.waitingOrders ?? EMPTY_WAITING_ORDERS;
    const pendingPurchases = data?.pendingPurchases ?? EMPTY_PENDING_PURCHASES;
    const productTypeLabel = item
        ? PRODUCT_TYPE_LABELS[item.товар_тип_номенклатуры || 'товар'] || item.товар_тип_номенклатуры || 'Товар'
        : 'Товар';
    const vatLabel = item ? PRODUCT_VAT_LABELS[item.товар_ндс_id || 5] || '22%' : '22%';
    const accountingAccountLabel = item?.товар_счет_учета
        ? ACCOUNT_LABELS[item.товар_счет_учета] || item.товар_счет_учета
        : null;
    const expenseAccountLabel = item?.товар_счет_затрат
        ? ACCOUNT_LABELS[item.товар_счет_затрат] || item.товар_счет_затрат
        : null;

    const filteredMovements = movements.filter((m) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            (m.тип_операции || '').toLowerCase().includes(q) ||
            (m.комментарий || '').toLowerCase().includes(q) ||
            String(m.заявка_номер || '').includes(q) ||
            String(m.закупка_номер || '').includes(q)
        );
    });

    const filteredWaitingOrders = waitingOrders.filter((o) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            String(o.заявка_номер || '').includes(q) ||
            (o.клиент_название || '').toLowerCase().includes(q) ||
            (o.заявка_статус || '').toLowerCase().includes(q)
        );
    });

    const filteredPendingPurchases = pendingPurchases.filter((p) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            String(p.закупка_номер || '').includes(q) ||
            (p.поставщик_название || '').toLowerCase().includes(q) ||
            (p.закупка_статус || '').toLowerCase().includes(q)
        );
    });

    const movementsCount = movements.length;
    const waitingCount = waitingOrders.length;
    const pendingCount = pendingPurchases.length;
    const warehousePrintDocuments = useMemo<RecordPrintDocument[]>(() => {
        if (!item) return [];

        const result: RecordPrintDocument[] = [
            {
                key: 'warehouse-card',
                title: 'Карточка складской позиции',
                fileName: `Карточка складской позиции № ${item.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Карточка складской позиции #${item.id}`}
                        subtitle={item.товар_название}
                        meta={
                            <>
                                <div>Артикул: {item.товар_артикул || '—'}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Остатки и стоимость',
                                fields: [
                                    { label: 'Текущий остаток', value: `${item.количество} ${item.товар_единица}` },
                                    { label: 'Минимальный остаток', value: `${item.товар_мин_остаток} ${item.товар_единица}` },
                                    { label: 'Статус', value: getStockStatusText(item.stock_status) },
                                    { label: 'Стоимость по закупке', value: formatCurrency(item.количество * (item.товар_цена_закупки || 0)) },
                                ],
                            },
                            {
                                title: 'Сведения о товаре',
                                fields: [
                                    { label: 'Категория', value: item.товар_категория || '—' },
                                    { label: 'Тип номенклатуры', value: productTypeLabel },
                                    { label: 'Ставка НДС', value: vatLabel },
                                    { label: 'Счет учета', value: accountingAccountLabel || '—' },
                                    { label: 'Счет затрат', value: expenseAccountLabel || '—' },
                                    { label: 'Цена закупки', value: formatCurrency(item.товар_цена_закупки || 0) },
                                    { label: 'Цена продажи', value: formatCurrency(item.товар_цена_продажи || 0) },
                                    {
                                        label: 'Последнее поступление',
                                        value: item.дата_последнего_поступления ? formatDate(item.дата_последнего_поступления) : 'Нет данных',
                                    },
                                ],
                            },
                        ]}
                    />
                ),
            },
        ];

        if (movements.length) {
            result.push({
                key: 'warehouse-movements',
                title: 'История движений',
                fileName: `История движений складской позиции № ${item.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`История движений по позиции #${item.id}`}
                        subtitle={item.товар_название}
                        meta={
                            <>
                                <div>Движений: {movements.length}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Движения',
                                table: {
                                    columns: ['Дата', 'Операция', 'Количество', 'Основание', 'Контрагент', 'Комментарий'],
                                    rows: movements.map((movement) => [
                                        formatDateTime(movement.дата_операции),
                                        movement.тип_операции || '—',
                                        `${movement.количество} ${item.товар_единица}`,
                                        movement.заявка_номер
                                            ? `Заявка #${movement.заявка_номер}`
                                            : movement.закупка_номер
                                                ? `Закупка #${movement.закупка_номер}`
                                                : movement.отгрузка_номер
                                                    ? `Отгрузка #${movement.отгрузка_номер}`
                                                    : '—',
                                        movement.клиент_название || movement.поставщик_название || '—',
                                        movement.комментарий || '—',
                                    ]),
                                },
                            },
                        ]}
                    />
                ),
            });
        }

        if (waitingOrders.length || pendingPurchases.length) {
            result.push({
                key: 'warehouse-demand',
                title: 'Резервы и ожидания',
                fileName: `Резервы и ожидания складской позиции № ${item.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Резервы и ожидания по позиции #${item.id}`}
                        subtitle={item.товар_название}
                        meta={
                            <>
                                <div>Ожидающих заявок: {waitingOrders.length}</div>
                                <div>Ожидаемых закупок: {pendingPurchases.length}</div>
                            </>
                        }
                        sections={[
                            waitingOrders.length
                                ? {
                                    title: 'Ожидающие заявки',
                                    table: {
                                        columns: ['№ заявки', 'Дата', 'Клиент', 'Количество', 'Цена', 'Статус'],
                                        rows: waitingOrders.map((order) => [
                                            `#${order.заявка_номер}`,
                                            formatDate(order.заявка_дата),
                                            order.клиент_название || '—',
                                            `${order.количество} ${item.товар_единица}`,
                                            formatCurrency(order.цена || 0),
                                            order.заявка_статус || '—',
                                        ]),
                                    },
                                }
                                : {
                                    title: 'Ожидающие заявки',
                                    note: 'Ожидающих заявок по этой позиции нет.',
                                },
                            pendingPurchases.length
                                ? {
                                    title: 'Ожидаемые закупки',
                                    table: {
                                        columns: ['№ закупки', 'Дата', 'Поставщик', 'Количество', 'Ожидаемая дата', 'Статус'],
                                        rows: pendingPurchases.map((purchase) => [
                                            `#${purchase.закупка_номер}`,
                                            formatDate(purchase.закупка_дата),
                                            purchase.поставщик_название || '—',
                                            `${purchase.количество} ${item.товар_единица}`,
                                            purchase.ожидаемая_дата ? formatDate(purchase.ожидаемая_дата) : '—',
                                            purchase.закупка_статус || '—',
                                        ]),
                                    },
                                }
                                : {
                                    title: 'Ожидаемые закупки',
                                    note: 'Ожидаемых закупок по этой позиции нет.',
                                },
                        ]}
                    />
                ),
            });
        }

        return result;
    }, [
        accountingAccountLabel,
        expenseAccountLabel,
        formatCurrency,
        formatDate,
        formatDateTime,
        getStockStatusText,
        item,
        movements,
        pendingPurchases,
        productTypeLabel,
        vatLabel,
        waitingOrders,
    ]);

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

    if (!data || !item) {
        return (
            <Layout>
                <div className={styles.error}>Товар не найден</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>

                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>{item.товар_название}</h1>
                        <div className={styles.subtitle}>{item.товар_артикул ? `Артикул: ${item.товар_артикул}` : 'Карточка товара на складе'}</div>
                    </div>

                    <div className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={() => router.back()}
                        >
                            <FiArrowLeft className={styles.icon} /> Назад
                        </Button>
                        <RecordDocumentCenter
                            documents={warehousePrintDocuments}
                            buttonClassName={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            saveTarget={canWarehouseProductAttachmentsUpload && item.товар_id ? {
                                entityType: 'product',
                                entityId: item.товар_id,
                                permScope: 'warehouse',
                            } : undefined}
                            onSaved={() => item.товар_id ? fetchAttachments(Number(item.товар_id)) : undefined}
                        />

                        {canEdit ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                onClick={handleEditProduct}
                            >
                                <FiEdit2 className={styles.icon} /> Редактировать
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="red"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                onClick={handleDeleteProduct}
                            >
                                <FiTrash2 className={styles.icon} /> Удалить
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className={styles.unifiedBlock}>
                    <Card className={styles.statsContainer}>
                        <h2 className={styles.statsTitle}>Статистика</h2>
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{item.количество.toLocaleString('ru-RU')}</div>
                                <div className={styles.statLabel}>Текущий остаток, {item.товар_единица}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{item.товар_мин_остаток.toLocaleString('ru-RU')}</div>
                                <div className={styles.statLabel}>Минимальный остаток, {item.товар_единица}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{formatCurrency(item.количество * (item.товар_цена_закупки || 0))}</div>
                                <div className={styles.statLabel}>Стоимость по закупке</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{movementsCount.toLocaleString('ru-RU')}</div>
                                <div className={styles.statLabel}>Движений ({getPlural(movementsCount, 'запись', 'записи', 'записей')})</div>
                            </div>
                        </div>

                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Категория</div>
                            <div className={styles.infoVal}><span className={styles.categoryPill}>{item.товар_категория || '—'}</span></div>
                        </div>
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Тип номенклатуры</div>
                            <div className={styles.infoVal}>{productTypeLabel}</div>
                        </div>
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Ставка НДС</div>
                            <div className={styles.infoVal}>{vatLabel}</div>
                        </div>
                        {accountingAccountLabel ? (
                            <div className={styles.infoRow}>
                                <div className={styles.infoKey}>Счет учета</div>
                                <div className={styles.infoVal}>{accountingAccountLabel}</div>
                            </div>
                        ) : null}
                        {expenseAccountLabel ? (
                            <div className={styles.infoRow}>
                                <div className={styles.infoKey}>Счет затрат</div>
                                <div className={styles.infoVal}>{expenseAccountLabel}</div>
                            </div>
                        ) : null}
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Статус</div>
                            <div className={styles.infoVal}>
                                <span className={`${styles.badge} ${getStatusBadgeClass(item.stock_status)}`}>{getStockStatusText(item.stock_status)}</span>
                            </div>
                        </div>
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Цена закупки</div>
                            <div className={styles.infoVal}>{formatCurrency(item.товар_цена_закупки || 0)}</div>
                        </div>
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Цена продажи</div>
                            <div className={styles.infoVal}>{formatCurrency(item.товар_цена_продажи || 0)}</div>
                        </div>
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Последнее поступление</div>
                            <div className={styles.infoVal}>
                                {item.дата_последнего_поступления ? formatDate(item.дата_последнего_поступления) : 'Нет данных'}
                            </div>
                        </div>
                        <div className={styles.infoRow}>
                            <div className={styles.infoKey}>Комментарий</div>
                            <div className={styles.infoVal}>{item.товар_комментарий || '—'}</div>
                        </div>
                    </Card>

                    {canWarehouseProductAttachmentsView ? (
                        <Card className={styles.tableCard}>
                            <div className={styles.tableHeader}>
                                <div>
                                    <h2 className={styles.sectionTitle}>Документы товара</h2>
                                </div>
                                {canWarehouseProductAttachmentsUpload ? (
                                    <div className={styles.tableHeaderActions}>
                                        <input
                                            ref={(el) => {
                                                fileInputRef.current = el;
                                            }}
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
                                    </div>
                                ) : null}
                            </div>

                            {attachmentsError ? (
                                <Text size="2" color="red" style={{ padding: '0 16px 12px' }}>{attachmentsError}</Text>
                            ) : null}

                            {attachmentsLoading ? (
                                <Text size="2" color="gray" style={{ padding: '0 16px 12px' }}>Загрузка документов…</Text>
                            ) : attachments.length === 0 ? (
                                <Text size="2" color="gray" style={{ padding: '0 16px 12px' }}>Нет прикрепленных документов</Text>
                            ) : (
                                <div className={styles.tableContainer}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Файл</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell align="right">Размер</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell align="right">Действия</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {attachments.map((a) => (
                                                <Table.Row key={a.id}>
                                                    <Table.Cell>
                                                        <Flex align="center" gap="2">
                                                            <FiPaperclip />
                                                            <Text as="div" size="2" weight="medium">{a.filename}</Text>
                                                        </Flex>
                                                        <Text as="div" size="1" color="gray">{a.mime_type}</Text>
                                                    </Table.Cell>
                                                    <Table.Cell align="right">{formatBytes(a.size_bytes)}</Table.Cell>
                                                    <Table.Cell align="right">
                                                        <Flex justify="end" gap="2" wrap="wrap">
                                                            <Button
                                                                type="button"
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                                onClick={() => openPreview(a)}
                                                            >
                                                                <FiFile className={styles.icon} /> Открыть
                                                            </Button>
                                                            <a
                                                                href={`/api/attachments/${encodeURIComponent(a.id)}/download?perm_scope=warehouse`}
                                                                style={{ textDecoration: 'none' }}
                                                            >
                                                                <Button
                                                                    type="button"
                                                                    variant="surface"
                                                                    color="gray"
                                                                    highContrast
                                                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                                                >
                                                                    <FiDownload className={styles.icon} /> Скачать
                                                                </Button>
                                                            </a>
                                                            {canWarehouseProductAttachmentsDelete ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="surface"
                                                                    color="red"
                                                                    highContrast
                                                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                                                    onClick={() => void handleDeleteAttachment(a.id)}
                                                                >
                                                                    <FiTrash2 className={styles.icon} /> Удалить
                                                                </Button>
                                                            ) : null}
                                                        </Flex>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            )}
                        </Card>
                    ) : null}

                    <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <Dialog.Content style={{ maxWidth: 980, width: '95vw' }}>
                            <Dialog.Title>{previewAttachment?.filename || 'Документ'}</Dialog.Title>
                            <Dialog.Description>{previewAttachment?.mime_type || ''}</Dialog.Description>

                            <Box style={{ marginTop: 12 }}>
                                {previewAttachment && canPreviewInline(previewAttachment) ? (
                                    previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                        <img
                                            src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline?perm_scope=warehouse`}
                                            alt={previewAttachment.filename}
                                            style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <iframe
                                            src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline?perm_scope=warehouse`}
                                            style={{ width: '100%', height: '75vh', border: '1px solid #eee', borderRadius: 8 }}
                                            title={previewAttachment.filename}
                                        />
                                    )
                                ) : (
                                    <Text as="div" size="2" color="gray">
                                        Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                                    </Text>
                                )}
                            </Box>

                            <Flex gap="3" mt="4" justify="end">
                                {previewAttachment ? (
                                    <a
                                        href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download?perm_scope=warehouse`}
                                        style={{ textDecoration: 'none' }}
                                    >
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

                    {canShowTableSection ? (
                        <div className={styles.tableSection}>
                            <Tabs.Root
                                value={activeTab}
                                onValueChange={(v) => {
                                    const next = v as any;
                                    if (next === 'movements' && !canMovementsView) return;
                                    if (next === 'waitingOrders' && !canWaitingOrdersView) return;
                                    if (next === 'pendingPurchases' && !canPendingPurchasesView) return;
                                    setActiveTab(next);
                                }}
                            >
                                <Tabs.List className={styles.tabsList}>
                                    {canMovementsView ? (
                                        <Tabs.Trigger value="movements">
                                            История движений
                                            {movementsCount > 0 ? <span className={styles.tabBadge}>{movementsCount}</span> : null}
                                        </Tabs.Trigger>
                                    ) : null}
                                    {canWaitingOrdersView ? (
                                        <Tabs.Trigger value="waitingOrders">
                                            Ожидающие заявки
                                            {waitingCount > 0 ? <span className={styles.tabBadge}>{waitingCount}</span> : null}
                                        </Tabs.Trigger>
                                    ) : null}
                                    {canPendingPurchasesView ? (
                                        <Tabs.Trigger value="pendingPurchases">
                                            Ожидаемые поступления
                                            {pendingCount > 0 ? <span className={styles.tabBadge}>{pendingCount}</span> : null}
                                        </Tabs.Trigger>
                                    ) : null}
                                </Tabs.List>

                                <div className={styles.tableHeader}>
                                    <div>
                                        <h2 className={styles.sectionTitle}>
                                            {activeTab === 'movements'
                                                ? 'История движений'
                                                : activeTab === 'waitingOrders'
                                                    ? 'Ожидающие заявки'
                                                    : 'Ожидаемые поступления'}
                                        </h2>
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

                                {canMovementsView ? (
                                    <Tabs.Content value="movements">
                                        <div className={styles.tableContainer}>
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Количество</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Комментарий</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Документ</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredMovements.length ? filteredMovements.map((movement) => (
                                                        <Table.Row key={movement.id} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <span className={styles.muted}>{movement.тип_операции}</span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={styles.movementQty}>
                                                                    {(movement.тип_операции === 'поступление' || movement.тип_операции === 'приход') ? '+' : '-'}{Math.abs(movement.количество)}
                                                                </span>
                                                                <span className={styles.muted}> {item.товар_единица}</span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                {movement.комментарий ? movement.комментарий : <span className={styles.muted}>—</span>}
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{formatDateTime(movement.дата_операции)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                {movement.заявка_номер && canOrdersView ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="surface"
                                                                        color="gray"
                                                                        highContrast
                                                                        className={styles.linkPill}
                                                                        onClick={() => router.push(`/orders/${movement.заявка_номер}`)}
                                                                    >
                                                                        Заявка #{movement.заявка_номер}
                                                                    </Button>
                                                                ) : movement.закупка_номер && canPurchasesView ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="surface"
                                                                        color="gray"
                                                                        highContrast
                                                                        className={styles.linkPill}
                                                                        onClick={() => router.push(`/purchases/${movement.закупка_номер}`)}
                                                                    >
                                                                        Закупка #{movement.закупка_номер}
                                                                    </Button>
                                                                ) : movement.отгрузка_номер && canShipmentsView ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="surface"
                                                                        color="gray"
                                                                        highContrast
                                                                        className={styles.linkPill}
                                                                        onClick={() => router.push(`/shipments/${movement.отгрузка_номер}`)}
                                                                    >
                                                                        Отгрузка #{movement.отгрузка_номер}
                                                                    </Button>
                                                                ) : (
                                                                    <span className={styles.muted}>—</span>
                                                                )}
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={5}>
                                                                <Text size="2" color="gray">Нет движений</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                        </div>
                                    </Tabs.Content>
                                ) : null}

                                {canWaitingOrdersView ? (
                                    <Tabs.Content value="waitingOrders">
                                        <div className={styles.tableContainer}>
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>№ заявки</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Количество</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Цена</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredWaitingOrders.length ? filteredWaitingOrders.map((order) => (
                                                        <Table.Row key={order.id} className={styles.tableRow} onClick={() => router.push(`/orders/${order.заявка_номер}`)}>
                                                            <Table.Cell>#{order.заявка_номер}</Table.Cell>
                                                            <Table.Cell>{order.клиент_название}</Table.Cell>
                                                            <Table.Cell>{order.количество} {item.товар_единица}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(order.цена)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(order.количество * order.цена)}</Table.Cell>
                                                            <Table.Cell>
                                                                <span className={`${styles.statusPill} ${getDocStatusClass(order.заявка_статус)}`}>
                                                                    {order.заявка_статус}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatDate(order.заявка_дата)}</Table.Cell>
                                                        </Table.Row>
                                                    )) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={7}>
                                                                <Text size="2" color="gray">Нет ожидающих заявок</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                        </div>
                                    </Tabs.Content>
                                ) : null}

                                {canPendingPurchasesView ? (
                                    <Tabs.Content value="pendingPurchases">
                                        <div className={styles.tableContainer}>
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>№ закупки</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Поставщик</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Количество</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Цена</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Ожидаемая</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredPendingPurchases.length ? filteredPendingPurchases.map((purchase) => (
                                                        <Table.Row key={purchase.id} className={styles.tableRow} onClick={() => router.push(`/purchases/${purchase.закупка_номер}`)}>
                                                            <Table.Cell>#{purchase.закупка_номер}</Table.Cell>
                                                            <Table.Cell>{purchase.поставщик_название}</Table.Cell>
                                                            <Table.Cell>{purchase.количество} {item.товар_единица}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(purchase.цена)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(purchase.количество * purchase.цена)}</Table.Cell>
                                                            <Table.Cell>
                                                                <span className={`${styles.statusPill} ${getDocStatusClass(purchase.закупка_статус)}`}>
                                                                    {purchase.закупка_статус}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatDate(purchase.закупка_дата)}</Table.Cell>
                                                            <Table.Cell>{purchase.ожидаемая_дата ? formatDate(purchase.ожидаемая_дата) : '—'}</Table.Cell>
                                                        </Table.Row>
                                                    )) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={8}>
                                                                <Text size="2" color="gray">Нет ожидаемых поступлений</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                        </div>
                                    </Tabs.Content>
                                ) : null}
                            </Tabs.Root>
                        </div>
                    ) : null}

                    {/* Modals */}
                    {
                        data?.item && (
                            <EditProductModal
                                isOpen={isEditModalOpen}
                                onClose={() => setIsEditModalOpen(false)}
                                onProductUpdated={handleProductUpdated}
                                product={{
                                    id: data.item.товар_id,
                                    название: data.item.товар_название,
                                    артикул: data.item.товар_артикул,
                                    категория: data.item.товар_категория,
                                    тип_номенклатуры: data.item.товар_тип_номенклатуры as any,
                                    счет_учета: data.item.товар_счет_учета,
                                    счет_затрат: data.item.товар_счет_затрат,
                                    ндс_id: data.item.товар_ндс_id,
                                    комментарий: data.item.товар_комментарий,
                                    единица_измерения: data.item.товар_единица,
                                    минимальный_остаток: data.item.товар_мин_остаток,
                                    цена_закупки: data.item.товар_цена_закупки,
                                    цена_продажи: data.item.товар_цена_продажи
                                }}
                            />
                        )
                    }

                    {
                        data?.item && (
                            <Dialog.Root
                                open={isDeleteModalOpen}
                                onOpenChange={(open) => {
                                    if (!open) setIsDeleteModalOpen(false);
                                }}
                            >
                                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                                    <Box className={deleteConfirmationStyles.form}>
                                        <Flex direction="column" gap="3">
                                            <Text as="div" size="2" color="gray">
                                                Вы уверены, что хотите удалить этот товар со склада? Это действие нельзя отменить.
                                            </Text>

                                            <Box className={deleteConfirmationStyles.positionsSection}>
                                                <Flex direction="column" gap="1">
                                                    <Text as="div" weight="bold">{data.item.товар_название}</Text>
                                                    <Text as="div" size="2" color="gray">Артикул: {data.item.товар_артикул || '-'}</Text>
                                                    <Text as="div" size="2" color="gray">Остаток: {data.item.количество} {data.item.товар_единица}</Text>
                                                </Flex>
                                            </Box>

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
                                    </Box>
                                </Dialog.Content>
                            </Dialog.Root>
                        )
                    }
                </div>
            </div>
        </Layout>
    );
}
