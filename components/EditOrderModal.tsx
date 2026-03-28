import React, { useMemo, useState, useEffect } from 'react';
import styles from './CreateOrderModal.module.css';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, fetchDefaultVatRateId, getVatRateOption, VAT_RATE_OPTIONS } from '../lib/vat';

interface Client {
    id: number;
    название: string;
}

interface Manager {
    id: number;
    фио: string;
    должность?: string;
}

interface Product {
    id: number;
    название: string;
    цена?: number;
    цена_продажи?: number;
    артикул?: string;
    единица_измерения?: string;
}

interface OrderPosition {
    id?: number;
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
}

const UNSET_VAT_RATE_ID = 0;
const VAT_UNSET_OPTION = { id: UNSET_VAT_RATE_ID, label: 'НДС не задан', rate: 0 };
const VAT_RATE_OPTIONS_WITH_UNSET = [VAT_UNSET_OPTION, ...VAT_RATE_OPTIONS];
const getVatRateOptionSafe = (value: number) => (Number(value) > 0 ? getVatRateOption(value) : VAT_UNSET_OPTION);
const normalizeEditableOrderStatus = (value?: string | null) => {
    const status = String(value || '').trim().toLowerCase();

    if (status === 'досборка') return 'в работе';
    if (status === 'доотгрузка') return 'отгружена';
    return String(value || '').trim();
};

const arePositionsEqual = (left: OrderPosition[], right: OrderPosition[]) => {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((position, index) => {
        const compared = right[index];

        return Number(position.товар_id) === Number(compared?.товар_id)
            && Number(position.количество) === Number(compared?.количество)
            && Number(position.цена) === Number(compared?.цена)
            && Number(position.ндс_id ?? UNSET_VAT_RATE_ID) === Number(compared?.ндс_id ?? UNSET_VAT_RATE_ID);
    });
};

interface Order {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    адрес_доставки?: string;
    статус: string;
    недостающие_товары?: Array<{
        статус: string;
        недостающее_количество: number;
    }>;
}

interface EditOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (orderData: any) => void;
    order: Order | null;
    canEdit?: boolean;
}

