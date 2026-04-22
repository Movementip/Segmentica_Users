import React, { useEffect, useMemo, useState } from 'react';

import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

import styles from '../WarehouseMovementModal/WarehouseMovementModal.module.css';

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

    const movementType = delta == null ? null : delta >= 0 ? 'приход' : 'расход';

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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={styles.modalContent}
                onClose={handleClose}
                title="Корректировка остатка"
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
                            onClick={() => void handleSubmit()}
                            disabled={loading}
                        >
                            {loading ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                    </>
                )}
            >
                <div className={styles.form}>
                    <div className={styles.infoCard}>
                        <div className={styles.infoCardTitle}>Товар</div>
                        <div className={styles.infoValue}>
                            {warehouseItem.товар_артикул ? `${warehouseItem.товар_артикул} — ` : ''}
                            {warehouseItem.товар_название}
                        </div>
                    </div>

                    <div className={styles.infoGrid}>
                        <div className={styles.infoCard}>
                            <div className={styles.summaryLabel}>Текущий остаток</div>
                            <div className={styles.summaryValue}>
                                {warehouseItem.количество} {warehouseItem.товар_единица}
                            </div>
                        </div>

                        <div className={styles.infoCard}>
                            <div className={styles.summaryLabel}>Тип изменения</div>
                            {movementType ? (
                                <div className={styles.summaryValue}>
                                    <span className={styles.typePill} data-type={movementType}>
                                        {movementType === 'приход' ? 'Приход' : 'Расход'}
                                    </span>
                                </div>
                            ) : (
                                <div className={`${styles.summaryValue} ${styles.deltaNeutral}`}>—</div>
                            )}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <Label>Новый остаток</Label>
                        <Input
                            value={newQty}
                            onChange={(event) => setNewQty(event.target.value)}
                            placeholder="0"
                            type="number"
                            min={0}
                            className={styles.textField}
                        />
                    </div>

                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Изменение</div>
                        {delta === null ? (
                            <div className={`${styles.summaryValue} ${styles.deltaNeutral}`}>—</div>
                        ) : (
                            <div
                                className={`${styles.summaryValue} ${
                                    delta > 0 ? styles.deltaPositive : delta < 0 ? styles.deltaNegative : styles.deltaNeutral
                                }`}
                            >
                                {delta > 0 ? '+' : delta < 0 ? '-' : ''}
                                {Math.abs(delta)} {warehouseItem.товар_единица}
                            </div>
                        )}
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}
                </div>
            </EntityModalShell>
        </Dialog>
    );
}
