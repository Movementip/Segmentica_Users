import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import OrderSearchSelect from './OrderSearchSelect';
import styles from './AddProductToSupplierModalV2.module.css';

interface Product {
    id: number;
    название: string;
    артикул: string;
    единица_измерения: string;
    категория?: string;
}

interface AddProductToSupplierModalV2Props {
    isOpen: boolean;
    onClose: () => void;
    onProductAdded: () => void;
    поставщик_id: number;
    поставщик_название: string;
}

export function AddProductToSupplierModalV2({
    isOpen,
    onClose,
    onProductAdded,
    поставщик_id,
    поставщик_название,
}: AddProductToSupplierModalV2Props): JSX.Element {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    const [formData, setFormData] = useState({
        товар_id: '',
        цена: '',
        срок_поставки: '',
    });

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        void fetchProducts();
    }, [isOpen]);

    const fetchProducts = async () => {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Ошибка загрузки товаров');
            const data = await response.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            setProducts([]);
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        }
    };

    const selectedProduct = useMemo(() => {
        const idNum = Number(formData.товар_id);
        if (!idNum) return null;
        return products.find((p) => p.id === idNum) || null;
    }, [products, formData.товар_id]);

    const canSubmit = useMemo(() => {
        return Boolean(formData.товар_id) && Boolean(formData.цена) && Boolean(formData.срок_поставки) && !loading;
    }, [formData.товар_id, formData.цена, formData.срок_поставки, loading]);

    const productSelectOptions = useMemo(
        () => products.map((product) => ({
            value: String(product.id),
            label: `${product.артикул} - ${product.название}${product.категория ? ` (${product.категория})` : ''}`,
        })),
        [products]
    );

    const handleClose = () => {
        setError(null);
        setLoading(false);
        setFormData({ товар_id: '', цена: '', срок_поставки: '' });
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/suppliers/${поставщик_id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    товар_id: Number(formData.товар_id),
                    цена: Number(formData.цена),
                    срок_поставки: Number(formData.срок_поставки),
                }),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(responseData.error || 'Ошибка добавления товара');
            }

            onProductAdded();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return <></>;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Добавить товар</Dialog.Title>
                <Dialog.Description className={styles.description}>
                    Поставщик: <Text as="span" weight="bold">{поставщик_название}</Text>
                </Dialog.Description>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Товар</Text>
                                <OrderSearchSelect
                                    value={formData.товар_id}
                                    onValueChange={(value) => setFormData((prev) => ({ ...prev, товар_id: value }))}
                                    options={productSelectOptions}
                                    placeholder="Выберите товар"
                                    emptyText="Нет товаров"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Цена за единицу (₽)</Text>
                                <TextField.Root
                                    type="number"
                                    value={formData.цена}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, цена: e.target.value }))}
                                    placeholder={'Например: 1500'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Срок поставки (дни)</Text>
                                <TextField.Root
                                    type="number"
                                    value={formData.срок_поставки}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, срок_поставки: e.target.value }))}
                                    placeholder={'Например: 7'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            {selectedProduct ? (
                                <Box className={styles.selectedCard}>
                                    <Text as="div" size="2" weight="medium">Выбранный товар</Text>
                                    <Text as="div" size="2" color="gray">{selectedProduct.название}</Text>
                                    <Text as="div" size="1" color="gray">Артикул: {selectedProduct.артикул}</Text>
                                    <Text as="div" size="1" color="gray">Ед.: {selectedProduct.единица_измерения}</Text>
                                </Box>
                            ) : (
                                <Box />
                            )}
                        </div>

                        {error ? (
                            <Box className={styles.error}>
                                <Text as="div" size="2" color="red">{error}</Text>
                            </Box>
                        ) : null}

                        <Flex gap="3" justify="end" className={styles.actions}>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} className={styles.secondaryButton} disabled={loading}>
                                Отмена
                            </Button>
                            <Button type="submit" variant="solid" color="gray" highContrast className={styles.primaryButton} disabled={!canSubmit}>
                                {loading ? 'Добавление...' : 'Добавить'}
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}
