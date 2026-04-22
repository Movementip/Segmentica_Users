import React from 'react';

import OrderSearchSelect from '../../ui/OrderSearchSelect/OrderSearchSelect';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '../../ui/select';
import { Textarea } from '../../ui/textarea';

import styles from '../WarehouseMovementModal/WarehouseMovementModal.module.css';

export interface Category {
    id: number;
    название: string;
    родительская_категория_id?: number | null;
}

interface CategoryOption extends Category {
    depth: number;
}

export type ProductFieldOption = {
    value: string;
    label: string;
};

export type NomenclatureTypeValue =
    | 'товар'
    | 'материал'
    | 'продукция'
    | 'входящая_услуга'
    | 'исходящая_услуга'
    | 'внеоборотный_актив';

export type ProductFormState = {
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

type ProductFormSource = Partial<{
    тип_номенклатуры: NomenclatureTypeValue;
    название: string;
    артикул: string;
    категория: string;
    категория_название: string;
    категория_id: number;
    счет_учета: string;
    счет_затрат: string;
    единица_измерения: string;
    минимальный_остаток: number;
    цена_закупки: number;
    цена_продажи: number;
    ндс_id: number;
    комментарий: string;
}>;

export type AccountOption = {
    code: string;
    value: string;
    label: string;
};

export const NOMENCLATURE_TYPE_OPTIONS: Array<{ value: NomenclatureTypeValue; label: string }> = [
    { value: 'товар', label: 'Товар' },
    { value: 'материал', label: 'Материал' },
    { value: 'продукция', label: 'Продукция' },
    { value: 'входящая_услуга', label: 'Входящая услуга' },
    { value: 'исходящая_услуга', label: 'Исходящая услуга' },
    { value: 'внеоборотный_актив', label: 'Внеоборотный актив' },
];

export const MATERIAL_ACCOUNT_OPTIONS: AccountOption[] = [
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

export const EXPENSE_ACCOUNT_OPTIONS: AccountOption[] = [
    { code: '20', value: '20 Основное производство', label: '20 Основное производство' },
    { code: '23', value: '23 Вспомогательные производства', label: '23 Вспомогательные производства' },
    { code: '25', value: '25 Общепроизводственные расходы', label: '25 Общепроизводственные расходы' },
    { code: '26', value: '26 Общехозяйственные (управленческие) расходы', label: '26 Общехозяйственные (управленческие) расходы' },
    { code: '29', value: '29 Обслуживающие производства и хозяйства', label: '29 Обслуживающие производства и хозяйства' },
    { code: '44', value: '44 Расходы на продажу (коммерческие расходы)', label: '44 Расходы на продажу (коммерческие расходы)' },
    { code: '91.02', value: '91.02 Прочие расходы', label: '91.02 Прочие расходы' },
    { code: '97', value: '97 Расходы будущих периодов', label: '97 Расходы будущих периодов' },
];

export const DEFAULT_MATERIAL_ACCOUNT = MATERIAL_ACCOUNT_OPTIONS[0].value;
export const DEFAULT_EXPENSE_ACCOUNT =
    EXPENSE_ACCOUNT_OPTIONS.find((option) => option.code === '44')?.value ||
    EXPENSE_ACCOUNT_OPTIONS[0].value;

export const PRODUCT_VAT_OPTIONS = [
    { value: '1', label: 'Без НДС' },
    { value: '4', label: '10%' },
    { value: '5', label: '22%' },
];

export const normalizeAccountValue = (
    value: string | null | undefined,
    options: AccountOption[],
    fallback: string
): string => {
    if (!value) return fallback;
    const matchedOption = options.find((option) => option.value === value || option.code === value);
    return matchedOption?.value || value;
};

export const createInitialProductFormState = (): ProductFormState => ({
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

export const mapProductToFormState = (product: ProductFormSource): ProductFormState => ({
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

export const parseDecimal = (value: string): number => {
    const normalized = Number(String(value).replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
};

export const parseInteger = (value: string): number => {
    const normalized = Number.parseInt(value, 10);
    return Number.isFinite(normalized) ? normalized : 0;
};

export const buildCategoryOptions = (categories: Category[]): ProductFieldOption[] => {
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
};

type ProductFormFieldsProps = {
    formData: ProductFormState;
    setFormData: React.Dispatch<React.SetStateAction<ProductFormState>>;
    categories: Category[];
    categoryOptions: ProductFieldOption[];
    error?: string | null;
    notice?: string | null;
};

export function ProductFormFields({
    formData,
    setFormData,
    categories,
    categoryOptions,
    error = null,
    notice = null,
}: ProductFormFieldsProps): JSX.Element {
    const showsAccountingAccount = formData.тип_номенклатуры === 'материал';
    const showsExpenseAccount = formData.тип_номенклатуры === 'входящая_услуга';

    const setField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
        setFormData((previous) => ({ ...previous, [key]: value }));
    };

    const handleTypeChange = (value: unknown) => {
        const nextType = String(value) as NomenclatureTypeValue;
        setFormData((previous) => ({
            ...previous,
            тип_номенклатуры: nextType,
            счет_учета: nextType === 'материал'
                ? normalizeAccountValue(previous.счет_учета, MATERIAL_ACCOUNT_OPTIONS, DEFAULT_MATERIAL_ACCOUNT)
                : DEFAULT_MATERIAL_ACCOUNT,
            счет_затрат: nextType === 'входящая_услуга'
                ? normalizeAccountValue(previous.счет_затрат, EXPENSE_ACCOUNT_OPTIONS, DEFAULT_EXPENSE_ACCOUNT)
                : DEFAULT_EXPENSE_ACCOUNT,
        }));
    };

    return (
        <div className={styles.productForm}>
            {notice ? <div className={styles.notice}>{notice}</div> : null}

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Тип номенклатуры</div>
                <div className={styles.productFormField}>
                    <Select
                        value={formData.тип_номенклатуры}
                        items={NOMENCLATURE_TYPE_OPTIONS}
                        onValueChange={handleTypeChange}
                    >
                        <SelectTrigger className={styles.selectFullWidth} />
                        <SelectContent>
                            {NOMENCLATURE_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Название</div>
                <div className={styles.productFormField}>
                    <Input
                        value={formData.название}
                        onChange={(event) => setField('название', event.target.value)}
                        placeholder="Введите название"
                        className={styles.textField}
                    />
                </div>
            </div>

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Группа</div>
                <div className={styles.productFormField}>
                    <OrderSearchSelect
                        value={formData.категория_id}
                        options={categoryOptions}
                        onValueChange={(value) => {
                            const nextCategory = categories.find((item) => String(item.id) === value) || null;
                            setFormData((previous) => ({
                                ...previous,
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
                <div className={styles.productFormLabel}>Артикул</div>
                <div className={styles.productFormField}>
                    <Input
                        value={formData.артикул}
                        onChange={(event) => setField('артикул', event.target.value)}
                        placeholder="Введите артикул"
                        className={styles.textField}
                    />
                </div>
            </div>

            {showsAccountingAccount ? (
                <div className={styles.productFormRow}>
                    <div className={styles.productFormLabel}>Счет учета</div>
                    <div className={styles.productFormField}>
                        <Select
                            value={formData.счет_учета}
                            items={MATERIAL_ACCOUNT_OPTIONS}
                            onValueChange={(value) => setField('счет_учета', String(value))}
                        >
                            <SelectTrigger className={styles.selectFullWidth} />
                            <SelectContent>
                                {MATERIAL_ACCOUNT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            ) : null}

            {showsExpenseAccount ? (
                <div className={styles.productFormRow}>
                    <div className={styles.productFormLabel}>Счет затрат</div>
                    <div className={styles.productFormField}>
                        <Select
                            value={formData.счет_затрат}
                            items={EXPENSE_ACCOUNT_OPTIONS}
                            onValueChange={(value) => setField('счет_затрат', String(value))}
                        >
                            <SelectTrigger className={styles.selectFullWidth} />
                            <SelectContent>
                                {EXPENSE_ACCOUNT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            ) : null}

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Единица измерения</div>
                <div className={styles.productFormField}>
                    <Input
                        value={formData.единица_измерения}
                        onChange={(event) => setField('единица_измерения', event.target.value)}
                        placeholder="шт"
                        className={styles.textField}
                    />
                </div>
            </div>

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Ставка НДС</div>
                <div className={styles.productFormField}>
                    <Select
                        value={formData.ндс_id}
                        items={PRODUCT_VAT_OPTIONS}
                        onValueChange={(value) => setField('ндс_id', String(value))}
                    >
                        <SelectTrigger className={styles.selectFullWidth} />
                        <SelectContent>
                            {PRODUCT_VAT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Комментарий</div>
                <div className={styles.productFormField}>
                    <Textarea
                        value={formData.комментарий}
                        onChange={(event) => setField('комментарий', event.target.value)}
                        placeholder="Комментарий к товару"
                        className={styles.productTextarea}
                    />
                </div>
            </div>

            <div className={styles.productFormRow}>
                <div className={styles.productFormLabel}>Склад и цены</div>
                <div className={styles.productFormField}>
                    <div className={styles.productFormFieldInline}>
                        <div className={styles.productFormField}>
                            <Label className={styles.subFieldLabel}>Цена закупки</Label>
                            <Input
                                value={formData.цена_закупки}
                                onChange={(event) => setField('цена_закупки', event.target.value)}
                                placeholder="0"
                                type="number"
                                min={0}
                                step={0.01}
                                className={styles.textField}
                            />
                        </div>

                        <div className={styles.productFormField}>
                            <Label className={styles.subFieldLabel}>Цена продажи</Label>
                            <Input
                                value={formData.цена_продажи}
                                onChange={(event) => setField('цена_продажи', event.target.value)}
                                placeholder="0"
                                type="number"
                                min={0}
                                step={0.01}
                                className={styles.textField}
                            />
                        </div>

                        <div className={styles.productFormField}>
                            <Label className={styles.subFieldLabel}>Мин. остаток</Label>
                            <Input
                                value={formData.минимальный_остаток}
                                onChange={(event) => setField('минимальный_остаток', event.target.value)}
                                placeholder="0"
                                type="number"
                                min={0}
                                step={1}
                                className={styles.textField}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}
        </div>
    );
}
