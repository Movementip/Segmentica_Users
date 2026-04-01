import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Text, TextArea, TextField, Select, Box } from '@radix-ui/themes';
import OrderSearchSelect from './OrderSearchSelect';
import styles from './WarehouseMovementModal.module.css';

type NomenclatureTypeValue = 'товар' | 'материал' | 'продукция' | 'входящая_услуга' | 'исходящая_услуга' | 'внеоборотный_актив';

interface Product {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    категория_id?: number;
    категория_название?: string;
    тип_номенклатуры?: NomenclatureTypeValue;
    счет_учета?: string;
    счет_затрат?: string;
    ндс_id?: number;
    комментарий?: string;
    единица_измерения: string;
    минимальный_остаток: number;
    цена_закупки?: number;
    цена_продажи: number;
}

interface Category {
    id: number;
    название: string;
    родительская_категория_id?: number | null;
}

interface CategoryOption extends Category {
    depth: number;
}

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProductUpdated: () => void;
    product: Product | null;
}

type ProductFormData = {
    тип_номенклатуры: NomenclatureTypeValue;
    название: string;
    артикул: string;
    категория: string;
    категория_id: string;
    счет_учета: string;
    счет_затрат: string;
    единица_измерения: string;
    минимальный_остаток: string;
    цена_закупки: string;
    цена_продажи: string;
    ндс_id: string;
    комментарий: string;
};

type AccountOption = {
    code: string;
    value: string;
    label: string;
};

const NOMENCLATURE_TYPE_OPTIONS: Array<{ value: NomenclatureTypeValue; label: string }> = [
    { value: 'товар', label: 'Товар' },
    { value: 'материал', label: 'Материал' },
    { value: 'продукция', label: 'Продукция' },
    { value: 'входящая_услуга', label: 'Входящая услуга' },
    { value: 'исходящая_услуга', label: 'Исходящая услуга' },
    { value: 'внеоборотный_актив', label: 'Внеоборотный актив' },
];

const MATERIAL_ACCOUNT_OPTIONS: AccountOption[] = [
    { code: '10.мат', value: '10.мат Материалы и сырье', label: '10.мат Материалы и сырье' },
    { code: '10.дет', value: '10.дет Детали, комплектующие и полуфабрикаты', label: '10.дет Детали, комплектующие и полуфабрикаты' },
    { code: '10.см', value: '10.см Топливо', label: '10.см Топливо' },
    { code: '10.зап', value: '10.зап Запасные части', label: '10.зап Запасные части' },
    { code: '10.стр', value: '10.стр Строительные материалы', label: '10.стр Строительные материалы' },
    { code: '10.хоз', value: '10.хоз Хозяйственные принадлежности и инвентарь', label: '10.хоз Хозяйственные принадлежности и инвентарь' },
    { code: '10.спец', value: '10.спец Специальная одежда', label: '10.спец Специальная одежда' },
    { code: '10.тара', value: '10.тара Тара', label: '10.тара Тара' },
    { code: '10.пр', value: '10.пр Прочие материалы', label: '10.пр Прочие материалы' },
];

const EXPENSE_ACCOUNT_OPTIONS: AccountOption[] = [
    { code: '20', value: '20 Основное производство', label: '20 Основное производство' },
    { code: '23', value: '23 Вспомогательные производства', label: '23 Вспомогательные производства' },
    { code: '25', value: '25 Общепроизводственные расходы', label: '25 Общепроизводственные расходы' },
    { code: '26', value: '26 Общехозяйственные (управленческие) расходы', label: '26 Общехозяйственные (управленческие) расходы' },
    { code: '29', value: '29 Обслуживающие производства и хозяйства', label: '29 Обслуживающие производства и хозяйства' },
    { code: '44', value: '44 Расходы на продажу (коммерческие расходы)', label: '44 Расходы на продажу (коммерческие расходы)' },
    { code: '91.02', value: '91.02 Прочие расходы', label: '91.02 Прочие расходы' },
    { code: '97', value: '97 Расходы будущих периодов', label: '97 Расходы будущих периодов' },
];

const DEFAULT_MATERIAL_ACCOUNT = MATERIAL_ACCOUNT_OPTIONS[0].value;
const DEFAULT_EXPENSE_ACCOUNT = EXPENSE_ACCOUNT_OPTIONS.find((option) => option.code === '44')?.value || EXPENSE_ACCOUNT_OPTIONS[0].value;

const normalizeAccountValue = (value: string | null | undefined, options: AccountOption[], fallback: string): string => {
    if (!value) return fallback;
    const matchedOption = options.find((option) => option.value === value || option.code === value);
    return matchedOption?.value || value;
};