interface OrderWorkflowGuard {
    readyForShipment: boolean;
    activeShipmentCount: number;
    deliveredShipmentCount: number;
    canComplete: boolean;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({ isOpen, onClose, onSubmit, order, canEdit }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedClient, setSelectedClient] = useState<number | ''>('');
    const [selectedManager, setSelectedManager] = useState<number | ''>('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [status, setStatus] = useState('');
    const [positions, setPositions] = useState<OrderPosition[]>([]);
    const [initialPositions, setInitialPositions] = useState<OrderPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [initialDataLoading, setInitialDataLoading] = useState(false);
    const [defaultVatRateId, setDefaultVatRateId] = useState(DEFAULT_VAT_RATE_ID);
    const [workflowGuard, setWorkflowGuard] = useState<OrderWorkflowGuard | null>(null);

    const blocked = canEdit === false;
    const getProductSalePrice = (product?: Product | null) => Number(product?.цена_продажи ?? product?.цена ?? 0);

    useEffect(() => {
        if (isOpen && order) {
            setInitialDataLoading(true);
            loadClients();
            loadManagers();
            loadProducts();
            loadOrderData();
            void loadWorkflowGuard();
            void fetchDefaultVatRateId().then((value) => setDefaultVatRateId(value));
        }
    }, [isOpen, order]);

    useEffect(() => {
        if (!isOpen) return;
        if (clients.length > 0 && managers.length > 0 && products.length > 0) {
            setInitialDataLoading(false);
        }
    }, [isOpen, clients.length, managers.length, products.length]);

    useEffect(() => {
        if (isOpen && order) {
            setSelectedClient(order.клиент_id);
            setSelectedManager(order.менеджер_id || '');
            setDeliveryAddress(order.адрес_доставки || '');
            setStatus(normalizeEditableOrderStatus(order.статус));
        }
    }, [isOpen, order?.id]);

    const loadClients = async () => {
        try {
            const response = await fetch('/api/clients');
            if (response.ok) {
                const data = await response.json();
                setClients(data);
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    };

    const loadManagers = async () => {
        try {
            const response = await fetch('/api/managers');
            if (response.ok) {
                const data = await response.json();
                setManagers(data);
            }
        } catch (error) {
            console.error('Error loading managers:', error);
        }
    };

    const loadProducts = async () => {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    };

    const loadOrderData = async () => {
        if (!order) return;

        setSelectedClient(order.клиент_id);
        setSelectedManager(order.менеджер_id || '');
        setDeliveryAddress(order.адрес_доставки || '');
        setStatus(normalizeEditableOrderStatus(order.статус));

        // Load order positions
        try {
            const response = await fetch(`/api/orders/${order.id}/positions`);
            if (response.ok) {
                const positionsData = await response.json();
                if (!Array.isArray(positionsData) || positionsData.length === 0) {
                    setPositions([]);
                    setError('Не удалось загрузить позиции заявки');
                    return;
                }
                setPositions(positionsData.map((pos: any) => ({
                    id: pos.id,
                    товар_id: pos.товар_id,
                    количество: pos.количество,
                    цена: pos.цена,
                    ндс_id: pos.ндс_id == null ? UNSET_VAT_RATE_ID : Number(pos.ндс_id)
                })));
                setInitialPositions(positionsData.map((pos: any) => ({
                    id: pos.id,
                    товар_id: pos.товар_id,
                    количество: pos.количество,
                    цена: pos.цена,
                    ндс_id: pos.ндс_id == null ? UNSET_VAT_RATE_ID : Number(pos.ндс_id)
                })));
                setError('');
            }
        } catch (error) {
            console.error('Error loading order positions:', error);
            setError('Не удалось загрузить позиции заявки');
        }
    };

    const loadWorkflowGuard = async () => {
        if (!order) return;

        try {
            const response = await fetch(`/api/orders/${order.id}/workflow`);
            if (!response.ok) {
                throw new Error('Не удалось загрузить workflow заявки');
            }

            const data = await response.json();
            setWorkflowGuard({
                readyForShipment: Boolean(data?.readyForShipment),
                activeShipmentCount: Number(data?.activeShipmentCount || 0),
                deliveredShipmentCount: Number(data?.deliveredShipmentCount || 0),
                canComplete: Boolean(data?.canComplete),
            });
        } catch (workflowError) {
            console.error('Error loading order workflow guard:', workflowError);
            setWorkflowGuard(null);
        }
    };

    const addPosition = () => {
        if (blocked) return;
        setPositions([...positions, { товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId }]);
    };

    const updatePosition = (index: number, field: keyof OrderPosition, value: number) => {
        if (blocked) return;
        const updatedPositions = positions.map((pos, i) => {
            if (i === index) {
                const updatedPos = { ...pos, [field]: value };
                // Auto-update price when product is selected
                if (field === 'товар_id') {
                    const product = products.find(p => p.id === value);
                    if (product) {
                        updatedPos.цена = getProductSalePrice(product);
                    }
                }
                return updatedPos;
            }
            return pos;
        });
        setPositions(updatedPositions);
    };

    const removePosition = (index: number) => {
        if (blocked) return;
        setPositions(positions.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (blocked) {
            setError('Нет доступа');
            return;
        }

        if (!selectedClient) {
            setError('Выберите клиента');
            return;
        }

        if (positions.length === 0) {
            setError('Позиции заявки не загружены. Откройте заявку заново и попробуйте ещё раз');
            return;
        }

        const invalidPositions = positions.filter(pos => !pos.товар_id || pos.количество <= 0 || pos.цена <= 0);
        if (invalidPositions.length > 0) {
            setError('Заполните все поля позиций корректно');
            return;
        }

        if (positions.some((pos) => !Number(pos.ндс_id))) {
            setError('У некоторых позиций не задан НДС. Выберите ставку перед сохранением.');
            return;
        }

        setLoading(true);

        try {
            const positionsChanged = !arePositionsEqual(positions, initialPositions);
            const nextStatus = normalizeEditableOrderStatus(status) || normalizeEditableOrderStatus(order?.статус) || 'новая';
            const orderData = {
                id: order?.id,
                клиент_id: selectedClient,
                менеджер_id: selectedManager || null,
                адрес_доставки: deliveryAddress || null,
                статус: nextStatus,
                ...(positionsChanged ? { позиции: positions } : {})
            };

            await onSubmit(orderData);
            handleClose();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Ошибка обновления заявки');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedClient('');
        setSelectedManager('');
        setDeliveryAddress('');
        setStatus('');
        setPositions([]);
        setInitialPositions([]);
        setError('');
        onClose();
    };

    const getTotalAmount = () => {
        return positions.reduce((sum, pos) => (
            sum + calculateVatAmountsFromLine(pos.количество, pos.цена, getVatRateOptionSafe(pos.ндс_id).rate).total
        ), 0);
    };

    const clientValue = selectedClient === '' ? '' : String(selectedClient);
    const managerValue = selectedManager === '' ? '' : String(selectedManager);

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        for (const p of products) map.set(p.id, p);
        return map;
    }, [products]);

    if (!isOpen || !order) return null;

    const hasActiveMissingProducts = (order.недостающие_товары || []).some(
        (item) => item.статус !== 'получено' && Number(item.недостающее_количество) > 0
    );

    const statusOptions = [
        { value: 'новая', label: 'Новая', disabled: false },
        { value: 'в обработке', label: 'В обработке', disabled: false },
        { value: 'подтверждена', label: 'Подтверждена', disabled: false },
        { value: 'в работе', label: 'В работе', disabled: false },
        { value: 'собрана', label: 'Собрана', disabled: hasActiveMissingProducts || !workflowGuard?.readyForShipment },
        { value: 'отгружена', label: 'Отгружена', disabled: hasActiveMissingProducts || !((workflowGuard?.activeShipmentCount || 0) > 0 || (workflowGuard?.deliveredShipmentCount || 0) > 0) },
        { value: 'выполнена', label: 'Выполнена', disabled: hasActiveMissingProducts || !workflowGuard?.canComplete },
        { value: 'отменена', label: 'Отменена', disabled: false },
    ];

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Редактировать заявку #{order.id}</Dialog.Title>


                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Клиент *
                            </Text>
                            {clients.length === 0 ? (
                                <Select.Root value="">
                                    <Select.Trigger
                                        variant="surface"
                                        color="gray"
                                        className={styles.selectTrigger}
                                        disabled
                                    />
                                </Select.Root>
                            ) : (
                                <Select.Root
                                    key={`client-${order.id}-${clients.length}`}
                                    value={clientValue}
                                    onValueChange={(value) => setSelectedClient(value ? Number(value) : '')}
                                >
                                    <Select.Trigger
                                        variant="surface"
                                        color="gray"
                                        className={styles.selectTrigger}
                                        disabled={initialDataLoading}
                                        placeholder="Выберите клиента"
                                    />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        {clients.map((client) => (
                                            <Select.Item key={client.id} value={String(client.id)}>
                                                {client.название}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            )}
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Менеджер
                            </Text>
                            {managers.length === 0 ? (
                                <Select.Root value="">
                                    <Select.Trigger
                                        variant="surface"
                                        color="gray"
                                        className={styles.selectTrigger}
                                        disabled
                                    />
                                </Select.Root>
                            ) : (
                                <Select.Root
                                    key={`manager-${order.id}-${managers.length}`}
                                    value={managerValue}
                                    onValueChange={(value) => setSelectedManager(value ? Number(value) : '')}
                                >
                                    <Select.Trigger
                                        variant="surface"
                                        color="gray"
                                        className={styles.selectTrigger}
                                        disabled={initialDataLoading}
                                        placeholder="Выберите менеджера"
                                    />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        {managers.map((manager) => (
                                            <Select.Item key={manager.id} value={String(manager.id)}>
                                                {manager.фио} {manager.должность && `(${manager.должность})`}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            )}
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Статус *
                            </Text>
                                <Select.Root value={status} onValueChange={setStatus}>
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        {statusOptions.map((option) => (
                                            <Select.Item key={option.value} value={option.value} disabled={option.disabled}>
                                                {option.label}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                                {(hasActiveMissingProducts || workflowGuard) && (
                                    <Text as="p" size="1" color="gray" mt="2">
                                        {hasActiveMissingProducts
                                            ? 'Статусы «Собрана», «Отгружена» и «Выполнена» закрыты, пока по заявке есть активные недостачи.'
                                            : workflowGuard?.canComplete
                                                ? 'Заявку уже можно завершать: у нее есть доставленная отгрузка.'
                                                : workflowGuard?.readyForShipment
                                                    ? 'Заявка собрана и готова к созданию отгрузки.'
                                                    : 'Поздние статусы откроются автоматически по мере прохождения закупки, склада и отгрузки.'}
                                    </Text>
                                )}
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Адрес доставки
                            </Text>
                            <TextField.Root
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                placeholder="Введите адрес доставки"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.positionsSection}>
                            <Flex align="center" justify="between" mb="3" className={styles.positionsHeader}>
                                <Text as="span" size="4" weight="medium">
                                    Позиции заявки
                                </Text>
                                <Button type="button" variant="surface" color="gray" highContrast onClick={addPosition}>
                                    Добавить позицию
                                </Button>
                            </Flex>

                            <Box className={styles.positionsTable}>
                                {positions.length > 0 && (
                                    <Box className={styles.positionHeaderRow}>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Товар</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Ед.изм</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Кол-во</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Цена, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellRight}`}>Сумма без НДС, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>НДС</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellRight}`}>Сумма НДС, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellRight}`}>Всего, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellCenter}`} />
                                    </Box>
                                )}

                                <Flex direction="column" gap="2">
                                    {positions.map((position, index) => {
                                        const selectedProduct = productsById.get(position.товар_id);
                                        const basePrice = getProductSalePrice(selectedProduct);
                                        const minPrice = basePrice > 0 ? basePrice * 0.9 : 0;
                                        const showMinPrice = minPrice > 0;
                                        const priceIsLow = showMinPrice && position.цена < minPrice;
                                        const vatOption = getVatRateOptionSafe(position.ндс_id);
                                        const vatAmounts = calculateVatAmountsFromLine(position.количество, position.цена, vatOption.rate);

                                        return (
                                            <Box key={index} className={styles.positionRow}>
                                                <Select.Root
                                                    value={position.товар_id ? String(position.товар_id) : ''}
                                                    onValueChange={(value) => updatePosition(index, 'товар_id', value ? Number(value) : 0)}
                                                >
                                                    <Select.Trigger variant="surface" color="gray" className={styles.positionSelectTrigger} />
                                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                        {products.map((product) => (
                                                            <Select.Item key={product.id} value={String(product.id)}>
                                                                {product.артикул ? `${product.артикул} - ` : ''}{product.название}
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Content>
                                                </Select.Root>

                                                <Text as="span" size="2" className={styles.unitValue}>
                                                    {selectedProduct?.единица_измерения || 'шт'}
                                                </Text>

                                                <TextField.Root
                                                    type="number"
                                                    value={String(position.количество)}
                                                    onChange={(e) => updatePosition(index, 'количество', Number(e.target.value))}
                                                    placeholder="Кол-во"
                                                    min={1}
                                                    className={styles.qtyField}
                                                    size="2"
                                                />

                                                <Flex direction="column" gap="1">
                                                    <TextField.Root
                                                        type="number"
                                                        value={String(position.цена)}
                                                        onChange={(e) => updatePosition(index, 'цена', Number(e.target.value))}
                                                        placeholder="Цена"
                                                        min={0}
                                                        step={0.01}
                                                        className={priceIsLow ? styles.priceFieldInvalid : styles.priceField}
                                                        size="2"
                                                    />
                                                    {showMinPrice && (
                                                        <Text size="1" color={priceIsLow ? 'red' : 'gray'} className={styles.minPriceHint}>
                                                            Мин. {minPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                        </Text>
                                                    )}
                                                </Flex>

                                                <Text as="span" size="2" weight="medium" className={styles.positionMetric}>
                                                    {vatAmounts.net.toLocaleString('ru-RU', {
                                                        style: 'currency',
                                                        currency: 'RUB',
                                                    })}
                                                </Text>

                                                <Select.Root
                                                    value={String(position.ндс_id || UNSET_VAT_RATE_ID)}
                                                    onValueChange={(value) => updatePosition(index, 'ндс_id', value ? Number(value) : UNSET_VAT_RATE_ID)}
                                                >
                                                    <Select.Trigger variant="surface" color="gray" className={styles.vatField} />
                                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                        {VAT_RATE_OPTIONS_WITH_UNSET.map((option) => (
                                                            <Select.Item key={option.id} value={String(option.id)}>
                                                                {option.label}
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Content>
                                                </Select.Root>

                                                <Text as="span" size="2" weight="medium" className={styles.positionMetric}>
                                                    {vatAmounts.tax.toLocaleString('ru-RU', {
                                                        style: 'currency',
                                                        currency: 'RUB',
                                                    })}
                                                </Text>

                                                <Text as="span" size="2" weight="medium" className={styles.positionTotal}>
                                                    {vatAmounts.total.toLocaleString('ru-RU', {
                                                        style: 'currency',
                                                        currency: 'RUB',
                                                    })}
                                                </Text>

                                                <Button
                                                    type="button"
                                                    variant="surface"
                                                    color="gray"
                                                    highContrast
                                                    className={styles.removePositionButton}
                                                    onClick={() => removePosition(index)}
                                                >
                                                    ×
                                                </Button>
                                            </Box>
                                        );
                                    })}
                                </Flex>
                            </Box>

                            {positions.length > 0 && (
                                <Box className={styles.totalAmount}>
                                    <Text weight="bold">
                                        Общая сумма:{' '}
                                        {getTotalAmount().toLocaleString('ru-RU', {
                                            style: 'currency',
                                            currency: 'RUB',
                                        })}
                                    </Text>
                                </Box>
                            )}
                        </Box>

                        {error && (
                            <Box className={styles.error}>
                                <Text size="2">{error}</Text>
                            </Box>
                        )}

                        <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose}>
                                Отмена
                            </Button>
                            <Button type="submit" variant="solid" color="gray" highContrast disabled={loading || blocked} loading={loading}>
                                Сохранить изменения
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default EditOrderModal;
