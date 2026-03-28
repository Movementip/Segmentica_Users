import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './ShipmentDetail.module.css';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Card, Dialog, DropdownMenu, Flex, Grid, Select, Separator, Table, Text, TextField } from '@radix-ui/themes';
import { FiTruck, FiEye, FiArrowLeft, FiDownload, FiEdit2, FiFile, FiFileText, FiPaperclip, FiPrinter, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../lib/vat';
import modalStyles from '../../components/Modal.module.css';

const EMPTY_SELECT_VALUE = '__empty__';

interface ShipmentDetail {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер?: string | number;
    транспорт_название?: string;
}

interface Order {
    id: number;
}

interface Transport {
    id: number;
    название: string;
}

interface OrderPosition {
    id: number;
    товар_id: number;
    количество: number;
    цена: number;
    сумма: number;
    ндс_id?: number;
    ндс_название?: string;
    ндс_ставка?: number;
    сумма_без_ндс?: number;
    сумма_ндс?: number;
    сумма_всего?: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

function ShipmentDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;

    const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transports, setTransports] = useState<Transport[]>([]);
    const [positions, setPositions] = useState<OrderPosition[]>([]);
    const [positionsLoading, setPositionsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [operationLoading, setOperationLoading] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
    const [formData, setFormData] = useState({
        заявка_id: 0,
        транспорт_id: 0,
        статус: 'в пути',
        номер_отслеживания: '',
        стоимость_доставки: 0,
    });
    const [editPreviewPositions, setEditPreviewPositions] = useState<OrderPosition[]>([]);
    const [editPreviewLoading, setEditPreviewLoading] = useState(false);

    const canView = Boolean(user?.permissions?.includes('shipments.view'));
    const canEdit = Boolean(user?.permissions?.includes('shipments.edit'));
    const canDelete = Boolean(user?.permissions?.includes('shipments.delete'));

    const canOrdersView = Boolean(user?.permissions?.includes('orders.view'));
    const canOrdersList = Boolean(user?.permissions?.includes('orders.list'));

    const canShipmentOrderView = Boolean(user?.permissions?.includes('shipments.order.view'));
    const canShipmentTrack = Boolean(user?.permissions?.includes('shipments.track'));
    const canShipmentPrint = Boolean(user?.permissions?.includes('shipments.print'));

    const canShipmentsAttachmentsView = Boolean(user?.permissions?.includes('shipments.attachments.view'));
    const canShipmentsAttachmentsUpload = Boolean(user?.permissions?.includes('shipments.attachments.upload'));
    const canShipmentsAttachmentsDelete = Boolean(user?.permissions?.includes('shipments.attachments.delete'));

    const canShipmentsPositionsView = Boolean(user?.permissions?.includes('shipments.positions.view'));

    const canGoToOrder = canOrdersView && canShipmentOrderView;

    const formatDateTime = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const syncFormWithShipment = useCallback((s: ShipmentDetail) => {
        setFormData({
            заявка_id: Number(s.заявка_id) || 0,
            транспорт_id: Number(s.транспорт_id) || 0,
            статус: (s.статус || 'в пути').toLowerCase(),
            номер_отслеживания: s.номер_отслеживания || '',
            стоимость_доставки: Number(s.стоимость_доставки) || 0,
        });
    }, []);

    const fetchShipmentPositions = useCallback(async (orderId: number) => {
        if (!orderId) {
            setPositions([]);
            return;
        }

        if (!canShipmentsPositionsView) {
            setPositions([]);
            return;
        }

        if (!canOrdersView) {
            setPositions([]);
            return;
        }

        try {
            setPositionsLoading(true);
            const res = await fetch(`/api/orders/${encodeURIComponent(String(orderId))}`);
            if (!res.ok) {
                setPositions([]);
                return;
            }

            const data = await res.json();
            setPositions(Array.isArray(data?.позиции) ? data.позиции : []);
        } catch {
            setPositions([]);
        } finally {
            setPositionsLoading(false);
        }
    }, [canOrdersView, canShipmentsPositionsView]);

    const fetchEditPreviewPositions = useCallback(async (orderId: number) => {
        if (!orderId || !canOrdersView || !canShipmentsPositionsView) {
            setEditPreviewPositions([]);
            return;
        }

        try {
            setEditPreviewLoading(true);
            const res = await fetch(`/api/orders/${encodeURIComponent(String(orderId))}`);
            if (!res.ok) {
                setEditPreviewPositions([]);
                return;
            }

            const data = await res.json();
            setEditPreviewPositions(Array.isArray(data?.позиции) ? data.позиции : []);
        } catch {
            setEditPreviewPositions([]);
        } finally {
            setEditPreviewLoading(false);
        }
    }, [canOrdersView, canShipmentsPositionsView]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
        }).format(amount);
    };

    useEffect(() => {
        if (!isEditModalOpen) {
            setEditPreviewPositions([]);
            setEditPreviewLoading(false);
            return;
        }

        if (!formData.заявка_id) {
            setEditPreviewPositions([]);
            return;
        }

        fetchEditPreviewPositions(formData.заявка_id);
    }, [isEditModalOpen, formData.заявка_id, fetchEditPreviewPositions]);

    const editPreviewTotal = editPreviewPositions.reduce((sum, position) => {
        if (typeof position.сумма_всего === 'number') return sum + position.сумма_всего;
        return sum + calculateVatAmountsFromLine(position.количество, position.цена, getVatRateOption(position.ндс_id).rate).total;
    }, 0);

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

    const fetchAttachments = useCallback(async (shipmentId: number) => {
        if (!canShipmentsAttachmentsView) return;
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
            setAttachments([]);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);
            const res = await fetch(`/api/attachments?entity_type=shipment&entity_id=${encodeURIComponent(String(shipmentId))}`);
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
    }, [canShipmentsAttachmentsView]);

    const handleUploadAttachment = useCallback(async (file: File) => {
        if (!canShipmentsAttachmentsUpload) return;
        const shipmentId = Number(shipment?.id);
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) return;

        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'shipment');
            form.append('entity_id', String(shipmentId));

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(shipmentId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [canShipmentsAttachmentsUpload, fetchAttachments, shipment?.id]);

    const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
        if (!canShipmentsAttachmentsDelete) return;
        const shipmentId = Number(shipment?.id);
        if (!Number.isInteger(shipmentId) || shipmentId <= 0) return;

        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=shipment&entity_id=${encodeURIComponent(String(shipmentId))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(shipmentId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    }, [fetchAttachments, shipment?.id]);

    const getStatusText = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'в пути':
                return 'В пути';
            case 'доставлено':
                return 'Доставлено';
            case 'отменено':
                return 'Отменено';
            default:
                return status || '-';
        }
    };

    const getStatusPillClass = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'в пути':
                return styles.statusPillBlue;
            case 'доставлено':
                return styles.statusPillGreen;
            case 'отменено':
                return styles.statusPillRed;
            default:
                return '';
        }
    };

    const getTrackingUrl = useCallback((s: ShipmentDetail): string | null => {
        const track = (s.номер_отслеживания || '').trim();
        if (!track) return null;
        const carrierName = (s.транспорт_название || '').toLowerCase();
        if (carrierName.includes('деловые линии') || carrierName.includes('деловые') || carrierName.includes('дл')) {
            return `https://www.dellin.ru/tracker/orders/${encodeURIComponent(track)}/`;
        }
        if (carrierName.includes('сдэк') || carrierName.includes('cdek')) {
            return `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(track)}`;
        }
        return null;
    }, []);

    const handlePrintDocumentsWord = useCallback(async (s: ShipmentDetail) => {
        const shipDate = s.дата_отгрузки ? new Date(s.дата_отгрузки).toLocaleDateString('ru-RU') : '-';
        const shipTime = s.дата_отгрузки ? new Date(s.дата_отгрузки).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        const costText = s.стоимость_доставки ? formatCurrency(s.стоимость_доставки) : 'Не указана';
        const statusText = getStatusText((s.статус || '').toLowerCase());
        const orderText = s.заявка_номер ? `№${s.заявка_номер}` : `#${s.заявка_id}`;
        const transportText = s.транспорт_название || (s.транспорт_id ? `ТК #${s.транспорт_id}` : '-');
        const trackText = s.номер_отслеживания || 'Не указан';

        const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Отгрузка №${s.id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #111; }
        h1 { text-align: center; margin: 0 0 20px; }
        .meta { margin: 16px 0 24px; }
        .meta-row { display: flex; gap: 16px; margin: 6px 0; }
        .label { width: 180px; color: #555; }
        .value { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin: 18px 0; }
        th { background-color: #f3f3f3; padding: 10px; text-align: left; border: 1px solid #ddd; }
        td { padding: 10px; border: 1px solid #ddd; }
        .signature { margin-top: 80px; }
        .signature-line { display: inline-block; width: 220px; border-top: 1px solid #000; margin: 5px 20px 0 0; position: relative; top: -5px; }
        .signature-label { display: inline-block; width: 220px; margin-right: 20px; }
      </style>
    </head>
    <body>
      <h1>Отгрузка №${s.id}</h1>
      <div class='meta'>
        <div class='meta-row'><div class='label'>Заявка</div><div class='value'>${orderText}</div></div>
        <div class='meta-row'><div class='label'>Транспортная компания</div><div class='value'>${transportText}</div></div>
        <div class='meta-row'><div class='label'>Номер отслеживания</div><div class='value'>${trackText}</div></div>
        <div class='meta-row'><div class='label'>Дата отгрузки</div><div class='value'>${shipDate}${shipTime ? ` ${shipTime}` : ''}</div></div>
        <div class='meta-row'><div class='label'>Стоимость доставки</div><div class='value'>${costText}</div></div>
        <div class='meta-row'><div class='label'>Статус</div><div class='value'>${statusText}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Параметр</th>
            <th>Значение</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>ID отгрузки</td><td>${s.id}</td></tr>
          <tr><td>ID заявки</td><td>${s.заявка_id}</td></tr>
          <tr><td>ID ТК</td><td>${s.транспорт_id}</td></tr>
        </tbody>
      </table>

      <div class='signature'>
        <div>
          <span class='signature-label'>Ответственный</span>
          <span class='signature-line'></span>
          <span>(______________)</span>
        </div>
      </div>
    </body>
    </html>
  `;

        const blob = new Blob(['\ufeff', htmlContent], {
            type: 'application/msword;charset=utf-8',
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Отгрузка_${s.id}_${shipDate.replace(/\./g, '-')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const fetchShipment = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/shipments/${encodeURIComponent(String(id))}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Ошибка загрузки отгрузки');
            }
            const data = await res.json();
            setShipment(data);
            setPositions(Array.isArray(data?.позиции) ? data.позиции : []);
            syncFormWithShipment(data);

            if (data?.id) {
                await fetchAttachments(Number(data.id));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [fetchAttachments, id, syncFormWithShipment]);

    const fetchOrdersAndTransports = useCallback(async () => {
        try {
            const [ordersRes, transportsRes] = await Promise.all([
                canOrdersList ? fetch('/api/orders') : Promise.resolve(null),
                fetch('/api/transport'),
            ]);

            if (ordersRes && ordersRes.ok) {
                const o = await ordersRes.json();
                setOrders(Array.isArray(o) ? o : []);
            } else {
                setOrders([]);
            }

            if (transportsRes.ok) {
                const t = await transportsRes.json();
                setTransports(Array.isArray(t) ? t : []);
            }
        } catch {
            // ignore
        }
    }, [canOrdersList]);

    useEffect(() => {
        if (authLoading) return;
        if (!canView) return;
        fetchShipment();
    }, [authLoading, canView, fetchShipment]);

    useEffect(() => {
        fetchOrdersAndTransports();
    }, [fetchOrdersAndTransports]);

    const handleSubmitEdit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shipment) return;

        try {
            setOperationLoading(true);
            setError(null);

            const response = await fetch('/api/shipments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: shipment.id,
                    заявка_id: formData.заявка_id,
                    транспорт_id: formData.транспорт_id,
                    статус: formData.статус,
                    номер_отслеживания: formData.номер_отслеживания || null,
                    стоимость_доставки: formData.стоимость_доставки || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления отгрузки');
            }

            await fetchShipment();
            setIsEditModalOpen(false);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Ошибка обновления отгрузки');
        } finally {
            setOperationLoading(false);
        }
    }, [fetchShipment, formData, shipment]);

    const handleDeleteShipment = useCallback(async () => {
        if (!shipment) return;
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/shipments?id=${shipment.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления отгрузки');
            }

            router.push('/shipments');
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка удаления отгрузки');
        } finally {
            setOperationLoading(false);
            setIsDeleteConfirmOpen(false);
        }
    }, [router, shipment]);

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
                <div className={styles.card}>
                    <Text as="div" size="2" color="gray">Загрузка…</Text>
                </div>
            </div>
        );
    }

    if (error || !shipment) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <Text as="div" size="3" weight="bold">Ошибка</Text>
                    <Text as="div" color="red" mt="2">{error || 'Отгрузка не найдена'}</Text>
                    <div className={styles.buttonGroup} style={{ marginTop: 16 }}>
                        <Link href="/shipments" style={{ textDecoration: 'none' }}>
                            <Button variant="surface" color="gray" highContrast className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}>
                                Назад к списку отгрузок
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const trackingUrl = getTrackingUrl(shipment);
    const getVatSummary = (position: OrderPosition) => {
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

    const positionsTotal = positions.reduce((sum, p) => sum + getVatSummary(p).total, 0);

    return (
        <div className={`${styles.container} print-shipment-detail`}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Отгрузка #{shipment.id}</h1>
                        <p className={styles.subtitle}>Детали отгрузки и документы</p>
                        <div className={`${styles.statusPill} ${getStatusPillClass(shipment.статус)}`}>
                            <Text as="span" size="1" weight="medium">{getStatusText(shipment.статус)}</Text>
                        </div>
                    </div>

                    <div className={styles.headerActions}>
                        <Link href="/shipments" className={styles.noPrint} style={{ textDecoration: 'none' }}>
                            <Button variant="surface" color="gray" highContrast className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}>
                                <FiArrowLeft className={styles.icon} /> Назад
                            </Button>
                        </Link>

                        {canShipmentPrint ? (
                            <Button
                                onClick={() => window.print()}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                            >
                                <FiPrinter className={styles.icon} />
                                Печать
                            </Button>
                        ) : null}

                        {canShipmentPrint ? (
                            <Button
                                onClick={async () => {
                                    try {
                                        await handlePrintDocumentsWord(shipment);
                                    } catch (err) {
                                        console.error(err);
                                        setError(err instanceof Error ? err.message : 'Ошибка печати документов');
                                    }
                                }}
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                            >
                                <FiFileText className={styles.icon} />
                                Word
                            </Button>
                        ) : null}

                        {canGoToOrder ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                onClick={() => {
                                    if (!shipment.заявка_id) return;
                                    router.push(`/orders/${encodeURIComponent(String(shipment.заявка_id))}`);
                                }}
                                disabled={!shipment.заявка_id}
                            >
                                <FiEye className={styles.icon} />
                                Перейти к заявке
                            </Button>
                        ) : null}

                        {canShipmentTrack ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                onClick={() => {
                                    if (!trackingUrl) return;
                                    window.open(trackingUrl, '_blank', 'noopener,noreferrer');
                                }}
                                disabled={!trackingUrl}
                            >
                                <FiTruck className={styles.icon} />
                                Отследить
                            </Button>
                        ) : null}

                        {canEdit ? (
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                                onClick={() => setIsEditModalOpen(true)}
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
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} ${styles.noPrint}`}
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
                        Детали отгрузки
                    </Text>
                    <Text as="div" size="1" color="gray" className={styles.infoLabel}>
                        Отгрузка от {formatDateTime(shipment.дата_отгрузки)}
                    </Text>
                </div>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Основная информация
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Заявка</Text>
                                    <Text as="div" size="2" weight="medium">{shipment.заявка_номер ? `№${shipment.заявка_номер}` : `#${shipment.заявка_id}`}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Транспортная компания</Text>
                                    <Text as="div" size="2">{shipment.транспорт_название || `ТК #${shipment.транспорт_id}`}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Номер отслеживания</Text>
                                    <Text as="div" size="2">{shipment.номер_отслеживания || 'Не указан'}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="2" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                                Финансы и статус
                            </Text>
                            <Separator size="4" />
                            <Flex direction="column" gap="2">
                                <Box>
                                    <Text as="div" size="1" color="gray">Стоимость доставки</Text>
                                    <Text as="div" size="2" weight="medium">{shipment.стоимость_доставки ? formatCurrency(shipment.стоимость_доставки) : 'Не указана'}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Статус</Text>
                                    <Text as="div" size="2">{getStatusText(shipment.статус)}</Text>
                                </Box>
                                <Box>
                                    <Text as="div" size="1" color="gray">Дата отгрузки</Text>
                                    <Text as="div" size="2">{formatDateTime(shipment.дата_отгрузки)}</Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>

                <div className={styles.actions}>
                    {trackingUrl && canShipmentTrack ? (
                        <Button
                            onClick={() => window.open(trackingUrl, '_blank', 'noopener,noreferrer')}
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.noPrint}`}
                        >
                            <FiTruck className={styles.icon} />
                            Отследить груз
                        </Button>
                    ) : null}
                </div>
            </div>

            {canShipmentsAttachmentsView ? (
                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Документы
                        </Text>
                        {canShipmentsAttachmentsUpload ? (
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
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={attachmentsUploading}
                                >
                                    <FiUploadCloud className={styles.icon} />
                                    {attachmentsUploading ? 'Загрузка…' : 'Загрузить файл'}
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {attachmentsError ? (
                        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 12 }}>
                            <Text as="div" size="2" color="red">{attachmentsError}</Text>
                        </Box>
                    ) : null}

                    {attachmentsLoading ? (
                        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 12 }}>
                            <Text as="div" size="2" color="gray">Загрузка документов…</Text>
                        </Box>
                    ) : attachments.length === 0 ? (
                        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 12 }}>
                            <Text as="div" size="2" color="gray">Нет прикрепленных документов</Text>
                        </Box>
                    ) : (
                        <Box style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
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
                                                <div style={{ fontWeight: 600 }}>{a.filename}</div>
                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.mime_type}</div>
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
                                                        <FiFile className={styles.icon} />  Открыть
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
                                                            <FiDownload className={styles.icon} /> Скачать
                                                        </Button>
                                                    </a>
                                                    {canShipmentsAttachmentsDelete ? (
                                                        <Button
                                                            type="button"
                                                            variant="surface"
                                                            color="red"
                                                            highContrast
                                                            className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton} ${styles.orderDeleteButton} ${styles.noPrint}`}
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
                            <Button variant="surface" color="gray" highContrast>
                                Закрыть
                            </Button>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>

            {canShipmentsPositionsView ? (
                <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeaderRow}>
                        <Text as="div" size="2" weight="bold" className={styles.sectionTitle}>
                            Состав отгрузки
                        </Text>
                        {positionsLoading ? (
                            <Text as="div" size="1" color="gray">Загрузка...</Text>
                        ) : null}
                    </div>

                    <div className={styles.tableWrapper}>
                        <Table.Root variant="surface" className={styles.table}>
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
                                {positions.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={8}>
                                            <Text as="div" size="2" color="gray">Нет данных о составе отгрузки</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : (
                                    positions.map((position) => {
                                        const vatSummary = getVatSummary(position);

                                        return (
                                            <Table.Row key={position.id}>
                                                <Table.Cell>
                                                    <div className={styles.productName}>{position.товар_название}</div>
                                                    <div className={styles.productMeta}>
                                                        {position.товар_артикул} • {position.товар_категория || 'Без категории'}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    {position.товар_единица_измерения || 'шт'}
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>
                                                    {position.количество}
                                                </Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatCurrency(Number(position.цена) || 0)}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.net)}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>{vatSummary.label}</Table.Cell>
                                                <Table.Cell className={styles.textRight}>{formatCurrency(vatSummary.tax)}</Table.Cell>
                                                <Table.Cell className={styles.textRight} style={{ fontWeight: 600 }}>
                                                    {formatCurrency(vatSummary.total)}
                                                </Table.Cell>
                                            </Table.Row>
                                        );
                                    })
                                )}

                                {positions.length > 0 ? (
                                    <Table.Row className={styles.totalRow as any}>
                                        <Table.Cell className={styles.textRight} colSpan={7}>
                                            Итого:
                                        </Table.Cell>
                                        <Table.Cell className={styles.textRight} style={{ fontWeight: 600, textAlign: 'right' }}>
                                            {formatCurrency(positionsTotal)}
                                        </Table.Cell>
                                    </Table.Row>
                                ) : null}
                            </Table.Body>
                        </Table.Root>
                    </div>
                </div>
            ) : null}

            <Dialog.Root open={isDeleteConfirmOpen} onOpenChange={(open) => (!open ? setIsDeleteConfirmOpen(false) : undefined)}>
                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>

                    <Box className={deleteConfirmationStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить эту отгрузку? Это действие нельзя отменить.
                            </Text>

                            <Box className={deleteConfirmationStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" weight="bold">Отгрузка #{shipment.id}</Text>
                                    <Text as="div" size="2" color="gray">Заявка: #{shipment.заявка_id}</Text>
                                    <Text as="div" size="2" color="gray">ТК: {shipment.транспорт_название || `#${shipment.транспорт_id}`}</Text>
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
                                    onClick={handleDeleteShipment}
                                    disabled={operationLoading}
                                >
                                    {operationLoading ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={isEditModalOpen} onOpenChange={(open) => (!open ? setIsEditModalOpen(false) : undefined)}>
                <Dialog.Content className={modalStyles.radixDialogWide}>
                    <Dialog.Title>Редактировать отгрузку</Dialog.Title>
                    <Dialog.Description className={styles.modalDescription}>
                        Обновите данные отгрузки.
                    </Dialog.Description>

                    <form onSubmit={handleSubmitEdit} className={styles.modalForm}>
                        <Flex direction="column" gap="4">
                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Заявка</Text>
                                <Select.Root
                                    value={formData.заявка_id ? String(formData.заявка_id) : EMPTY_SELECT_VALUE}
                                    onValueChange={(v) => setFormData((p) => ({ ...p, заявка_id: v === EMPTY_SELECT_VALUE ? 0 : Number(v) || 0 }))}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} placeholder="Выберите заявку" />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value={EMPTY_SELECT_VALUE} disabled>
                                            Выберите заявку
                                        </Select.Item>
                                        {orders.map((o) => (
                                            <Select.Item key={o.id} value={String(o.id)}>
                                                Заявка #{o.id}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Транспортная компания</Text>
                                <Select.Root
                                    value={formData.транспорт_id ? String(formData.транспорт_id) : EMPTY_SELECT_VALUE}
                                    onValueChange={(v) => setFormData((p) => ({ ...p, транспорт_id: v === EMPTY_SELECT_VALUE ? 0 : Number(v) || 0 }))}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} placeholder="Выберите ТК" />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value={EMPTY_SELECT_VALUE} disabled>
                                            Выберите ТК
                                        </Select.Item>
                                        {transports.map((t) => (
                                            <Select.Item key={t.id} value={String(t.id)}>
                                                {t.название}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Статус</Text>
                                <Select.Root value={formData.статус} onValueChange={(v) => setFormData((p) => ({ ...p, статус: v }))}>
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="в пути">В пути</Select.Item>
                                        <Select.Item value="доставлено">Доставлено</Select.Item>
                                        <Select.Item value="отменено">Отменено</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Номер отслеживания (опц.)</Text>
                                <TextField.Root
                                    value={formData.номер_отслеживания}
                                    onChange={(ev) => setFormData((p) => ({ ...p, номер_отслеживания: ev.target.value }))}
                                    placeholder="TRACK-001"
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Стоимость доставки (опц.)</Text>
                                <TextField.Root
                                    value={formData.стоимость_доставки === 0 ? '' : String(formData.стоимость_доставки)}
                                    onChange={(ev) => {
                                        const v = ev.target.value;
                                        const n = v === '' ? 0 : Number(v);
                                        setFormData((p) => ({ ...p, стоимость_доставки: Number.isFinite(n) ? n : p.стоимость_доставки }));
                                    }}
                                    placeholder="0"
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.modalPreviewSection}>
                                <Flex align="center" justify="between" gap="3" wrap="wrap">
                                    <Text as="div" size="3" weight="medium" className={styles.modalPreviewTitle}>
                                        Позиции заявки
                                    </Text>
                                    {editPreviewLoading ? (
                                        <Text size="2" color="gray">Загружаем состав заявки...</Text>
                                    ) : null}
                                </Flex>

                                {!formData.заявка_id ? (
                                    <Text as="div" size="2" color="gray" className={styles.modalPreviewHint}>
                                        Выберите заявку, чтобы увидеть состав отгрузки.
                                    </Text>
                                ) : null}

                                {formData.заявка_id && !editPreviewLoading && editPreviewPositions.length === 0 ? (
                                    <Text as="div" size="2" color="gray" className={styles.modalPreviewHint}>
                                        У выбранной заявки пока нет позиций или они недоступны для просмотра.
                                    </Text>
                                ) : null}

                                {editPreviewPositions.length > 0 ? (
                                    <>
                                        <div className={styles.modalPreviewTableWrap}>
                                            <Table.Root variant="surface" className={styles.modalPreviewTable}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Ед.изм</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Кол-во</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Цена, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Сумма без НДС, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>НДС</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Сумма НДС, ₽</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell className={styles.textRight}>Всего, ₽</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {editPreviewPositions.map((position) => {
                                                        const vatOption = getVatRateOption(position.ндс_id);
                                                        const fallbackAmounts = calculateVatAmountsFromLine(position.количество, position.цена, position.ндс_ставка ?? vatOption.rate);

                                                        return (
                                                            <Table.Row key={position.id}>
                                                                <Table.Cell>
                                                                    <div className={styles.productName}>{position.товар_название || `Товар #${position.товар_id}`}</div>
                                                                    {position.товар_артикул ? (
                                                                        <div className={styles.productMeta}>{position.товар_артикул}</div>
                                                                    ) : null}
                                                                </Table.Cell>
                                                                <Table.Cell>{position.товар_единица_измерения || 'шт'}</Table.Cell>
                                                                <Table.Cell>{position.количество}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{formatCurrency(position.цена || 0)}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{formatCurrency(position.сумма_без_ндс ?? fallbackAmounts.net)}</Table.Cell>
                                                                <Table.Cell>{position.ндс_название || vatOption.label}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{formatCurrency(position.сумма_ндс ?? fallbackAmounts.tax)}</Table.Cell>
                                                                <Table.Cell className={styles.textRight}>{formatCurrency(position.сумма_всего ?? fallbackAmounts.total)}</Table.Cell>
                                                            </Table.Row>
                                                        );
                                                    })}
                                                </Table.Body>
                                            </Table.Root>
                                        </div>

                                        <Flex justify="end" className={styles.modalPreviewTotal}>
                                            <Text weight="bold">Итого: {formatCurrency(editPreviewTotal)}</Text>
                                        </Flex>
                                    </>
                                ) : null}
                            </Box>

                            <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                                <Button type="button" variant="surface" color="gray" highContrast onClick={() => setIsEditModalOpen(false)} disabled={operationLoading}>
                                    Отмена
                                </Button>
                                <Button type="submit" color="gray" highContrast disabled={operationLoading}>
                                    {operationLoading ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </form>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(ShipmentDetailPage);
