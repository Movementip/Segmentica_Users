import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Table, Text } from '@radix-ui/themes';
import { FiEye } from 'react-icons/fi';
import { useRouter } from 'next/router';
import styles from './ProductPriceHistoryModal.module.css';

interface ProductPriceHistoryEntry {
    id: number;
    товар_id: number;
    цена_закупки?: number;
    цена_продажи?: number;
    изменено_в: string;
    источник?: string;
    комментарий?: string;
}

interface ProductPriceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId: number | null;
    productName?: string;
}

export const ProductPriceHistoryModal: React.FC<ProductPriceHistoryModalProps> = ({
    isOpen,
    onClose,
    productId,
    productName,
}) => {
    const router = useRouter();
    const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'sale-desc' | 'sale-asc'>('date-desc');

    const handleClose = () => {
        setError(null);
        onClose();
    };

    useEffect(() => {
        if (!isOpen || !productId) return;

        const fetchHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/products?id=${productId}&include_price_history=1`);
                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error('Нет доступа к истории цен');
                    }
                    throw new Error('Ошибка загрузки истории цен');
                }

                const data = await response.json();
                setHistory(Array.isArray(data.история_цен) ? data.история_цен : []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [isOpen, productId]);

    const sourceOptions = useMemo(() => {
        return Array.from(new Set(history.map((item) => item.источник).filter(Boolean) as string[]));
    }, [history]);

    const filteredHistory = useMemo(() => {
        let data = [...history];

        if (sourceFilter !== 'all') {
            data = data.filter((item) => item.источник === sourceFilter);
        }

        data.sort((a, b) => {
            if (sortBy === 'date-asc') {
                return new Date(a.изменено_в).getTime() - new Date(b.изменено_в).getTime();
            }
            if (sortBy === 'sale-asc') {
                return (a.цена_продажи || 0) - (b.цена_продажи || 0);
            }
            if (sortBy === 'sale-desc') {
                return (b.цена_продажи || 0) - (a.цена_продажи || 0);
            }
            return new Date(b.изменено_в).getTime() - new Date(a.изменено_в).getTime();
        });

        return data;
    }, [history, sourceFilter, sortBy]);

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (amount?: number) => {
        if (amount === undefined || amount === null) return '—';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
        }).format(amount);
    };

    if (!isOpen || !productId) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <Dialog.Content className={styles.modalContent} style={{ maxWidth: 900 }}>
                <Dialog.Title>
                    История цен{productName ? `: ${productName}` : ''}
                </Dialog.Title>


                <Flex direction="column" gap="4" className={styles.form}>
                    <Flex align="end" gap="3" wrap="wrap">
                        <Box className={styles.formGroup} style={{ minWidth: 220, flex: '0 1 220px', marginBottom: 0 }}>
                            <Text as="label" size="2" weight="medium">
                                Источник
                            </Text>
                            <Select.Root value={sourceFilter} onValueChange={setSourceFilter}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="all">Все</Select.Item>
                                    {sourceOptions.map((option) => (
                                        <Select.Item key={option} value={option}>{option}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box className={styles.formGroup} style={{ minWidth: 220, flex: '0 1 220px', marginBottom: 0 }}>
                            <Text as="label" size="2" weight="medium">
                                Сортировка
                            </Text>
                            <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as 'date-desc' | 'date-asc' | 'sale-desc' | 'sale-asc')}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="date-desc">Сначала новые</Select.Item>
                                    <Select.Item value="date-asc">Сначала старые</Select.Item>
                                    <Select.Item value="sale-desc">Цена продажи по убыванию</Select.Item>
                                    <Select.Item value="sale-asc">Цена продажи по возрастанию</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box style={{ marginLeft: 'auto', alignSelf: 'end' }}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={styles.headerActionsButton}
                                onClick={() => router.push(`/products/${productId}#price-history`)}
                            >
                                <FiEye /> Открыть страницу товара
                            </Button>
                        </Box>
                    </Flex>

                    {error && (
                        <Box className={styles.error}>
                            <Text size="2">{error}</Text>
                        </Box>
                    )}

                    <Box style={{ overflowX: 'auto' }} className={styles.tableContainer}>
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Цена закупки</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Цена продажи</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Источник</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Комментарий</Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {loading ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={5}>
                                            <Text size="2" color="gray">Загрузка...</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : filteredHistory.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={5}>
                                            <Text size="2" color="gray">История цен отсутствует</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : (
                                    filteredHistory.map((entry) => (
                                        <Table.Row key={entry.id}>
                                            <Table.Cell>{formatDateTime(entry.изменено_в)}</Table.Cell>
                                            <Table.Cell align="right">{formatCurrency(entry.цена_закупки)}</Table.Cell>
                                            <Table.Cell align="right">{formatCurrency(entry.цена_продажи)}</Table.Cell>
                                            <Table.Cell>{entry.источник || '—'}</Table.Cell>
                                            <Table.Cell>{entry.комментарий || '—'}</Table.Cell>
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
