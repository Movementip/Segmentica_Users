import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './ClientDetail.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Card, Dialog, Flex, Grid, Heading, Table, Text } from '@radix-ui/themes';
import { FiArrowLeft, FiDownload, FiEdit2, FiFile, FiPaperclip, FiShoppingCart, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import EditClientModal from '../../components/EditClientModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

const MotionTableRow = motion(Table.Row);

interface Client {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    тип?: string;
    created_at: string;
}

interface Order {
    id: number;
    номер: number;
    дата_создания: string;
    статус: string;
    общая_сумма: number;
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

function ClientDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [client, setClient] = useState<Client | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

    const canView = Boolean(user?.permissions?.includes('clients.view'));
    const canEdit = Boolean(user?.permissions?.includes('clients.edit'));
    const canDelete = Boolean(user?.permissions?.includes('clients.delete'));
    const canOrdersHistory = Boolean(user?.permissions?.includes('clients.orders_history.view'));
    const canOrdersHistoryOrderView = Boolean(user?.permissions?.includes('clients.orders_history.order.view'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('clients.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('clients.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('clients.attachments.delete'));
    const canOrderView = Boolean(user?.permissions?.includes('orders.view'));

    const canViewClientOrder = canOrderView && canOrdersHistoryOrderView;

    const ordersTotal = useMemo(() => {
        return orders.reduce((acc, o) => acc + (Number(o.общая_сумма) || 0), 0);
    }, [orders]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchClientData();
        }
    }, [authLoading, canView, id]);

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

    const fetchClientData = async () => {
        try {
            setLoading(true);

            // Fetch client details
            const clientResponse = await fetch(`/api/clients?id=${id}`);
            if (!clientResponse.ok) {
                throw new Error('Ошибка загрузки данных клиента');
            }

            const clientData = await clientResponse.json();
            setClient(clientData);

            if (canAttachmentsView) {
                await fetchAttachments(Number(clientData?.id));
            } else {
                setAttachments([]);
            }

            // Fetch client orders
            if (canOrdersHistory) {
                const ordersResponse = await fetch(`/api/orders?client_id=${id}`);
                if (ordersResponse.ok) {
                    const ordersData = await ordersResponse.json();
                    setOrders(ordersData);
                }
            } else {
                setOrders([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const fetchAttachments = async (clientId: number) => {
        if (!canAttachmentsView) {
            setAttachments([]);
            return;
        }
        if (!Number.isInteger(clientId) || clientId <= 0) {
            setAttachments([]);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=client&entity_id=${encodeURIComponent(String(clientId))}`);
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
        if (!canAttachmentsView) {
            setAttachmentsError('Нет доступа');
            return;
        }
        if (!canPreviewInline(a)) {
            window.open(`/api/attachments/${encodeURIComponent(a.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const handleUploadAttachment = async (file: File) => {
        if (!client?.id) return;
        if (!canAttachmentsUpload) {
            setAttachmentsError('Нет доступа');
            return;
        }
        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'client');
            form.append('entity_id', String(client.id));

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(client.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!client?.id) return;
        if (!canAttachmentsDelete) {
            setAttachmentsError('Нет доступа');
            return;
        }
        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=client&entity_id=${encodeURIComponent(String(client.id))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(client.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const handleDeleteClient = async () => {
        if (!client) return;
        if (!canDelete) {
            setDeleteError('Нет доступа');
            return;
        }
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(`/api/clients?id=${client.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка удаления клиента');
            }

            setIsDeleteDialogOpen(false);
            router.push('/clients');
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Ошибка удаления клиента');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditClient = async (clientData: any) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            setError(null);

            const response = await fetch('/api/clients', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(clientData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления клиента');
            }

            await fetchClientData();
            setIsEditModalOpen(false);
        } catch (err) {
            console.error('Error updating client:', err);
            setError(err instanceof Error ? err.message : 'Ошибка обновления клиента');
            throw err;
        } finally {
            setOperationLoading(false);
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

    const statusBadge = (statusRaw: string) => {
        const status = (statusRaw || '').toLowerCase();
        const map: Record<string, { label: string; color: any }> = {
            'новая': { label: 'НОВАЯ', color: 'blue' },
            'в обработке': { label: 'В ОБРАБОТКЕ', color: 'orange' },
            'подтверждена': { label: 'ПОДТВЕРЖДЕНА', color: 'orange' },
            'собрана': { label: 'СОБРАНА', color: 'purple' },
            'отгружена': { label: 'ОТГРУЖЕНА', color: 'green' },
            'выполнена': { label: 'ВЫПОЛНЕНА', color: 'green' },
            'отменена': { label: 'ОТМЕНЕНА', color: 'red' },
        };
        const meta = map[status] ?? { label: statusRaw?.toUpperCase?.() ?? '-', color: 'gray' };
        const pillClass =
            meta.color === 'green'
                ? styles.statusPillGreen
                : meta.color === 'red'
                    ? styles.statusPillRed
                    : meta.color === 'orange' || meta.color === 'amber'
                        ? styles.statusPillOrange
                        : styles.statusPillBlue;
        return (
            <Badge variant="soft" color={meta.color} highContrast className={`${styles.statusPill} ${pillClass}`}>
                {meta.label}
            </Badge>
        );
    };

    const clientTypeBadge = (raw?: string) => {
        const t = (raw || '').toLowerCase();
        const isRetail = /розн/.test(t) || t === 'розничный';
        const isCorp = /корп/.test(t) || /юр/.test(t) || t === 'корпоративный';
        const color = isCorp ? 'purple' : isRetail ? 'green' : 'gray';
        return (
            <Badge variant="soft" color={color} highContrast>
                {raw || 'розничный'}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header} />
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className={styles.container}>
                <Card size="3" variant="surface">
                    <Flex direction="column" gap="3">
                        <Text as="div" size="4" weight="bold">Ошибка</Text>
                        <Text as="div" color="red" size="2">
                            {error || 'Клиент не найден'}
                        </Text>
                        <Flex>
                            <Button variant="surface" color="gray" highContrast onClick={() => router.push('/clients')}>
                                Назад к клиентам
                            </Button>
                        </Flex>
                    </Flex>
                </Card>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <Heading as="h1" size="6" className={styles.title}>
                            {client.название}
                        </Heading>
                        <Text as="div" className={styles.subtitle}>
                            Клиент #{client.id}
                        </Text>
                    </div>
                    <div className={styles.headerActions}>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={() => router.push('/clients')}
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                        >
                            <FiArrowLeft className={styles.icon} />
                            Назад
                        </Button>
                        {canEdit ? (
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => setIsEditModalOpen(true)}
                                disabled={operationLoading}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </Button>
                        ) : null}

                        {canOrdersHistory ? (
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => router.push(`/orders?client_id=${client.id}`)}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            >
                                <FiShoppingCart className={styles.icon} />
                                Заявки клиента
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                variant="surface"
                                color="red"
                                highContrast
                                onClick={() => {
                                    setDeleteError(null);
                                    setIsDeleteDialogOpen(true);
                                }}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton}`}
                                disabled={operationLoading}
                            >
                                <FiTrash2 className={styles.icon} />
                                Удалить
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>



            <Card size="3" variant="surface">
                <div className={styles.sectionHeader}>
                    <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                        Детали клиента
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Регистрация: {client.created_at ? formatDate(client.created_at) : '-'}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Box>
                                <Text as="div" className={styles.infoLabel}>ID</Text>
                                <Text as="div" className={styles.infoValue}>#{client.id}</Text>
                            </Box>
                            <Box>
                                <Text as="div" className={styles.infoLabel}>Тип клиента</Text>
                                <Box mt="1">{clientTypeBadge(client.тип)}</Box>
                            </Box>
                            <Box>
                                <Text as="div" className={styles.infoLabel}>Телефон</Text>
                                <Text as="div" className={styles.infoValue}>{client.телефон || '-'}</Text>
                            </Box>
                            <Box>
                                <Text as="div" className={styles.infoLabel}>Email</Text>
                                <Text as="div" className={styles.infoValue}>{client.email || '-'}</Text>
                            </Box>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Box>
                                <Text as="div" className={styles.infoLabel}>Адрес</Text>
                                <Text as="div" className={styles.infoValue}>{client.адрес || '-'}</Text>
                            </Box>
                            <Box>
                                <Text as="div" className={styles.infoLabel}>Заявок</Text>
                                <Text as="div" className={styles.infoValue}>{orders.length}</Text>
                            </Box>
                            <Box>
                                <Text as="div" className={styles.infoLabel}>Сумма по заявкам</Text>
                                <Text as="div" className={styles.infoValue}>{formatCurrency(ordersTotal)}</Text>
                            </Box>
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

                {canOrdersHistory ? (
                    <div className={styles.sectionBlock}>
                        <div className={styles.sectionHeaderRow}>
                            <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                                Заявки клиента
                            </Text>
                            <Text as="div" className={styles.sectionTotal}>
                                {orders.length ? `Итого: ${formatCurrency(ordersTotal)}` : ''}
                            </Text>
                        </div>

                        <div className={styles.tableWrapper}>
                            <Table.Root variant="surface">
                                <Table.Header>
                                    <Table.Row>
                                        <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Дата создания</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell className={styles.actionsCellHeader}>Действия</Table.ColumnHeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {orders.length ? (
                                        <AnimatePresence>
                                            {orders.map((order) => (
                                                <MotionTableRow
                                                    key={order.id}
                                                    style={{ cursor: 'pointer' }}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    onClick={canViewClientOrder ? () => router.push(`/orders/${order.id}`) : undefined}
                                                >
                                                    <Table.Cell>#{order.id}</Table.Cell>
                                                    <Table.Cell>{formatDateTime(order.дата_создания)}</Table.Cell>
                                                    <Table.Cell>{statusBadge(order.статус)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(order.общая_сумма)}</Table.Cell>
                                                    <Table.Cell className={styles.actionsCellRight}>
                                                        {canViewClientOrder ? (
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={styles.surfaceButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/orders/${order.id}`);
                                                                }}
                                                            >
                                                                Посмотреть заявку
                                                            </Button>
                                                        ) : null}
                                                    </Table.Cell>
                                                </MotionTableRow>
                                            ))}
                                        </AnimatePresence>
                                    ) : (
                                        <Table.Row>
                                            <Table.Cell colSpan={5}>
                                                <Text size="2" color="gray">У клиента пока нет заявок</Text>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table.Root>
                        </div>
                    </div>
                ) : null}
            </Card>

            <EditClientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditClient}
                client={client}
            />

            <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <Dialog.Content className={deleteConfirmStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить клиента?
                            </Text>

                            <Box className={deleteConfirmStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" weight="bold">Клиент #{client.id}</Text>
                                    <Text as="div" size="2" color="gray">Название: {client.название}</Text>
                                </Flex>
                            </Box>

                            <Text as="div" size="2" color="gray">
                                <Text as="span" weight="bold">Внимание:</Text> Клиента нельзя будет восстановить. Если у клиента есть заявки, удаление запрещено.
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
                                    onClick={handleDeleteClient}
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

export default withLayout(ClientDetailPage);