import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import EditPurchaseModal from '../../components/EditPurchaseModal';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import { exportToExcel, exportToWord } from '../../utils/exportUtils';
import styles from './PurchaseDetail.module.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiArrowLeft, FiDownload, FiEdit2, FiEye, FiFile, FiFileText, FiPaperclip, FiPrinter, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { Badge, Box, Button, Card, Dialog, DropdownMenu, Flex, Grid, Separator, Table, Text } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../lib/vat';

interface PurchasePosition {
    id: number;
    товар_id: number;
    товар_название: string;
    товар_артикул: string;
    товар_единица_измерения: string;
    количество: number;
    цена: number;
    сумма: number;
    ндс_id?: number;
    ндс_название?: string;
    ндс_ставка?: number;
    сумма_без_ндс?: number;
    сумма_ндс?: number;
    сумма_всего?: number;
}

interface Purchase {
    id: number;
    поставщик_id: number;
    поставщик_название: string;
    поставщик_телефон: string;
    поставщик_email: string;
    заявка_id?: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
    позиции: PurchasePosition[];
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

function PurchaseDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

    const canView = Boolean(user?.permissions?.includes('purchases.view'));
    const canEdit = Boolean(user?.permissions?.includes('purchases.edit'));
    const canDelete = Boolean(user?.permissions?.includes('purchases.delete'));
    const canPurchaseOrderView = Boolean(user?.permissions?.includes('purchases.order.view'));
    const canOrderView = Boolean(user?.permissions?.includes('orders.view'));
    const canPrint = Boolean(user?.permissions?.includes('purchases.print'));
    const canExportPdf = Boolean(user?.permissions?.includes('purchases.export.pdf'));
    const canExportExcel = Boolean(user?.permissions?.includes('purchases.export.excel'));
    const canExportWord = Boolean(user?.permissions?.includes('purchases.export.word'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('purchases.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('purchases.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('purchases.attachments.delete'));

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        if (id) {
            fetchPurchase();
        }
    }, [authLoading, canView, id]);

