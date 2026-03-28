import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import styles from './CreatePurchaseModal.module.css';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, fetchDefaultVatRateId, getVatRateOption, VAT_RATE_OPTIONS } from '../lib/vat';
import OrderSearchSelect from './OrderSearchSelect';

interface Product {
    id: number;
    название: string;
    артикул: string;
    единица_измерения: string;
    цена?: number;
    цена_продажи?: number;
}

interface Supplier {
    id: number;
    название: string;
}

interface TransportOption {
    id: number;
    название: string;
}

interface OrderOption {
    id: number;
    клиент_название?: string;
}

interface PurchasePosition {
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
    включена: boolean;
}

export interface OrderPositionSnapshot {
    товар_id: number;
    количество: number;
    ндс_id?: number;
    цена?: number;
}

const normalizeOrderPositionSnapshot = (
    snapshot: OrderPositionSnapshot,
    vatRateId: number
): PurchasePosition => {
    const productId = Number(snapshot.товар_id) || 0;
    const quantity = Number(snapshot.количество) || 1;
    const price = Number(snapshot.цена ?? 0) || 0;
    const rawVatId = snapshot.ндс_id;

    return {
        товар_id: productId,
        количество: quantity > 0 ? quantity : 1,
        цена: price,
        ндс_id: rawVatId == null ? vatRateId : Number(rawVatId) || vatRateId,
        включена: true,
    };
};

