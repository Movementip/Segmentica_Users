import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { CreatePurchaseModal } from '../../components/CreatePurchaseModal';
import { AddProductToSupplierModalV2 } from '../../components/AddProductToSupplierModalV2';
import { ChangeSupplierRatingModal } from '../../components/ChangeSupplierRatingModal';
import { EditSupplierModal } from '../../components/EditSupplierModal';
import styles from './SupplierDetail.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Box, Button, Dialog, Card, Flex, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiArrowLeft, FiDownload, FiEdit2, FiFile, FiPaperclip, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiTruck, FiUploadCloud } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

interface SupplierProduct {
    id: number;
    товар_id: number;
    цена: number;
    срок_поставки: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

interface SupplierPurchase {
    id: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
    заявка_id?: number;
}

interface SupplierDetail {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    рейтинг: number;
    created_at: string;
    ассортимент: SupplierProduct[];
    закупки: SupplierPurchase[];
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

function SupplierDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'products' | 'purchases'>('products');
    const [search, setSearch] = useState('');

    // Modal states
    const [isCreatePurchaseModalOpen, setIsCreatePurchaseModalOpen] = useState(false);
    const [createPurchaseModalKey, setCreatePurchaseModalKey] = useState(0);
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [isChangeRatingModalOpen, setIsChangeRatingModalOpen] = useState(false);
    const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

    const canView = Boolean(user?.permissions?.includes('suppliers.view'));
    const canEdit = Boolean(user?.permissions?.includes('suppliers.edit'));
    const canDelete = Boolean(user?.permissions?.includes('suppliers.delete'));
    const canAddProduct = Boolean(user?.permissions?.includes('suppliers.assortment.add_product'));
    const canCreatePurchase = Boolean(user?.permissions?.includes('purchases.create'));
    const canCreatePurchaseFromSupplier = Boolean(user?.permissions?.includes('suppliers.purchases.create'));
    const canShowCreatePurchase = canCreatePurchase && canCreatePurchaseFromSupplier;
    const canAssortmentView = Boolean(user?.permissions?.includes('suppliers.assortment.view'));
    const canPurchasesHistoryView = Boolean(user?.permissions?.includes('suppliers.purchases_history.view'));
    const canOrdersView = Boolean(user?.permissions?.includes('orders.view'));
    const canPurchasesView = Boolean(user?.permissions?.includes('purchases.view'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('suppliers.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('suppliers.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('suppliers.attachments.delete'));

    const canShowTables = canAssortmentView || canPurchasesHistoryView;

    const fetchAttachments = useCallback(async (supplierId: number) => {
        if (!Number.isInteger(supplierId) || supplierId <= 0) {
            setAttachments([]);
            return;
        }

        if (!canAttachmentsView) {
            setAttachments([]);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=supplier&entity_id=${encodeURIComponent(String(supplierId))}`);
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
    }, [canAttachmentsView]);

    const fetchSupplierDetail = useCallback(async () => {
        try {
            setError(null);

            if (!canView) {
                setSupplier(null);
                setAttachments([]);
                return;
            }
            setLoading(true);
            const response = await fetch(`/api/suppliers/${id}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщика');
            }

            const data = await response.json();
            setSupplier(data);

            if (canAttachmentsView) {
                await fetchAttachments(Number(data?.id));
            } else {
                setAttachments([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [canAttachmentsView, canView, fetchAttachments, id]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchSupplierDetail();
        }
    }, [authLoading, canView, fetchSupplierDetail, id]);

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
        if (!supplier?.id) return;
        if (!canAttachmentsUpload) return;
        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'supplier');
            form.append('entity_id', String(supplier.id));

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(supplier.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!supplier) return;
        if (!canAttachmentsDelete) return;
        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=supplier&entity_id=${encodeURIComponent(String(supplier.id))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(supplier.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'заказано': return '#2196f3';
            case 'в пути': return '#ff9800';
            case 'получено': return '#4caf50';
            case 'отменено': return '#f44336';
            default: return '#666';
        }
    };

    const productsFiltered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!supplier) return [];
        if (!q) return supplier.ассортимент;
        return supplier.ассортимент.filter((p) => {
            return (
                String(p.товар_id).includes(q) ||
                (p.товар_название || '').toLowerCase().includes(q) ||
                (p.товар_артикул || '').toLowerCase().includes(q) ||
                (p.товар_категория || '').toLowerCase().includes(q)
            );
        });
    }, [supplier, search]);

