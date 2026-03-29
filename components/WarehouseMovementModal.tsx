import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import OrderSearchSelect from './OrderSearchSelect';
import styles from './WarehouseMovementModal.module.css';

type MovementType = 'приход' | 'расход';

type ProductOption = {
    id: number;
    название: string;
    артикул: string;
    единица_измерения: string;
};

export interface WarehouseMovementModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialType: MovementType;
    onSaved: () => void;
}

export function WarehouseMovementModal({ isOpen, onClose, initialType, onSaved }: WarehouseMovementModalProps): JSX.Element {
    const [type, setType] = useState<MovementType>(initialType);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [productId, setProductId] = useState<string>('');
    const [qty, setQty] = useState<string>('1');
    const [comment, setComment] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setType(initialType);
        setError(null);
    }, [initialType, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchProducts = async () => {
            try {
                const res = await fetch('/api/products');
                if (!res.ok) throw new Error('Не удалось загрузить товары');
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
            }
        };

        fetchProducts();
    }, [isOpen]);

    const selectedProduct = useMemo(() => {
        const id = Number(productId);
        return products.find((p) => p.id === id);
    }, [productId, products]);

    const productOptions = useMemo(
        () =>
            products.map((product) => ({
                value: String(product.id),
                label: product.артикул ? `${product.артикул} - ${product.название}` : product.название,
            })),
        [products]
    );

    const handleClose = () => {
        setProductId('');
        setQty('1');
        setComment('');
        setLoading(false);
        setError(null);
        onClose();
    };

    const onSubmit = async () => {
        setError(null);

        const pid = Number(productId);
        const q = Number(qty);

        if (!pid) {
            setError('Выбери товар');
            return;
        }

        if (!Number.isFinite(q) || q <= 0) {
            setError('Количество должно быть больше 0');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch('/api/warehouse/movement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation_kind: 'movement',
                    товар_id: pid,
                    тип_операции: type,
                    количество: q,
                    комментарий: comment.trim() || null,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Ошибка сохранения движения');
            }

            onSaved();
            handleClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Движение товара</Dialog.Title>


                {error ? (
                    <Box className={styles.error}>
                        <Text size="2">{error}</Text>
                    </Box>
                ) : null}

                <Flex direction="column" gap="4" className={styles.form}>
                    <Box className={styles.formGroup}>
                        <Text as="label" size="2" weight="medium">
                            Тип
                        </Text>
                        <div className={styles.typePill} data-type={type}>
                            {type === 'приход' ? 'Приход' : 'Расход'}
                        </div>
                    </Box>

                    <Box className={styles.formGroup}>
                        <Text as="label" size="2" weight="medium">
                            Товар
                        </Text>
                        <OrderSearchSelect
                            value={productId}
                            options={productOptions}
                            onValueChange={setProductId}
                            placeholder="Начни вводить название или артикул..."
                            emptyText="Ничего не найдено"
                            inputClassName={styles.textField}
                        />
                        {selectedProduct ? (
                            <Text size="1" color="gray" className={styles.helper}>
                                Ед.: {selectedProduct.единица_измерения}
                            </Text>
                        ) : null}
                    </Box>

                    <Box className={styles.formGroup}>
                        <Text as="label" size="2" weight="medium">
                            Количество
                        </Text>
                        <TextField.Root
                            type="number"
                            min={1}
                            step={1}
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Box>

                    <Box className={styles.formGroup}>
                        <Text as="label" size="2" weight="medium">
                            Комментарий
                        </Text>
                        <TextField.Root
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Опционально"
                            variant="surface"
                            radius="large"
                            size="3"
                            className={styles.textField}
                        />
                    </Box>

                    <Flex justify="end" gap="3" className={styles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                            Отмена
                        </Button>
                        <Button type="button" variant="solid" color="gray" highContrast onClick={onSubmit} loading={loading} disabled={loading}>
                            Сохранить
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
}
