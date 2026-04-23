import React, { useEffect, useMemo, useState } from 'react';

import { EntityModalShell } from '@/components/EntityModalShell/EntityModalShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { fetchOrderDefaults } from '@/lib/orderModes';

import OrderSearchSelect from '../../ui/OrderSearchSelect/OrderSearchSelect';
import styles from './CreateShipmentModal.module.css';

interface CreateShipmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    transportId?: number | null;
    initialOrderId?: number | null;
    lockOrderId?: boolean;
}

type FormState = {
    заявка_id: string;
    использовать_доставку: boolean;
    статус: string;
    номер_отслеживания: string;
    стоимость_доставки: string;
};

type OrderOption = {
    id: number;
    клиент_название?: string;
};

type TransportOption = {
    id: number;
    название?: string;
};

const STATUS_OPTIONS = [
    { value: 'в пути', label: 'в пути' },
    { value: 'доставлено', label: 'доставлено' },
    { value: 'отменено', label: 'отменено' },
];

export function CreateShipmentModal({
    isOpen,
    onClose,
    onCreated,
    transportId,
    initialOrderId,
    lockOrderId = false,
}: CreateShipmentModalProps): JSX.Element | null {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersError, setOrdersError] = useState<string | null>(null);
    const [orders, setOrders] = useState<OrderOption[]>([]);
    const [transportsLoading, setTransportsLoading] = useState(false);
    const [transportsError, setTransportsError] = useState<string | null>(null);
    const [transports, setTransports] = useState<TransportOption[]>([]);
    const [selectedTransportId, setSelectedTransportId] = useState<number>(transportId ?? 0);
    const [autoCalculateDeliveryCost, setAutoCalculateDeliveryCost] = useState(false);

    const [formData, setFormData] = useState<FormState>({
        заявка_id: '',
        использовать_доставку: true,
        статус: 'в пути',
        номер_отслеживания: '',
        стоимость_доставки: '',
    });

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setLoading(false);
        setSelectedTransportId(transportId ?? 0);
        setFormData({
            заявка_id: initialOrderId ? String(initialOrderId) : '',
            использовать_доставку: true,
            статус: 'в пути',
            номер_отслеживания: '',
            стоимость_доставки: '',
        });
        void fetchOrderDefaults().then(({ autoCalculateShipmentDeliveryCost }) => {
            setAutoCalculateDeliveryCost(Boolean(autoCalculateShipmentDeliveryCost));
        });
    }, [initialOrderId, isOpen, transportId]);

    useEffect(() => {
        if (!isOpen) return;

        const loadOrders = async () => {
            setOrdersLoading(true);
            setOrdersError(null);
            try {
                const resp = await fetch('/api/orders');
                const json = await resp.json().catch(() => []);

                if (!resp.ok) {
                    throw new Error((json as any)?.error || 'Ошибка получения заявок');
                }

                const list = Array.isArray(json) ? json : [];
                setOrders(
                    list
                        .map((o: any) => ({
                            id: Number(o?.id),
                            клиент_название: o?.клиент_название,
                        }))
                        .filter((o: OrderOption) => Number.isFinite(o.id) && o.id > 0)
                );
            } catch (e) {
                setOrders([]);
                setOrdersError(e instanceof Error ? e.message : 'Не удалось загрузить заявки');
            } finally {
                setOrdersLoading(false);
            }
        };

        void loadOrders();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || transportId) return;

        const loadTransports = async () => {
            setTransportsLoading(true);
            setTransportsError(null);
            try {
                const resp = await fetch('/api/transport');
                const json = await resp.json().catch(() => []);

                if (!resp.ok) {
                    throw new Error((json as any)?.error || 'Ошибка получения транспортных компаний');
                }

                const list = Array.isArray(json)
                    ? json
                    : Array.isArray((json as any)?.transport)
                        ? (json as any).transport
                        : [];

                setTransports(
                    list
                        .map((item: any) => ({
                            id: Number(item?.id),
                            название: item?.название,
                        }))
                        .filter((item: TransportOption) => Number.isFinite(item.id) && item.id > 0)
                );
            } catch (e) {
                setTransports([]);
                setTransportsError(e instanceof Error ? e.message : 'Не удалось загрузить транспортные компании');
            } finally {
                setTransportsLoading(false);
            }
        };

        void loadTransports();
    }, [isOpen, transportId]);

    const canSubmit = useMemo(() => {
        const statusOk = STATUS_OPTIONS.some((item) => item.value === formData.статус);
        const transportOk = !formData.использовать_доставку || Number(transportId ?? selectedTransportId) > 0;
        return statusOk && transportOk && !loading;
    }, [formData.использовать_доставку, formData.статус, loading, selectedTransportId, transportId]);

    const transportSelectOptions = useMemo(
        () =>
            transports.map((item) => ({
                value: String(item.id),
                label: item.название || `ТК #${item.id}`,
            })),
        [transports]
    );

    const orderSelectOptions = useMemo(
        () => [
            { value: '', label: 'Без заявки' },
            ...orders.map((item) => ({
                value: String(item.id),
                label: `#${item.id}${item.клиент_название ? ` — ${item.клиент_название}` : ''}`,
            })),
        ],
        [orders]
    );

    const selectedOrderLabel = useMemo(() => {
        if (!formData.заявка_id) return '';
        const selectedOrder = orders.find((item) => String(item.id) === formData.заявка_id);
        return selectedOrder
            ? `#${selectedOrder.id}${selectedOrder.клиент_название ? ` — ${selectedOrder.клиент_название}` : ''}`
            : `#${formData.заявка_id}`;
    }, [formData.заявка_id, orders]);

    const handleClose = () => {
        if (loading) return;
        setError(null);
        setLoading(false);
        setOrdersError(null);
        setTransportsError(null);
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setError(null);

        try {
            const payload = {
                заявка_id: formData.заявка_id.trim() ? Number(formData.заявка_id) : null,
                использовать_доставку: formData.использовать_доставку,
                транспорт_id: formData.использовать_доставку ? Number(transportId ?? selectedTransportId) : null,
                статус: formData.статус.trim() || 'в пути',
                номер_отслеживания: formData.номер_отслеживания.trim() || null,
                стоимость_доставки:
                    formData.использовать_доставку && formData.стоимость_доставки.trim()
                        ? Number(formData.стоимость_доставки)
                        : null,
            };

            const resp = await fetch('/api/shipments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                throw new Error(json.error || 'Ошибка создания отгрузки');
            }

            onCreated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка при создании');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={styles.modalContent}
                onClose={handleClose}
                title="Создать отгрузку"
                description="Заполните данные отгрузки. Транспорт будет привязан к текущей компании."
                footerClassName={styles.actions}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            form="create-shipment-form"
                            className={styles.primaryButton}
                            disabled={!canSubmit}
                        >
                            {loading ? 'Создание...' : 'Создать'}
                        </Button>
                    </>
                }
            >
                <form id="create-shipment-form" onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGrid}>
                        <div className={`${styles.formGroup} ${styles.spanAll}`}>
                            <Label className={styles.checkboxRow} htmlFor="shipment-use-delivery">
                                <Checkbox
                                    id="shipment-use-delivery"
                                    checked={formData.использовать_доставку}
                                    disabled={loading}
                                    onCheckedChange={(checked) => {
                                        const nextValue = checked === true;
                                        setFormData((previous) => ({
                                            ...previous,
                                            использовать_доставку: nextValue,
                                            номер_отслеживания: nextValue ? previous.номер_отслеживания : '',
                                            стоимость_доставки: nextValue ? previous.стоимость_доставки : '',
                                        }));
                                    }}
                                />
                                <span>Использовать доставку</span>
                            </Label>
                            <p className={styles.fieldHint}>
                                Если выключено, отгрузка оформляется как передача без доставки.
                            </p>
                        </div>

                        {!transportId && formData.использовать_доставку ? (
                            <div className={styles.formGroup}>
                                <Label className={styles.fieldLabel}>Транспортная компания</Label>
                                <OrderSearchSelect
                                    value={selectedTransportId ? String(selectedTransportId) : ''}
                                    onValueChange={(value) => setSelectedTransportId(value ? Number(value) : 0)}
                                    options={transportSelectOptions}
                                    placeholder="Выберите транспорт"
                                    disabled={transportsLoading || loading}
                                    emptyText={transportsLoading ? 'Загрузка...' : 'Нет транспортных компаний'}
                                />
                            </div>
                        ) : null}

                        <div className={styles.formGroup}>
                            <Label className={styles.fieldLabel} htmlFor="shipment-order">
                                Заявка
                            </Label>
                            {lockOrderId ? (
                                <Input
                                    id="shipment-order"
                                    value={selectedOrderLabel}
                                    readOnly
                                    className={styles.textField}
                                />
                            ) : (
                                <OrderSearchSelect
                                    value={formData.заявка_id}
                                    onValueChange={(value) => setFormData((previous) => ({ ...previous, заявка_id: value }))}
                                    options={orderSelectOptions}
                                    placeholder="Выберите заявку"
                                    disabled={ordersLoading || loading}
                                    emptyText={ordersLoading ? 'Загрузка...' : 'Нет заявок'}
                                />
                            )}
                            {!formData.заявка_id ? (
                                <p className={styles.fieldHint}>
                                    Если заявку не выбирать, отгрузка будет создана как самостоятельная складская
                                    отгрузка без автоподбора позиций из заявки.
                                </p>
                            ) : null}
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.fieldLabel}>Статус</Label>
                            <Select
                                value={formData.статус}
                                onValueChange={(value) => {
                                    if (typeof value === 'string') {
                                        setFormData((previous) => ({ ...previous, статус: value }));
                                    }
                                }}
                                disabled={loading}
                            >
                                <SelectTrigger className={styles.selectTrigger}>
                                    <SelectValue placeholder="Выберите статус" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.fieldLabel} htmlFor="shipment-tracking">
                                Номер отслеживания
                            </Label>
                            <Input
                                id="shipment-tracking"
                                value={formData.номер_отслеживания}
                                onChange={(event) =>
                                    setFormData((previous) => ({ ...previous, номер_отслеживания: event.target.value }))
                                }
                                placeholder="TRACK-001"
                                className={styles.textField}
                                disabled={!formData.использовать_доставку}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.fieldLabel} htmlFor="shipment-cost">
                                Стоимость доставки
                            </Label>
                            <Input
                                id="shipment-cost"
                                value={formData.стоимость_доставки}
                                onChange={(event) =>
                                    setFormData((previous) => ({ ...previous, стоимость_доставки: event.target.value }))
                                }
                                placeholder="400.00"
                                className={styles.textField}
                                disabled={!formData.использовать_доставку || autoCalculateDeliveryCost}
                            />
                            <p className={styles.fieldHint}>
                                {!formData.использовать_доставку
                                    ? 'Стоимость доставки не используется, потому что отгрузка оформляется без доставки.'
                                    : autoCalculateDeliveryCost
                                        ? 'Стоимость будет рассчитана автоматически по тарифу выбранной транспортной компании.'
                                        : 'Стоимость доставки можно ввести вручную. По умолчанию используется именно этот режим.'}
                            </p>
                        </div>
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}
                    {ordersError ? <div className={styles.error}>{ordersError}</div> : null}
                    {transportsError ? <div className={styles.error}>{transportsError}</div> : null}
                </form>
            </EntityModalShell>
        </Dialog>
    );
}
