import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import { FiPlus } from 'react-icons/fi';
import styles from './Modal.module.css';

interface ProductOption {
    id: number;
    название: string;
    артикул: string;
}

interface OrderOption {
    id: number;
}

interface AddMissingProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => Promise<void> | void;
    products: ProductOption[];
    orders: OrderOption[];
}

const initialFormData = {
    заявка_id: '0',
    товар_id: '0',
    необходимое_количество: '1',
    недостающее_количество: '1',
};

export function AddMissingProductModal({
    isOpen,
    onClose,
    onCreated,
    products,
    orders,
}: AddMissingProductModalProps): JSX.Element | null {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(false);
        setError(null);
        setFormData(initialFormData);
    }, [isOpen]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (Number(formData.заявка_id) <= 0) return false;
        if (Number(formData.товар_id) <= 0) return false;
        if (Number(formData.необходимое_количество) <= 0) return false;
        if (Number(formData.недостающее_количество) <= 0) return false;
        return true;
    }, [formData, loading]);

    const handleClose = () => {
        setLoading(false);
        setError(null);
        onClose();
    };

    const handleSubmit = async () => {
        if (!canSubmit) {
            setError('Пожалуйста, заполните все поля корректно.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/missing-products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    заявка_id: Number(formData.заявка_id),
                    товар_id: Number(formData.товар_id),
                    необходимое_количество: Number(formData.необходимое_количество),
                    недостающее_количество: Number(formData.недостающее_количество),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка добавления недостающего товара');
            }

            await onCreated();
            handleClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.radixDialog}>
                <Dialog.Title>Добавить недостающий товар</Dialog.Title>
                <Dialog.Description className={styles.radixDescription}>
                    Создайте новую позицию для контроля нехватки товара по заявке.
                </Dialog.Description>

                <div className={styles.radixForm}>
                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium">Заявка</Text>
                        <Select.Root value={formData.заявка_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, заявка_id: value }))}>
                            <Select.Trigger placeholder="Выберите заявку" className={styles.radixSelectTrigger} />
                            <Select.Content position="popper" className={styles.radixSelectContent}>
                                <Select.Item value="0">Выберите заявку</Select.Item>
                                {orders.map((order) => (
                                    <Select.Item key={order.id} value={String(order.id)}>
                                        {`Заявка #${order.id}`}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium">Товар</Text>
                        <Select.Root value={formData.товар_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, товар_id: value }))}>
                            <Select.Trigger placeholder="Выберите товар" className={styles.radixSelectTrigger} />
                            <Select.Content position="popper" className={styles.radixSelectContent}>
                                <Select.Item value="0">Выберите товар</Select.Item>
                                {products.map((item) => (
                                    <Select.Item key={item.id} value={String(item.id)}>
                                        {`${item.артикул} - ${item.название}`}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <Flex gap="3" wrap="wrap">
                        <div className={styles.radixField} style={{ flex: '1 1 220px' }}>
                            <Text as="label" size="2" weight="medium">Необходимое количество</Text>
                            <TextField.Root
                                type="number"
                                min={1}
                                value={formData.необходимое_количество}
                                onChange={(e) => setFormData((prev) => ({ ...prev, необходимое_количество: e.target.value }))}
                                placeholder="Введите количество"
                                size="3"
                            />
                        </div>

                        <div className={styles.radixField} style={{ flex: '1 1 220px' }}>
                            <Text as="label" size="2" weight="medium">Недостающее количество</Text>
                            <TextField.Root
                                type="number"
                                min={1}
                                value={formData.недостающее_количество}
                                onChange={(e) => setFormData((prev) => ({ ...prev, недостающее_количество: e.target.value }))}
                                placeholder="Введите количество"
                                size="3"
                            />
                        </div>
                    </Flex>

                    {error ? <div className={styles.error}>{error}</div> : null}

                    <Flex justify="end" gap="3" className={styles.radixActions}>
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
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            className={styles.primaryButton}
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            loading={loading}
                        >
                            {loading ? 'Добавление...' : (
                                <>
                                    <FiPlus size={16} /> Добавить
                                </>
                            )}
                        </Button>
                    </Flex>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}
