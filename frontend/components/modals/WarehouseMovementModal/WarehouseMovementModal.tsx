import React, { useEffect, useMemo, useState } from 'react';

import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import OrderSearchSelect from '../../ui/OrderSearchSelect/OrderSearchSelect';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

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

export function WarehouseMovementModal({
    isOpen,
    onClose,
    initialType,
    onSaved,
}: WarehouseMovementModalProps): JSX.Element | null {
    const [type, setType] = useState<MovementType>(initialType);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [productId, setProductId] = useState('');
    const [qty, setQty] = useState('1');
    const [comment, setComment] = useState('');
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
                const response = await fetch('/api/products');
                if (!response.ok) throw new Error('Не удалось загрузить товары');
                const data = await response.json();
                setProducts(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
            }
        };

        void fetchProducts();
    }, [isOpen]);

    const selectedProduct = useMemo(() => {
        const id = Number(productId);
        return products.find((product) => product.id === id);
    }, [productId, products]);

    const productOptions = useMemo(
        () => products.map((product) => ({
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
        const quantity = Number(qty);

        if (!pid) {
            setError('Выбери товар');
            return;
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            setError('Количество должно быть больше 0');
            return;
        }

        try {
            setLoading(true);

            const response = await fetch('/api/warehouse/movement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation_kind: 'movement',
                    товар_id: pid,
                    тип_операции: type,
                    количество: quantity,
                    комментарий: comment.trim() || null,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
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

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={styles.modalContent}
                onClose={handleClose}
                title={type === 'приход' ? 'Приход товара' : 'Расход товара'}
                footerClassName={styles.modalActions}
                footer={(
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            className={styles.primaryButton}
                            onClick={() => void onSubmit()}
                            disabled={loading}
                        >
                            {loading ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                    </>
                )}
            >
                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <Label>Тип операции</Label>
                        <div className={styles.typePill} data-type={type}>
                            {type === 'приход' ? 'Приход' : 'Расход'}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <Label>Товар</Label>
                        <OrderSearchSelect
                            value={productId}
                            options={productOptions}
                            onValueChange={setProductId}
                            placeholder="Начни вводить название или артикул..."
                            emptyText="Ничего не найдено"
                            inputClassName={styles.textField}
                        />
                        {selectedProduct ? (
                            <div className={styles.helper}>Ед.: {selectedProduct.единица_измерения}</div>
                        ) : null}
                    </div>

                    <div className={styles.formGroup}>
                        <Label>Количество</Label>
                        <Input
                            type="number"
                            min={1}
                            step={1}
                            value={qty}
                            onChange={(event) => setQty(event.target.value)}
                            className={styles.textField}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <Label>Комментарий</Label>
                        <Textarea
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            placeholder="Опционально"
                            className={styles.productTextarea}
                        />
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}
                </div>
            </EntityModalShell>
        </Dialog>
    );
}
