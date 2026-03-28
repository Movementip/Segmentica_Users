import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Select, Text, TextArea, TextField } from '@radix-ui/themes';
import styles from './Modal.module.css';

interface Category {
    id: number;
    название: string;
    описание?: string;
    родительская_категория_id?: number;
    активна: boolean;
}

interface CategoryOption extends Category {
    depth: number;
}

interface EditCategoryModalProps {
    category: Category | null;
    isOpen: boolean;
    onClose: () => void;
    onCategoryUpdated: () => void;
}

export function EditCategoryModal({ category, isOpen, onClose, onCategoryUpdated }: EditCategoryModalProps): JSX.Element {
    const [название, setНазвание] = useState('');
    const [описание, setОписание] = useState('');
    const [родительскаяКатегорияId, setРодительскаяКатегорияId] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !category) {
            return;
        }

        setНазвание(category.название || '');
        setОписание(category.описание || '');
        setРодительскаяКатегорияId(category.родительская_категория_id ? String(category.родительская_категория_id) : 'root');
        setError(null);
    }, [isOpen, category]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        fetchCategories();
    }, [isOpen]);

    const categoryOptions = useMemo(() => {
        const byParent = new Map<number | null, Category[]>();

        categories
            .filter((item) => item.id !== category?.id)
            .forEach((item) => {
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
        return result;
    }, [categories, category?.id]);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) {
                throw new Error('Ошибка загрузки категорий');
            }

            const data = await response.json();
            setCategories(data);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!category) {
            return;
        }

        if (!название.trim()) {
            setError('Название категории обязательно');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/categories', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: category.id,
                    название: название.trim(),
                    описание: описание.trim() || null,
                    родительская_категория_id: родительскаяКатегорияId === 'root' ? null : parseInt(родительскаяКатегорияId, 10),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления категории');
            }

            onCategoryUpdated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.radixDialog}>
                <Dialog.Title>Редактировать категорию</Dialog.Title>
                <Dialog.Description className={styles.radixDescription}>
                    Обновите название, описание и положение категории в дереве.
                </Dialog.Description>

                <form onSubmit={handleSubmit} className={styles.radixForm}>
                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium" htmlFor="edit-category-name">
                            Название
                        </Text>
                        <TextField.Root
                            id="edit-category-name"
                            value={название}
                            onChange={(e) => setНазвание(e.target.value)}
                            placeholder="Введите название категории"
                            size="3"
                        />
                    </div>

                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium" htmlFor="edit-category-description">
                            Описание
                        </Text>
                        <TextArea
                            id="edit-category-description"
                            value={описание}
                            onChange={(e) => setОписание(e.target.value)}
                            placeholder="Введите описание категории"
                            size="3"
                            className={styles.radixTextarea}
                        />
                    </div>

                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium" htmlFor="edit-category-parent">
                            Родительская категория
                        </Text>
                        <Select.Root value={родительскаяКатегорияId || 'root'} onValueChange={setРодительскаяКатегорияId}>
                            <Select.Trigger id="edit-category-parent" placeholder="Выберите родительскую категорию" className={styles.radixSelectTrigger} />
                            <Select.Content position="popper" className={styles.radixSelectContent}>
                                <Select.Item value="root">Корневая категория</Select.Item>
                                {categoryOptions.map((item) => (
                                    <Select.Item key={item.id} value={String(item.id)}>
                                        {`${'— '.repeat(item.depth)}${item.название}`}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                        <Text as="div" size="1" color="gray">
                            Текущую категорию нельзя сделать родителем самой себя.
                        </Text>
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}

                    <Flex justify="end" gap="3" mt="5" className={styles.radixActions}>
                        <Button type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={handleClose}
                            disabled={loading}
                            className={styles.secondaryButton} >
                            Отмена
                        </Button>
                        <Button type="submit"
                            variant="solid"
                            color="gray"
                            highContrast
                            disabled={loading}
                            loading={loading}
                            className={styles.primaryButton}>
                            {loading ? 'Сохранение...' : 'Сохранить изменения'}
                        </Button>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}
