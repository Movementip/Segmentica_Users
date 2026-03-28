import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import styles from './WarehouseMovementModal.module.css';

interface AdjustStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    warehouseItem: {
        id: number;
        товар_id: number;
        товар_название: string;
        товар_артикул: string;
        товар_единица: string;
        количество: number;
    } | null;
    onSaved: () => void;
}

export function AdjustStockModal({
    isOpen,
    onClose,
    warehouseItem,
    onSaved,
}: AdjustStockModalProps): JSX.Element | null {
    const [newQty, setNewQty] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !warehouseItem) return;
        setNewQty(String(warehouseItem.количество ?? 0));
        setError(null);
        setLoading(false);
    }, [isOpen, warehouseItem]);

    const delta = useMemo(() => {
        const current = warehouseItem?.количество ?? 0;
        const parsed = Number(newQty);
        if (Number.isNaN(parsed)) return null;
        return parsed - current;
    }, [newQty, warehouseItem]);

    const movementType = delta === null ? null : delta >= 0 ? 'приход' : 'расход';

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async () => {
        if (!warehouseItem) return;

        const targetQty = Number(newQty);
        if (!Number.isFinite(targetQty) || targetQty < 0) {
            setError('Введите корректное количество (0 или больше)');
            return;
        }

        if (delta === null) {
            setError('Введите корректное количество');
            return;
        }

        if (delta === 0) {
            handleClose();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/warehouse/movement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    operation_kind: 'adjustment',
                    товар_id: warehouseItem.товар_id,
                    тип_операции: movementType,
                    количество: Math.abs(delta),
                    комментарий: 'Корректировка остатков товара',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Ошибка сохранения корректировки');
            }

            onSaved();
            handleClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !warehouseItem) return null;

    const currentQty = warehouseItem.количество ?? 0;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
            <Dialog.Content className={styles.modalContent} style={{ maxWidth: 560 }}>
                <Dialog.Title>Корректировка остатка</Dialog.Title>

                <Flex direction="column" gap="4" mt="4">
                    <Flex direction="column" gap="1">
                        <Text size="2" weight="medium">Товар</Text>
                        <Text size="2" color="gray">
                            {warehouseItem.товар_артикул ? `${warehouseItem.товар_артикул} — ` : ''}{warehouseItem.товар_название}
                        </Text>
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text size="2" weight="medium">Текущий остаток</Text>
                        <Text size="2" color="gray">{currentQty} {warehouseItem.товар_единица}</Text>
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text as="label" size="2" weight="medium">Новый остаток</Text>
                        <TextField.Root
                            value={newQty}
                            onChange={(e) => setNewQty(e.target.value)}
                            placeholder="0"
                            type="number"
                            min={0}
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Flex>

                    <Flex direction="column" gap="1">
                        <Text size="2" weight="medium">Изменение</Text>
                        {delta === null ? (
                            <Text size="2" color="gray">—</Text>
                        ) : (
                            <Text size="2" color="gray">
                                {movementType === 'приход' ? '+' : '-'}{Math.abs(delta)} {warehouseItem.товар_единица}
                                {' '}
                                ({movementType})
                            </Text>
                        )}
                    </Flex>

                    {error ? (
                        <Text size="2" color="red">{error}</Text>
                    ) : null}

                    <Flex justify="end" gap="3" mt="3" className={styles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            onClick={handleSubmit}
                            disabled={loading}
                            loading={loading}
                        >
                            {loading ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
}