    const fetchPurchase = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/purchases?id=${id}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки закупки');
            }

            const data = await response.json();
            setPurchase(data);
            if (data?.id && canAttachmentsView) {
                await fetchAttachments(Number(data.id));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
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

    const fetchAttachments = async (purchaseId: number) => {
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=purchase&entity_id=${encodeURIComponent(String(purchaseId))}`);
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
        if (!purchase) return;
        if (!canAttachmentsUpload) return;
        try {
            setUploadLoading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('entity_type', 'purchase');
            form.append('entity_id', String(purchase.id));
            form.append('file', file);

            const res = await fetch('/api/attachments', {
                method: 'POST',
                body: form,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(purchase.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!purchase) return;
        if (!canAttachmentsDelete) return;
        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=purchase&entity_id=${encodeURIComponent(String(purchase.id))}`,
                { method: 'DELETE' }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка удаления вложения');
            }

            await fetchAttachments(purchase.id);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    };

    const handleExportExcel = () => {
        if (!canExportExcel) return;
        if (purchase) {
            exportToExcel(purchase as any);
        }
    };

    const handleExportWord = () => {
        if (!canExportWord) return;
        if (purchase) {
            exportToWord(purchase as any);
        }
    };

    const handlePrint = () => {
        if (!canPrint) return;
        window.print();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getVatSummary = (position: PurchasePosition) => {
        if (typeof position.сумма_без_ндс === 'number' && typeof position.сумма_ндс === 'number' && typeof position.сумма_всего === 'number') {
            return {
                net: position.сумма_без_ндс,
                tax: position.сумма_ндс,
                total: position.сумма_всего,
                label: position.ндс_название || getVatRateOption(position.ндс_id).label,
            };
        }

        const vatOption = getVatRateOption(position.ндс_id);
        const breakdown = calculateVatAmountsFromLine(position.количество, position.цена, position.ндс_ставка ?? vatOption.rate);
        return {
            ...breakdown,
            label: position.ндс_название || vatOption.label,
        };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'новая': return '#2196F3';
            case 'в обработке': return '#ff9800';
            case 'получено': return '#4CAF50';
            case 'отменено': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'новая': return 'НОВАЯ';
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'получено': return 'ПОЛУЧЕНО';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleExportPdf = () => {
        if (!canExportPdf) return;
        if (!purchase) return;

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'pt',
            format: 'a4',
        });

        const title = `Закупка #${purchase.id}`;
        doc.setFontSize(16);
        doc.text(title, 40, 60);

        doc.setFontSize(10);
        doc.text(`Дата заказа: ${formatDate(purchase.дата_заказа)}`, 40, 84);
        doc.text(`Статус: ${purchase.статус}`, 40, 100);
        doc.text(`Поставщик: ${purchase.поставщик_название || 'Не указан'}`, 40, 116);
        doc.text(`Заявка: ${purchase.заявка_id ? `#${purchase.заявка_id}` : 'Не указана'}`, 40, 132);

        autoTable(doc, {
            startY: 156,
            head: [["Товар", "Кол-во", "Цена", "Сумма"]],
            body: purchase.позиции.map((p) => [
                p.товар_название,
                String(p.количество),
                formatCurrency(p.цена),
                formatCurrency(p.сумма),
            ]),
            styles: { fontSize: 9 },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
            },
        });

        const finalY = (doc as any).lastAutoTable?.finalY ?? 156;
        doc.setFontSize(12);
        doc.text(`Итого: ${formatCurrency(purchase.общая_сумма)}`, 40, finalY + 24);
        doc.save(`purchase-${purchase.id}.pdf`);
    };
    const handleEditPurchase = async (purchaseData: any) => {
        if (!canEdit) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/purchases?id=${purchaseData.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(purchaseData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления закупки');
            }

            await fetchPurchase();
            setIsEditModalOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка обновления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeletePurchase = async () => {
        if (!purchase) return;
        if (!canDelete) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/purchases?id=${purchase.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления закупки');
            }
            router.push('/purchases');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка удаления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>

            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <Htag tag="h1">Ошибка</Htag>
                <div className={styles.card}>
                    <p style={{ color: '#f44336' }}>{error}</p>
                    <div className={styles.buttonGroup} style={{ marginTop: '16px' }}>
                        <Link href="/purchases" className={`${styles.button} ${styles.surfaceButton}`} style={{ textDecoration: 'none' }}>
                            Назад к списку закупок
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className={styles.container}>
                <Htag tag="h1">Ошибка</Htag>
                <div className={styles.card}>
                    <p style={{ color: '#f44336' }}>Закупка не найдена</p>
                    <div className={styles.buttonGroup} style={{ marginTop: '16px' }}>
                        <Link href="/purchases" className={`${styles.button} ${styles.surfaceButton}`} style={{ textDecoration: 'none' }}>
                            Назад к списку закупок
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const statusLower = (purchase.статус || '').toLowerCase();
    const statusClass = statusLower === 'отменено'
        ? styles.statusPillRed
        : statusLower === 'в обработке'
            ? styles.statusPillOrange
            : statusLower === 'получено'
                ? styles.statusPillGreen
                : styles.statusPillBlue;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Закупка #{purchase.id}</h1>
                        <p className={styles.subtitle}>Детали закупки и позиции</p>
                    </div>
                    <div className={styles.headerActions}>
                        <Link href="/purchases" className="noPrint" style={{ textDecoration: 'none' }}>
                            <Button variant="surface" color="gray" highContrast className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}>
                                <FiArrowLeft className={styles.icon} />
                                Назад
                            </Button>
                        </Link>

                        {purchase.заявка_id && canPurchaseOrderView && canOrderView ? (
                            <Link href={`/orders/${purchase.заявка_id}`} className="noPrint" style={{ textDecoration: 'none' }}>
                                <Button
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                >
                                    <FiEye className={styles.icon} />
                                    Перейти к заявке
                                </Button>
                            </Link>
                        ) : null}

                        {canPrint ? (
                            <Button
                                onClick={handlePrint}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                            >
                                <FiPrinter className={styles.icon} />
                                Печать
                            </Button>
                        ) : null}

                        {canExportPdf ? (
                            <Button
                                onClick={handleExportPdf}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                            >
                                <FiDownload className={styles.icon} />
                                PDF
                            </Button>
                        ) : null}

                        {canExportExcel ? (
                            <Button
                                onClick={handleExportExcel}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                            >
                                <FiFile className={styles.icon} />
                                Excel
                            </Button>
                        ) : null}

                        {canExportWord ? (
                            <Button
                                onClick={handleExportWord}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                            >
                                <FiFileText className={styles.icon} />
                                Word
                            </Button>
                        ) : null}

                        {canEdit ? (
                            <Button
                                onClick={() => setIsEditModalOpen(true)}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                            >
                                <FiEdit2 className={styles.icon} />
                                Редактировать
                            </Button>
                        ) : null}

                        {canDelete ? (
                            <Button
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                variant="surface"
                                color="red"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} noPrint`}
                            >
                                <FiTrash2 className={styles.icon} />
                                Удалить
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.sectionHeader}>
                    <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                        Детали закупки
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Закупка от {formatDate(purchase.дата_заказа)}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Информация о поставщике
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Поставщик</Text>
                                    <Text as="div" size="2" weight="medium">{purchase.поставщик_название || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Телефон</Text>
                                    <Text as="div" size="2">{purchase.поставщик_телефон || 'Не указан'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Email</Text>
                                    <Text as="div" size="2">{purchase.поставщик_email || 'Не указан'}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Информация о закупке
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Flex direction="column" align="start" style={{ flexDirection: 'column', alignItems: 'flex-start', }}>
                                    <Text as="div" size="1" color="gray">Статус</Text>
                                    <Badge
                                        variant="soft"
                                        highContrast
                                        className={`${styles.statusPill} ${statusClass}`}
                                    >
                                        {getStatusText(purchase.статус)}
                                    </Badge>
                                </Flex>
                                <Box>
                                    <Text as="div" size="1" color="gray">Заявка</Text>
                                    <Text as="div" size="2">{purchase.заявка_id ? `#${purchase.заявка_id}` : 'Не указана'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата заказа</Text>
                                    <Text as="div" size="2">{formatDate(purchase.дата_заказа)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата поступления</Text>
                                    <Text as="div" size="2">{purchase.дата_поступления ? formatDate(purchase.дата_поступления) : 'Не указана'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Общая сумма</Text>
                                    <Text as="div" size="2" weight="medium">{formatCurrency(purchase.общая_сумма)}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>

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
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                                >
                                    <FiUploadCloud className={styles.icon} />
                                    {uploadLoading ? 'Загрузка…' : 'Загрузить файл'}
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {!canAttachmentsView ? (
                        <Text as="div" size="2" color="red" style={{ marginLeft: 16 }}>
                            Forbidden
                        </Text>
                    ) : null}

                    {attachmentsError ? (
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
                            <Table.Root variant="surface" className={styles.table as any}>
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
                                                        className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} noPrint`}
                                                        onClick={() => openPreview(a)}
                                                    >
                                                        <FiFile className={styles.icon} />
                                                        Открыть
                                                    </Button>
                                                    <a
                                                        href={`/api/attachments/${encodeURIComponent(a.id)}/download`}
                                                        style={{ textDecoration: 'none' }}
                                                        className="noPrint"
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
                                                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} noPrint`}
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
                    ) : null}
                </div>

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

                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Позиции закупки
                        </Text>


                    </div>

                    <div className={styles.tableWrapper}>
                        <Table.Root variant="surface" className={styles.table as any}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Ед.изм</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Количество</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Цена, ₽</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Сумма без НДС, ₽</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>НДС</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Сумма НДС, ₽</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.textRight}>Всего, ₽</Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {purchase.позиции.map((position) => {
                                    const vatSummary = getVatSummary(position);

                                    return (
                                        <Table.Row key={position.id}>
                                            <Table.Cell>
                                                <div className={styles.productName}>{position.товар_название}</div>
                                                <div className={styles.productMeta}>
                                                    {position.товар_артикул}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>
                                                {position.товар_единица_измерения || 'шт'}
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>
                                                {position.количество}
                                            </Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatCurrency(position.цена)}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.net)}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>{vatSummary.label}</Table.Cell>
                                            <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.tax)}</Table.Cell>
                                            <Table.Cell className={styles.textRight} style={{ fontWeight: 600 }}>
                                                {formatCurrency(vatSummary.total)}
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                                <Table.Row className={styles.totalRow as any}>
                                    <Table.Cell className={styles.textRight} colSpan={7}>
                                        Итого:
                                    </Table.Cell>
                                    <Table.Cell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                        {formatCurrency(purchase.общая_сумма)}
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        </Table.Root>
                    </div>
                </div>
            </div>

            <EditPurchaseModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                purchase={purchase as any}
                onSubmit={handleEditPurchase}
            />

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
                                Вы уверены, что хотите удалить эту закупку? Это действие нельзя отменить.
                            </Text>

                            <Box className={deleteConfirmationStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" weight="bold">Закупка #{purchase.id}</Text>
                                    <Text as="div" size="2" color="gray">Сумма: {formatCurrency(purchase.общая_сумма || 0)}</Text>
                                </Flex>
                            </Box>

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmationStyles.modalActions}>
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
                                    className={deleteConfirmationStyles.modalDeleteButton}
                                    onClick={handleDeletePurchase}
                                    disabled={operationLoading}
                                >
                                    {operationLoading ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(PurchaseDetailPage);
