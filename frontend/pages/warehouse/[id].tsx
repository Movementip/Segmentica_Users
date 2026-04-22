import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FiArrowLeft,
    FiDownload,
    FiEdit2,
    FiFile,
    FiPaperclip,
    FiTrash2,
    FiUploadCloud,
} from 'react-icons/fi';

import { DataSearchField } from '../../components/DataSearchField/DataSearchField';
import { EntityActionButton } from '../../components/EntityActionButton/EntityActionButton';
import { EntityStatusBadge, getOrderStatusTone } from '../../components/EntityStatusBadge/EntityStatusBadge';
import { EntityTableSurface, entityTableClassName } from '../../components/EntityDataTable/EntityDataTable';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import deleteConfirmationStyles from '../../components/modals/DeleteConfirmation/DeleteConfirmation.module.css';
import { EditProductModal } from '../../components/modals/EditProductModal/EditProductModal';
import type { NomenclatureTypeValue } from '../../components/modals/ProductFormFields/ProductFormFields';
import { RecordDocumentCenter, RecordPrintSheet, type RecordPrintDocument } from '../../components/print/RecordDocumentCenter';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '../../components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { withLayout } from '../../layout';
import {
    getWarehouseMovementSignedQuantity,
    getWarehouseStockStatusLabel,
    getWarehouseStockStatusTone,
    isWarehouseIncomingMovement,
} from '../../components/warehouse/utils';

import styles from './WarehouseDetail.module.css';

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

type WarehouseDetailTab = 'movements' | 'waitingOrders' | 'pendingPurchases';

const resolveNomenclatureType = (value?: string | null): NomenclatureTypeValue => {
    switch (value) {
        case 'материал':
        case 'продукция':
        case 'входящая_услуга':
        case 'исходящая_услуга':
        case 'внеоборотный_актив':
            return value;
        case 'товар':
        default:
            return 'товар';
    }
};

