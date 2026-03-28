import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
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

const EMPTY_SELECT_VALUE = '__empty__';

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

    const [formData, setFormData] = useState<FormState>({
        заявка_id: '',
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
            статус: 'в пути',
            номер_отслеживания: '',
            стоимость_доставки: '',
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
        const orderOk = formData.заявка_id.trim().length > 0 && !Number.isNaN(Number(formData.заявка_id));
        const statusOk = ['в пути', 'доставлено', 'отменено'].includes(formData.статус);
        const transportOk = Number(transportId ?? selectedTransportId) > 0;
        return orderOk && statusOk && transportOk && !loading;
    }, [formData.заявка_id, formData.статус, loading, selectedTransportId, transportId]);

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
                заявка_id: Number(formData.заявка_id),
                транспорт_id: Number(transportId ?? selectedTransportId),
                статус: formData.статус?.trim() || 'в пути',
                номер_отслеживания: formData.номер_отслеживания.trim() || null,
                стоимость_доставки: formData.стоимость_доставки.trim() ? Number(formData.стоимость_доставки) : null,
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
                            {!transportId ? (
                                <Box className={styles.formGroup}>
                                    <Text as="label" size="2" weight="medium">
                                        Транспортная компания
                                    </Text>
                                    <Select.Root
                                        value={selectedTransportId ? String(selectedTransportId) : ''}
                                        onValueChange={(value) => setSelectedTransportId(value ? Number(value) : 0)}
                                        disabled={transportsLoading || loading}
                                    >
                                        <Select.Trigger variant="surface" color="gray" className={styles.textField} placeholder="Выберите транспорт" />
                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                            {transports.length === 0 ? (
                                                <Select.Item value={EMPTY_SELECT_VALUE} disabled>
                                                    {transportsLoading ? 'Загрузка...' : 'Нет транспортных компаний'}
                                                </Select.Item>
                                            ) : (
                                                transports.map((item) => (
                                                    <Select.Item key={item.id} value={String(item.id)}>
                                                        {item.название || `ТК #${item.id}`}
                                                    </Select.Item>
                                                ))
                                            )}
                                        </Select.Content>
                                    </Select.Root>
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
                                    <Select.Root
                                        value={formData.заявка_id}
                                        onValueChange={(value) => setFormData((p) => ({ ...p, заявка_id: value === EMPTY_SELECT_VALUE ? '' : value }))}
                                        disabled={ordersLoading || loading}
                                    >
                                        <Select.Trigger variant="surface" color="gray" className={styles.textField} placeholder="Выберите заявку" />
                                        <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                            {orders.length === 0 ? (
                                                <Select.Item value={EMPTY_SELECT_VALUE} disabled>
                                                    {ordersLoading ? 'Загрузка...' : 'Нет заявок'}
                                                </Select.Item>
                                            ) : (
                                                orders.map((o) => (
                                                    <Select.Item key={o.id} value={String(o.id)}>
                                                        #{o.id}{o.клиент_название ? ` — ${o.клиент_название}` : ''}
                                                    </Select.Item>
                                                ))
                                            )}
                                        </Select.Content>
                                    </Select.Root>
                                )}
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
                                />
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