interface CreatePurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchaseCreated: () => void;
    поставщик_id?: number;
    поставщик_название?: string;
    заявка_id?: number;
    lockOrderId?: boolean;
    initialOrderPositions?: OrderPositionSnapshot[];
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({
    isOpen,
    onClose,
    onPurchaseCreated,
    поставщик_id = 0,
    поставщик_название = '',
    заявка_id,
    lockOrderId = false,
    initialOrderPositions
}) => {
    const submitLockRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [transports, setTransports] = useState<TransportOption[]>([]);
    const [orders, setOrders] = useState<OrderOption[]>([]);
    const [createToken, setCreateToken] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number>(поставщик_id);
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>(поставщик_название);
    const [selectedOrderId, setSelectedOrderId] = useState<number>(заявка_id || 0);
    const [формаДанные, setФормаДанные] = useState({
        статус: 'заказано',
        дата_поступления: '',
        использовать_доставку: false,
        транспорт_id: 0,
        стоимость_доставки: '',
    });
    const [позиции, setПозиции] = useState<PurchasePosition[]>([
        { товар_id: 0, количество: 1, цена: 0, ндс_id: DEFAULT_VAT_RATE_ID, включена: true }
    ]);
    const [defaultVatRateId, setDefaultVatRateId] = useState(DEFAULT_VAT_RATE_ID);
    const getProductSalePrice = (product?: Product | null) => Number(product?.цена_продажи ?? product?.цена ?? 0);

    const buildInitialPositions = (vatRateId: number): PurchasePosition[] => {
        if (!initialOrderPositions || initialOrderPositions.length === 0) {
            return [{ товар_id: 0, количество: 1, цена: 0, ндс_id: vatRateId, включена: true }];
        }

        return initialOrderPositions.map((snapshot) => normalizeOrderPositionSnapshot(snapshot, vatRateId));
    };

    const resetModalState = (vatRateId: number) => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        const pad = (n: number) => String(n).padStart(2, '0');
        const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

        setError(null);
        setCreateToken('');
        setSelectedSupplierId(Number(поставщик_id) || 0);
        setSelectedSupplierName(поставщик_название || '');
        setSelectedOrderId(Number(заявка_id) || 0);
        setФормаДанные({
            статус: 'заказано',
            дата_поступления: value,
            использовать_доставку: false,
            транспорт_id: 0,
            стоимость_доставки: '',
        });
        setПозиции(buildInitialPositions(vatRateId));
    };

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!createToken) return false;
        if (!selectedSupplierId) return false;
        if (формаДанные.использовать_доставку && !формаДанные.транспорт_id) return false;

        const validPositions = позиции.filter((pos) => pos.включена && pos.товар_id > 0 && pos.количество > 0 && pos.цена > 0);
        return validPositions.length > 0;
    }, [createToken, loading, selectedSupplierId, формаДанные.использовать_доставку, формаДанные.транспорт_id, позиции]);

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        for (const p of products) map.set(p.id, p);
        return map;
    }, [products]);
    const supplierOptions = useMemo(
        () => suppliers.map((supplier) => ({ value: String(supplier.id), label: supplier.название })),
        [suppliers]
    );
    const orderOptions = useMemo(
        () => orders.map((order) => ({
            value: String(order.id),
            label: `#${order.id}${order.клиент_название ? ` — ${order.клиент_название}` : ''}`,
        })),
        [orders]
    );
    const purchaseOrderOptions = useMemo(
        () => [{ value: '', label: 'Без заявки' }, ...orderOptions],
        [orderOptions]
    );
    const transportOptions = useMemo(
        () => transports.map((transport) => ({ value: String(transport.id), label: transport.название })),
        [transports]
    );
    const productOptions = useMemo(
        () => products.map((product) => ({
            value: String(product.id),
            label: `${product.артикул ? `${product.артикул} - ` : ''}${product.название}`,
        })),
        [products]
    );

    const datePart = формаДанные.дата_поступления ? формаДанные.дата_поступления.slice(0, 10) : '';
    const timePart = формаДанные.дата_поступления ? формаДанные.дата_поступления.slice(11, 16) : '';

    useEffect(() => {
        if (!isOpen) {
            submitLockRef.current = false;
            return;
        }

        const nextVatRateId = defaultVatRateId || DEFAULT_VAT_RATE_ID;
        resetModalState(nextVatRateId);
        fetchProducts();
        fetchSuppliers();
        void fetchOrders();
        void fetchTransports();
        void fetchCreateToken();
        void fetchDefaultVatRateId().then((value) => {
            setDefaultVatRateId(value);
            setПозиции((prev) => prev.map((item) => ({
                ...item,
                ндс_id: item.ндс_id || value,
            })));
        });
    }, [isOpen, поставщик_id, поставщик_название, initialOrderPositions]);

    useEffect(() => {
        if (!isOpen) return;
        if (products.length === 0) return;

        setПозиции((prev) => prev.map((item) => {
            if (!item.товар_id || Number(item.цена) > 0) return item;
            const product = productsById.get(item.товар_id);
            const price = getProductSalePrice(product);
            if (price <= 0) return item;
            return {
                ...item,
                цена: price,
            };
        }));
    }, [isOpen, products, productsById]);

    const fetchProducts = async () => {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/suppliers');
            if (response.ok) {
                const data = await response.json();
                setSuppliers(data);
                setSelectedSupplierId((prev) => (
                    prev && data.some((supplier: Supplier) => supplier.id === prev) ? prev : 0
                ));
                setSelectedSupplierName((prevName) => {
                    if (!prevName) return '';
                    const matchByName = data.find((supplier: Supplier) => supplier.название === prevName);
                    return matchByName?.название || '';
                });
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await fetch('/api/orders');
            const data = await response.json().catch(() => []);
            const list = Array.isArray(data) ? data : [];
            setOrders(
                list
                    .map((item: any) => ({
                        id: Number(item?.id),
                        клиент_название: String(item?.клиент_название || ''),
                    }))
                    .filter((item: OrderOption) => Number.isFinite(item.id) && item.id > 0)
            );
        } catch (fetchOrdersError) {
            console.error('Error fetching orders:', fetchOrdersError);
            setOrders([]);
        }
    };

    const fetchCreateToken = async () => {
        try {
            const response = await fetch('/api/purchases/create-token');
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось подготовить создание закупки');
            }

            setCreateToken(String(data?.token || ''));
        } catch (tokenError) {
            console.error('Error fetching purchase create token:', tokenError);
            setCreateToken('');
            setError(tokenError instanceof Error ? tokenError.message : 'Не удалось подготовить создание закупки');
        }
    };

    const fetchTransports = async () => {
        try {
            const response = await fetch('/api/transport');
            const data = await response.json().catch(() => []);
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.transport)
                    ? data.transport
                    : [];
            setTransports(
                list
                    .map((item: any) => ({ id: Number(item?.id), название: String(item?.название || '') }))
                    .filter((item: TransportOption) => Number.isFinite(item.id) && item.id > 0)
            );
        } catch (transportError) {
            console.error('Error fetching transports:', transportError);
            setTransports([]);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setФормаДанные(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePositionChange = (index: number, field: keyof PurchasePosition, value: string | number | boolean) => {
        const newPositions = [...позиции];
        const parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        newPositions[index] = {
            ...newPositions[index],
            [field]: parsedValue
        };
        if (field === 'товар_id') {
            const product = products.find((item) => item.id === Number(parsedValue));
            if (product) {
                newPositions[index].цена = getProductSalePrice(product);
            }
        }
        setПозиции(newPositions);
    };

    const addPosition = () => {
        setПозиции([...позиции, { товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId, включена: true }]);
    };

    const removePosition = (index: number) => {
        if (позиции.length > 1) {
            setПозиции(позиции.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current) return;
        submitLockRef.current = true;
        setLoading(true);
        setError(null);

        try {
            // Validate positions
            const validPositions = позиции
                .filter(pos => pos.включена && pos.товар_id > 0 && pos.количество > 0 && pos.цена > 0)
                .map(({ включена, ...rest }) => rest);

            if (validPositions.length === 0) {
                throw new Error('Добавьте хотя бы одну позицию с корректными данными');
            }

            if (формаДанные.использовать_доставку && !формаДанные.транспорт_id) {
                throw new Error('Выберите транспортную компанию для доставки закупки');
            }

            const response = await fetch('/api/purchases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-purchase-create-source': 'manual-modal',
                },
                body: JSON.stringify({
                    create_token: createToken,
                    поставщик_id: selectedSupplierId,
                    заявка_id: selectedOrderId || null,
                    статус: формаДанные.статус,
                    дата_поступления: формаДанные.дата_поступления || null,
                    использовать_доставку: формаДанные.использовать_доставку,
                    транспорт_id: формаДанные.использовать_доставку ? Number(формаДанные.транспорт_id) : null,
                    стоимость_доставки: формаДанные.использовать_доставку && формаДанные.стоимость_доставки.trim()
                        ? Number(формаДанные.стоимость_доставки)
                        : null,
                    позиции: validPositions
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания закупки');
            }

            onPurchaseCreated();
            onClose();
            // Reset form
            setФормаДанные({ статус: 'заказано', дата_поступления: '', использовать_доставку: false, транспорт_id: 0, стоимость_доставки: '' });
            setПозиции([{ товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId, включена: true }]);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        } finally {
            submitLockRef.current = false;
            setLoading(false);
        }
    };

    const getTotalAmount = () => {
        return позиции.filter((pos) => pos.включена).reduce((sum, pos) => (
            sum + calculateVatAmountsFromLine(pos.количество, pos.цена, getVatRateOption(pos.ндс_id).rate).total
        ), 0);
    };

    const deliveryAmount = формаДанные.использовать_доставку
        ? Number(формаДанные.стоимость_доставки || 0)
        : 0;
    const grandTotalAmount = getTotalAmount() + deliveryAmount;

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Создать закупку</Dialog.Title>


                {selectedSupplierName ? (
                    <Text as="div" size="2" color="gray" className={styles.supplierLine}>
                        Поставщик: <Text as="span" weight="bold" color="gray">{selectedSupplierName}</Text>
                    </Text>
                ) : null}

                {error && (
                    <Box className={styles.error}>
                        <Text size="2">{error}</Text>
                    </Box>
                )}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <OrderSearchSelect
                                    label="Поставщик"
                                    value={selectedSupplierId ? String(selectedSupplierId) : ''}
                                    onValueChange={(value) => {
                                        const id = value ? Number(value) : 0;
                                        setSelectedSupplierId(id);
                                        const found = suppliers.find((s) => s.id === id);
                                        setSelectedSupplierName(found?.название || '');
                                    }}
                                    options={supplierOptions}
                                    placeholder="Поиск поставщика"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Статус закупки</Text>
                                <Select.Root value={формаДанные.статус} onValueChange={(value) => setФормаДанные((p) => ({ ...p, статус: value }))}>
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="заказано">Заказано</Select.Item>
                                        <Select.Item value="в пути">В пути</Select.Item>
                                        <Select.Item value="получено">Получено</Select.Item>
                                        <Select.Item value="отменено">Отменено</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Заявка</Text>
                                {lockOrderId ? (
                                    <TextField.Root
                                        value={
                                            selectedOrderId
                                                ? `#${selectedOrderId}${orders.find((item) => item.id === selectedOrderId)?.клиент_название ? ` — ${orders.find((item) => item.id === selectedOrderId)?.клиент_название}` : ''}`
                                                : ''
                                        }
                                        readOnly
                                        className={styles.textField}
                                        size="2"
                                    />
                                ) : (
                                    <OrderSearchSelect
                                        value={selectedOrderId ? String(selectedOrderId) : ''}
                                        onValueChange={(value) => setSelectedOrderId(value ? Number(value) || 0 : 0)}
                                        options={purchaseOrderOptions}
                                        placeholder="Без заявки"
                                    />
                                )}
                                {!selectedOrderId ? (
                                    <Text as="span" size="1" color="gray">
                                        Если заявку не выбирать, закупка будет оформлена как поступление сразу на склад.
                                    </Text>
                                ) : null}
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Дата поступления (опционально)</Text>
                                <Flex gap="2" wrap="wrap">
                                    <TextField.Root
                                        type="date"
                                        value={datePart}
                                        onChange={(e) => {
                                            const nextDate = e.target.value;
                                            const nextTime = timePart || '00:00';
                                            setФормаДанные((p) => ({ ...p, дата_поступления: nextDate ? `${nextDate}T${nextTime}` : '' }));
                                        }}
                                        className={`${styles.textField} ${styles.dateField}`}
                                        size="2"
                                    />

                                </Flex>
                            </Box>

                            <Box className={styles.formGroup}>
                                <label className={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked={формаДанные.использовать_доставку}
                                        onChange={(e) => setФормаДанные((p) => ({
                                            ...p,
                                            использовать_доставку: e.target.checked,
                                            транспорт_id: e.target.checked ? p.транспорт_id : 0,
                                            стоимость_доставки: e.target.checked ? p.стоимость_доставки : '',
                                        }))}
                                        className={styles.includeCheckbox}
                                    />
                                    <span>Использовать доставку</span>
                                </label>
                                <Text as="span" size="1" color="gray">
                                    Если выключено, считаем, что закупку забрали сами.
                                </Text>
                            </Box>

                            {формаДанные.использовать_доставку ? (
                                <>
                                    <Box className={styles.formGroup}>
                                        <OrderSearchSelect
                                            label="Кто доставляет"
                                            value={формаДанные.транспорт_id ? String(формаДанные.транспорт_id) : ''}
                                            onValueChange={(value) => setФормаДанные((p) => ({ ...p, транспорт_id: value ? Number(value) : 0 }))}
                                            options={transportOptions}
                                            placeholder="Выберите ТК"
                                        />
                                    </Box>

                                    <Box className={styles.formGroup}>
                                        <Text as="label" size="2" weight="medium">Стоимость доставки (опционально)</Text>
                                        <TextField.Root
                                            value={формаДанные.стоимость_доставки}
                                            onChange={(e) => setФормаДанные((p) => ({ ...p, стоимость_доставки: e.target.value }))}
                                            placeholder="400.00"
                                            className={styles.textField}
                                            size="2"
                                        />
                                    </Box>
                                </>
                            ) : null}
                        </div>

                        <Box className={styles.positionsSection}>
                            <Flex align="center" justify="between" mb="3" className={styles.positionsHeader}>
                                <Text as="span" size="4" weight="medium">Позиции закупки</Text>
                                <Flex gap="2" wrap="wrap" justify="end">
                                    {initialOrderPositions && initialOrderPositions.length > 0 ? (
                                        <>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => setПозиции((prev) => prev.map((item) => ({ ...item, включена: true })))}
                                                className={styles.addPositionButton}
                                            >
                                                Выбрать все
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => setПозиции((prev) => prev.map((item) => ({ ...item, включена: false })))}
                                                className={styles.addPositionButton}
                                            >
                                                Оставить на потом
                                            </Button>
                                        </>
                                    ) : null}
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        onClick={addPosition}
                                        className={styles.addPositionButton}
                                    >
                                        Добавить позицию
                                    </Button>
                                </Flex>
                            </Flex>

                            <Box className={styles.positionsTable}>
                                {позиции.length > 0 && (
                                    <Box className={styles.positionHeaderRow}>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellCenter}`}>В закупку</Text>
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
                                    {позиции.map((position, index) => {
                                        const selectedProduct = productsById.get(position.товар_id);
                                        const vatAmounts = calculateVatAmountsFromLine(position.количество, position.цена, getVatRateOption(position.ндс_id).rate);

                                        return (
                                            <Box key={index} className={`${styles.positionRow} ${!position.включена ? styles.positionRowMuted : ''}`}>
                                                <label className={styles.includeCell}>
                                                    <input
                                                        type="checkbox"
                                                        checked={position.включена}
                                                        onChange={(e) => handlePositionChange(index, 'включена', e.target.checked)}
                                                        className={styles.includeCheckbox}
                                                    />
                                                    <span className={styles.includeLabel}>
                                                        {position.включена ? 'Да' : 'Позже'}
                                                    </span>
                                                </label>

                                                <OrderSearchSelect
                                                    value={position.товар_id ? String(position.товар_id) : ''}
                                                    onValueChange={(value) => handlePositionChange(index, 'товар_id', value ? Number(value) : 0)}
                                                    options={productOptions}
                                                    placeholder="Выберите товар"
                                                    compact
                                                    menuPlacement="top"
                                                    inputClassName={styles.positionSearchSelectInput}
                                                    menuClassName={styles.positionSearchSelectMenu}
                                                />

                                                <Text as="span" size="2" className={styles.unitValue}>
                                                    {selectedProduct?.единица_измерения || 'шт'}
                                                </Text>

                                                <TextField.Root
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={String(position.количество)}
                                                    onChange={(e) => handlePositionChange(index, 'количество', e.target.value)}
                                                    className={styles.qtyField}
                                                    size="2"
                                                />

                                                <TextField.Root
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={String(position.цена)}
                                                    onChange={(e) => handlePositionChange(index, 'цена', e.target.value)}
                                                    className={styles.priceField}
                                                    size="2"
                                                />

                                                <Text as="span" size="2" weight="medium" className={styles.positionMetric}>
                                                    {vatAmounts.net.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                </Text>

                                                <Select.Root
                                                    value={String(position.ндс_id || DEFAULT_VAT_RATE_ID)}
                                                    onValueChange={(value) => handlePositionChange(index, 'ндс_id', value ? Number(value) : defaultVatRateId)}
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
                                                    {vatAmounts.tax.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                </Text>

                                                <Text as="span" size="2" weight="medium" className={styles.positionTotal}>
                                                    {vatAmounts.total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                </Text>

                                                <Button
                                                    type="button"
                                                    variant="surface"
                                                    color="gray"
                                                    highContrast
                                                    onClick={() => removePosition(index)}
                                                    disabled={позиции.length === 1}
                                                    className={styles.removePositionButton}
                                                >
                                                    ×
                                                </Button>
                                            </Box>
                                        );
                                    })}
                                </Flex>
                            </Box>

                            <Box className={styles.totalAmount}>
                                <Text size="2" className={styles.totalRowSecondary}>
                                    Сумма товаров:{' '}
                                    {getTotalAmount().toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </Text>
                                <Text size="2" className={styles.totalRowSecondary}>
                                    Стоимость доставки:{' '}
                                    {deliveryAmount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </Text>
                                <Text weight="bold" className={styles.totalRowPrimary}>
                                    Общая сумма:{' '}
                                    {grandTotalAmount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </Text>
                            </Box>
                        </Box>

                        <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={onClose}
                                disabled={loading}
                                className={styles.secondaryButton}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                color="gray"
                                highContrast
                                disabled={!canSubmit}
                                loading={loading}
                                className={styles.primaryButton}
                            >
                                Создать закупку
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};
