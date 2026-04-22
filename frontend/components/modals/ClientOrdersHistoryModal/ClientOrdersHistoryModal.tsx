import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { FiChevronDown, FiEye } from 'react-icons/fi';

import { EntityActionButton } from '../../EntityActionButton/EntityActionButton';
import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import { EntityStatusBadge } from '../../EntityStatusBadge/EntityStatusBadge';
import { EntityTableSurface, entityTableClassName } from '../../EntityDataTable/EntityDataTable';
import { Dialog } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';

import styles from './ClientOrdersHistoryModal.module.css';

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

const STATUS_OPTIONS = [
    { value: 'all', label: 'Все статусы' },
    { value: 'новая', label: 'Новая' },
    { value: 'в обработке', label: 'В обработке' },
    { value: 'выполнена', label: 'Выполнена' },
    { value: 'отгружена', label: 'Отгружена' },
    { value: 'отменена', label: 'Отменена' },
] as const;

const SORT_OPTIONS = [
    { value: 'date-desc', label: 'Сначала новые' },
    { value: 'date-asc', label: 'Сначала старые' },
    { value: 'sum-desc', label: 'Сумма по убыванию' },
    { value: 'sum-asc', label: 'Сумма по возрастанию' },
] as const;

type StatusFilter = typeof STATUS_OPTIONS[number]['value'];
type SortBy = typeof SORT_OPTIONS[number]['value'];

const ClientOrdersHistoryModal: React.FC<ClientOrdersHistoryModalProps> = ({
    isOpen,
    onClose,
    clientId,
    clientName,
}) => {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortBy, setSortBy] = useState<SortBy>('date-desc');

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

        void fetchOrders();
    }, [isOpen, clientId]);

    const filteredOrders = useMemo(() => {
        let data = [...orders];

        if (statusFilter !== 'all') {
            data = data.filter((order) => (order.статус || '').toLowerCase() === statusFilter.toLowerCase());
        }

        data.sort((a, b) => {
            if (sortBy === 'date-asc') return new Date(a.дата_создания).getTime() - new Date(b.дата_создания).getTime();
            if (sortBy === 'sum-asc') return (a.общая_сумма || 0) - (b.общая_сумма || 0);
            if (sortBy === 'sum-desc') return (b.общая_сумма || 0) - (a.общая_сумма || 0);
            return new Date(b.дата_создания).getTime() - new Date(a.дата_создания).getTime();
        });

        return data;
    }, [orders, sortBy, statusFilter]);

    const statusFilterLabel = useMemo(
        () => STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? 'Все статусы',
        [statusFilter]
    );

    const sortByLabel = useMemo(
        () => SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Сначала новые',
        [sortBy]
    );

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
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={styles.modalContent}
                title={`История заявок${clientName ? `: ${clientName}` : ''}`}
                description="Здесь собраны все заявки выбранного клиента с фильтрацией и сортировкой."
                onClose={handleClose}
                footer={(
                    <EntityActionButton type="button" onClick={handleClose}>
                        Закрыть
                    </EntityActionButton>
                )}
            >
                <div className={styles.controls}>
                    <div className={styles.controlField}>
                        <span className={styles.controlLabel}>Статус</span>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                            <SelectTrigger className={styles.selectTrigger}>
                                <span className={styles.selectTriggerValue}>{statusFilterLabel}</span>
                                <FiChevronDown className={styles.selectTriggerIcon} />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className={styles.controlField}>
                        <span className={styles.controlLabel}>Сортировка</span>
                        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                            <SelectTrigger className={styles.selectTrigger}>
                                <span className={styles.selectTriggerValue}>{sortByLabel}</span>
                                <FiChevronDown className={styles.selectTriggerIcon} />
                            </SelectTrigger>
                            <SelectContent>
                                {SORT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <EntityActionButton
                        type="button"
                        className={styles.openButton}
                        onClick={() => router.push(`/orders?client_id=${clientId}`)}
                    >
                        Открыть в заявках
                    </EntityActionButton>
                </div>

                {error ? <div className={styles.error}>{error}</div> : null}

                <EntityTableSurface variant="embedded" clip="all" className={styles.tableSurface}>
                    <Table className={entityTableClassName}>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Дата</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Сумма</TableHead>
                                <TableHead>Адрес</TableHead>
                                <TableHead className={styles.actionsHead}>Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className={styles.emptyState}>
                                        Загрузка заявок...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className={styles.emptyState}>
                                        Нет заявок
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>#{order.id}</TableCell>
                                        <TableCell>{formatDate(order.дата_создания)}</TableCell>
                                        <TableCell>
                                            <EntityStatusBadge value={order.статус} compact />
                                        </TableCell>
                                        <TableCell>{formatCurrency(order.общая_сумма)}</TableCell>
                                        <TableCell>{order.адрес_доставки || '-'}</TableCell>
                                        <TableCell className={styles.actionsCell}>
                                            <EntityActionButton
                                                type="button"
                                                onClick={() => router.push(`/orders/${order.id}`)}
                                            >
                                                <FiEye />
                                                Открыть
                                            </EntityActionButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </EntityTableSurface>
            </EntityModalShell>
        </Dialog>
    );
};

export default ClientOrdersHistoryModal;
