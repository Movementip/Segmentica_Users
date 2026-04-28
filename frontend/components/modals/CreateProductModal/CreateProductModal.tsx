import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import { ProductFormFields, buildCategoryOptions, Category, createInitialProductFormState, parseDecimal, parseInteger, type ProductFormState } from '../ProductFormFields/ProductFormFields';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';

import styles from '../WarehouseMovementModal/WarehouseMovementModal.module.css';

interface CreateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    onProductCreated: () => void;
    initialProduct?: Partial<ProductFormState> | null;
}

const buildInitialFormState = (initialProduct?: Partial<ProductFormState> | null): ProductFormState => ({
    ...createInitialProductFormState(),
    ...(initialProduct || {}),
});

export function CreateProductModal({ isOpen, onClose, onBack, onProductCreated, initialProduct }: CreateProductModalProps): JSX.Element | null {
    const [formData, setFormData] = useState(createInitialProductFormState());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!formData.название.trim()) return false;
        if (!formData.артикул.trim()) return false;
        if (!formData.единица_измерения.trim()) return false;
        return true;
    }, [formData.артикул, formData.единица_измерения, formData.название, loading]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        setFormData(buildInitialFormState(initialProduct));
        setError(null);
        setLoading(false);
    }, [initialProduct, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const loadCategories = async () => {
            try {
                const response = await fetch('/api/categories');
                if (!response.ok) return;
                const data = await response.json();
                setCategories(Array.isArray(data) ? data : []);
            } catch {
                setCategories([]);
            }
        };

        void loadCategories();
    }, [isOpen]);

    const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

    const selectedCategory = useMemo(() => {
        if (!formData.категория_id) return null;
        return categories.find((item) => String(item.id) === formData.категория_id) || null;
    }, [categories, formData.категория_id]);

    const showsAccountingAccount = formData.тип_номенклатуры === 'материал';
    const showsExpenseAccount = formData.тип_номенклатуры === 'входящая_услуга';

    const resetForm = () => {
        setFormData(buildInitialFormState(initialProduct));
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        setLoading(false);
        onClose();
    };

    const handleBack = () => {
        resetForm();
        setLoading(false);
        if (onBack) {
            onBack();
            return;
        }
        onClose();
    };

    const handleSubmit = async () => {
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

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/warehouse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    тип_номенклатуры: formData.тип_номенклатуры,
                    название: formData.название.trim(),
                    категория: selectedCategory?.название || null,
                    категория_id: formData.категория_id || undefined,
                    артикул: formData.артикул.trim(),
                    счет_учета: showsAccountingAccount ? formData.счет_учета : undefined,
                    счет_затрат: showsExpenseAccount ? formData.счет_затрат : undefined,
                    единица_измерения: formData.единица_измерения.trim(),
                    ндс_id: Number(formData.ндс_id),
                    комментарий: formData.комментарий.trim() || undefined,
                    цена_закупки: formData.цена_закупки.trim() ? parseDecimal(formData.цена_закупки) : 0,
                    цена_продажи: formData.цена_продажи.trim() ? parseDecimal(formData.цена_продажи) : 0,
                    минимальный_остаток: parseInteger(formData.минимальный_остаток),
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

    if (!isOpen) return null;

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
                            disabled={!canSubmit}
                        >
                            {loading ? 'Создание…' : 'Сохранить'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            onClick={onBack ? handleBack : handleClose}
                            disabled={loading}
                        >
                            {onBack ? 'Назад' : 'Отменить'}
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
}
