import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import styles from './EditSupplierModal.module.css';

export type EditSupplierModalSupplier = {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    рейтинг?: number;
};

interface EditSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => void;
    supplier: EditSupplierModalSupplier | null;
}

type FormState = {
    название: string;
    телефон: string;
    email: string;
    рейтинг: string;
};

export function EditSupplierModal({ isOpen, onClose, onUpdated, supplier }: EditSupplierModalProps): JSX.Element {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<FormState>({
        название: '',
        телефон: '',
        email: '',
        рейтинг: '5',
    });

    useEffect(() => {
        if (!isOpen) return;

        setError(null);
        setLoading(false);

        setFormData({
            название: supplier?.название || '',
            телефон: supplier?.телефон || '',
            email: supplier?.email || '',
            рейтинг: String(supplier?.рейтинг ?? 5),
        });
    }, [isOpen, supplier]);

    const canSubmit = useMemo(() => {
        return Boolean(supplier) && formData.название.trim().length > 0 && !loading;
    }, [formData.название, loading, supplier]);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplier) return;
        if (!formData.название.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/suppliers/${supplier.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    название: formData.название.trim(),
                    телефон: formData.телефон.trim() ? formData.телефон.trim() : null,
                    email: formData.email.trim() ? formData.email.trim() : null,
                    рейтинг: Number(formData.рейтинг) || 5,
                }),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(responseData.error || 'Ошибка обновления поставщика');
            }

            onUpdated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка при обновлении поставщика');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return <></>;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Редактировать поставщика</Dialog.Title>
                <Dialog.Description className={styles.description}>
                    Обновите данные компании и контакты.
                </Dialog.Description>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Название компании
                                </Text>
                                <TextField.Root
                                    value={formData.название}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, название: e.target.value }))}
                                    placeholder={'ООО "Компания"'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Рейтинг
                                </Text>
                                <Select.Root
                                    value={formData.рейтинг}
                                    onValueChange={(value) => setFormData((prev) => ({ ...prev, рейтинг: value }))}
                                >
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="5">5</Select.Item>
                                        <Select.Item value="4">4</Select.Item>
                                        <Select.Item value="3">3</Select.Item>
                                        <Select.Item value="2">2</Select.Item>
                                        <Select.Item value="1">1</Select.Item>
                                        <Select.Item value="0">0</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">
                                    Телефон
                                </Text>
                                <TextField.Root
                                    value={formData.телефон}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, телефон: e.target.value }))}
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
                                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                    placeholder={'info@company.com'}
                                    className={styles.textField}
                                    size="2"
                                />
                            </Box>
                        </div>

                        {error ? (
                            <Box className={styles.error}>
                                <Text as="div" size="2" color="red">
                                    {error}
                                </Text>
                            </Box>
                        ) : null}

                        <Flex gap="3" justify="end" className={styles.actions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={handleClose}
                                className={styles.secondaryButton}
                                disabled={loading}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={styles.primaryButton}
                                disabled={!canSubmit}
                            >
                                {loading ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}
