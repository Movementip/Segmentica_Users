import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Text, TextArea, TextField, Select } from '@radix-ui/themes';
import OrderSearchSelect from './OrderSearchSelect';
import styles from './WarehouseMovementModal.module.css';

interface CreateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProductCreated: () => void;
}

interface Category {
    id: number;
    название: string;
    родительская_категория_id?: number | null;
}

interface CategoryOption extends Category {
    depth: number;
}

type NomenclatureTypeValue = 'товар' | 'материал' | 'продукция' | 'входящая_услуга' | 'исходящая_услуга' | 'внеоборотный_актив';

type ProductFormState = {
    тип_номенклатуры: NomenclatureTypeValue;
    название: string;
    категория_id: string;
    артикул: string;
    счет_учета: string;
    счет_затрат: string;
    единица_измерения: string;
    ндс_id: string;
    комментарий: string;
    цена_закупки: string;
    цена_продажи: string;
    минимальный_остаток: string;
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

const createInitialFormState = (): ProductFormState => ({
    тип_номенклатуры: 'товар',
    название: '',
    категория_id: '',
    артикул: '',
    счет_учета: DEFAULT_MATERIAL_ACCOUNT,
    счет_затрат: DEFAULT_EXPENSE_ACCOUNT,
    единица_измерения: 'шт',
    ндс_id: '5',
    комментарий: '',
    цена_закупки: '',
    цена_продажи: '',
    минимальный_остаток: '0',
});

const parseDecimal = (value: string): number => {
    const normalized = Number(String(value).replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
};

const parseInteger = (value: string): number => {
    const normalized = Number.parseInt(value, 10);
    return Number.isFinite(normalized) ? normalized : 0;
};

export function CreateProductModal({ isOpen, onClose, onProductCreated }: CreateProductModalProps): JSX.Element {
    const [formData, setFormData] = useState<ProductFormState>(createInitialFormState());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!formData.название.trim()) return false;
        if (!formData.артикул.trim()) return false;
        if (!formData.единица_измерения.trim()) return false;
        return true;
    }, [formData.артикул, formData.единица_измерения, formData.название, loading]);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setLoading(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const loadCategories = async () => {
            try {
                const res = await fetch('/api/categories');
                if (!res.ok) return;
                const data = await res.json();
                setCategories(Array.isArray(data) ? data : []);
            } catch {
                setCategories([]);
            }
        };

        loadCategories();
    }, [isOpen]);

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

    const selectedCategory = useMemo(() => {
        if (!formData.категория_id) return null;
        return categories.find((item) => String(item.id) === formData.категория_id) || null;
    }, [categories, formData.категория_id]);

    const showsAccountingAccount = formData.тип_номенклатуры === 'материал';
    const showsExpenseAccount = formData.тип_номенклатуры === 'входящая_услуга';

    const resetForm = () => {
        setFormData(createInitialFormState());
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        setLoading(false);
        onClose();
    };

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/warehouse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    тип_номенклатуры: formData.тип_номенклатуры,
                    название: formData.название.trim(),
                    категория: selectedCategory?.название || null,
                    категория_id: formData.категория_id || undefined,
                    артикул: formData.артикул.trim(),
                    счет_учета: showsAccountingAccount ? formData.счет_учета : undefined,
                    счет_затрат: showsExpenseAccount ? formData.счет_затрат : undefined,
                    единица_измерения: formData.единица_измерения.trim(),
                    ндс_id: Number(formData.ндс_id),
                    комментарий: formData.комментарий.trim() || undefined,
                    цена_закупки: formData.цена_закупки.trim() ? parseDecimal(formData.цена_закупки) : 0,
                    цена_продажи: formData.цена_продажи.trim() ? parseDecimal(formData.цена_продажи) : 0,
                    минимальный_остаток: parseInteger(formData.минимальный_остаток),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания товара');
            }

            resetForm();
            onProductCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitClick = async () => {
        if (!canSubmit) return;
        await handleSubmit({ preventDefault: () => undefined } as unknown as React.FormEvent);
    };

    if (!isOpen) {
        return <></>;
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
            <Dialog.Content className={`${styles.modalContent} ${styles.productModalContent}`}>
                <Dialog.Title>Карточка товара</Dialog.Title>

                <Flex direction="column" gap="4" className={styles.productForm}>
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
                                onChange={(e) => setFormData((prev) => ({ ...prev, название: e.target.value }))}
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
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, категория_id: value }))}
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
                                onChange={(e) => setFormData((prev) => ({ ...prev, артикул: e.target.value }))}
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
                                onChange={(e) => setFormData((prev) => ({ ...prev, единица_измерения: e.target.value }))}
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
                                onChange={(e) => setFormData((prev) => ({ ...prev, комментарий: e.target.value }))}
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
                                        onChange={(e) => setFormData((prev) => ({ ...prev, цена_закупки: e.target.value }))}
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
                                        onChange={(e) => setFormData((prev) => ({ ...prev, цена_продажи: e.target.value }))}
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
                                        onChange={(e) => setFormData((prev) => ({ ...prev, минимальный_остаток: e.target.value }))}
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

                    {error ? (
                        <div className={styles.error}>
                            <Text size="2">{error}</Text>
                        </div>
                    ) : null}

                    <Flex justify="start" gap="3" className={`${styles.modalActions} ${styles.productActions}`}>
                        <Button
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            onClick={handleSubmitClick}
                            disabled={!canSubmit}
                            className={styles.primaryBlackButton}
                        >
                            {loading ? 'Создание…' : 'Сохранить'}
                        </Button>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                            Отменить
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
}
