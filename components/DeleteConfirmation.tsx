import React from 'react';
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes';
import styles from './DeleteConfirmation.module.css';

interface Order {
    id: number;
    клиент_название?: string;
    общая_сумма: number;
}

interface DeleteConfirmationProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    order?: Order | null;
    loading?: boolean;
    title?: string;
    message?: string;
    warning?: string;
    confirmText?: string;
    cancelText?: string;
    details?: React.ReactNode;
    contentClassName?: string;
    actionsClassName?: string;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
    isOpen,
    onClose,
    onConfirm,
    order = null,
    loading = false,
    title,
    message,
    warning,
    confirmText,
    cancelText,
    details,
    contentClassName,
    actionsClassName,
}) => {
    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <Dialog.Content className={contentClassName || styles.modalContent}>
                <Dialog.Title>{title || 'Подтверждение удаления'}</Dialog.Title>


                <Box className={styles.form}>
                    <Flex direction="column" gap="3">
                        <Text as="div" size="2" color="gray">
                            {message || 'Вы уверены, что хотите удалить заявку?'}
                        </Text>
                        {details ? details : order ? <CardInfo order={order} /> : null}
                        <Text as="div" size="2" color="gray">
                            <Text as="span" weight="bold">Внимание:</Text>{' '}
                            {warning || 'Это действие нельзя отменить. Все данные заявки и связанные позиции будут удалены.'}
                        </Text>

                        <Flex justify="end" gap="3" mt="4" className={actionsClassName || styles.modalActions}>
                            <Button type="button" variant="surface" color="gray" highContrast onClick={onClose} disabled={loading}>
                                {cancelText || 'Отмена'}
                            </Button>
                            <Button
                                type="button"
                                variant="surface"
                                color="red"
                                highContrast
                                className={styles.modalDeleteButton}
                                onClick={onConfirm}
                                disabled={loading}
                            >
                                {loading ? 'Удаление...' : confirmText || 'Удалить'}
                            </Button>
                        </Flex>
                    </Flex>
                </Box>
            </Dialog.Content>
        </Dialog.Root>
    );
};

const CardInfo = ({ order }: { order: Order }) => {
    const sum = order.общая_сумма.toLocaleString('ru-RU', {
        style: 'currency',
        currency: 'RUB',
    });

    return (
        <Box className={styles.positionsSection}>
            <Flex direction="column" gap="1">
                <Text as="div" weight="bold">Заявка #{order.id}</Text>
                {order.клиент_название ? (
                    <Text as="div" size="2" color="gray">Клиент: {order.клиент_название}</Text>
                ) : null}
                <Text as="div" size="2" color="gray">Сумма: {sum}</Text>
            </Flex>
        </Box>
    );
};

export default DeleteConfirmation;