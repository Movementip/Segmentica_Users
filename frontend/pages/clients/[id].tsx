import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
    FiArrowLeft,
    FiDownload,
    FiEdit2,
    FiFile,
    FiPaperclip,
    FiShoppingCart,
    FiTrash2,
    FiUploadCloud,
} from 'react-icons/fi';

import { ClientTypeBadge } from '../../components/clients/ClientTypeBadge/ClientTypeBadge';
import { EntityActionButton } from '../../components/EntityActionButton/EntityActionButton';
import { EntityStatusBadge } from '../../components/EntityStatusBadge/EntityStatusBadge';
import { EntityTableSurface, entityTableClassName } from '../../components/EntityDataTable/EntityDataTable';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import EditClientModal from '../../components/modals/EditClientModal/EditClientModal';
import { RecordDocumentCenter, RecordPrintSheet, type RecordPrintDocument } from '../../components/print/RecordDocumentCenter';
import { useAuth } from '../../hooks/use-auth';
import { withLayout } from '../../layout/Layout';
import {
    getClientContragentTypeLabel,
    normalizeClientContragentType,
    type ClientContragent,
} from '../../lib/clientContragents';
import type { AttachmentItem } from '../../types/attachments';
import styles from './ClientDetail.module.css';

type Client = ClientContragent;

interface Order {
    id: number;
    номер: number;
    дата_создания: string;
    статус: string;
    общая_сумма: number;
}

