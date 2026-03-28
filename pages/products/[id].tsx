import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { EditProductModal } from '../../components/EditProductModal';
import { usePageTitle } from '../../context/PageTitleContext';
import styles from './ProductDetail.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Box, Button, Card, Dialog, Flex, Grid, Separator, Table, Text } from '@radix-ui/themes';
import { FiArrowLeft, FiDownload, FiEdit2, FiFile, FiPaperclip, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

interface ProductPriceHistory {
    id: number;
    товар_id: number;
    цена_закупки?: number;
    цена_продажи?: number;
    изменено_в: string;
    источник?: string;
    комментарий?: string;
}

interface ProductDetail {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    цена_закупки?: number;
    цена_продажи: number;
    единица_измерения: string;
    минимальный_остаток: number;
    created_at: string;
    категория_id?: number;
    история_цен?: ProductPriceHistory[];
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

function ProductDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const { setPageTitle } = usePageTitle();
    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

    const canView = Boolean(user?.permissions?.includes('products.view'));
    const canEdit = Boolean(user?.permissions?.includes('products.edit'));
    const canDelete = Boolean(user?.permissions?.includes('products.delete'));
    const canPriceHistoryView = Boolean(user?.permissions?.includes('products.price_history.view'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('products.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('products.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('products.attachments.delete'));

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchProductDetail();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, canView, id]);

    useEffect(() => {
        if (!product?.название) return;
        setPageTitle(product.название);
    }, [product?.название, setPageTitle]);

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

    const fetchProductDetail = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/products?id=${id}${canPriceHistoryView ? '&include_price_history=1' : ''}`
            );

            if (!response.ok) {
                throw new Error('Ошибка загрузки товара');
            }

            const data = await response.json();
            setProduct(data);
            if (data?.id) {
                if (canAttachmentsView) {
                    await fetchAttachments(Number(data.id));
                } else {
                    setAttachments([]);
                    setAttachmentsError(null);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const fetchAttachments = async (productId: number) => {
        if (!canAttachmentsView) {
            setAttachments([]);
            setAttachmentsError(null);
            setAttachmentsLoading(false);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=product&entity_id=${encodeURIComponent(String(productId))}`);
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
            window.open(`/api/attachments/${encodeURIComponent(a.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const handlePickFile = () => {
        if (!canAttachmentsUpload) return;
        fileInputRef.current?.click();
    };

    const handleUploadFile = async (file: File) => {
        if (!product) return;
        if (!canAttachmentsUpload) return;
        try {
            setUploadLoading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('entity_type', 'product');
            form.append('entity_id', String(product.id));
            form.append('file', file);

            const res = await fetch('/api/attachments', {
                method: 'POST',
                body: form,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(product.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!product) return;
        if (!canAttachmentsDelete) return;
        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=product&entity_id=${encodeURIComponent(String(product.id))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(product.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU', {
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

    const goBack = () => {
        router.push('/products');
    };

    const handleProductUpdated = async () => {
        setIsEditModalOpen(false);
        await fetchProductDetail();
    };

    const handleDelete = async () => {
        if (!product) return;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(`/api/products?id=${product.id}`, {
                method: 'DELETE',
            });

            const errorData = await response.json().catch(() => ({} as any));

            if (!response.ok) {
                throw new Error(errorData?.error || 'Ошибка удаления товара');
            }

            setIsDeleteDialogOpen(false);
            router.push('/products');
        } catch (err) {
            console.error('Error deleting product:', err);
            setDeleteError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.title}>Загрузка товара...</h1>
                            <p className={styles.subtitle}>Пожалуйста, подождите...</p>
                        </div>
                    </div>
                </div>
                <div className={styles.loading}>
                    <FiRefreshCw className={styles.spinner} />
                    <span>Загрузка данных товара...</span>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.title}>Ошибка</h1>
                            <p className={styles.subtitle}>Не удалось загрузить карточку товара</p>
                        </div>
                    </div>
                </div>
                <div className={styles.error}>
                    <span>{error || 'Товар не найден'}</span>
                    <Button type="button" className={styles.primaryButton} onClick={goBack}>
                        Вернуться к товарам
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>{product.название}</h1>
                        <p className={styles.subtitle}>Карточка товара и история цен</p>
                    </div>
                    <div className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            onClick={goBack}
                        >
                            <FiArrowLeft className={styles.icon} />
                            Назад
                        </Button>
                        {canEdit ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                onClick={() => setIsEditModalOpen(true)}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="red"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                onClick={() => {
                                    setDeleteError(null);
                                    setIsDeleteDialogOpen(true);
                                }}
                            >
                                <FiTrash2 className={styles.icon} /> Удалить
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.sectionHeader}>
                    <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                        Детали товара
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Товар зарегистрирован {formatDate(product.created_at)}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4" style={{ padding: '0 0 20px' }}>
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="2">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Основная информация
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Название</Text>
                                    <Text as="div" size="2" weight="medium">{product.название}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Артикул</Text>
                                    <Text as="div" size="2">{product.артикул}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата регистрации</Text>
                                    <Text as="div" size="2">{formatDate(product.created_at)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Категория</Text>
                                    <Text as="div" size="2">{product.категория || 'Не указана'}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="2">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Параметры и цены
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Цена продажи</Text>
                                    <Text as="div" size="2" weight="medium">{formatCurrency(product.цена_продажи)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Цена закупки</Text>
                                    <Text as="div" size="2">{product.цена_закупки !== undefined ? formatCurrency(product.цена_закупки) : 'Не указана'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Единица измерения</Text>
                                    <Text as="div" size="2">{product.единица_измерения}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Минимальный остаток</Text>
                                    <Text as="div" size="2">{product.минимальный_остаток} {product.единица_измерения}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>

                {canAttachmentsView ? (
                    <div className={styles.sectionBlock}>
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
                                            if (f) void handleUploadFile(f);
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        onClick={handlePickFile}
                                        disabled={uploadLoading}
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    >
                                        <FiUploadCloud className={styles.icon} />
                                        {uploadLoading ? 'Загрузка…' : 'Загрузить файл'}
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        {canAttachmentsView && attachmentsError ? (
                            <Text as="div" size="2" color="red" style={{ marginLeft: 16 }}>
                                {attachmentsError}
                            </Text>
                        ) : null}

                        {canAttachmentsView && attachmentsLoading ? (
                            <Text as="div" size="2" color="gray" style={{ marginLeft: 16 }}>
                                Загрузка документов…
                            </Text>
                        ) : canAttachmentsView && attachments.length === 0 ? (
                            <Text as="div" size="2" color="gray" style={{ marginLeft: 16 }}>
                                Нет прикрепленных документов
                            </Text>
                        ) : canAttachmentsView ? (
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
                                                        <Text as="div" size="2" weight="medium">{a.filename}</Text>
                                                    </Flex>
                                                    <Text as="div" size="1" color="gray">{a.mime_type}</Text>
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
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="red"
                                                            highContrast
                                                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                                            onClick={() => void handleDeleteAttachment(a.id)}
                                                            style={!canAttachmentsDelete ? { display: 'none' } : undefined}
                                                        >
                                                            <FiTrash2 className={styles.icon} />
                                                            Удалить
                                                        </Button>
                                                    </Flex>
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            </Box>
                        ) : null}
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
                            {previewAttachment && canAttachmentsView ? (
                                <a
                                    href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Button variant="surface" color="gray" highContrast>
                                        <FiDownload className={styles.icon} />
                                        Скачать
                                    </Button>
                                </a>
                            ) : null}
                            <Dialog.Close>
                                <Button variant="surface" color="gray" highContrast>
                                    Закрыть
                                </Button>
                            </Dialog.Close>
                        </Flex>
                    </Dialog.Content>
                </Dialog.Root>

                {canPriceHistoryView ? (
                    <div id="price-history" className={styles.sectionBlock}>
                        <div className={styles.sectionHeaderRow}>
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                История цен
                            </Text>
                        </div>
                        {product.история_цен && product.история_цен.length > 0 ? (
                            <div className={styles.tableWrapper}>
                                <Table.Root variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Цена закупки</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.textRight}>Цена продажи</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Источник</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Комментарий</Table.ColumnHeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {product.история_цен.map((entry) => (
                                            <Table.Row key={entry.id} className={styles.tableRow}>
                                                <Table.Cell>{formatDateTime(entry.изменено_в)}</Table.Cell>
                                                <Table.Cell align="right">{entry.цена_закупки !== undefined ? formatCurrency(entry.цена_закупки) : '—'}</Table.Cell>
                                                <Table.Cell align="right">{entry.цена_продажи !== undefined ? formatCurrency(entry.цена_продажи) : '—'}</Table.Cell>
                                                <Table.Cell>{entry.источник || '—'}</Table.Cell>
                                                <Table.Cell>{entry.комментарий || '—'}</Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            </div>
                        ) : (
                            <div className={styles.noData}>История цен пока отсутствует.</div>
                        )}
                    </div>
                ) : null}
            </div>

            <EditProductModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onProductUpdated={handleProductUpdated}
                product={product}
            />

            <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <Dialog.Content className={deleteConfirmStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить товар?
                            </Text>

                            <Box className={deleteConfirmStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" weight="bold">Товар #{product.id}</Text>
                                    <Text as="div" size="2" color="gray">Название: {product.название}</Text>
                                </Flex>
                            </Box>

                            <Text as="div" size="2" color="gray">
                                <Text as="span" weight="bold">Внимание:</Text> Это действие нельзя отменить.
                            </Text>

                            {deleteError ? (
                                <Box mt="3">
                                    <Text as="div" color="red" size="2">
                                        {deleteError}
                                    </Text>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    disabled={isDeleting}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmStyles.modalDeleteButton}
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(ProductDetailPage);