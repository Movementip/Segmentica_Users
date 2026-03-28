import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Table, Text } from '@radix-ui/themes';
import { FiEye } from 'react-icons/fi';
import { useRouter } from 'next/router';
import styles from './CreateOrderModal.module.css';

interface Order {
    id: number;
    клиент_id: number;
    дата_создания: string;
    статус: string;
    общая_сумма: number;
    адрес_доставки?: string;
    менеджер_фио?: string;
}

interface ClientOrdersHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: number | null;
    clientName?: string;
}

const ClientOrdersHistoryModal: React.FC<ClientOrdersHistoryModalProps> = ({ isOpen, onClose, clientId, clientName }) => {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<'all' | 'новая' | 'в обработке' | 'выполнена' | 'отгружена' | 'отменена'>('all');
    const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'sum-desc' | 'sum-asc'>('date-desc');

    const handleClose = () => {
        setError(null);
        onClose();
    };

    useEffect(() => {
        if (!isOpen || !clientId) return;

        const fetchOrders = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/orders?client_id=${clientId}`);
                if (!response.ok) throw new Error('Ошибка загрузки заявок');

                const data = await response.json();
                setOrders(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [isOpen, clientId]);

    const filteredOrders = useMemo(() => {
        let data = [...orders];

        if (statusFilter !== 'all') {
            data = data.filter((o) => (o.статус || '').toLowerCase() === statusFilter.toLowerCase());
        }

        data.sort((a, b) => {
            if (sortBy === 'date-asc') return new Date(a.дата_создания).getTime() - new Date(b.дата_создания).getTime();
            if (sortBy === 'sum-asc') return (a.общая_сумма || 0) - (b.общая_сумма || 0);
            if (sortBy === 'sum-desc') return (b.общая_сумма || 0) - (a.общая_сумма || 0);
            return new Date(b.дата_создания).getTime() - new Date(a.дата_создания).getTime();
        });

        return data;
    }, [orders, statusFilter, sortBy]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (!isOpen || !clientId) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>
                    История заказов{clientName ? `: ${clientName}` : ''}
                </Dialog.Title>


                <Flex direction="column" gap="4">
                    <Flex align="center" gap="3" wrap="wrap">
                        <Box style={{ minWidth: 220 }}>
                            <Text as="label" size="2" weight="medium">
                                Статус
                            </Text>
                            <Select.Root value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="all">Все</Select.Item>
                                    <Select.Item value="новая">Новая</Select.Item>
                                    <Select.Item value="в обработке">В обработке</Select.Item>
                                    <Select.Item value="выполнена">Выполнена</Select.Item>
                                    <Select.Item value="отгружена">Отгружена</Select.Item>
                                    <Select.Item value="отменена">Отменена</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box style={{ minWidth: 220 }}>
                            <Text as="label" size="2" weight="medium">
                                Сортировка
                            </Text>
                            <Select.Root value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="date-desc">Сначала новые</Select.Item>
                                    <Select.Item value="date-asc">Сначала старые</Select.Item>
                                    <Select.Item value="sum-desc">Сумма по убыванию</Select.Item>
                                    <Select.Item value="sum-asc">Сумма по возрастанию</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box style={{ marginLeft: 'auto' }}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={styles.surfaceActionButton}
                                onClick={() => router.push(`/orders?client_id=${clientId}`)}
                            >
                                Открыть в заявках
                            </Button>
                        </Box>
                    </Flex>

                    {error && (
                        <Box className={styles.error}>
                            <Text size="2">{error}</Text>
                        </Box>
                    )}

                    <Box style={{ overflowX: 'auto' }}>
                        <Table.Root variant="surface">
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Адрес</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Действия</Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {loading ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={6}>
                                            <Text size="2" color="gray">Загрузка...</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : filteredOrders.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={6}>
                                            <Text size="2" color="gray">Нет заявок</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : (
                                    filteredOrders.map((o) => (
                                        <Table.Row key={o.id}>
                                            <Table.Cell>{o.id}</Table.Cell>
                                            <Table.Cell>{formatDate(o.дата_создания)}</Table.Cell>
                                            <Table.Cell>{o.статус}</Table.Cell>
                                            <Table.Cell>{formatCurrency(o.общая_сумма)}</Table.Cell>
                                            <Table.Cell>{o.адрес_доставки || '-'}</Table.Cell>
                                            <Table.Cell>
                                                <Button
                                                    type="button"
                                                    variant="surface"
                                                    color="gray"
                                                    highContrast
                                                    className={styles.surfaceActionButton}
                                                    onClick={() => router.push(`/orders/${o.id}`)}
                                                >
                                                    <FiEye />
                                                </Button>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))
                                )}
                            </Table.Body>
                        </Table.Root>
                    </Box>

                    <Flex justify="end" gap="3" mt="2" className={styles.modalActions}>
                        <Button type="button" variant="surface" color="gray" highContrast onClick={handleClose}>
                            Закрыть
                        </Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default ClientOrdersHistoryModal;
