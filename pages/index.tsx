import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import { withLayout } from '../layout';
import styles from '../styles/Dashboard.module.css';
import Link from 'next/link';
import {
    FiPackage,
    FiTruck,
    FiAlertTriangle,
    FiUsers,
    FiClock,
    FiPlusCircle,
    FiBarChart2,
    FiArrowRight,
    FiShoppingCart,
    FiTruck as FiTruckIcon
} from 'react-icons/fi';

interface DashboardStats {
    activeOrders: number;
    totalProducts: number;
    activeSuppliers: number;
    lowStockItems: number;
    monthlyRevenue: number;
    pendingShipments: number;
    recentOrders: Array<{
        id: number;
        client: string;
        amount: number;
        status: string;
        created_at: string;
    }>;
    stockByCategory: Array<{
        category: string;
        count: number;
    }>;
    warehouseMovements: Array<{
        id: number;
        product_name: string;
        quantity: number;
        operation_type: string;
        operation_date: string;
        comment: string;
        order_id: string;
        purchase_id: string;
    }>;
    salesByPeriod: Array<{
        период: string;
        количество_продаж: number;
        общая_сумма: number;
        средний_чек: number;
    }>;
}

const Home: NextPage = (): JSX.Element => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await fetch('/api/dashboard');
                if (!response.ok) {
                    throw new Error('Ошибка при загрузке данных');
                }
                const data = await response.json();
                setStats(data);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError('Не удалось загрузить данные. Пожалуйста, обновите страницу.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) return <div className={styles.loading}><div>Загрузка...</div></div>;
    if (error) return <div className={styles.error}><FiAlertTriangle /> {error}</div>;
    if (!stats) return <div className={styles.error}>Нет данных для отображения</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Панель управления</h1>
                <p>Обзор вашей деятельности</p>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <h3>Активные заказы</h3>
                    <div className={styles.statValue}>{stats.activeOrders}</div>
                    <div className={styles.statChange}>
                        <FiClock /> <span>В работе</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <h3>Товары на складе</h3>
                    <div className={styles.statValue}>{stats.totalProducts}</div>
                    <div className={styles.statChange}>
                        <FiPackage /> <span>Всего позиций</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <h3>Поставщики</h3>
                    <div className={styles.statValue}>{stats.activeSuppliers}</div>
                    <div className={styles.statChange}>
                        <FiUsers /> <span>Активных</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <h3>Низкий запас</h3>
                    <div className={styles.statValue}>{stats.lowStockItems}</div>
                    <div className={`${styles.statChange} ${styles.danger}`}>
                        <FiAlertTriangle /> <span>Требуют внимания</span>
                    </div>
                </div>
            </div>

            <div className={styles.grid}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Последние заказы</h2>
                        <Link href="/orders" className={styles.viewAll}>
                            Показать все <FiArrowRight />
                        </Link>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.ordersTable}>
                            <thead>
                                <tr>
                                    <th>Заказ</th>
                                    <th>Контрагент</th>
                                    <th>Дата</th>
                                    <th>Сумма</th>
                                    <th>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <div className={styles.orderId}>#{order.id}</div>
                                        </td>
                                        <td>
                                            <div className={styles.orderClient}>{order.client}</div>
                                        </td>
                                        <td className={styles.orderDate}>
                                            {new Date(order.created_at).toLocaleDateString('ru-RU')}
                                        </td>
                                        <td className={styles.orderAmount}>
                                            {order.amount.toLocaleString('ru-RU')} ₽
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${order.status === 'выполнена' ? styles.statusCompleted :
                                                order.status === 'отменена' ? styles.statusCancelled : styles.statusPending
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Продажи по периодам</h2>
                        <Link href="/archive" className={styles.viewAll}>
                            Подробнее <FiArrowRight />
                        </Link>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.ordersTable}>
                            <thead>
                                <tr>
                                    <th>Период</th>
                                    <th>Кол-во продаж</th>
                                    <th>Общая сумма</th>
                                    <th>Средний чек</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.salesByPeriod.map((sale) => (
                                    <tr key={sale.период}>
                                        <td className={styles.orderDate}>
                                            {new Date(sale.период).toLocaleDateString('ru-RU', {
                                                year: 'numeric',
                                                month: 'long'
                                            })}
                                        </td>
                                        <td className={styles.quantityCell}>
                                            {sale.количество_продаж.toLocaleString('ru-RU')}
                                        </td>
                                        <td className={styles.amountCell}>
                                            {(parseFloat(sale.общая_сумма) || 0).toLocaleString('ru-RU', {
                                                style: 'currency',
                                                currency: 'RUB',
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })}
                                        </td>
                                        <td className={styles.amountCell}>
                                            {(parseFloat(sale.средний_чек) || 0).toLocaleString('ru-RU', {
                                                style: 'currency',
                                                currency: 'RUB',
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Последние движения по складу</h2>
                    <Link href="/warehouse-movements" className={styles.viewAll}>
                        Показать все <FiArrowRight />
                    </Link>
                </div>
                <div className={styles.tableContainer}>
                    <table className={styles.ordersTable}>
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th>Количество</th>
                                <th>Тип операции</th>
                                <th>Дата</th>
                                <th>Связанный заказ</th>
                                <th>Закупка</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.warehouseMovements.map((movement) => (
                                <tr key={movement.id}>
                                    <td>
                                        <div className={styles.orderClient}>{movement.product_name}</div>
                                        {movement.comment && <div className={styles.orderNote}>{movement.comment}</div>}
                                    </td>
                                    <td className={`${styles.quantityCell} ${movement.operation_type === 'приход' ? styles.positive : styles.negative
                                        }`}>
                                        {movement.operation_type === 'приход' ? '+' : '-'}{movement.quantity}
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${movement.operation_type === 'приход' ? styles.statusCompleted : styles.statusPending
                                            }`}>
                                            {movement.operation_type}
                                        </span>
                                    </td>
                                    <td className={styles.orderDate}>
                                        {new Date(movement.operation_date).toLocaleDateString('ru-RU')}
                                    </td>
                                    <td>{movement.order_id}</td>
                                    <td>{movement.purchase_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Быстрые действия</h2>
                </div>
                <div className={styles.quickActions}>
                    <Link href="/products" className={styles.actionButton}>
                        <FiPackage />
                        <span>Добавить товар</span>
                    </Link>
                    <Link href="/suppliers" className={styles.actionButton}>
                        <FiTruckIcon />
                        <span>Новый поставщик</span>
                    </Link>
                    <Link href="/reports" className={styles.actionButton}>
                        <FiBarChart2 />
                        <span>Отчеты</span>
                    </Link>
                    <Link href="/purchases" className={styles.actionButton}>
                        <FiShoppingCart />
                        <span>Закупки</span>
                    </Link>
                    <Link href="/shipments" className={styles.actionButton}>
                        <FiTruckIcon />
                        <span>Отгрузки</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default withLayout(Home);
