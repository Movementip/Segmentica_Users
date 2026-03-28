import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import styles from './CreatePurchaseModal.module.css';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, fetchDefaultVatRateId, getVatRateOption, VAT_RATE_OPTIONS } from '../lib/vat';

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

interface PurchasePosition {
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

interface Purchase {
    id: number;
    поставщик_id: number;
    поставщик_название?: string;
    заявка_id?: number;
    статус: string;
    дата_поступления?: string;
    позиции?: PurchasePosition[];
}

interface EditPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (purchaseData: any) => void;
    purchase: Purchase | null;
}

const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({ isOpen, onClose, onSubmit, purchase }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');

    const [формаДанные, setФормаДанные] = useState({
        статус: 'заказано',
        дата_поступления: '',
        заявка_id: '',
    });
    const [defaultVatRateId, setDefaultVatRateId] = useState(DEFAULT_VAT_RATE_ID);

    const normalizePurchaseStatus = (raw: string) => {
        const s = (raw || '').toLowerCase();
        if (s === 'заказано' || s === 'в пути' || s === 'получено' || s === 'отменено') return s;
        return 'заказано';
    };

    const [позиции, setПозиции] = useState<PurchasePosition[]>([{ товар_id: 0, количество: 1, цена: 0, ндс_id: DEFAULT_VAT_RATE_ID }]);
    const getProductSalePrice = (product?: Product | null) => Number(product?.цена_продажи ?? product?.цена ?? 0);

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        for (const p of products) map.set(p.id, p);
        return map;
    }, [products]);

    const datePart = формаДанные.дата_поступления ? формаДанные.дата_поступления.slice(0, 10) : '';
    const timePart = формаДанные.дата_поступления ? формаДанные.дата_поступления.slice(11, 16) : '';

    useEffect(() => {
        if (!isOpen || !purchase) return;

        setError(null);
        setLoading(true);
        void fetchDefaultVatRateId().then((value) => setDefaultVatRateId(value));

        const init = async () => {
            try {
                const [productsRes, suppliersRes, purchaseRes] = await Promise.all([
                    fetch('/api/products'),
                    fetch('/api/suppliers'),
                    fetch(`/api/purchases?id=${purchase.id}`),
                ]);

                if (productsRes.ok) {
                    const data = await productsRes.json();
                    setProducts(Array.isArray(data) ? data : []);
                }

                if (suppliersRes.ok) {
                    const data = await suppliersRes.json();
                    setSuppliers(Array.isArray(data) ? data : []);
                }

                let purchaseFull: Purchase = purchase;
                if (purchaseRes.ok) {
                    purchaseFull = await purchaseRes.json();
                }

                const supplierId = Number(purchaseFull.поставщик_id) || 0;
                setSelectedSupplierId(purchaseFull.поставщик_id || null);
                setSelectedSupplierName(purchaseFull.поставщик_название || '');

                setФормаДанные({
                    статус: normalizePurchaseStatus(purchaseFull.статус || 'заказано'),
                    дата_поступления: purchaseFull.дата_поступления ? String(purchaseFull.дата_поступления).slice(0, 16) : '',
                    заявка_id: purchaseFull.заявка_id ? String(purchaseFull.заявка_id) : '',
                });

                const nextPositions = Array.isArray(purchaseFull.позиции) && purchaseFull.позиции.length
                    ? purchaseFull.позиции.map((pos) => ({
                        id: pos.id,
                        товар_id: Number(pos.товар_id) || 0,
                        количество: Number(pos.количество) || 1,
                        цена: Number(pos.цена) || 0,
                        ндс_id: pos.ндс_id == null ? UNSET_VAT_RATE_ID : Number(pos.ндс_id),
                    }))
                    : [{ товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId }];

                setПозиции(nextPositions);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [isOpen, purchase?.id]);

    const handlePositionChange = (index: number, field: keyof PurchasePosition, value: string | number) => {
        setПозиции((prev) => {
            const next = [...prev];
            const current = next[index];
            const parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
            next[index] = {
                ...current,
                [field]: parsedValue,
            };
            if (field === 'товар_id') {
                const product = products.find((item) => item.id === Number(parsedValue));
                if (product) {
                    next[index].цена = getProductSalePrice(product);
                }
            }
            return next;
        });
    };

    const addPosition = () => {
        setПозиции((prev) => [...prev, { товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId }]);
    };

    const removePosition = (index: number) => {
        setПозиции((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    };

    const getTotalAmount = () => {
        return позиции.reduce((sum, pos) => (
            sum + calculateVatAmountsFromLine(pos.количество, pos.цена, getVatRateOptionSafe(pos.ндс_id).rate).total
        ), 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!purchase) return;

        setLoading(true);
        setError(null);

        try {
            const validPositions = позиции.filter((pos) => pos.товар_id > 0 && pos.количество > 0 && pos.цена > 0);
            if (validPositions.length === 0) {
                throw new Error('Добавьте хотя бы одну позицию с корректными данными');
            }
            if (validPositions.some((pos) => !Number(pos.ндс_id))) {
                throw new Error('У некоторых позиций не задан НДС. Выберите ставку перед сохранением.');
            }

            const payload = {
                поставщик_id: selectedSupplierId,
                заявка_id: формаДанные.заявка_id.trim() ? Number(формаДанные.заявка_id) : null,
                статус: normalizePurchaseStatus(формаДанные.статус),
                дата_поступления: формаДанные.дата_поступления || null,
                позиции: validPositions,
            };

            await onSubmit({ id: purchase.id, ...payload });
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !purchase) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Редактировать закупку</Dialog.Title>


                <Text as="div" size="2" color="gray" className={styles.supplierLine}>
                    Закупка: <Text as="span" weight="bold" color="gray">#{purchase.id}</Text>
                </Text>

                {error && (
                    <Box className={styles.error}>
                        <Text size="2">{error}</Text>
                    </Box>
                )}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Поставщик</Text>
                                <Select.Root
                                    value={selectedSupplierId ? String(selectedSupplierId) : ''}
                                    onValueChange={(value) => {
                                        const id = value ? Number(value) : 0;
                                        setSelectedSupplierId(id);
                                        const found = suppliers.find((s) => s.id === id);
                                        setSelectedSupplierName(found?.название || selectedSupplierName);
                                    }}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} placeholder="Выберите поставщика" />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        {suppliers.map((s) => (
                                            <Select.Item key={s.id} value={String(s.id)}>
                                                {s.название}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Заявка (ID)</Text>
                                <TextField.Root
                                    value={формаДанные.заявка_id}
                                    onChange={(e) => setФормаДанные((p) => ({ ...p, заявка_id: e.target.value }))}
                                    placeholder="Например: 23"
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Статус</Text>
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
                                        className={styles.textField}
                                        size="2"
                                    />
                                </Flex>
                            </Box>
                        </div>

                        <Box className={styles.positionsSection}>
                            <Flex align="center" justify="between" mb="3" className={styles.positionsHeader}>
                                <Text as="span" size="4" weight="medium">Позиции закупки</Text>
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

                            <Box className={styles.positionsTable}>
                                {позиции.length > 0 && (
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
                                    {позиции.map((position, index) => {
                                        const selectedProduct = productsById.get(position.товар_id);
                                        const vatOption = getVatRateOptionSafe(position.ндс_id);
                                        const vatAmounts = calculateVatAmountsFromLine(position.количество, position.цена, vatOption.rate);

                                        return (
                                            <Box key={position.id ?? index} className={styles.positionRow}>
                                                <Select.Root
                                                    value={position.товар_id ? String(position.товар_id) : ''}
                                                    onValueChange={(value) => handlePositionChange(index, 'товар_id', value ? Number(value) : 0)}
                                                >
                                                    <Select.Trigger variant="surface" color="gray" className={styles.positionSelectTrigger} placeholder="Выберите товар" />
                                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                        {products.map((product) => (
                                                            <Select.Item key={product.id} value={String(product.id)}>
                                                                {product.артикул} - {product.название}
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Content>
                                                </Select.Root>

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
                                                    value={String(position.ндс_id || UNSET_VAT_RATE_ID)}
                                                    onValueChange={(value) => handlePositionChange(index, 'ндс_id', value ? Number(value) : UNSET_VAT_RATE_ID)}
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
                                                >
                                                    ×
                                                </Button>
                                            </Box>
                                        );
                                    })}
                                </Flex>
                            </Box>

                            <Box className={styles.totalAmount}>
                                <Text weight="bold">
                                    Общая сумма:{' '}
                                    {getTotalAmount().toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
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
                                disabled={loading || getTotalAmount() === 0}
                                loading={loading}
                                className={styles.primaryButton}
                            >
                                Сохранить
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default EditPurchaseModal;
