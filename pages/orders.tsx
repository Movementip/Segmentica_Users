import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import CreateOrderModal from '../components/CreateOrderModal';
import DeleteConfirmation from '../components/DeleteConfirmation';
import styles from '../styles/Orders.module.css';
import { FiPlus, FiRefreshCw, FiTrash2, FiSearch, FiFilter, FiChevronDown } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface Order {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    адрес_доставки?: string;
    клиент_название?: string;
    менеджер_фио?: string;
}

function OrdersPage(): JSX.Element {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const filterRef = useRef<HTMLDivElement>(null);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [operationLoading, setOperationLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Filters state
    const [filters, setFilters] = useState({
        status: 'all',
        sortBy: 'date-desc',
    });

    // Handle clicks outside filter dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setShowFilters(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch orders on initial load and when search or filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, searchQuery ? 300 : 0); // Only debounce when searching

        return () => clearTimeout(timer);
    }, [searchQuery, filters]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/orders');

            if (!response.ok) {
                throw new Error('Ошибка загрузки заявок');
            }

            let data = await response.json();

            // Apply search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                data = data.filter((order: Order) =>
                    (order.клиент_название?.toLowerCase().includes(query)) ||
                    (order.менеджер_фио?.toLowerCase().includes(query)) ||
                    (order.адрес_доставки?.toLowerCase().includes(query)) ||
                    (order.статус.toLowerCase().includes(query)) ||
                    (order.id.toString().includes(query))
                );
            }

            // Apply status filter
            if (filters.status !== 'all') {
                data = data.filter((order: Order) =>
                    order.статус.toLowerCase() === filters.status.toLowerCase()
                );
            }

            // Apply sorting
            data.sort((a: Order, b: Order) => {
                switch (filters.sortBy) {
                    case 'date-asc':
                        return new Date(a.дата_создания).getTime() - new Date(b.дата_создания).getTime();
                    case 'sum-asc':
                        return a.общая_сумма - b.общая_сумма;
                    case 'sum-desc':
                        return b.общая_сумма - a.общая_сумма;
                    case 'date-desc':
                    default:
                        return new Date(b.дата_создания).getTime() - new Date(a.дата_создания).getTime();
                }
            });

            setOrders(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'новая': return '#2196f3';
            case 'в обработке': return '#ff9800';
            case 'выполнена': return '#4caf50';
            case 'отменена': return '#f44336';
            default: return '#666';
        }
    };

    // CRUD operations
    const handleCreateOrder = async (orderData: any) => {
        try {
            setOperationLoading(true);
            console.log('Creating order with data:', orderData); // Debug log

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData); // Debug log
                throw new Error(errorData.error || 'Ошибка создания заявки');
            }

            const result = await response.json();
            console.log('Order created successfully:', result); // Debug log

            await fetchOrders(); // Refresh the list
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;

        try {
            setOperationLoading(true);
            const response = await fetch(`/api/orders?id=${selectedOrder.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Ошибка удаления заявки');
            }

            await fetchOrders(); // Refresh the list
            setIsDeleteConfirmOpen(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error deleting order:', error);
            setError('Ошибка удаления заявки');
        } finally {
            setOperationLoading(false);
        }
    };

    const openDeleteConfirm = (order: Order) => {
        setSelectedOrder(order);
        setIsDeleteConfirmOpen(true);
    };

    if (loading) {
        return (
            <>
                <div className={styles.card}>
                    <p>Загрузка заявок...</p>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>

                <div className={styles.card}>
                    <h2>Ошибка</h2>
                    <p style={{ color: '#f44336' }}>{error}</p>
                    <button
                        onClick={fetchOrders}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#3d5afe',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '16px'
                        }}
                    >
                        Повторить попытку
                    </button>
                </div>
            </>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header Section */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Заявки</h1>
                        <p className={styles.subtitle}>Управление заявками клиентов</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            className={`${styles.button} ${styles.secondaryButton}`}
                            onClick={fetchOrders}
                            disabled={loading}
                        >
                            <FiRefreshCw className={`${styles.icon} ${loading ? styles.spin : ''}`} />
                            Обновить
                        </button>
                        <button
                            className={`${styles.button} ${styles.primaryButton}`}
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <FiPlus className={styles.icon} />
                            Новая заявка
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#4e73df' }}>
                        {orders.filter(o => o.статус.toLowerCase() === 'новая').length}
                    </div>
                    <div className={styles.statLabel}>Новые</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#f6c23e' }}>
                        {orders.filter(o => o.статус.toLowerCase() === 'в обработке').length}
                    </div>
                    <div className={styles.statLabel}>В обработке</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#1cc88a' }}>
                        {orders.filter(o => o.статус.toLowerCase() === 'выполнена').length}
                    </div>
                    <div className={styles.statLabel}>Выполнены</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#36b9cc' }}>
                        {formatCurrency(orders.reduce((sum, o) => sum + o.общая_сумма, 0))}
                    </div>
                    <div className={styles.statLabel}>Общая сумма</div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className={styles.searchSection}>
                <div className={styles.searchInput}>
                    <FiSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Поиск по заявкам..."
                        className={styles.searchField}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <div className={styles.filterDropdown} ref={filterRef}>
                        <button
                            className={`${styles.filterButton} ${filters.status !== 'all' ? styles.active : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowFilters(!showFilters);
                            }}
                        >
                            <FiFilter className={styles.icon} />
                            Фильтры
                            <FiChevronDown className={`${styles.icon} ${showFilters ? styles.rotateIcon : ''}`} />
                        </button>
                        <div
                            className={`${styles.filterDropdownContent} ${showFilters ? styles.show : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={styles.filterSection}>
                                <label className={styles.filterLabel}>Статус заявки</label>
                                <select
                                    className={styles.select}
                                    value={filters.status}
                                    onChange={(e) => {
                                        setFilters({ ...filters, status: e.target.value });
                                        setShowFilters(false);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="all">Все статусы</option>
                                    <option value="новая">Новая</option>
                                    <option value="в обработке">В обработке</option>
                                    <option value="выполнена">Выполнена</option>
                                    <option value="отменена">Отменена</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className={styles.sortDropdown}>
                        <span>Сортировка: </span>
                        <select
                            className={styles.select}
                            value={filters.sortBy}
                            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                        >
                            <option value="date-desc">По дате (новые сначала)</option>
                            <option value="date-asc">По дате (старые сначала)</option>
                            <option value="sum-asc">По сумме (по возрастанию)</option>
                            <option value="sum-desc">По сумме (по убыванию)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className={styles.card}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.loadingSpinner}></div>
                        <p>Загрузка заявок...</p>
                    </div>
                ) : error ? (
                    <div className={styles.errorState}>
                        <p className={styles.errorText}>{error}</p>
                        <button
                            className={`${styles.button} ${styles.primaryButton}`}
                            onClick={fetchOrders}
                        >
                            Повторить попытку
                        </button>
                    </div>
                ) : orders.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>Заявки не найдены</p>
                        <button
                            className={`${styles.button} ${styles.primaryButton}`}
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <FiPlus className={styles.icon} />
                            Создать первую заявку
                        </button>
                    </div>
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>ID</th>
                                    <th className={styles.tableHeader}>Контрагент</th>
                                    <th className={styles.tableHeader}>Менеджер</th>
                                    <th className={styles.tableHeader}>Дата</th>
                                    <th className={styles.tableHeader}>Статус</th>
                                    <th className={`${styles.tableHeader} ${styles.textRight}`}>Сумма</th>
                                    <th className={styles.tableHeader}>Адрес</th>
                                    <th className={styles.tableHeader}></th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {orders.map((order) => (
                                        <motion.tr
                                            key={order.id}
                                            className={styles.tableRow}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            onClick={() => router.push(`/orders/${order.id}`)}
                                        >
                                            <td className={styles.tableCell}>
                                                <span className={styles.orderId}>#{order.id}</span>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.clientCell}>
                                                    <div className={styles.clientName}>
                                                        {order.клиент_название || `Клиент ID: ${order.клиент_id}`}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.managerCell}>
                                                    {order.менеджер_фио || (order.менеджер_id ? `ID: ${order.менеджер_id}` : 'Не назначен')}
                                                </div>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.dateCell}>
                                                    {formatDate(order.дата_создания)}
                                                </div>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div
                                                    className={styles.statusBadge}
                                                    style={{
                                                        backgroundColor: `${getStatusColor(order.статус)}15`,
                                                        color: getStatusColor(order.статус),
                                                        border: `1px solid ${getStatusColor(order.статус)}40`
                                                    }}
                                                >
                                                    {order.статус}
                                                </div>
                                            </td>
                                            <td className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell}`}>
                                                {formatCurrency(order.общая_сумма)}
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.addressCell}>
                                                    {order.адрес_доставки || 'Не указан'}
                                                </div>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.actionsCell}>
                                                    <button
                                                        className={styles.deleteButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDeleteConfirm(order);
                                                        }}
                                                        title="Удалить заявку"
                                                    >
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {/* Modal Components */}
            <CreateOrderModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateOrder}
            />

            <DeleteConfirmation
                isOpen={isDeleteConfirmOpen}
                onClose={() => {
                    setIsDeleteConfirmOpen(false);
                    setSelectedOrder(null);
                }}
                onConfirm={handleDeleteOrder}
                order={selectedOrder}
                loading={operationLoading}
            />
        </div>
    );
}

export default withLayout(OrdersPage);