const PRODUCT_VAT_OPTIONS = [
    { value: '1', label: 'Без НДС' },
    { value: '4', label: '10%' },
    { value: '5', label: '22%' },
];

const createInitialFormData = (): ProductFormData => ({
    тип_номенклатуры: 'товар',
    название: '',
    артикул: '',
    категория: '',
    категория_id: '',
    счет_учета: DEFAULT_MATERIAL_ACCOUNT,
    счет_затрат: DEFAULT_EXPENSE_ACCOUNT,
    единица_измерения: 'шт',
    минимальный_остаток: '0',
    цена_закупки: '0',
    цена_продажи: '0',
    ндс_id: '5',
    комментарий: '',
});

const parseDecimal = (value: string): number => {
    const normalized = Number(String(value).replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
};

const parseInteger = (value: string): number => {
    const normalized = Number.parseInt(value, 10);
    return Number.isFinite(normalized) ? normalized : 0;
};

const mapProductToFormData = (product: Product): ProductFormData => ({
    тип_номенклатуры: product.тип_номенклатуры || 'товар',
    название: product.название || '',
    артикул: product.артикул || '',
    категория: product.категория || product.категория_название || '',
    категория_id: product.категория_id ? String(product.категория_id) : '',
    счет_учета: normalizeAccountValue(product.счет_учета, MATERIAL_ACCOUNT_OPTIONS, DEFAULT_MATERIAL_ACCOUNT),
    счет_затрат: normalizeAccountValue(product.счет_затрат, EXPENSE_ACCOUNT_OPTIONS, DEFAULT_EXPENSE_ACCOUNT),
    единица_измерения: product.единица_измерения || 'шт',
    минимальный_остаток: product.минимальный_остаток?.toString() || '0',
    цена_закупки: product.цена_закупки?.toString() || '0',
    цена_продажи: product.цена_продажи?.toString() || '0',
    ндс_id: String(product.ндс_id || 5),
    комментарий: product.комментарий || '',
});

export const EditProductModal: React.FC<EditProductModalProps> = ({
    isOpen,
    onClose,
    onProductUpdated,
    product
}) => {
    const [loading, setLoading] = useState(false);
    const [isFetchingProduct, setIsFetchingProduct] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productDetails, setProductDetails] = useState<Product | null>(null);
    const [formData, setFormData] = useState<ProductFormData>(createInitialFormData());

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setLoading(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const loadCategories = async () => {
            try {
                const response = await fetch('/api/categories');
                if (!response.ok) {
                    throw new Error('Ошибка загрузки категорий');
                }
                const data = await response.json();
                setCategories(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Error fetching categories for edit product:', err);
            }
        };

        loadCategories();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !product?.id) {
            setProductDetails(null);
            return;
        }

        let isCancelled = false;

        const loadProductDetails = async () => {
            try {
                setIsFetchingProduct(true);
                const response = await fetch(`/api/products?id=${product.id}`);
                if (!response.ok) {
                    throw new Error('Ошибка загрузки товара');
                }

                const data = await response.json();
                if (!isCancelled) {
                    setProductDetails(data);
                }
            } catch (err) {
                if (!isCancelled) {
                    setProductDetails(product);
                    setError(err instanceof Error ? err.message : 'Ошибка загрузки товара');
                }
            } finally {
                if (!isCancelled) {
                    setIsFetchingProduct(false);
                }
            }
        };

        loadProductDetails();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, product]);

    const categoryOptions = useMemo(() => {
        const byParent = new Map<number | null, Category[]>();

        categories.forEach((item) => {
            const parentId = item.родительская_категория_id ?? null;
            const siblings = byParent.get(parentId) || [];
            siblings.push(item);
            byParent.set(parentId, siblings);
        });

        const result: CategoryOption[] = [];
        const walk = (parentId: number | null, depth: number) => {
            const nodes = byParent.get(parentId) || [];
            nodes
                .sort((left, right) => left.название.localeCompare(right.название, 'ru-RU'))
                .forEach((item) => {
                    result.push({ ...item, depth });
                    walk(item.id, depth + 1);
                });
        };

        walk(null, 0);

        return result.map((category) => ({
            value: String(category.id),
            label: `${'— '.repeat(category.depth)}${category.название}`,
        }));
    }, [categories]);

    useEffect(() => {
        const source = productDetails || product;
        if (!source) return;
        setFormData(mapProductToFormData(source));
    }, [product, productDetails]);

    useEffect(() => {
        if (!product || !categories.length) return;
        if (formData.категория_id) return;

        const categoryName = product.категория || product.категория_название || '';
        if (!categoryName) return;

        const matchedCategory = categories.find((item) => item.название === categoryName);
        if (!matchedCategory) return;

        setFormData((prev) => ({
            ...prev,
            категория_id: String(matchedCategory.id),
            категория: matchedCategory.название,
        }));
    }, [categories, formData.категория_id, product]);

    const selectedCategory = useMemo(() => {
        const selectedId = Number(formData.категория_id);
        if (!Number.isFinite(selectedId) || !selectedId) return null;
        return categories.find((item) => item.id === selectedId) || null;
    }, [categories, formData.категория_id]);

    const showsAccountingAccount = formData.тип_номенклатуры === 'материал';
    const showsExpenseAccount = formData.тип_номенклатуры === 'входящая_услуга';

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!formData.название.trim()) return false;
        if (!formData.артикул.trim()) return false;
        if (!formData.единица_измерения.trim()) return false;
        return true;
    }, [formData.артикул, formData.единица_измерения, formData.название, loading]);

    const handleTypeChange = (value: string) => {
        const nextType = value as NomenclatureTypeValue;
        setFormData((prev) => ({
            ...prev,
            тип_номенклатуры: nextType,
            счет_учета: nextType === 'материал'
                ? normalizeAccountValue(prev.счет_учета, MATERIAL_ACCOUNT_OPTIONS, DEFAULT_MATERIAL_ACCOUNT)
                : DEFAULT_MATERIAL_ACCOUNT,
            счет_затрат: nextType === 'входящая_услуга'
                ? normalizeAccountValue(prev.счет_затрат, EXPENSE_ACCOUNT_OPTIONS, DEFAULT_EXPENSE_ACCOUNT)
                : DEFAULT_EXPENSE_ACCOUNT,
        }));
    };

    const handleSubmit = async () => {
        if (!product) return;

        if (!formData.название.trim()) {
            setError('Название товара обязательно');
            return;
        }

        if (!formData.артикул.trim()) {
            setError('Артикул обязателен');
            return;
        }

        if (!formData.единица_измерения.trim()) {
            setError('Единица измерения обязательна');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/products', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: product.id,
                    тип_номенклатуры: formData.тип_номенклатуры,
                    название: formData.название.trim(),
                    артикул: formData.артикул.trim(),
                    категория: selectedCategory?.название || null,
                    категория_id: formData.категория_id || null,
                    счет_учета: showsAccountingAccount ? formData.счет_учета : null,
                    счет_затрат: showsExpenseAccount ? formData.счет_затрат : null,
                    единица_измерения: formData.единица_измерения.trim(),
                    минимальный_остаток: parseInteger(formData.минимальный_остаток),
                    цена_закупки: parseDecimal(formData.цена_закупки),
                    цена_продажи: parseDecimal(formData.цена_продажи),
                    ндс_id: Number(formData.ндс_id),
                    комментарий: formData.комментарий.trim() || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления товара');
            }

            onProductUpdated();
            handleClose();
        } catch (e) {
            console.error('Error updating product:', e);
            setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setLoading(false);
        setIsFetchingProduct(false);
        setProductDetails(null);
        onClose();
    };

    if (!isOpen || !product) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={`${styles.modalContent} ${styles.productModalContent}`}>
                <Dialog.Title>Карточка товара</Dialog.Title>


                {error ? (
                    <Box className={styles.error}>
                        <Text size="2">{error}</Text>
                    </Box>
                ) : null}

                <Flex direction="column" gap="4" className={styles.productForm}>
                    {isFetchingProduct ? (
                        <Text size="2" color="gray">Загрузка данных товара…</Text>
                    ) : null}

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Тип номенклатуры</Text>
                        <div className={styles.productFormField}>
                            <Select.Root value={formData.тип_номенклатуры} onValueChange={handleTypeChange}>
                                <Select.Trigger variant="surface" color="gray" radius="large" className={styles.selectFullWidth} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {NOMENCLATURE_TYPE_OPTIONS.map((option) => (
                                        <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </div>
                    </div>

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Название</Text>
                        <div className={styles.productFormField}>
                            <TextField.Root
                                value={formData.название}
                                onChange={(e) => setFormData((p) => ({ ...p, название: e.target.value }))}
                                placeholder="Введите название"
                                variant="surface"
                                radius="large"
                                size="3"
                                className={styles.textField}
                            />
                        </div>
                    </div>

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Группа</Text>
                        <div className={styles.productFormField}>
                            <OrderSearchSelect
                                value={formData.категория_id}
                                options={categoryOptions}
                                onValueChange={(value) => {
                                    const nextCategory = categories.find((item) => String(item.id) === value) || null;
                                    setFormData((prev) => ({
                                        ...prev,
                                        категория_id: value,
                                        категория: nextCategory?.название || '',
                                    }));
                                }}
                                placeholder="Без группы"
                                emptyText="Ничего не найдено"
                                inputClassName={styles.textField}
                            />
                        </div>
                    </div>

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Артикул</Text>
                        <div className={styles.productFormField}>
                            <TextField.Root
                                value={formData.артикул}
                                onChange={(e) => setFormData((p) => ({ ...p, артикул: e.target.value }))}
                                placeholder="Введите артикул"
                                variant="surface"
                                radius="large"
                                size="3"
                                className={styles.textField}
                            />
                        </div>
                    </div>

                    {showsAccountingAccount ? (
                        <div className={styles.productFormRow}>
                            <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Счет учета</Text>
                            <div className={styles.productFormField}>
                                <Select.Root value={formData.счет_учета} onValueChange={(value) => setFormData((prev) => ({ ...prev, счет_учета: value }))}>
                                    <Select.Trigger variant="surface" color="gray" radius="large" className={styles.selectFullWidth} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        {MATERIAL_ACCOUNT_OPTIONS.map((option) => (
                                            <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        </div>
                    ) : null}

                    {showsExpenseAccount ? (
                        <div className={styles.productFormRow}>
                            <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Счет затрат</Text>
                            <div className={styles.productFormField}>
                                <Select.Root value={formData.счет_затрат} onValueChange={(value) => setFormData((prev) => ({ ...prev, счет_затрат: value }))}>
                                    <Select.Trigger variant="surface" color="gray" radius="large" className={styles.selectFullWidth} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        {EXPENSE_ACCOUNT_OPTIONS.map((option) => (
                                            <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        </div>
                    ) : null}

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Единица измерения</Text>
                        <div className={styles.productFormField}>
                            <TextField.Root
                                value={formData.единица_измерения}
                                onChange={(e) => setFormData((p) => ({ ...p, единица_измерения: e.target.value }))}
                                placeholder="шт"
                                variant="surface"
                                radius="large"
                                size="3"
                                className={styles.textField}
                            />
                        </div>
                    </div>

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Ставка НДС</Text>
                        <div className={styles.productFormField}>
                            <Select.Root value={formData.ндс_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, ндс_id: value }))}>
                                <Select.Trigger variant="surface" color="gray" radius="large" className={styles.selectFullWidth} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {PRODUCT_VAT_OPTIONS.map((option) => (
                                        <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </div>
                    </div>

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Комментарий</Text>
                        <div className={styles.productFormField}>
                            <TextArea
                                value={formData.комментарий}
                                onChange={(e) => setFormData((p) => ({ ...p, комментарий: e.target.value }))}
                                placeholder="Комментарий к товару"
                                className={styles.productTextarea}
                            />
                        </div>
                    </div>

                    <div className={styles.productFormRow}>
                        <Text as="label" size="2" weight="medium" className={styles.productFormLabel}>Склад и цены</Text>
                        <div className={styles.productFormField}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                                <div className={styles.productFormField}>
                                    <Text as="label" size="1" color="gray">Цена закупки</Text>
                                    <TextField.Root
                                        value={formData.цена_закупки}
                                        onChange={(e) => setFormData((p) => ({ ...p, цена_закупки: e.target.value }))}
                                        placeholder="0"
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        variant="surface"
                                        radius="large"
                                        size="3"
                                        className={styles.textField}
                                    />
                                </div>
                                <div className={styles.productFormField}>
                                    <Text as="label" size="1" color="gray">Цена продажи</Text>
                                    <TextField.Root
                                        value={formData.цена_продажи}
                                        onChange={(e) => setFormData((p) => ({ ...p, цена_продажи: e.target.value }))}
                                        placeholder="0"
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        variant="surface"
                                        radius="large"
                                        size="3"
                                        className={styles.textField}
                                    />
                                </div>
                                <div className={styles.productFormField}>
                                    <Text as="label" size="1" color="gray">Мин. остаток</Text>
                                    <TextField.Root
                                        value={formData.минимальный_остаток}
                                        onChange={(e) => setFormData((p) => ({ ...p, минимальный_остаток: e.target.value }))}
                                        placeholder="0"
                                        type="number"
                                        min={0}
                                        step={1}
                                        variant="surface"
                                        radius="large"
                                        size="3"
                                        className={styles.textField}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <Flex justify="start" gap="3" className={`${styles.modalActions} ${styles.productActions}`}>
                        <Button type="button" variant="solid" color="gray" highContrast onClick={handleSubmit} disabled={!canSubmit || isFetchingProduct} className={styles.primaryBlackButton}>
                            {loading ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                            Отменить
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};