    const purchasesFiltered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!supplier) return [];
        if (!q) return supplier.закупки;
        return supplier.закупки.filter((p) => {
            return (
                String(p.id).includes(q) ||
                String(p.заявка_id ?? '').includes(q) ||
                (p.статус || '').toLowerCase().includes(q)
            );
        });
    }, [supplier, search]);

    // Modal handlers
    const handleCreatePurchase = () => {
        if (!canShowCreatePurchase) return;
        setCreatePurchaseModalKey((prev) => prev + 1);
        setIsCreatePurchaseModalOpen(true);
    };

    const handleAddProduct = () => {
        if (!canAddProduct) return;
        setIsAddProductModalOpen(true);
    };

    const handleChangeRating = () => {
        setIsChangeRatingModalOpen(true);
    };

    const handlePurchaseCreated = () => {
        fetchSupplierDetail(); // Refresh data
        setIsCreatePurchaseModalOpen(false);
    };

    const handleProductAdded = () => {
        fetchSupplierDetail(); // Refresh data
        setIsAddProductModalOpen(false);
    };

    const handleRatingChanged = () => {
        fetchSupplierDetail(); // Refresh data
        setIsChangeRatingModalOpen(false);
    };

    const handleDeleteSupplier = async () => {
        if (!supplier) return;
        if (!canDelete) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/suppliers?id=${supplier.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка удаления поставщика');
            }
            router.push('/suppliers');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка удаления поставщика');
        } finally {
            setOperationLoading(false);
            setIsDeleteConfirmOpen(false);
        }
    };

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

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Загрузка...</h1>
                        <p className={styles.subtitle}>Загрузка поставщика</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !supplier) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={() => router.push('/suppliers')}
                        >
                            <FiArrowLeft className={styles.icon} /> Назад к поставщикам
                        </Button>
                        <h1 className={styles.title}>Ошибка</h1>
                        <p className={styles.subtitle}>{error || 'Поставщик не найден'}</p>
                    </div>
                </div>
            </div>
        );
    }

    const productsCount = supplier.ассортимент.length;
    const purchasesCount = supplier.закупки.length;
    const purchasesInTransit = supplier.закупки.filter((p) => (p.статус || '').toLowerCase() === 'в пути').length;
    const purchasesSum = supplier.закупки.reduce((sum, p) => sum + (Number(p.общая_сумма) || 0), 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.titleRow}>

                        <h1 className={styles.title}>{supplier.название}</h1>
                    </div>
                    <p className={styles.subtitle}>Карточка поставщика и история закупок</p>
                </div>

                <div className={styles.headerActions}>
                    <Button
                        type="button"
                        variant="surface"
                        color="gray"
                        highContrast
                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                        onClick={() => router.push('/suppliers')}
                    >
                        <FiArrowLeft className={styles.icon} /> Назад
                    </Button>
                    <Button
                        type="button"
                        variant="surface"
                        color="gray"
                        highContrast
                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                        onClick={fetchSupplierDetail}
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
                            onClick={() => setIsEditSupplierOpen(true)}
                        >
                            <FiEdit2 className={styles.icon} /> Редактировать
                        </Button>
                    ) : null}

                    {canAddProduct ? (
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={handleAddProduct}
                        >
                            <FiPlus className={styles.icon} /> Добавить товар
                        </Button>
                    ) : null}

                    {canShowCreatePurchase ? (
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={handleCreatePurchase}
                        >
                            <FiTruck className={styles.icon} /> Создать закупку
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
                            disabled={operationLoading}
                        >
                            <FiTrash2 className={styles.icon} /> Удалить
                        </Button>
                    ) : null}
                </div>
            </div>

            <Card className={styles.statsContainer}>
                <h2 className={styles.statsTitle}>Информация о поставщике</h2>
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{productsCount.toLocaleString('ru-RU')}</div>
                        <div className={styles.statLabel}>Позиций в ассортименте</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{purchasesCount.toLocaleString('ru-RU')}</div>
                        <div className={styles.statLabel}>Закупок (последние 20)</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{purchasesInTransit.toLocaleString('ru-RU')}</div>
                        <div className={styles.statLabel}>Закупок в пути</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{formatCurrency(purchasesSum)}</div>
                        <div className={styles.statLabel}>Сумма закупок</div>
                    </div>
                </div>

                <div className={styles.infoRow}>
                    <div className={styles.infoKey}>ID</div>
                    <div className={styles.infoVal}>#{supplier.id}</div>
                </div>
                <div className={styles.infoRow}>
                    <div className={styles.infoKey}>Дата регистрации</div>
                    <div className={styles.infoVal}>{formatDate(supplier.created_at)}</div>
                </div>
                <div className={styles.infoRow}>
                    <div className={styles.infoKey}>Телефон</div>
                    <div className={styles.infoVal}>{supplier.телефон || '—'}</div>
                </div>
                <div className={styles.infoRow}>
                    <div className={styles.infoKey}>Email</div>
                    <div className={styles.infoVal}>{supplier.email || '—'}</div>
                </div>
                <div className={styles.infoRow}>
                    <div className={styles.infoKey}>Рейтинг</div>
                    <div className={styles.infoVal}>
                        <span className={`${styles.badge} ${supplier.рейтинг >= 4 ? styles.badgeSuccess : styles.badgeWarn}`}>{supplier.рейтинг} / 5</span>
                    </div>
                </div>
            </Card>

            <div className={styles.tableSection}>
                {canAttachmentsView ? (
                    <div className={`${styles.sectionBlock} ${styles.sectionBlockNoTop}`}>
                        <div className={styles.sectionHeaderRow}>
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Документы
                            </Text>
                            {canAttachmentsUpload ? (
                                <div className={styles.buttonGroup}>
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
                                </div>
                            ) : null}
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
                                                        {canAttachmentsDelete ? (
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
                ) : null}

                <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <Dialog.Content style={{ maxWidth: 980, width: '95vw' }}>
                        <Dialog.Title>{previewAttachment?.filename || 'Документ'}</Dialog.Title>
                        <Dialog.Description>{previewAttachment?.mime_type || ''}</Dialog.Description>

                        <Box style={{ marginTop: 12 }}>
                            {previewAttachment && canPreviewInline(previewAttachment) ? (
                                previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                    <img
                                        src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                        alt={previewAttachment.filename}
                                        style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }}
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

                {canShowTables ? (
                    <Tabs.Root
                        className={styles.TabsRoot}
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as any)}
                    >
                        <Tabs.List className={styles.tabsList}>
                            {canAssortmentView ? (
                                <Tabs.Trigger value="products">
                                    Ассортимент
                                    {productsCount > 0 ? <span className={styles.tabBadge}>{productsCount}</span> : null}
                                </Tabs.Trigger>
                            ) : null}
                            {canPurchasesHistoryView ? (
                                <Tabs.Trigger value="purchases">
                                    История закупок
                                    {purchasesCount > 0 ? <span className={styles.tabBadge}>{purchasesCount}</span> : null}
                                </Tabs.Trigger>
                            ) : null}
                        </Tabs.List>

                        <div className={styles.tableHeader}>
                            <div>
                                <h2 className={styles.sectionTitle}>
                                    {activeTab === 'products' ? 'Ассортимент товаров' : 'История закупок'}
                                </h2>
                                {activeTab === 'purchases' ? (
                                    <Text size="2" color="gray">Нажмите на закупку для просмотра подробностей</Text>
                                ) : null}
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

                        {canAssortmentView ? (
                            <Tabs.Content value="products">
                                <div className={styles.tableContainer}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Артикул</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Категория</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell className={styles.textRight}>Цена</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Срок поставки</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {productsFiltered.length ? productsFiltered.map((product) => (
                                                <Table.Row key={product.id} className={styles.tableRow}>
                                                    <Table.Cell>
                                                        <span className={styles.itemTitle}>{product.товар_артикул}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className={styles.itemTitle}>{product.товар_название}</div>
                                                        <Text as="div" size="1" color="gray">ID: {product.товар_id}</Text>
                                                    </Table.Cell>
                                                    <Table.Cell>{product.товар_категория || '—'}</Table.Cell>
                                                    <Table.Cell className={styles.textRight}>
                                                        <span className={styles.itemTitle}>{formatCurrency(product.цена)}</span>
                                                        <span className={styles.muted}> / {product.товар_единица_измерения}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span className={`${styles.statusPill} ${product.срок_поставки <= 3 ? styles.badgeSuccess : styles.badgeWarn}`}>{product.срок_поставки} дн.</span>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )) : (
                                                <Table.Row>
                                                    <Table.Cell colSpan={5}>
                                                        <Text size="2" color="gray">Нет товаров в ассортименте</Text>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </Tabs.Content>
                        ) : null}

                        {canPurchasesHistoryView ? (
                            <Tabs.Content value="purchases">
                                <div className={styles.tableContainer}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Дата заказа</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Дата поступления</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell className={styles.textRight}>Сумма</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Заявка</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {purchasesFiltered.length ? purchasesFiltered.map((purchase) => (
                                                <Table.Row
                                                    key={purchase.id}
                                                    className={styles.tableRow}
                                                    onClick={() => {
                                                        if (!canPurchasesView) return;
                                                        router.push(`/purchases/${purchase.id}`);
                                                    }}
                                                >
                                                    <Table.Cell>
                                                        <span className={styles.itemTitle}>#{purchase.id}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>{formatDate(purchase.дата_заказа)}</Table.Cell>
                                                    <Table.Cell>{purchase.дата_поступления ? formatDate(purchase.дата_поступления) : <span className={styles.muted}>—</span>}</Table.Cell>
                                                    <Table.Cell>
                                                        <span className={styles.statusPill} style={{ backgroundColor: getStatusColor(purchase.статус) + '15', color: getStatusColor(purchase.статус), borderColor: getStatusColor(purchase.статус) + '40' }}>
                                                            {purchase.статус}
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.textRight}>
                                                        <span className={styles.itemTitle}>{formatCurrency(purchase.общая_сумма)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {purchase.заявка_id ? (
                                                            canOrdersView ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="surface"
                                                                    color="gray"
                                                                    highContrast
                                                                    className={styles.surfaceButton}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        router.push(`/orders/${purchase.заявка_id}`);
                                                                    }}
                                                                >
                                                                    #{purchase.заявка_id}
                                                                </Button>
                                                            ) : (
                                                                <span className={styles.muted}>—</span>
                                                            )
                                                        ) : (
                                                            <span className={styles.muted}>—</span>
                                                        )}
                                                    </Table.Cell>
                                                </Table.Row>
                                            )) : (
                                                <Table.Row>
                                                    <Table.Cell colSpan={6}>
                                                        <Text size="2" color="gray">Закупок нет</Text>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </Tabs.Content>
                        ) : null}
                    </Tabs.Root>
                ) : null}
            </div>

            {supplier ? (
                <>
                    {canEdit ? (
                        <EditSupplierModal
                            isOpen={isEditSupplierOpen}
                            onClose={() => setIsEditSupplierOpen(false)}
                            onUpdated={fetchSupplierDetail}
                            supplier={{
                                id: supplier.id,
                                название: supplier.название,
                                телефон: supplier.телефон,
                                email: supplier.email,
                                рейтинг: supplier.рейтинг,
                            }}
                        />
                    ) : null}

                    {canShowCreatePurchase ? (
                        <CreatePurchaseModal
                            key={`supplier-detail-purchase-${createPurchaseModalKey}`}
                            isOpen={isCreatePurchaseModalOpen}
                            onClose={() => setIsCreatePurchaseModalOpen(false)}
                            onPurchaseCreated={handlePurchaseCreated}
                            поставщик_id={supplier.id}
                            поставщик_название={supplier.название}
                        />
                    ) : null}

                    {canAddProduct ? (
                        <AddProductToSupplierModalV2
                            isOpen={isAddProductModalOpen}
                            onClose={() => setIsAddProductModalOpen(false)}
                            onProductAdded={handleProductAdded}
                            поставщик_id={supplier.id}
                            поставщик_название={supplier.название}
                        />
                    ) : null}

                    <ChangeSupplierRatingModal
                        isOpen={isChangeRatingModalOpen}
                        onClose={() => setIsChangeRatingModalOpen(false)}
                        onRatingChanged={handleRatingChanged}
                        поставщик_id={supplier.id}
                        поставщик_название={supplier.название}
                        текущий_рейтинг={supplier.рейтинг}
                    />

                    {canDelete ? (
                        <Dialog.Root open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                            <Dialog.Content className={deleteConfirmStyles.modalContent}>
                                <Dialog.Title>Подтверждение удаления</Dialog.Title>
                                <Box className={deleteConfirmStyles.form}>
                                    <Flex direction="column" gap="3">
                                        <Text as="div" size="2" color="gray">
                                            Вы уверены, что хотите удалить поставщика? Это действие нельзя отменить.
                                        </Text>

                                        <Box className={deleteConfirmStyles.positionsSection}>
                                            <Flex direction="column" gap="1">
                                                <Text as="div" weight="bold">{supplier.название}</Text>
                                                {supplier.телефон ? (
                                                    <Text as="div" size="2" color="gray">Телефон: {supplier.телефон}</Text>
                                                ) : null}
                                                {supplier.email ? (
                                                    <Text as="div" size="2" color="gray">Email: {supplier.email}</Text>
                                                ) : null}
                                            </Flex>
                                        </Box>

                                        <Flex justify="end" gap="3" mt="4" className={deleteConfirmStyles.modalActions}>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => setIsDeleteConfirmOpen(false)}
                                                disabled={operationLoading}
                                            >
                                                Отмена
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="red"
                                                highContrast
                                                className={deleteConfirmStyles.modalDeleteButton}
                                                onClick={handleDeleteSupplier}
                                                disabled={operationLoading}
                                            >
                                                {operationLoading ? 'Удаление...' : 'Удалить'}
                                            </Button>
                                        </Flex>
                                    </Flex>
                                </Box>
                            </Dialog.Content>
                        </Dialog.Root>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

export default withLayout(SupplierDetailPage);
