import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import styles from './Modal.module.css';

export interface MissingProductEditItem {
    id: number;
    заявка_id: number;
    товар_id: number;
    необходимое_количество: number;
    недостающее_количество: number;
    статус: string;
}

interface ProductOption {
    id: number;
    название: string;
    артикул: string;
}

interface OrderOption {
    id: number;
}

interface EditMissingProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => Promise<void> | void;
    missingProduct: MissingProductEditItem | null;
    products: ProductOption[];
    orders: OrderOption[];
}

export function EditMissingProductModal({
    isOpen,
    onClose,
    onUpdated,
    missingProduct,
    products,
    orders,
}: EditMissingProductModalProps): JSX.Element | null {
    const product = missingProduct;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        id: 0,
        заявка_id: '',
        товар_id: '',
        необходимое_количество: '',
        недостающее_количество: '',
        статус: 'в обработке',
    });

    useEffect(() => {
        if (!isOpen || !product) return;

        setError(null);
        setLoading(false);
        setFormData({
            id: product.id,
            заявка_id: String(product.заявка_id),
            товар_id: String(product.товар_id),
            необходимое_количество: String(product.необходимое_количество),
            недостающее_количество: String(product.недостающее_количество),
            статус: product.статус || 'в обработке',
        });
    }, [isOpen, product]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!formData.заявка_id) return false;
        if (!formData.товар_id) return false;
        if (!formData.необходимое_количество || Number(formData.необходимое_количество) <= 0) return false;
        if (!formData.недостающее_количество || Number(formData.недостающее_количество) <= 0) return false;
        return true;
    }, [formData, loading]);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async () => {
        if (!product) return;

        const normalizedStatus = formData.статус;
        const normalizedMissingQuantity = normalizedStatus === 'получено'
            ? 0
            : Number(formData.недостающее_количество);

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/missing-products', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: product.id,
                    заявка_id: Number(formData.заявка_id),
                    товар_id: Number(formData.товар_id),
                    необходимое_количество: Number(formData.необходимое_количество),
                    недостающее_количество: normalizedMissingQuantity,
                    статус: normalizedStatus,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления недостающего товара');
            }

            await onUpdated();
            handleClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.radixDialog}>
                <Dialog.Title>Редактировать недостающий товар</Dialog.Title>
                <Dialog.Description className={styles.radixDescription}>
                    Обновите параметры позиции и её текущий статус.
                </Dialog.Description>

                <div className={styles.radixForm}>
                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium">Заявка</Text>
                        <Select.Root value={formData.заявка_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, заявка_id: value }))}>
                            <Select.Trigger placeholder="Выберите заявку" className={styles.radixSelectTrigger} />
                            <Select.Content position="popper" className={styles.radixSelectContent}>
                                {orders.map((order) => (
                                    <Select.Item key={order.id} value={String(order.id)}>
                                        Заявка #{order.id}
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
                                {products.map((item) => (
                                    <Select.Item key={item.id} value={String(item.id)}>
                                        {item.артикул} - {item.название}
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

                    <div className={styles.radixField}>
                        <Text as="label" size="2" weight="medium">Статус</Text>
                        <Select.Root value={formData.статус} onValueChange={(value) => setFormData((prev) => ({ ...prev, статус: value }))}>
                            <Select.Trigger className={styles.radixSelectTrigger} />
                            <Select.Content position="popper" className={styles.radixSelectContent}>
                                <Select.Item value="в обработке">В обработке</Select.Item>
                                <Select.Item value="заказано">Заказано</Select.Item>
                                <Select.Item value="получено">Получено</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}

                    <Flex justify="end" gap="3" className={styles.radixActions}>
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
                            onClick={handleSubmit}
                            disabled={loading}
                            loading={loading}
                            className={styles.primaryButton}>
                            {loading ? 'Сохранение...' : 'Сохранить изменения'}
                        </Button>
                    </Flex>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}
