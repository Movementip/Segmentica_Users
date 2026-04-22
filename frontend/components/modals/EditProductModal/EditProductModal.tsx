import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import { ProductFormFields, buildCategoryOptions, Category, createInitialProductFormState, mapProductToFormState, NomenclatureTypeValue, parseDecimal, parseInteger } from '../ProductFormFields/ProductFormFields';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';

import styles from '../WarehouseMovementModal/WarehouseMovementModal.module.css';

type Product = {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    категория_id?: number;
    категория_название?: string;
    тип_номенклатуры?: NomenclatureTypeValue;
    счет_учета?: string;
    счет_затрат?: string;
    ндс_id?: number;
    комментарий?: string;
    единица_измерения: string;
    минимальный_остаток: number;
    цена_закупки?: number;
    цена_продажи: number;
};

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
    product,
}) => {
    const [loading, setLoading] = useState(false);
    const [isFetchingProduct, setIsFetchingProduct] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productDetails, setProductDetails] = useState<Product | null>(null);
    const [formData, setFormData] = useState(createInitialProductFormState());

    useLayoutEffect(() => {
        if (!isOpen || !product) return;
        setError(null);
        setLoading(false);
        setIsFetchingProduct(false);
        setProductDetails(product);
        setFormData(mapProductToFormState(product));
    }, [isOpen, product]);

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

        void loadCategories();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !product?.id) {
            setProductDetails(null);
            return;
        }

        let isCancelled = false;

        const loadProductDetails = async () => {
            try {
                setIsFetchingProduct(true);
                const response = await fetch(`/api/products?id=${product.id}`);

                if (!response.ok) {
                    throw new Error('Ошибка загрузки товара');
                }

                const data = await response.json();
                if (!isCancelled) {
                    setProductDetails(data);
                }
            } catch (err) {
                if (!isCancelled) {
                    setProductDetails(product);
                    setError(err instanceof Error ? err.message : 'Ошибка загрузки товара');
                }
            } finally {
                if (!isCancelled) {
                    setIsFetchingProduct(false);
                }
            }
        };

        void loadProductDetails();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, product]);

    const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

    useEffect(() => {
        const source = productDetails || product;
        if (!source) return;
        setFormData(mapProductToFormState(source));
    }, [product, productDetails]);

    useEffect(() => {
        if (!product || !categories.length) return;
        if (formData.категория_id) return;

        const categoryName = product.категория || product.категория_название || '';
        if (!categoryName) return;

        const matchedCategory = categories.find((item) => item.название === categoryName);
        if (!matchedCategory) return;

        setFormData((previous) => ({
            ...previous,
            категория_id: String(matchedCategory.id),
            категория: matchedCategory.название,
        }));
    }, [categories, formData.категория_id, product]);

    const selectedCategory = useMemo(() => {
        const selectedId = Number(formData.категория_id);
        if (!Number.isFinite(selectedId) || !selectedId) return null;
        return categories.find((item) => item.id === selectedId) || null;
    }, [categories, formData.категория_id]);

    const showsAccountingAccount = formData.тип_номенклатуры === 'материал';
    const showsExpenseAccount = formData.тип_номенклатуры === 'входящая_услуга';

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!formData.название.trim()) return false;
        if (!formData.артикул.trim()) return false;
        if (!formData.единица_измерения.trim()) return false;
        return true;
    }, [formData.артикул, formData.единица_измерения, formData.название, loading]);

    const handleSubmit = async () => {
        if (!product) return;

        if (!formData.название.trim()) {
            setError('Название товара обязательно');
            return;
        }

        if (!formData.артикул.trim()) {
            setError('Артикул обязателен');
            return;
        }

        if (!formData.единица_измерения.trim()) {
            setError('Единица измерения обязательна');
            return;
        }

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
                    тип_номенклатуры: formData.тип_номенклатуры,
                    название: formData.название.trim(),
                    артикул: formData.артикул.trim(),
                    категория: selectedCategory?.название || null,
                    категория_id: formData.категория_id || null,
                    счет_учета: showsAccountingAccount ? formData.счет_учета : null,
                    счет_затрат: showsExpenseAccount ? formData.счет_затрат : null,
                    единица_измерения: formData.единица_измерения.trim(),
                    минимальный_остаток: parseInteger(formData.минимальный_остаток),
                    цена_закупки: parseDecimal(formData.цена_закупки),
                    цена_продажи: parseDecimal(formData.цена_продажи),
                    ндс_id: Number(formData.ндс_id),
                    комментарий: formData.комментарий.trim() || null,
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
        setIsFetchingProduct(false);
        setProductDetails(null);
        setFormData(createInitialProductFormState());
        onClose();
    };

    if (!isOpen || !product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={`${styles.modalContent} ${styles.productModalContent}`}
                onClose={handleClose}
                title="Карточка товара"
                footerClassName={`${styles.modalActions} ${styles.productActions} ${styles.productFooter}`}
                footer={(
                    <>
                        <Button
                            type="button"
                            variant="default"
                            className={styles.primaryButton}
                            onClick={() => void handleSubmit()}
                            disabled={!canSubmit || isFetchingProduct}
                        >
                            {loading ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Отменить
                        </Button>
                    </>
                )}
            >
                <ProductFormFields
                    formData={formData}
                    setFormData={setFormData}
                    categories={categories}
                    categoryOptions={categoryOptions}
                    error={error}
                />
            </EntityModalShell>
        </Dialog>
    );
};
