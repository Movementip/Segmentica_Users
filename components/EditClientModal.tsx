import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes';
import styles from './CreateOrderModal.module.css';

interface Client {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    тип?: string;
}

interface EditClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (clientData: any) => void;
    client: Client | null;
}

const EditClientModal: React.FC<EditClientModalProps> = ({ isOpen, onClose, onSubmit, client }) => {
    const [название, setНазвание] = useState('');
    const [телефон, setТелефон] = useState('');
    const [email, setEmail] = useState('');
    const [адрес, setАдрес] = useState('');
    const [тип, setТип] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !client) return;
        setНазвание(client.название || '');
        setТелефон(client.телефон || '');
        setEmail(client.email || '');
        setАдрес(client.адрес || '');
        setТип(client.тип || '');
        setError(null);
    }, [isOpen, client?.id]);

    const typeValue = useMemo(() => {
        return тип ? тип : '';
    }, [тип]);

    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!client) return;

        if (!название.trim()) {
            setError('Название клиента обязательно');
            return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Некорректный формат email');
            return;
        }

        setLoading(true);
        try {
            await onSubmit({
                id: client.id,
                название: название.trim(),
                телефон: телефон.trim() || null,
                email: email.trim() || null,
                адрес: адрес.trim() || null,
                тип: typeValue.trim() || null,
            });
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка обновления клиента');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !client) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Редактировать клиента #{client.id}</Dialog.Title>


                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Название *
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
                                placeholder="Введите телефон"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Email
                            </Text>
                            <TextField.Root
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
                                placeholder="Введите адрес"
                                className={styles.textField}
                                size="2"
                            />
                        </Box>

                        <Box className={styles.formGroup}>
                            <Text as="label" size="2" weight="medium">
                                Тип клиента
                            </Text>
                            <Select.Root value={typeValue} onValueChange={setТип}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} placeholder="Выберите тип" />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="Розничный">Розничный</Select.Item>
                                    <Select.Item value="Корпоративный">Корпоративный</Select.Item>
                                    <Select.Item value="Физ лицо">Физ лицо</Select.Item>
                                    <Select.Item value="Юр лицо">Юр лицо</Select.Item>
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
                            <Button type="submit" variant="solid" color="gray" highContrast disabled={loading} loading={loading}>
                                Сохранить
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default EditClientModal;
