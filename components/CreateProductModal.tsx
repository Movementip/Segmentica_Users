import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Text, TextField, Select } from '@radix-ui/themes';
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

export function CreateProductModal({ isOpen, onClose, onProductCreated }: CreateProductModalProps): JSX.Element {
    const [название, setНазвание] = useState('');
    const [артикул, setАртикул] = useState('');
    const [категорияId, setКатегорияId] = useState('');
    const [цена_закупки, setЦенаЗакупки] = useState('');
    const [цена_продажи, setЦенаПродажи] = useState('');
    const [единица_измерения, setЕдиницаИзмерения] = useState('шт');
    const [минимальный_остаток, setМинимальныйОстаток] = useState('0');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!название.trim()) return false;
        if (!артикул.trim()) return false;
        if (!цена_продажи || parseFloat(цена_продажи) <= 0) return false;
        return true;
    }, [артикул, loading, название, цена_продажи]);

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
                // ignore
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

    const resetForm = () => {
        setНазвание('');
        setАртикул('');
        setКатегорияId('');
        setЦенаЗакупки('');
        setЦенаПродажи('');
        setЕдиницаИзмерения('шт');
        setМинимальныйОстаток('0');
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!название.trim()) {
            setError('Название товара обязательно');
            return;
        }

        if (!артикул.trim()) {
            setError('Артикул обязателен');
            return;
        }

        if (!цена_продажи || parseFloat(цена_продажи) <= 0) {
            setError('Цена продажи обязательна и должна быть больше 0');
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
                    название: название.trim(),
                    артикул: артикул.trim(),
                    категория_id: категорияId || undefined,
                    цена_закупки: цена_закупки ? parseFloat(цена_закупки) : undefined,
                    цена_продажи: parseFloat(цена_продажи),
                    единица_измерения: единица_измерения,
                    минимальный_остаток: parseInt(минимальный_остаток) || 0
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
            <Dialog.Content className={styles.modalContent}>


                <Dialog.Title>Добавить новый товар</Dialog.Title>

                <Flex direction="column" gap="4" mt="4">
                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Название *</Text>
                        <TextField.Root
                            value={название}
                            onChange={(e) => setНазвание(e.target.value)}
                            placeholder="Введите название товара"
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Артикул *</Text>
                        <TextField.Root
                            value={артикул}
                            onChange={(e) => setАртикул(e.target.value)}
                            placeholder="Введите артикул"
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Категория</Text>
                        <OrderSearchSelect
                            value={категорияId}
                            options={categoryOptions}
                            onValueChange={setКатегорияId}
                            placeholder="Выберите категорию"
                            emptyText="Ничего не найдено"
                            inputClassName={styles.textField}
                        />
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Цена закупки (руб.)</Text>
                        <TextField.Root
                            value={цена_закупки}
                            onChange={(e) => setЦенаЗакупки(e.target.value)}
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

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Цена продажи (руб.) *</Text>
                        <TextField.Root
                            value={цена_продажи}
                            onChange={(e) => setЦенаПродажи(e.target.value)}
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

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Единица измерения</Text>
                        <Select.Root value={единица_измерения} onValueChange={setЕдиницаИзмерения}>
                            <Select.Trigger variant="surface" color="gray" radius="large" className={styles.selectFullWidth} />
                            <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                <Select.Item value="шт">шт</Select.Item>
                                <Select.Item value="кг">кг</Select.Item>
                                <Select.Item value="л">л</Select.Item>
                                <Select.Item value="м">м</Select.Item>
                                <Select.Item value="упак">упак</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Минимальный остаток</Text>
                        <TextField.Root
                            value={минимальный_остаток}
                            onChange={(e) => setМинимальныйОстаток(e.target.value)}
                            placeholder="0"
                            type="number"
                            min={0}
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Flex>

                    {error ? (
                        <Text size="2" color="red">{error}</Text>
                    ) : null}

                    <Flex justify="end" gap="3" mt="2" className={styles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            onClick={handleSubmitClick}
                            disabled={!canSubmit}
                            className={styles.primaryBlackButton}
                        >
                            {loading ? 'Создание…' : 'Добавить товар'}
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
}
