import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import { fetchOrderDefaults } from '../../../lib/orderModes';
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

export function CreateShipmentModal({ isOpen, onClose, onCreated, transportId, initialOrderId, lockOrderId = false }: CreateShipmentModalProps): JSX.Element {
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

        loadOrders();
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

        loadTransports();
    }, [isOpen, transportId]);

    const canSubmit = useMemo(() => {
        const statusOk = ['в пути', 'доставлено', 'отменено'].includes(formData.статус);
        const transportOk = !formData.использовать_доставку || Number(transportId ?? selectedTransportId) > 0;
        return statusOk && transportOk && !loading;
    }, [formData.использовать_доставку, formData.статус, loading, selectedTransportId, transportId]);

    const transportSelectOptions = useMemo(
        () => transports.map((item) => ({
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

    const handleClose = () => {
        if (loading) return;
        setError(null);
        setLoading(false);
        setOrdersError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setError(null);

        try {
            const payload = {
                заявка_id: formData.заявка_id.trim() ? Number(formData.заявка_id) : null,
                использовать_доставку: formData.использовать_доставку,
                транспорт_id: formData.использовать_доставку ? Number(transportId ?? selectedTransportId) : null,
                статус: formData.статус?.trim() || 'в пути',
                номер_отслеживания: formData.номер_отслеживания.trim() || null,
                стоимость_доставки: formData.использовать_доставку && formData.стоимость_доставки.trim()
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

    if (!isOpen) return <></>;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Создать отгрузку</Dialog.Title>
                <Dialog.Description className={styles.description}>
                    Заполните данные отгрузки. Транспорт будет привязан к текущей компании.
                </Dialog.Description>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <label className={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked={formData.использовать_доставку}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setFormData((p) => ({
                                                ...p,
                                                использовать_доставку: checked,
                                                номер_отслеживания: checked ? p.номер_отслеживания : '',
                                                стоимость_доставки: checked ? p.стоимость_доставки : '',
                                            }));
                                        }}
                                        className={styles.checkboxInput}
                                        disabled={loading}
                                    />
                                    <span>Использовать доставку</span>
                                </label>
                                <Text as="p" size="1" color="gray" className={styles.fieldHint}>
                                    Если выключено, отгрузка оформляется как передача без доставки.
                                </Text>
                            </Box>

                            {!transportId && formData.использовать_доставку ? (
                                <Box className={styles.formGroup}>
                                    <Text as="label" size="2" weight="medium">
                                        Транспортная компания
                                    </Text>
                                    <OrderSearchSelect
                                        value={selectedTransportId ? String(selectedTransportId) : ''}
                                        onValueChange={(value) => setSelectedTransportId(value ? Number(value) : 0)}
                                        options={transportSelectOptions}
                                        placeholder="Выберите транспорт"
                                        disabled={transportsLoading || loading}
                                        emptyText={transportsLoading ? 'Загрузка...' : 'Нет транспортных компаний'}
                                    />
                                </Box>
                            ) : null}

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Заявка
                                </Text>
                                {lockOrderId ? (
                                    <TextField.Root
                                        value={
                                            formData.заявка_id
                                                ? `#${formData.заявка_id}${orders.find((item) => String(item.id) === formData.заявка_id)?.клиент_название ? ` — ${orders.find((item) => String(item.id) === formData.заявка_id)?.клиент_название}` : ''}`
                                                : ''
                                        }
                                        readOnly
                                        className={styles.textField}
                                        size="2"
                                    />
                                ) : (
                                    <OrderSearchSelect
                                        value={formData.заявка_id}
                                        onValueChange={(value) => setFormData((p) => ({ ...p, заявка_id: value }))}
                                        options={orderSelectOptions}
                                        placeholder="Выберите заявку"
                                        disabled={ordersLoading || loading}
                                        emptyText={ordersLoading ? 'Загрузка...' : 'Нет заявок'}
                                    />
                                )}
                                {!formData.заявка_id ? (
                                    <Text as="p" size="1" color="gray" className={styles.fieldHint}>
                                        Если заявку не выбирать, отгрузка будет создана как самостоятельная складская отгрузка без автоподбора позиций из заявки.
                                    </Text>
                                ) : null}
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Статус
                                </Text>
                                <Select.Root
                                    value={formData.статус}
                                    onValueChange={(value) => setFormData((p) => ({ ...p, статус: value }))}
                                    disabled={loading}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={styles.textField} placeholder="Выберите статус" />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="в пути">в пути</Select.Item>
                                        <Select.Item value="доставлено">доставлено</Select.Item>
                                        <Select.Item value="отменено">отменено</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Номер отслеживания (опц.)
                                </Text>
                                <TextField.Root
                                    value={formData.номер_отслеживания}
                                    onChange={(e) => setFormData((p) => ({ ...p, номер_отслеживания: e.target.value }))}
                                    placeholder={'TRACK-001'}
                                    className={styles.textField}
                                    size="2"
                                    disabled={!formData.использовать_доставку}
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Стоимость доставки (опц.)
                                </Text>
                                <TextField.Root
                                    value={formData.стоимость_доставки}
                                    onChange={(e) => setFormData((p) => ({ ...p, стоимость_доставки: e.target.value }))}
                                    placeholder={'400.00'}
                                    className={styles.textField}
                                    size="2"
                                    disabled={!formData.использовать_доставку || autoCalculateDeliveryCost}
                                />
                                <Text as="p" size="1" color="gray" className={styles.fieldHint}>
                                    {!formData.использовать_доставку
                                        ? 'Стоимость доставки не используется, потому что отгрузка оформляется без доставки.'
                                        : autoCalculateDeliveryCost
                                        ? 'Стоимость будет рассчитана автоматически по тарифу выбранной транспортной компании.'
                                        : 'Стоимость доставки можно ввести вручную. По умолчанию используется именно этот режим.'}
                                </Text>
                            </Box>
                        </div>

                        {error ? (
                            <Box className={styles.error}>
                                <Text as="div" size="2" color="red">
                                    {error}
                                </Text>
                            </Box>
                        ) : null}

                        {ordersError ? (
                            <Box className={styles.error}>
                                <Text as="div" size="2" color="red">
                                    {ordersError}
                                </Text>
                            </Box>
                        ) : null}

                        {transportsError ? (
                            <Box className={styles.error}>
                                <Text as="div" size="2" color="red">
                                    {transportsError}
                                </Text>
                            </Box>
                        ) : null}

                        <Flex gap="3" justify="end" className={styles.actions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={handleClose}
                                className={styles.secondaryButton}
                                disabled={loading}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={styles.primaryButton}
                                disabled={!canSubmit}
                            >
                                {loading ? 'Создание...' : 'Создать'}
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}
