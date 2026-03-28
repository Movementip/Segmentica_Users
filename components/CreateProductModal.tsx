import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Text, TextField, Select } from '@radix-ui/themes';
import styles from './WarehouseMovementModal.module.css';

interface CreateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProductCreated: () => void;
}

export function CreateProductModal({ isOpen, onClose, onProductCreated }: CreateProductModalProps): JSX.Element {
    const [название, setНазвание] = useState('');
    const [артикул, setАртикул] = useState('');
    const [категория, setКатегория] = useState('');
    const [цена_закупки, setЦенаЗакупки] = useState('');
    const [цена_продажи, setЦенаПродажи] = useState('');
    const [единица_измерения, setЕдиницаИзмерения] = useState('шт');
    const [минимальный_остаток, setМинимальныйОстаток] = useState('0');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    const [isCategorySuggestOpen, setIsCategorySuggestOpen] = useState(false);

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
                const res = await fetch('/api/products');
                if (!res.ok) return;
                const data = await res.json();

                const cats = new Set<string>();
                if (Array.isArray(data)) {
                    for (const p of data) {
                        const c = typeof p?.категория === 'string' ? p.категория.trim() : '';
                        if (c) cats.add(c);
                    }
                }
                setCategoryOptions(Array.from(cats).sort((a, b) => a.localeCompare(b, 'ru')));
            } catch {
                // ignore
            }
        };

        loadCategories();
    }, [isOpen]);

    const filteredCategoryOptions = useMemo(() => {
        const q = категория.trim().toLowerCase();
        if (!q) return categoryOptions;
        return categoryOptions.filter((c) => c.toLowerCase().includes(q));
    }, [categoryOptions, категория]);

    const resetForm = () => {
        setНазвание('');
        setАртикул('');
        setКатегория('');
        setЦенаЗакупки('');
        setЦенаПродажи('');
        setЕдиницаИзмерения('шт');
        setМинимальныйОстаток('0');
        setError(null);
        setIsCategorySuggestOpen(false);
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
                    категория: категория.trim() || undefined,
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
                        <div className={styles.autocompleteWrap}>
                            <TextField.Root
                                value={категория}
                                onChange={(e) => setКатегория(e.target.value)}
                                placeholder="Введите категорию"
                                variant="surface"
                                radius="large"
                                size="3"
                                className={styles.textField}
                                onFocus={() => setIsCategorySuggestOpen(true)}
                                onBlur={() => {
                                    window.setTimeout(() => setIsCategorySuggestOpen(false), 0);
                                }}
                            />

                            {isCategorySuggestOpen ? (
                                <div className={styles.suggestList}>
                                    {filteredCategoryOptions.length === 0 ? (
                                        <div className={styles.suggestEmpty}>Ничего не найдено</div>
                                    ) : (
                                        filteredCategoryOptions.slice(0, 12).map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                className={styles.suggestItem}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setКатегория(c);
                                                    setIsCategorySuggestOpen(false);
                                                }}
                                            >
                                                {c}
                                            </button>
                                        ))
                                    )}
                                </div>
                            ) : null}
                        </div>
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