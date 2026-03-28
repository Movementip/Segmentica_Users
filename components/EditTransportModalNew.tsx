import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import styles from './EditTransportModalNew.module.css';

export type EditTransportModalTransportCompany = {
    id: number;
    название: string;
    телефон: string | null;
    email: string | null;
    тариф: number | null;
    created_at?: string;
};

type FormState = {
    название: string;
    телефон: string;
    email: string;
    тариф: string;
};

interface EditTransportModalNewProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => void;
    company: EditTransportModalTransportCompany | null;
}

export function EditTransportModalNew({ isOpen, onClose, onUpdated, company }: EditTransportModalNewProps): JSX.Element {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<FormState>({
        название: '',
        телефон: '',
        email: '',
        тариф: '',
    });

    useEffect(() => {
        if (!isOpen) return;

        setError(null);
        setLoading(false);

        setFormData({
            название: company?.название || '',
            телефон: company?.телефон || '',
            email: company?.email || '',
            тариф: company?.тариф != null ? String(company?.тариф) : '',
        });
    }, [isOpen, company]);

    const canSubmit = useMemo(() => {
        return Boolean(company) && formData.название.trim().length > 0 && !loading;
    }, [company, formData.название, loading]);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;
        if (!formData.название.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/transport/${company.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    название: formData.название.trim(),
                    телефон: formData.телефон.trim() ? formData.телефон.trim() : null,
                    email: formData.email.trim() ? formData.email.trim() : null,
                    тариф: formData.тариф.trim() ? Number(formData.тариф) : null,
                }),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(responseData.error || 'Ошибка обновления транспортной компании');
            }

            onUpdated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка при обновлении');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return <></>;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Редактировать транспортную компанию</Dialog.Title>
                <Dialog.Description className={styles.description}>Обновите данные компании и контакты.</Dialog.Description>

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
                                    Тариф
                                </Text>
                                <TextField.Root
                                    value={formData.тариф}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, тариф: e.target.value }))}
                                    placeholder={'50'}
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
