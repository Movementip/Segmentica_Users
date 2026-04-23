import React, { useEffect, useMemo, useState } from 'react';

import { EntityModalShell } from '@/components/EntityModalShell/EntityModalShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import styles from './CreateManagerModal.module.css';

interface CreateManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onManagerCreated: () => void;
    canCreate: boolean;
}

type ManagerCreatePayload = {
    фио: string;
    должность: string;
    телефон: string;
    email: string;
    ставка: string;
    дата_приема: string;
    активен: boolean;
};

export function CreateManagerModal({ isOpen, onClose, onManagerCreated, canCreate }: CreateManagerModalProps): JSX.Element | null {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<ManagerCreatePayload>({
        фио: '',
        должность: '',
        телефон: '',
        email: '',
        ставка: '',
        дата_приема: '',
        активен: true,
    });

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
    }, [isOpen]);

    const canSubmit = useMemo(() => {
        return canCreate && formData.фио.trim().length > 0 && formData.должность.trim().length > 0 && !loading;
    }, [canCreate, formData.должность, formData.фио, loading]);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        setFormData({
            фио: '',
            должность: '',
            телефон: '',
            email: '',
            ставка: '',
            дата_приема: '',
            активен: true,
        });
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.фио.trim() || !formData.должность.trim()) return;

        if (!canCreate) {
            setError('Нет доступа');
            return;
        }

        if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            setError('Некорректный формат email');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/managers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    фио: formData.фио.trim(),
                    должность: formData.должность.trim(),
                    телефон: formData.телефон.trim() ? formData.телефон.trim() : null,
                    email: formData.email.trim() ? formData.email.trim() : null,
                    ставка: formData.ставка.trim() ? Number(formData.ставка) : null,
                    дата_приема: formData.дата_приема ? formData.дата_приема : null,
                    активен: formData.активен,
                }),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(responseData.error || 'Ошибка создания сотрудника');
            }

            onManagerCreated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка при создании сотрудника');
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
                title="Добавить сотрудника"
                description="Заполните основные данные сотрудника."
            >
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <Label className={styles.label}>ФИО</Label>
                            <Input
                                value={formData.фио}
                                onChange={(e) => setFormData((p) => ({ ...p, фио: e.target.value }))}
                                placeholder="Иванов Иван Иванович"
                                className={styles.textField}
                                autoFocus
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.label}>Должность</Label>
                            <Input
                                value={formData.должность}
                                onChange={(e) => setFormData((p) => ({ ...p, должность: e.target.value }))}
                                placeholder="Менеджер по продажам"
                                className={styles.textField}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.label}>Телефон</Label>
                            <Input
                                value={formData.телефон}
                                onChange={(e) => setFormData((p) => ({ ...p, телефон: e.target.value }))}
                                placeholder="+7 (999) 123-45-67"
                                className={styles.textField}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.label}>Email</Label>
                            <Input
                                value={formData.email}
                                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                                placeholder="ivanov@company.com"
                                className={styles.textField}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.label}>Ставка (руб.)</Label>
                            <Input
                                value={formData.ставка}
                                onChange={(e) => setFormData((p) => ({ ...p, ставка: e.target.value }))}
                                placeholder="50000"
                                className={styles.textField}
                                type="number"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Label className={styles.label}>Дата приёма</Label>
                            <Input
                                value={formData.дата_приема}
                                onChange={(e) => setFormData((p) => ({ ...p, дата_приема: e.target.value }))}
                                className={styles.textField}
                                type="date"
                            />
                        </div>
                    </div>

                    <label className={styles.checkboxRow}>
                        <Checkbox
                            checked={formData.активен}
                            onCheckedChange={(checked) => setFormData((p) => ({ ...p, активен: checked === true }))}
                        />
                        <span className={styles.checkboxLabel}>Активен</span>
                    </label>

                    {error ? <div className={styles.error}>{error}</div> : null}

                    <div className={styles.actions}>
                        <Button type="button" variant="outline" onClick={handleClose} className={styles.secondaryButton} disabled={loading}>
                            Отмена
                        </Button>
                        <Button type="submit" variant="default" className={styles.primaryButton} disabled={!canSubmit}>
                            {loading ? 'Создание…' : 'Добавить'}
                        </Button>
                    </div>
                </form>
            </EntityModalShell>
        </Dialog>
    );
}
