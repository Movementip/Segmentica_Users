import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Text, TextField, Select, Box } from '@radix-ui/themes';
import OrderSearchSelect from './OrderSearchSelect';
import styles from './WarehouseMovementModal.module.css';

interface Product {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    категория_id?: number;
    категория_название?: string;
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

export const EditProductModal: React.FC<EditProductModalProps> = ({
    isOpen,
    onClose,
    onProductUpdated,
    product
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [formData, setFormData] = useState({
        название: '',
        артикул: '',
        категория: '',
        категория_id: '',
        единица_измерения: 'шт',
        минимальный_остаток: '0',
        цена_закупки: '0',
        цена_продажи: '0'
    });

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
        if (product) {
            setFormData({
                название: product.название || '',
                артикул: product.артикул || '',
                категория: product.категория || product.категория_название || '',
                категория_id: product.категория_id ? String(product.категория_id) : '',
                единица_измерения: product.единица_измерения || 'шт',
                минимальный_остаток: product.минимальный_остаток?.toString() || '0',
                цена_закупки: product.цена_закупки?.toString() || '0',
                цена_продажи: product.цена_продажи?.toString() || '0'
            });
        }
    }, [product]);

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

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!formData.название.trim()) return false;
        if (!formData.артикул.trim()) return false;
        if (!formData.цена_продажи || parseFloat(formData.цена_продажи) <= 0) return false;
        return true;
    }, [formData.артикул, formData.название, formData.цена_продажи, loading]);

    const handleSubmit = async () => {
        if (!product) return;

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
                    название: formData.название,
                    артикул: formData.артикул,
                    категория: selectedCategory?.название || null,
                    категория_id: formData.категория_id || null,
                    единица_измерения: formData.единица_измерения,
                    минимальный_остаток: parseInt(formData.минимальный_остаток) || 0,
                    цена_закупки: parseFloat(formData.цена_закупки) || 0,
                    цена_продажи: parseFloat(formData.цена_продажи) || 0
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
        onClose();
    };

    if (!isOpen || !product) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Редактировать товар</Dialog.Title>


                {error ? (
                    <Box className={styles.error}>
                        <Text size="2">{error}</Text>
                    </Box>
                ) : null}

                <Flex direction="column" gap="4" className={styles.form} mt="4">
                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Название товара *</Text>
                        <TextField.Root
                            value={formData.название}
                            onChange={(e) => setFormData((p) => ({ ...p, название: e.target.value }))}
                            placeholder="Введите название товара"
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Flex>

                    <Flex gap="3" wrap="wrap">
                        <Flex direction="column" gap="1" style={{ flex: '1 1 240px' }}>
                            <Text as="label" size="2" weight="medium">Артикул *</Text>
                            <TextField.Root
                                value={formData.артикул}
                                onChange={(e) => setFormData((p) => ({ ...p, артикул: e.target.value }))}
                                placeholder="Введите артикул"
                                variant="surface"
                                radius="large"
                                size="3"
                                className={styles.textField}
                            />
                        </Flex>
                        <Flex direction="column" gap="1" style={{ flex: '1 1 240px' }}>
                            <Text as="label" size="2" weight="medium">Категория *</Text>
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
                                placeholder="Выберите категорию"
                                emptyText="Ничего не найдено"
                                inputClassName={styles.textField}
                            />
                        </Flex>
                    </Flex>

                    <Flex gap="3" wrap="wrap">
                        <Flex direction="column" gap="1" style={{ flex: '1 1 240px' }}>
                            <Text as="label" size="2" weight="medium">Единица измерения *</Text>
                            <Select.Root value={formData.единица_измерения} onValueChange={(v) => setFormData((p) => ({ ...p, единица_измерения: v }))}>
                                <Select.Trigger
                                    variant="surface"
                                    color="gray"
                                    radius="large"
                                    className={styles.selectFullWidth}
                                />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="шт">шт</Select.Item>
                                    <Select.Item value="кг">кг</Select.Item>
                                    <Select.Item value="л">л</Select.Item>
                                    <Select.Item value="м">м</Select.Item>
                                    <Select.Item value="м²">м²</Select.Item>
                                    <Select.Item value="м³">м³</Select.Item>
                                    <Select.Item value="упак">упак</Select.Item>
                                    <Select.Item value="комп">комп</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </Flex>
                        <Flex direction="column" gap="1" style={{ flex: '1 1 240px' }}>
                            <Text as="label" size="2" weight="medium">Минимальный остаток</Text>
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
                        </Flex>
                    </Flex>

                    <Flex gap="3" wrap="wrap">
                        <Flex direction="column" gap="1" style={{ flex: '1 1 240px' }}>
                            <Text as="label" size="2" weight="medium">Цена закупки (₽)</Text>
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
                        </Flex>
                        <Flex direction="column" gap="1" style={{ flex: '1 1 240px' }}>
                            <Text as="label" size="2" weight="medium">Цена продажи (₽) *</Text>
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
                        </Flex>
                    </Flex>

                    <Flex justify="end" gap="3" className={styles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            loading={loading}
                        >
                            {loading ? 'Сохранение…' : 'Сохранить изменения'}
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};
