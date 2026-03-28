import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import styles from './CreateClientModal.module.css';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClientCreated: () => void;
}

export function CreateClientModal({ isOpen, onClose, onClientCreated }: CreateClientModalProps): JSX.Element {
    const [название, setНазвание] = useState('');
    const [телефон, setТелефон] = useState('');
    const [email, setEmail] = useState('');
    const [адрес, setАдрес] = useState('');
    const [тип, setТип] = useState('розничный');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setНазвание('');
        setТелефон('');
        setEmail('');
        setАдрес('');
        setТип('розничный');
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
    }, [isOpen]);

    const canSubmit = useMemo(() => {
        return название.trim().length > 0 && !loading;
    }, [название, loading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!название.trim()) {
            setError('Название клиента обязательно');
            return;
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Некорректный формат email');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    название: название.trim(),
                    телефон: телефон.trim() || undefined,
                    email: email.trim() || undefined,
                    адрес: адрес.trim() || undefined,
                    тип: тип.trim() || 'розничный',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания клиента');
            }

            resetForm();
            onClientCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const typeValue = useMemo(() => {
        return тип ? тип : '';
    }, [тип]);

    if (!isOpen) return <></>;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Добавить нового клиента</Dialog.Title>


                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Название клиента *
                            </Text>
                            <TextField.Root
                                value={название}
                                onChange={(e) => setНазвание(e.target.value)}
                                placeholder="Введите название клиента"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Телефон
                            </Text>
                            <TextField.Root
                                value={телефон}
                                onChange={(e) => setТелефон(e.target.value)}
                                placeholder="Введите номер телефона"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Email
                            </Text>
                            <TextField.Root
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Введите email"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Адрес
                            </Text>
                            <TextField.Root
                                value={адрес}
                                onChange={(e) => setАдрес(e.target.value)}
                                placeholder="Введите адрес клиента"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Тип клиента
                            </Text>
                            <Select.Root value={typeValue} onValueChange={setТип}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="розничный">Розничный</Select.Item>
                                    <Select.Item value="оптовый">Оптовый</Select.Item>
                                    <Select.Item value="корпоративный">Корпоративный</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        {error && (
                            <Box className={styles.error}>
                                <Text size="2">{error}</Text>
                            </Box>
                        )}

                        <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose} disabled={loading}>
                                Отмена
                            </Button>
                            <Button type="submit" variant="solid" color="gray" highContrast disabled={!canSubmit} loading={loading}>
                                Добавить клиента
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}