function WarehouseDetailPage(): JSX.Element {
    const router = useRouter();
    const { id } = router.query;
    const warehouseId = Array.isArray(id) ? id[0] : id;

    const { user, loading: authLoading } = useAuth();

    const [data, setData] = useState<WarehouseDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<WarehouseDetailTab>('movements');
    const [search, setSearch] = useState('');

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

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

            const response = await fetch(
                `/api/attachments?entity_type=product&entity_id=${encodeURIComponent(String(productId))}&perm_scope=warehouse`
            );

            if (!response.ok) {
                const responseData = await response.json().catch(() => ({}));
                throw new Error(responseData?.error || 'Ошибка загрузки вложений');
            }

            const result = (await response.json()) as AttachmentItem[];
            setAttachments(Array.isArray(result) ? result : []);
        } catch (fetchError) {
            console.error(fetchError);
            setAttachmentsError(fetchError instanceof Error ? fetchError.message : 'Ошибка загрузки вложений');
        } finally {
            setAttachmentsLoading(false);
        }
    }, [canWarehouseProductAttachmentsView]);

    const fetchData = useCallback(async () => {
        if (!warehouseId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/warehouse/${warehouseId}`);
            if (!response.ok) {
                throw new Error('Не удалось загрузить карточку складской позиции');
            }

            const result = await response.json();
            setData(result);

            if (result?.item?.товар_id && canWarehouseProductAttachmentsView) {
                await fetchAttachments(Number(result.item.товар_id));
            }
        } catch (fetchError) {
            console.error('Error fetching warehouse item details:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'Ошибка загрузки данных');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [canWarehouseProductAttachmentsView, fetchAttachments, warehouseId]);

    useEffect(() => {
        if (authLoading || !canView || !warehouseId) return;
        void fetchData();
    }, [authLoading, canView, fetchData, warehouseId]);

    useEffect(() => {
        if (authLoading) return;

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
    }, [activeTab, authLoading, canMovementsView, canPendingPurchasesView, canWaitingOrdersView]);

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

            const response = await fetch('/api/attachments', { method: 'POST', body: form });

            if (!response.ok) {
                const responseData = await response.json().catch(() => ({}));
                throw new Error(responseData?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(productId);
        } catch (uploadError) {
            console.error(uploadError);
            setAttachmentsError(uploadError instanceof Error ? uploadError.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!data?.item?.товар_id) return;
        if (!canWarehouseProductAttachmentsDelete) return;

        try {
            setAttachmentsError(null);
            const productId = Number(data.item.товар_id);
            const response = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=product&entity_id=${encodeURIComponent(String(productId))}&perm_scope=warehouse`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                const responseData = await response.json().catch(() => ({}));
                throw new Error(responseData?.error || 'Ошибка удаления вложения');
            }

            await fetchAttachments(productId);
        } catch (deleteError) {
            console.error(deleteError);
            setAttachmentsError(deleteError instanceof Error ? deleteError.message : 'Ошибка удаления вложения');
        }
    };

    const formatBytes = (bytes: number) => {
        const value = Number(bytes) || 0;
        if (value < 1024) return `${value} B`;
        const kilobytes = value / 1024;
        if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
        const megabytes = kilobytes / 1024;
        if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`;
        const gigabytes = megabytes / 1024;
        return `${gigabytes.toFixed(1)} GB`;
    };

    const canPreviewInline = (attachment: AttachmentItem) => {
        const mime = (attachment.mime_type || '').toLowerCase();
        const name = (attachment.filename || '').toLowerCase();
        if (mime.includes('pdf') || name.endsWith('.pdf')) return true;
        if (mime.startsWith('image/')) return true;
        if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return true;
        return false;
    };

    const openPreview = (attachment: AttachmentItem) => {
        if (!canPreviewInline(attachment)) {
            window.open(
                `/api/attachments/${encodeURIComponent(attachment.id)}/download?perm_scope=warehouse`,
                '_blank',
                'noopener,noreferrer'
            );
            return;
        }

        setPreviewAttachment(attachment);
        setIsPreviewOpen(true);
    };

    const getPlural = (value: number, one: string, few: string, many: string) => {
        const abs = Math.abs(value);
        const mod10 = abs % 10;
        const mod100 = abs % 100;
        if (mod100 >= 11 && mod100 <= 14) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
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

            void router.push('/warehouse');
        } catch (deleteError) {
            console.error('Error deleting product:', deleteError);
            alert('Ошибка удаления товара: ' + (deleteError instanceof Error ? deleteError.message : 'Unknown error'));
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
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
            currency: 'RUB',
        }).format(amount);
    }, []);

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

    const filteredMovements = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return movements;

        return movements.filter((movement) => (
            (movement.тип_операции || '').toLowerCase().includes(query) ||
            (movement.комментарий || '').toLowerCase().includes(query) ||
            String(movement.заявка_номер || '').includes(query) ||
            String(movement.закупка_номер || '').includes(query) ||
            String(movement.отгрузка_номер || '').includes(query)
        ));
    }, [movements, search]);

    const filteredWaitingOrders = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return waitingOrders;

        return waitingOrders.filter((order) => (
            String(order.заявка_номер || '').includes(query) ||
            (order.клиент_название || '').toLowerCase().includes(query) ||
            (order.заявка_статус || '').toLowerCase().includes(query)
        ));
    }, [search, waitingOrders]);

    const filteredPendingPurchases = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return pendingPurchases;

        return pendingPurchases.filter((purchase) => (
            String(purchase.закупка_номер || '').includes(query) ||
            (purchase.поставщик_название || '').toLowerCase().includes(query) ||
            (purchase.закупка_статус || '').toLowerCase().includes(query)
        ));
    }, [pendingPurchases, search]);

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
                        meta={(
                            <>
                                <div>Артикул: {item.товар_артикул || '—'}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        )}
                        sections={[
                            {
                                title: 'Остатки и стоимость',
                                fields: [
                                    { label: 'Текущий остаток', value: `${item.количество} ${item.товар_единица}` },
                                    { label: 'Минимальный остаток', value: `${item.товар_мин_остаток} ${item.товар_единица}` },
                                    { label: 'Статус', value: getWarehouseStockStatusLabel(item.stock_status) },
                                    {
                                        label: 'Стоимость по закупке',
                                        value: formatCurrency(item.количество * (item.товар_цена_закупки || 0)),
                                    },
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
                        meta={(
                            <>
                                <div>Движений: {movements.length}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        )}
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
                        meta={(
                            <>
                                <div>Ожидающих заявок: {waitingOrders.length}</div>
                                <div>Ожидаемых закупок: {pendingPurchases.length}</div>
                            </>
                        )}
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
        item,
        movements,
        pendingPurchases,
        productTypeLabel,
        vatLabel,
        waitingOrders,
    ]);

    const renderMovementReference = (movement: Movement) => {
        if (movement.заявка_номер && canOrdersView) {
            return (
                <EntityActionButton
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => void router.push(`/orders/${movement.заявка_номер}`)}
                >
                    Заявка #{movement.заявка_номер}
                </EntityActionButton>
            );
        }

        if (movement.закупка_номер && canPurchasesView) {
            return (
                <EntityActionButton
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => void router.push(`/purchases/${movement.закупка_номер}`)}
                >
                    Закупка #{movement.закупка_номер}
                </EntityActionButton>
            );
        }

        if (movement.отгрузка_номер && canShipmentsView) {
            return (
                <EntityActionButton
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => void router.push(`/shipments/${movement.отгрузка_номер}`)}
                >
                    Отгрузка #{movement.отгрузка_номер}
                </EntityActionButton>
            );
        }

        return <span className={styles.mutedText}>—</span>;
    };

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canView) {
        return <NoAccessPage />;
    }

    if (loading) {
        return <PageLoader label="Загрузка товара..." fullPage />;
    }

    if (!data || !item) {
        return (
            <div className={styles.container}>
                <div className={styles.errorCard}>
                    <h1 className={styles.errorTitle}>Товар не найден</h1>
                    <p className={styles.errorText}>{error || 'Не удалось загрузить карточку складской позиции'}</p>
                    <EntityActionButton type="button" onClick={() => void router.push('/warehouse')}>
                        Вернуться к складу
                    </EntityActionButton>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerCopy}>
                    <h1 className={styles.title}>{item.товар_название}</h1>
                    <p className={styles.subtitle}>
                        {item.товар_артикул ? `Артикул: ${item.товар_артикул}` : 'Карточка товара на складе'}
                    </p>
                </div>

                <div className={styles.headerActions}>
                    <EntityActionButton type="button" className={styles.actionButton} onClick={() => router.back()}>
                        <FiArrowLeft />
                        Назад
                    </EntityActionButton>

                    <RecordDocumentCenter
                        documents={warehousePrintDocuments}
                        buttonClassName={styles.actionButton}
                        saveTarget={canWarehouseProductAttachmentsUpload && item.товар_id ? {
                            entityType: 'product',
                            entityId: item.товар_id,
                            permScope: 'warehouse',
                        } : undefined}
                        onSaved={() => item.товар_id ? fetchAttachments(Number(item.товар_id)) : undefined}
                    />

                    {canEdit ? (
                        <EntityActionButton
                            type="button"
                            className={styles.actionButton}
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            <FiEdit2 />
                            Редактировать
                        </EntityActionButton>
                    ) : null}

                    {canDelete ? (
                        <EntityActionButton
                            type="button"
                            tone="danger"
                            className={styles.actionButton}
                            onClick={() => setIsDeleteModalOpen(true)}
                        >
                            <FiTrash2 />
                            Удалить
                        </EntityActionButton>
                    ) : null}
                </div>
            </header>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Статистика</h2>
                </div>

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
                        <div className={styles.statValue}>
                            {formatCurrency(item.количество * (item.товар_цена_закупки || 0))}
                        </div>
                        <div className={styles.statLabel}>Стоимость по закупке</div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{movementsCount.toLocaleString('ru-RU')}</div>
                        <div className={styles.statLabel}>
                            Движений ({getPlural(movementsCount, 'запись', 'записи', 'записей')})
                        </div>
                    </div>
                </div>

                <div className={styles.detailRows}>
                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Категория</div>
                        <div className={styles.detailValue}>
                            <span className={styles.categoryPill}>{item.товар_категория || '—'}</span>
                        </div>
                    </div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Тип номенклатуры</div>
                        <div className={styles.detailValue}>{productTypeLabel}</div>
                    </div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Ставка НДС</div>
                        <div className={styles.detailValue}>{vatLabel}</div>
                    </div>

                    {accountingAccountLabel ? (
                        <div className={styles.detailRow}>
                            <div className={styles.detailKey}>Счет учета</div>
                            <div className={styles.detailValue}>{accountingAccountLabel}</div>
                        </div>
                    ) : null}

                    {expenseAccountLabel ? (
                        <div className={styles.detailRow}>
                            <div className={styles.detailKey}>Счет затрат</div>
                            <div className={styles.detailValue}>{expenseAccountLabel}</div>
                        </div>
                    ) : null}

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Статус</div>
                        <div className={styles.detailValue}>
                            <EntityStatusBadge
                                value={item.stock_status}
                                label={getWarehouseStockStatusLabel(item.stock_status)}
                                tone={getWarehouseStockStatusTone(item.stock_status)}
                                compact
                            />
                        </div>
                    </div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Цена закупки</div>
                        <div className={styles.detailValue}>{formatCurrency(item.товар_цена_закупки || 0)}</div>
                    </div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Цена продажи</div>
                        <div className={styles.detailValue}>{formatCurrency(item.товар_цена_продажи || 0)}</div>
                    </div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Последнее поступление</div>
                        <div className={styles.detailValue}>
                            {item.дата_последнего_поступления ? formatDate(item.дата_последнего_поступления) : 'Нет данных'}
                        </div>
                    </div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailKey}>Комментарий</div>
                        <div className={styles.detailValue}>{item.товар_комментарий || '—'}</div>
                    </div>
                </div>
            </section>

            {canWarehouseProductAttachmentsView ? (
                <section className={styles.card}>
                    <div className={styles.sectionHeaderWithActions}>
                        <h2 className={styles.sectionTitle}>Документы товара</h2>

                        {canWarehouseProductAttachmentsUpload ? (
                            <div className={styles.sectionActions}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void handleUploadAttachment(file);
                                    }}
                                />
                                <EntityActionButton
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={attachmentsUploading}
                                >
                                    <FiUploadCloud />
                                    {attachmentsUploading ? 'Загрузка…' : 'Загрузить файл'}
                                </EntityActionButton>
                            </div>
                        ) : null}
                    </div>

                    {attachmentsError ? (
                        <div className={styles.inlineError}>{attachmentsError}</div>
                    ) : null}

                    {attachmentsLoading ? (
                        <div className={styles.emptyState}>Загрузка документов…</div>
                    ) : attachments.length === 0 ? (
                        <div className={styles.emptyState}>Нет прикрепленных документов</div>
                    ) : (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                            <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                                <colgroup>
                                    <col className={styles.colDocFile} />
                                    <col className={styles.colDocSize} />
                                    <col className={styles.colDocActions} />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Файл</TableHead>
                                        <TableHead className={styles.textRight}>Размер</TableHead>
                                        <TableHead className={styles.textRight}>Действия</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {attachments.map((attachment) => (
                                        <TableRow key={attachment.id}>
                                            <TableCell className={styles.tableCell}>
                                                <div className={styles.fileCell}>
                                                    <div className={styles.fileTitleRow}>
                                                        <FiPaperclip className={styles.fileIcon} />
                                                        <span className={styles.fileName}>{attachment.filename}</span>
                                                    </div>
                                                    <span className={styles.fileMeta}>{attachment.mime_type}</span>
                                                </div>
                                            </TableCell>

                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                {formatBytes(attachment.size_bytes)}
                                            </TableCell>

                                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                                <div className={styles.rowActions}>
                                                    <EntityActionButton
                                                        type="button"
                                                        className={styles.inlineAction}
                                                        onClick={() => openPreview(attachment)}
                                                    >
                                                        <FiFile />
                                                        Открыть
                                                    </EntityActionButton>

                                                    <EntityActionButton
                                                        type="button"
                                                        className={styles.inlineAction}
                                                        onClick={() => {
                                                            window.open(
                                                                `/api/attachments/${encodeURIComponent(attachment.id)}/download?perm_scope=warehouse`,
                                                                '_blank',
                                                                'noopener,noreferrer'
                                                            );
                                                        }}
                                                    >
                                                        <FiDownload />
                                                        Скачать
                                                    </EntityActionButton>

                                                    {canWarehouseProductAttachmentsDelete ? (
                                                        <EntityActionButton
                                                            type="button"
                                                            tone="danger"
                                                            className={styles.inlineAction}
                                                            onClick={() => void handleDeleteAttachment(attachment.id)}
                                                        >
                                                            <FiTrash2 />
                                                            Удалить
                                                        </EntityActionButton>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </EntityTableSurface>
                    )}
                </section>
            ) : null}

            {canShowTableSection ? (
                <section className={styles.card}>
                    <div className={styles.tabsHeader}>
                        <div className={styles.tabsList} role="tablist" aria-label="Разделы складской позиции">
                            {canMovementsView ? (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'movements'}
                                    data-active={activeTab === 'movements' ? 'true' : 'false'}
                                    className={styles.tabButton}
                                    onClick={() => setActiveTab('movements')}
                                >
                                    История движений
                                    {movementsCount > 0 ? <span className={styles.tabBadge}>{movementsCount}</span> : null}
                                </button>
                            ) : null}

                            {canWaitingOrdersView ? (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'waitingOrders'}
                                    data-active={activeTab === 'waitingOrders' ? 'true' : 'false'}
                                    className={styles.tabButton}
                                    onClick={() => setActiveTab('waitingOrders')}
                                >
                                    Ожидающие заявки
                                    {waitingCount > 0 ? <span className={styles.tabBadge}>{waitingCount}</span> : null}
                                </button>
                            ) : null}

                            {canPendingPurchasesView ? (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'pendingPurchases'}
                                    data-active={activeTab === 'pendingPurchases' ? 'true' : 'false'}
                                    className={styles.tabButton}
                                    onClick={() => setActiveTab('pendingPurchases')}
                                >
                                    Ожидаемые поступления
                                    {pendingCount > 0 ? <span className={styles.tabBadge}>{pendingCount}</span> : null}
                                </button>
                            ) : null}
                        </div>

                        <div className={styles.tableToolbar}>
                            <h2 className={styles.sectionTitle}>
                                {activeTab === 'movements'
                                    ? 'История движений'
                                    : activeTab === 'waitingOrders'
                                        ? 'Ожидающие заявки'
                                        : 'Ожидаемые поступления'}
                            </h2>

                            <DataSearchField
                                value={search}
                                onValueChange={setSearch}
                                placeholder="Поиск..."
                                wrapperClassName={styles.searchField}
                            />
                        </div>
                    </div>

                    {activeTab === 'movements' && canMovementsView ? (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                            <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                                <colgroup>
                                    <col className={styles.colMovementType} />
                                    <col className={styles.colMovementQuantity} />
                                    <col className={styles.colMovementComment} />
                                    <col className={styles.colMovementDate} />
                                    <col className={styles.colMovementDocument} />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Тип</TableHead>
                                        <TableHead>Количество</TableHead>
                                        <TableHead>Комментарий</TableHead>
                                        <TableHead>Дата</TableHead>
                                        <TableHead>Документ</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filteredMovements.length ? filteredMovements.map((movement) => (
                                        <TableRow key={movement.id}>
                                            <TableCell className={styles.tableCell}>
                                                <span className={styles.mutedText}>{movement.тип_операции}</span>
                                            </TableCell>

                                            <TableCell className={styles.tableCell}>
                                                <span
                                                    className={`${styles.movementQty} ${
                                                        isWarehouseIncomingMovement(movement.тип_операции)
                                                            ? styles.movementPositive
                                                            : styles.movementNegative
                                                    }`}
                                                >
                                                    {getWarehouseMovementSignedQuantity(movement.тип_операции, movement.количество)}
                                                </span>
                                                <span className={styles.mutedText}> {item.товар_единица}</span>
                                            </TableCell>

                                            <TableCell className={styles.tableCell}>
                                                {movement.комментарий || <span className={styles.mutedText}>—</span>}
                                            </TableCell>

                                            <TableCell className={styles.tableCell}>
                                                {formatDateTime(movement.дата_операции)}
                                            </TableCell>

                                            <TableCell className={styles.tableCell}>
                                                {renderMovementReference(movement)}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell className={styles.tableCell} colSpan={5}>
                                                <span className={styles.mutedText}>Нет движений</span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </EntityTableSurface>
                    ) : null}

                    {activeTab === 'waitingOrders' && canWaitingOrdersView ? (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                            <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                                <colgroup>
                                    <col className={styles.colOrderNumber} />
                                    <col className={styles.colOrderClient} />
                                    <col className={styles.colOrderQuantity} />
                                    <col className={styles.colOrderPrice} />
                                    <col className={styles.colOrderSum} />
                                    <col className={styles.colOrderStatus} />
                                    <col className={styles.colOrderDate} />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>№ заявки</TableHead>
                                        <TableHead>Клиент</TableHead>
                                        <TableHead>Количество</TableHead>
                                        <TableHead>Цена</TableHead>
                                        <TableHead>Сумма</TableHead>
                                        <TableHead>Статус</TableHead>
                                        <TableHead>Дата</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filteredWaitingOrders.length ? filteredWaitingOrders.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className={styles.clickableRow}
                                            onClick={() => void router.push(`/orders/${order.заявка_номер}`)}
                                        >
                                            <TableCell className={styles.tableCell}>#{order.заявка_номер}</TableCell>
                                            <TableCell className={styles.tableCell}>{order.клиент_название}</TableCell>
                                            <TableCell className={styles.tableCell}>{order.количество} {item.товар_единица}</TableCell>
                                            <TableCell className={styles.tableCell}>{formatCurrency(order.цена)}</TableCell>
                                            <TableCell className={styles.tableCell}>{formatCurrency(order.количество * order.цена)}</TableCell>
                                            <TableCell className={styles.tableCell}>
                                                <EntityStatusBadge
                                                    value={order.заявка_статус}
                                                    label={order.заявка_статус}
                                                    tone={getOrderStatusTone(order.заявка_статус)}
                                                    compact
                                                />
                                            </TableCell>
                                            <TableCell className={styles.tableCell}>{formatDate(order.заявка_дата)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell className={styles.tableCell} colSpan={7}>
                                                <span className={styles.mutedText}>Нет ожидающих заявок</span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </EntityTableSurface>
                    ) : null}

                    {activeTab === 'pendingPurchases' && canPendingPurchasesView ? (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                            <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                                <colgroup>
                                    <col className={styles.colPurchaseNumber} />
                                    <col className={styles.colPurchaseSupplier} />
                                    <col className={styles.colPurchaseQuantity} />
                                    <col className={styles.colPurchasePrice} />
                                    <col className={styles.colPurchaseSum} />
                                    <col className={styles.colPurchaseStatus} />
                                    <col className={styles.colPurchaseDate} />
                                    <col className={styles.colPurchaseEta} />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>№ закупки</TableHead>
                                        <TableHead>Поставщик</TableHead>
                                        <TableHead>Количество</TableHead>
                                        <TableHead>Цена</TableHead>
                                        <TableHead>Сумма</TableHead>
                                        <TableHead>Статус</TableHead>
                                        <TableHead>Дата</TableHead>
                                        <TableHead>Ожидаемая</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filteredPendingPurchases.length ? filteredPendingPurchases.map((purchase) => (
                                        <TableRow
                                            key={purchase.id}
                                            className={styles.clickableRow}
                                            onClick={() => void router.push(`/purchases/${purchase.закупка_номер}`)}
                                        >
                                            <TableCell className={styles.tableCell}>#{purchase.закупка_номер}</TableCell>
                                            <TableCell className={styles.tableCell}>{purchase.поставщик_название}</TableCell>
                                            <TableCell className={styles.tableCell}>{purchase.количество} {item.товар_единица}</TableCell>
                                            <TableCell className={styles.tableCell}>{formatCurrency(purchase.цена)}</TableCell>
                                            <TableCell className={styles.tableCell}>{formatCurrency(purchase.количество * purchase.цена)}</TableCell>
                                            <TableCell className={styles.tableCell}>
                                                <EntityStatusBadge
                                                    value={purchase.закупка_статус}
                                                    label={purchase.закупка_статус}
                                                    tone={getOrderStatusTone(purchase.закупка_статус)}
                                                    compact
                                                />
                                            </TableCell>
                                            <TableCell className={styles.tableCell}>{formatDate(purchase.закупка_дата)}</TableCell>
                                            <TableCell className={styles.tableCell}>
                                                {purchase.ожидаемая_дата ? formatDate(purchase.ожидаемая_дата) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell className={styles.tableCell} colSpan={8}>
                                                <span className={styles.mutedText}>Нет ожидаемых поступлений</span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </EntityTableSurface>
                    ) : null}
                </section>
            ) : null}

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className={styles.previewDialog}>
                    <div className={styles.previewHeader}>
                        <div>
                            <DialogTitle className={styles.previewTitle}>
                                {previewAttachment?.filename || 'Документ'}
                            </DialogTitle>
                            <DialogDescription className={styles.previewDescription}>
                                {previewAttachment?.mime_type || ''}
                            </DialogDescription>
                        </div>
                    </div>

                    <div className={styles.previewBody}>
                        {previewAttachment && canPreviewInline(previewAttachment) ? (
                            previewAttachment.mime_type.toLowerCase().startsWith('image/') ||
                            /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                <div className={styles.previewImageWrap}>
                                    <Image
                                        src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline?perm_scope=warehouse`}
                                        alt={previewAttachment.filename}
                                        fill
                                        unoptimized
                                        sizes="100vw"
                                        className={styles.previewImage}
                                    />
                                </div>
                            ) : (
                                <iframe
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline?perm_scope=warehouse`}
                                    className={styles.previewFrame}
                                    title={previewAttachment.filename}
                                />
                            )
                        ) : (
                            <div className={styles.emptyState}>
                                Предпросмотр недоступен для этого формата. Используй «Скачать».
                            </div>
                        )}
                    </div>

                    <div className={styles.previewActions}>
                        {previewAttachment ? (
                            <EntityActionButton
                                type="button"
                                className={styles.actionButton}
                                onClick={() => {
                                    window.open(
                                        `/api/attachments/${encodeURIComponent(previewAttachment.id)}/download?perm_scope=warehouse`,
                                        '_blank',
                                        'noopener,noreferrer'
                                    );
                                }}
                            >
                                <FiDownload />
                                Скачать
                            </EntityActionButton>
                        ) : null}

                        <EntityActionButton type="button" className={styles.actionButton} onClick={() => setIsPreviewOpen(false)}>
                            Закрыть
                        </EntityActionButton>
                    </div>
                </DialogContent>
            </Dialog>

            <EditProductModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onProductUpdated={async () => {
                    await fetchData();
                    setIsEditModalOpen(false);
                }}
                product={{
                    id: data.item.товар_id,
                    название: data.item.товар_название,
                    артикул: data.item.товар_артикул,
                    категория: data.item.товар_категория,
                    тип_номенклатуры: resolveNomenclatureType(data.item.товар_тип_номенклатуры),
                    счет_учета: data.item.товар_счет_учета,
                    счет_затрат: data.item.товар_счет_затрат,
                    ндс_id: data.item.товар_ндс_id,
                    комментарий: data.item.товар_комментарий,
                    единица_измерения: data.item.товар_единица,
                    минимальный_остаток: data.item.товар_мин_остаток,
                    цена_закупки: data.item.товар_цена_закупки,
                    цена_продажи: data.item.товар_цена_продажи,
                }}
            />

            <DeleteConfirmation
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                loading={isDeleting}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить этот товар со склада?"
                warning="Это действие нельзя отменить. Все данные товара и связанные складские записи будут удалены."
                details={(
                    <div className={deleteConfirmationStyles.positionsSection}>
                        <div className={deleteConfirmationStyles.orderTitle}>{data.item.товар_название}</div>
                        <div className={deleteConfirmationStyles.orderMeta}>
                            Артикул: {data.item.товар_артикул || '—'}
                        </div>
                        <div className={deleteConfirmationStyles.orderMeta}>
                            Остаток: {data.item.количество} {data.item.товар_единица}
                        </div>
                    </div>
                )}
            />
        </div>
    );
}

export default withLayout(WarehouseDetailPage);
