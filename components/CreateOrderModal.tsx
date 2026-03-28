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
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
}

interface CreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (orderData: any) => void;
    canCreate?: boolean;
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ isOpen, onClose, onSubmit, canCreate }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedClient, setSelectedClient] = useState<number | ''>('');
    const [selectedManager, setSelectedManager] = useState<number | ''>('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [positions, setPositions] = useState<OrderPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [defaultVatRateId, setDefaultVatRateId] = useState(DEFAULT_VAT_RATE_ID);

    const blocked = canCreate === false;
    const getProductSalePrice = (product?: Product | null) => Number(product?.цена_продажи ?? product?.цена ?? 0);

    const canSubmit = useMemo(() => {
        if (blocked) return false;
        if (loading) return false;
        if (!selectedClient) return false;
        if (positions.length === 0) return false;

        const invalidPositions = positions.filter((pos) => {
            if (!pos.товар_id || pos.количество <= 0 || pos.цена <= 0) return true;
            const product = products.find((p) => p.id === pos.товар_id);
            const basePrice = getProductSalePrice(product);
            if (basePrice > 0 && pos.цена < basePrice * 0.9) return true;
            return false;
        });

        return invalidPositions.length === 0;
    }, [blocked, loading, selectedClient, positions, products]);

    useEffect(() => {
        if (isOpen) {
            loadClients();
            loadManagers();
            loadProducts();
            void fetchDefaultVatRateId().then((value) => setDefaultVatRateId(value));
        }
    }, [isOpen]);

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

    const addPosition = () => {
        if (blocked) return;
        setPositions([...positions, { товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId }]);
    };

    const updatePosition = (index: number, field: keyof OrderPosition, value: number) => {
        if (blocked) return;
        const updatedPositions = positions.map((pos, i) => {
            if (i === index) {
                const updatedPos = { ...pos, [field]: value };
                // Auto-update price when product is selected (use the selling price from database)
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
            setError('Добавьте хотя бы одну позицию');
            return;
        }

        const invalidPositions = positions.filter(pos => {
            if (!pos.товар_id || pos.количество <= 0 || pos.цена <= 0) {
                return true;
            }
            // Check if price is at least 90% of the base price
            const product = products.find(p => p.id === pos.товар_id);
            const basePrice = getProductSalePrice(product);
            if (basePrice > 0 && pos.цена < basePrice * 0.9) {
                return true;
            }
            return false;
        });
        if (invalidPositions.length > 0) {
            setError('Заполните все поля позиций корректно. Цена не может быть ниже 90% от базовой цены');
            return;
        }

        setLoading(true);

        try {
            const orderData = {
                клиент_id: selectedClient,
                менеджер_id: selectedManager || null,
                адрес_доставки: deliveryAddress || null,
                позиции: positions
            };

            console.log('Sending order data:', orderData); // Debug log
            await onSubmit(orderData);
            handleClose();
        } catch (error) {
            console.error('Error in CreateOrderModal:', error); // Debug log
            setError('Ошибка создания заявки: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedClient('');
        setSelectedManager('');
        setDeliveryAddress('');
        setPositions([]);
        setError('');
        onClose();
    };

    const getTotalAmount = () => {
        return positions.reduce((sum, pos) => (
            sum + calculateVatAmountsFromLine(pos.количество, pos.цена, getVatRateOption(pos.ндс_id).rate).total
        ), 0);
    };

    const clientValue = selectedClient === '' ? '' : String(selectedClient);
    const managerValue = selectedManager === '' ? '' : String(selectedManager);

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        for (const p of products) map.set(p.id, p);
        return map;
    }, [products]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Создать новую заявку</Dialog.Title>


                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">Клиент *</Text>
                            <Select.Root value={clientValue} onValueChange={(value) => setSelectedClient(value ? Number(value) : '')}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {clients.map((client) => (
                                        <Select.Item key={client.id} value={String(client.id)}>
                                            {client.название}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">Менеджер</Text>
                            <Select.Root value={managerValue} onValueChange={(value) => setSelectedManager(value ? Number(value) : '')}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {managers.map((manager) => (
                                        <Select.Item key={manager.id} value={String(manager.id)}>
                                            {manager.фио} {manager.должность && `(${manager.должность})`}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">Адрес доставки</Text>
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
                                <Text as="span" size="4" weight="medium">Позиции заявки</Text>
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
                                        const vatAmounts = calculateVatAmountsFromLine(position.количество, position.цена, getVatRateOption(position.ндс_id).rate);

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
                                                    value={String(position.ндс_id || DEFAULT_VAT_RATE_ID)}
                                                    onValueChange={(value) => updatePosition(index, 'ндс_id', value ? Number(value) : defaultVatRateId)}
                                                >
                                                    <Select.Trigger variant="surface" color="gray" className={styles.vatField} />
                                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                        {VAT_RATE_OPTIONS.map((option) => (
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

                                                <Button type="button" variant="surface" color="gray" highContrast onClick={() => removePosition(index)}>
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
                            <Button type="submit" variant="solid" color="gray" highContrast disabled={!canSubmit || blocked} loading={loading}>
                                Создать заявку
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default CreateOrderModal;