function InfoItem({
    label,
    value,
    className,
}: {
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <div className={styles.infoLabel}>{label}</div>
            <div className={styles.infoValue}>{value}</div>
        </div>
    );
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

    const ordersTotal = useMemo(
        () => orders.reduce((acc, order) => acc + (Number(order.общая_сумма) || 0), 0),
        [orders]
    );

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            void fetchClientData();
        }
    }, [authLoading, canView, id]);

    const fetchClientData = async () => {
        try {
            setLoading(true);

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

            if (canOrdersHistory) {
                const ordersResponse = await fetch(`/api/orders?client_id=${id}`);
                if (ordersResponse.ok) {
                    const ordersData = await ordersResponse.json();
                    setOrders(Array.isArray(ordersData) ? ordersData : []);
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
        const value = Number(bytes) || 0;
        if (value < 1024) return `${value} B`;
        const kb = value / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(1)} GB`;
    };

    const canPreviewInline = (attachment: AttachmentItem) => {
        const mime = (attachment.mime_type || '').toLowerCase();
        const name = (attachment.filename || '').toLowerCase();
        if (mime.includes('pdf') || name.endsWith('.pdf')) return true;
        if (mime.startsWith('image/')) return true;
        return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name);
    };

    const openPreview = (attachment: AttachmentItem) => {
        if (!canAttachmentsView) {
            setAttachmentsError('Нет доступа');
            return;
        }
        if (!canPreviewInline(attachment)) {
            window.open(`/api/attachments/${encodeURIComponent(attachment.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(attachment);
        setIsPreviewOpen(true);
    };

    const handlePreviewOpenChange = (open: boolean) => {
        setIsPreviewOpen(open);
        if (!open) {
            setPreviewAttachment(null);
        }
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
            void router.push('/clients');
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
                headers: { 'Content-Type': 'application/json' },
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

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    const formatCurrency = (amount: number) => new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
    }).format(amount);

    const formatTextValue = (value?: string | null) => {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || 'Не указан';
    };

    const getClientIdentity = (value: Client) => {
        const type = normalizeClientContragentType(value.тип);
        if (type === 'Организация') {
            return {
                label: 'Полное название',
                value: formatTextValue(value.полноеНазвание || value.краткоеНазвание || value.название),
            };
        }
        if (type === 'Иностранный контрагент') {
            return {
                label: 'Название',
                value: formatTextValue(value.название),
            };
        }

        const fullName = [value.фамилия, value.имя, value.отчество]
            .map((item) => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)
            .join(' ');

        return {
            label: 'ФИО',
            value: fullName || formatTextValue(value.название),
        };
    };

    const getRegistrationLabel = (value: Client) => {
        const type = normalizeClientContragentType(value.тип);
        if (type === 'Организация') return 'Адрес по ЕГРЮЛ';
        if (type === 'Индивидуальный предприниматель') return 'Адрес по ЕГРИП';
        return 'Адрес по ФИАС';
    };

    const clientPrintDocuments: RecordPrintDocument[] = (() => {
        if (!client) return [];

        const identity = getClientIdentity(client);
        const normalizedType = normalizeClientContragentType(client.тип);
        const bankAccounts = client.bankAccounts || [];
        const latestOrderDate = orders.length
            ? orders
                .map((order) => new Date(order.дата_создания).getTime())
                .filter((value) => Number.isFinite(value))
                .sort((a, b) => b - a)[0]
            : null;

        const documents: RecordPrintDocument[] = [
            {
                key: 'client-card',
                title: 'Карточка клиента',
                fileName: `Карточка клиента № ${client.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Карточка клиента #${client.id}`}
                        subtitle={client.название}
                        meta={
                            <>
                                <div>Тип: {getClientContragentTypeLabel(client.тип)}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Основные реквизиты',
                                fields: [
                                    { label: 'ID', value: `#${client.id}` },
                                    { label: 'Тип клиента', value: getClientContragentTypeLabel(client.тип) },
                                    { label: identity.label, value: identity.value },
                                    { label: 'Краткое название', value: formatTextValue(client.краткоеНазвание || client.название) },
                                    { label: 'ИНН', value: formatTextValue(client.инн) },
                                    { label: 'КПП', value: formatTextValue(client.кпп) },
                                    {
                                        label: normalizedType === 'Организация' ? 'ОГРН' : 'ОГРНИП',
                                        value: formatTextValue(client.огрн || client.огрнип),
                                    },
                                    { label: 'ОКПО', value: formatTextValue(client.окпо) },
                                ],
                            },
                            {
                                title: 'Контакты и адреса',
                                fields: [
                                    { label: 'Телефон', value: formatTextValue(client.телефон) },
                                    { label: 'Email', value: formatTextValue(client.email) },
                                    { label: getRegistrationLabel(client), value: formatTextValue(client.адресРегистрации) },
                                    { label: 'Адрес для документов', value: formatTextValue(client.адресПечати || client.адрес) },
                                    { label: 'Комментарий', value: formatTextValue(client.комментарий) },
                                    {
                                        label: 'Паспорт',
                                        value: normalizedType === 'Физическое лицо'
                                            ? ([
                                                client.паспортСерия && `серия ${client.паспортСерия}`,
                                                client.паспортНомер && `номер ${client.паспортНомер}`,
                                                client.паспортДатаВыдачи && `от ${formatDate(client.паспортДатаВыдачи)}`,
                                            ].filter(Boolean).join(', ') || '—')
                                            : '—',
                                    },
                                ],
                            },
                            bankAccounts.length
                                ? {
                                    title: 'Банковские реквизиты',
                                    table: {
                                        columns: ['Счет', 'Банк', 'БИК', 'Расчетный счет', 'Корр. счет'],
                                        rows: bankAccounts.map((account) => [
                                            `${account.name}${account.isPrimary ? ' (основной)' : ''}`,
                                            account.bankName || '—',
                                            account.bik || '—',
                                            account.settlementAccount || '—',
                                            account.correspondentAccount || '—',
                                        ]),
                                    },
                                }
                                : {
                                    title: 'Банковские реквизиты',
                                    note: 'Банковские реквизиты для клиента еще не заполнены.',
                                },
                        ]}
                    />
                ),
            },
        ];

        if (orders.length) {
            documents.push({
                key: 'client-orders',
                title: 'История заявок клиента',
                fileName: `История заявок клиента № ${client.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`История заявок клиента #${client.id}`}
                        subtitle={client.название}
                        meta={
                            <>
                                <div>Заявок: {orders.length}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Сводка',
                                fields: [
                                    { label: 'Количество заявок', value: orders.length },
                                    { label: 'Сумма по заявкам', value: formatCurrency(ordersTotal) },
                                    {
                                        label: 'Последняя заявка',
                                        value: latestOrderDate ? new Date(latestOrderDate).toLocaleString('ru-RU') : '—',
                                    },
                                ],
                                columns: 1,
                            },
                            {
                                title: 'Заявки',
                                table: {
                                    columns: ['№ заявки', 'Дата создания', 'Статус', 'Сумма'],
                                    rows: orders.map((order) => [
                                        `#${order.номер}`,
                                        formatDateTime(order.дата_создания),
                                        order.статус || '—',
                                        formatCurrency(order.общая_сумма || 0),
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

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canView) {
        return <NoAccessPage />;
    }

    if (loading) {
        return <PageLoader label="Загрузка контрагента..." fullPage />;
    }

    if (error || !client) {
        return (
            <div className={styles.container}>
                <div className={styles.errorCard}>
                    <div className={styles.errorTitle}>Ошибка</div>
                    <div className={styles.errorMessage}>{error || 'Клиент не найден'}</div>
                    <EntityActionButton type="button" onClick={() => router.push('/clients')}>
                        Назад к клиентам
                    </EntityActionButton>
                </div>
            </div>
        );
    }

    const identity = getClientIdentity(client);
    const normalizedType = normalizeClientContragentType(client.тип);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>{client.название}</h1>
                    <p className={styles.subtitle}>Клиент #{client.id}</p>
                </div>

                <div className={styles.headerActions}>
                    <EntityActionButton type="button" onClick={() => router.push('/clients')} className={styles.actionButton}>
                        <FiArrowLeft />
                        Назад
                    </EntityActionButton>

                    <RecordDocumentCenter
                        documents={clientPrintDocuments}
                        buttonClassName={styles.actionButton}
                        saveTarget={canAttachmentsUpload ? { entityType: 'client', entityId: client.id } : undefined}
                        onSaved={() => fetchAttachments(Number(client.id))}
                    />

                    {canEdit ? (
                        <EntityActionButton
                            type="button"
                            onClick={() => setIsEditModalOpen(true)}
                            disabled={operationLoading}
                            className={styles.actionButton}
                        >
                            <FiEdit2 />
                            Редактировать
                        </EntityActionButton>
                    ) : null}

                    {canOrdersHistory ? (
                        <EntityActionButton
                            type="button"
                            onClick={() => router.push(`/orders?client_id=${client.id}`)}
                            className={styles.actionButton}
                        >
                            <FiShoppingCart />
                            Заявки клиента
                        </EntityActionButton>
                    ) : null}

                    {canDelete ? (
                        <EntityActionButton
                            type="button"
                            tone="danger"
                            onClick={() => {
                                setDeleteError(null);
                                setIsDeleteDialogOpen(true);
                            }}
                            className={styles.actionButton}
                            disabled={operationLoading}
                        >
                            <FiTrash2 />
                            Удалить
                        </EntityActionButton>
                    ) : null}
                </div>
            </header>

            <section className={styles.panel}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>Карточка контрагента</div>
                    <div className={styles.sectionMeta}>
                        Регистрация: {client.created_at ? formatDate(client.created_at) : 'Не указана'}
                    </div>
                </div>

                <div className={styles.detailsGrid}>
                    <div className={styles.detailsColumn}>
                        <InfoItem label="Клиент" value={formatTextValue(client.название)} />
                        <InfoItem label="Тип клиента" value={<ClientTypeBadge value={client.тип} />} />
                        <InfoItem label={identity.label} value={identity.value} />
                        <InfoItem label="Краткое название" value={formatTextValue(client.краткоеНазвание || client.название)} />
                        <InfoItem label="Телефон" value={formatTextValue(client.телефон)} />
                        <InfoItem label="Email" value={formatTextValue(client.email)} />
                        <InfoItem label="Адрес" value={formatTextValue(client.адрес)} />
                    </div>

                    <div className={styles.detailsColumn}>
                        <InfoItem label="ID" value={`#${client.id}`} />
                        <InfoItem
                            label="Регистрация"
                            value={client.created_at ? formatDate(client.created_at) : 'Не указана'}
                        />
                        <InfoItem
                            label="ИНН / КПП"
                            value={`${formatTextValue(client.инн)} / ${formatTextValue(client.кпп)}`}
                        />
                        <InfoItem
                            label={normalizedType === 'Организация' ? 'ОГРН / ОГРНИП' : 'ОГРНИП'}
                            value={
                                normalizedType === 'Организация'
                                    ? `${formatTextValue(client.огрн)} / ${formatTextValue(client.огрнип)}`
                                    : formatTextValue(client.огрнип || client.огрн)
                            }
                        />
                        <InfoItem label="ОКПО" value={formatTextValue(client.окпо)} />
                        <InfoItem label="Заявок" value={orders.length} />
                        <InfoItem label="Сумма по заявкам" value={formatCurrency(ordersTotal)} />
                        <InfoItem label={getRegistrationLabel(client)} value={formatTextValue(client.адресРегистрации)} />
                        <InfoItem label="Адрес для документов" value={formatTextValue(client.адресПечати || client.адрес)} />
                        <InfoItem label="Комментарий" value={formatTextValue(client.комментарий)} />
                        {normalizedType === 'Физическое лицо' ? (
                            <InfoItem
                                label="Паспорт"
                                value={
                                    [
                                        client.паспортСерия && `серия ${client.паспортСерия}`,
                                        client.паспортНомер && `номер ${client.паспортНомер}`,
                                        client.паспортДатаВыдачи && `от ${formatDate(client.паспортДатаВыдачи)}`,
                                    ].filter(Boolean).join(', ') || 'Не указан'
                                }
                            />
                        ) : null}

                    </div>

                    {client.bankAccounts?.length ? (
                        <div className={styles.detailsColumn}>
                            <div className={styles.inlineSectionTitle}>Расчетные счета</div>
                            <div className={styles.bankAccountsList}>
                                {client.bankAccounts.map((account, index) => (
                                    <div key={`${account.id || 'bank'}-${index}`} className={styles.bankAccount}>
                                        <div className={styles.bankAccountHeader}>
                                            <div className={styles.bankAccountTitle}>
                                                {formatTextValue(account.name)}
                                            </div>
                                            <div className={styles.bankAccountMeta}>
                                                {account.isPrimary ? 'Основной счет' : 'Дополнительный счет'}
                                            </div>
                                        </div>
                                        <div className={styles.bankAccountGrid}>
                                            <div className={styles.bankAccountColumn}>
                                                <InfoItem label="Банк" value={formatTextValue(account.bankName)} />
                                                <InfoItem label="БИК" value={formatTextValue(account.bik)} />
                                            </div>
                                            <div className={styles.bankAccountColumn}>
                                                <InfoItem label="Расчетный счет" value={formatTextValue(account.settlementAccount)} />
                                                <InfoItem label="Корреспондентский счет" value={formatTextValue(account.correspondentAccount)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.detailsColumn}>
                            <div className={styles.inlineSectionTitle}>Расчетные счета</div>
                            <div className={styles.emptyState}>Банковские реквизиты не заполнены</div>
                        </div>
                    )}
                </div>

                {canAttachmentsView ? (
                    <div className={styles.sectionBlock}>
                        <div className={styles.sectionHeaderRow}>
                            <div className={styles.sectionSubTitle}>Документы</div>
                            {canAttachmentsUpload ? (
                                <div className={styles.buttonGroup}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className={styles.hiddenInput}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) void handleUploadAttachment(file);
                                        }}
                                    />
                                    <EntityActionButton
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={attachmentsUploading}
                                        className={styles.actionButton}
                                    >
                                        <FiUploadCloud />
                                        {attachmentsUploading ? 'Загрузка…' : 'Загрузить файл'}
                                    </EntityActionButton>
                                </div>
                            ) : null}
                        </div>

                        {attachmentsError ? <div className={styles.errorInline}>{attachmentsError}</div> : null}

                        {attachmentsLoading ? (
                            <div className={styles.emptyState}>Загрузка документов…</div>
                        ) : attachments.length === 0 ? (
                            <div className={styles.emptyState}>Нет прикрепленных документов</div>
                        ) : (
                            <EntityTableSurface className={styles.tableSurface}>
                                <Table className={entityTableClassName}>
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
                                                <TableCell>
                                                    <div className={styles.fileCell}>
                                                        <div className={styles.fileIcon}><FiPaperclip /></div>
                                                        <div>
                                                            <div className={styles.fileName}>{attachment.filename}</div>
                                                            <div className={styles.fileMeta}>{attachment.mime_type}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className={styles.textRight}>{formatBytes(attachment.size_bytes)}</TableCell>
                                                <TableCell className={styles.textRight}>
                                                    <div className={styles.inlineActions}>
                                                        <EntityActionButton type="button" onClick={() => openPreview(attachment)}>
                                                            <FiFile />
                                                            Открыть
                                                        </EntityActionButton>
                                                        <a
                                                            href={`/api/attachments/${encodeURIComponent(attachment.id)}/download`}
                                                            className={styles.inlineLink}
                                                        >
                                                            <EntityActionButton type="button">
                                                                <FiDownload />
                                                                Скачать
                                                            </EntityActionButton>
                                                        </a>
                                                        {canAttachmentsDelete ? (
                                                            <EntityActionButton
                                                                type="button"
                                                                tone="danger"
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
                    </div>
                ) : null}

                {canOrdersHistory ? (
                    <div className={styles.sectionBlockOrders}>
                        <div className={styles.sectionHeaderRow}>
                            <div className={styles.sectionSubTitle}>Заявки клиента</div>
                            <div className={styles.sectionTotal}>
                                {orders.length ? `Итого: ${formatCurrency(ordersTotal)}` : ''}
                            </div>
                        </div>

                        <EntityTableSurface className={styles.tableSurface}>
                            <Table className={entityTableClassName}>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Дата создания</TableHead>
                                        <TableHead>Статус</TableHead>
                                        <TableHead>Сумма</TableHead>
                                        <TableHead className={styles.textRight}>Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.length ? (
                                        orders.map((order) => (
                                            <TableRow
                                                key={order.id}
                                                className={canViewClientOrder ? styles.clickableRow : undefined}
                                                onClick={canViewClientOrder ? () => router.push(`/orders/${order.id}`) : undefined}
                                            >
                                                <TableCell>#{order.id}</TableCell>
                                                <TableCell>{formatDateTime(order.дата_создания)}</TableCell>
                                                <TableCell>
                                                    <EntityStatusBadge value={order.статус} compact />
                                                </TableCell>
                                                <TableCell>{formatCurrency(order.общая_сумма)}</TableCell>
                                                <TableCell className={styles.textRight}>
                                                    {canViewClientOrder ? (
                                                        <EntityActionButton
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void router.push(`/orders/${order.id}`);
                                                            }}
                                                        >
                                                            Посмотреть заявку
                                                        </EntityActionButton>
                                                    ) : null}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className={styles.emptyState}>
                                                У клиента пока нет заявок
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </EntityTableSurface>
                    </div>
                ) : null}
            </section>

            <EditClientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditClient}
                client={client}
            />

            <Dialog open={isPreviewOpen} onOpenChange={handlePreviewOpenChange}>
                <DialogContent className={styles.previewContent}>
                    <DialogHeader>
                        <DialogTitle>{previewAttachment?.filename || 'Документ'}</DialogTitle>
                        <DialogDescription>{previewAttachment?.mime_type || ''}</DialogDescription>
                    </DialogHeader>

                    <div className={styles.previewBody}>
                        {previewAttachment && canPreviewInline(previewAttachment) ? (
                            previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                <img
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    alt={previewAttachment.filename}
                                    className={styles.previewImage}
                                />
                            ) : (
                                <iframe
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
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
                            <a
                                href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`}
                                className={styles.inlineLink}
                            >
                                <EntityActionButton type="button" className={styles.previewActionButton}>
                                    <FiDownload />
                                    Скачать
                                </EntityActionButton>
                            </a>
                        ) : null}
                        <EntityActionButton type="button" onClick={() => handlePreviewOpenChange(false)}>
                            Закрыть
                        </EntityActionButton>
                    </div>
                </DialogContent>
            </Dialog>

            <DeleteConfirmation
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDeleteClient}
                loading={isDeleting}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить клиента?"
                warning="Клиента нельзя будет восстановить. Если у клиента есть заявки, удаление запрещено."
                details={(
                    <div className={styles.deleteDetails}>
                        <div className={styles.deleteTitle}>Клиент #{client.id}</div>
                        <div className={styles.deleteMeta}>Название: {client.название}</div>
                        {deleteError ? <div className={styles.errorInline}>{deleteError}</div> : null}
                    </div>
                )}
            />
        </div>
    );
}

export default withLayout(ClientDetailPage);
