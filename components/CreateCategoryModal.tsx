import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Select, Text, TextArea, TextField } from '@radix-ui/themes';
import styles from './Modal.module.css';

interface Category {
    id: number;
    название: string;
    описание?: string;
    родительская_категория_id?: number;
}

interface CategoryOption extends Category {
    depth: number;
}

interface CreateCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCategoryCreated: () => void;
}

export function CreateCategoryModal({ isOpen, onClose, onCategoryCreated }: CreateCategoryModalProps): JSX.Element {
    const [название, setНазвание] = useState('');
    const [описание, setОписание] = useState('');
    const [родительская_категория_id, setРодительскаяКатегорияId] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        return Boolean(название.trim());
    }, [loading, название]);

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const categoryOptions = useMemo(() => {
        const byParent = new Map<number | null, Category[]>();

        categories.forEach((category) => {
            const parentId = category.родительская_категория_id ?? null;
            const siblings = byParent.get(parentId) || [];
            siblings.push(category);
            byParent.set(parentId, siblings);
        });

        const result: CategoryOption[] = [];

        const walk = (parentId: number | null, depth: number) => {
            const nodes = byParent.get(parentId) || [];
            nodes
                .sort((left, right) => left.название.localeCompare(right.название, 'ru-RU'))
                .forEach((category) => {
                    result.push({ ...category, depth });
                    walk(category.id, depth + 1);
                });
        };

        walk(null, 0);
        return result;
    }, [categories]);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const data = await response.json();
                setCategories(data);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const resetForm = () => {
        setНазвание('');
        setОписание('');
        setРодительскаяКатегорияId('');
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!название.trim()) {
            setError('Название категории обязательно');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    название: название.trim(),
                    описание: описание.trim() || undefined,
                    родительская_категория_id: родительская_категория_id ? parseInt(родительская_категория_id) : undefined
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания категории');
            }

            resetForm();
            onCategoryCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.radixDialog}>
                <Dialog.Title>Добавить новую категорию</Dialog.Title>
                <Dialog.Description className={styles.radixDescription}>
                    Создайте корневую категорию или продолжите любую существующую ветку дерева.
                </Dialog.Description>

                <form onSubmit={handleSubmit} className={styles.radixForm}>
                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium" htmlFor="название">
                            Название *
                        </Text>
                        <TextField.Root
                            id="название"
                            value={название}
                            onChange={(e) => setНазвание(e.target.value)}
                            placeholder="Введите название категории"
                            size="3"
                        />
                    </div>

                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium" htmlFor="описание">
                            Описание
                        </Text>
                        <TextArea
                            id="описание"
                            value={описание}
                            onChange={(e) => setОписание(e.target.value)}
                            placeholder="Введите описание категории"
                            size="3"
                            className={styles.radixTextarea}
                        />
                    </div>

                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium" htmlFor="родительская_категория_id">
                            Родительская категория
                        </Text>
                        <Select.Root value={родительская_категория_id || 'root'} onValueChange={(value) => setРодительскаяКатегорияId(value === 'root' ? '' : value)}>
                            <Select.Trigger id="родительская_категория_id" placeholder="Выберите родительскую категорию" className={styles.radixSelectTrigger} />
                            <Select.Content position="popper" className={styles.radixSelectContent}>
                                <Select.Item value="root">Основная категория</Select.Item>
                                {categoryOptions.map((category) => (
                                    <Select.Item key={category.id} value={String(category.id)}>
                                        {`${'— '.repeat(category.depth)}${category.название}`}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                        <Text as="div" size="1" color="gray">
                            Можно выбрать любую категорию, чтобы продолжить ветку глубже.
                        </Text>
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}

                    <Flex justify="end" gap="3" mt="5" className={styles.radixActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={handleClose}
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
                            {loading ? 'Создание...' : 'Добавить категорию'}
                        </Button>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}