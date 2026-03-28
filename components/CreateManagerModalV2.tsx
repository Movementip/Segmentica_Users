import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Checkbox, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import styles from './CreateManagerModalV2.module.css';

interface CreateManagerModalV2Props {
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

export function CreateManagerModalV2({ isOpen, onClose, onManagerCreated, canCreate }: CreateManagerModalV2Props): JSX.Element | null {
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
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Добавить сотрудника</Dialog.Title>
                <Dialog.Description className={styles.description}>Заполните данные сотрудника.</Dialog.Description>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    ФИО
                                </Text>
                                <TextField.Root
                                    value={formData.фио}
                                    onChange={(e) => setFormData((p) => ({ ...p, фио: e.target.value }))}
                                    placeholder={'Иванов Иван Иванович'}
                                    className={styles.textField}
                                    autoFocus
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Должность
                                </Text>
                                <TextField.Root
                                    value={formData.должность}
                                    onChange={(e) => setFormData((p) => ({ ...p, должность: e.target.value }))}
                                    placeholder={'Менеджер по продажам'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Телефон
                                </Text>
                                <TextField.Root
                                    value={formData.телефон}
                                    onChange={(e) => setFormData((p) => ({ ...p, телефон: e.target.value }))}
                                    placeholder={'+7 (999) 123-45-67'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Email
                                </Text>
                                <TextField.Root
                                    value={formData.email}
                                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                                    placeholder={'ivanov@company.com'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Ставка (руб.)
                                </Text>
                                <TextField.Root
                                    value={formData.ставка}
                                    onChange={(e) => setFormData((p) => ({ ...p, ставка: e.target.value }))}
                                    placeholder={'50000'}
                                    className={styles.textField}
                                    size="2"
                                    type="number"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Дата приёма
                                </Text>
                                <TextField.Root
                                    value={formData.дата_приема}
                                    onChange={(e) => setFormData((p) => ({ ...p, дата_приема: e.target.value }))}
                                    className={styles.textField}
                                    size="2"
                                    type="date"
                                />
                            </Box>
                        </div>

                        <Box className={styles.checkboxRow}>
                            <Checkbox
                                checked={formData.активен}
                                onCheckedChange={(checked) => setFormData((p) => ({ ...p, активен: checked === true }))}
                            />
                            <Text as="label" size="2">
                                Активен
                            </Text>
                        </Box>

                        {error ? (
                            <Box className={styles.error}>
                                <Text as="div" size="2" color="red">
                                    {error}
                                </Text>
                            </Box>
                        ) : null}

                        <Flex gap="3" justify="end" className={styles.actions}>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} className={styles.secondaryButton} disabled={loading}>
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={styles.primaryButton}
                                disabled={!canSubmit}
                                loading={loading}
                            >
                                {loading ? 'Создание...' : 'Добавить'}
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}
