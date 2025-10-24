import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Layout } from '../layout/Layout';
import styles from '../styles/Archive.module.css';

interface CompletedOrder {
    id: number;
    клиент_id: number;
    менеджер_id: number | null;
    дата_создания: string;
    дата_выполнения: string | null;
    статус: string;
    общая_сумма: number;
    адрес_доставки: string | null;
    клиент_название: string;
    менеджер_фио: string | null;
    количество_позиций: number;
}

interface CompletedPurchase {
    id: number;
    поставщик_id: number;
    заявка_id: number | null;
    дата_заказа: string;
    дата_поступления: string | null;
    статус: string;
    общая_сумма: number;
    поставщик_название: string;
    количество_позиций: number;
}

interface CompletedShipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер: number;
    клиент_название: string;
    транспорт_название: string;
}

interface EmployeePayment {
    id: number;
    сотрудник_id: number;
    сумма: number;
    дата: string;
    тип: string | null;
    заявка_id: number | null;
    сотрудник_фио: string;
    сотрудник_должность: string;
    заявка_номер: number | null;
}

interface FinancialRecord {
    id: number;
    дата: string;
    тип: string | null;
    описание: string | null;
    сумма: number;
    баланс_после: number | null;
    заявка_id: number | null;
    закупка_id: number | null;
    отгрузка_id: number | null;
    выплата_id: number | null;
    заявка_номер: number | null;
    закупка_номер: number | null;
    отгрузка_номер: number | null;
}

interface ArchiveStatistics {
    завершенные_заявки: number;
    завершенные_закупки: number;
    завершенные_отгрузки: number;
    всего_выплат: number;
    финансовых_записей: number;
    выручка_от_заявок: number | null;
    затраты_на_закупки: number | null;
    общие_выплаты: number | null;
}

interface ArchiveData {
    completedOrders: CompletedOrder[];
    completedPurchases: CompletedPurchase[];
    completedShipments: CompletedShipment[];
    employeePayments: EmployeePayment[];
    financialRecords: FinancialRecord[];
    statistics: ArchiveStatistics;
}

export default function Archive() {
    const [data, setData] = useState<ArchiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders');
    const [search, setSearch] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/archive');
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Error fetching archive data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const formatCurrency = (amount: number | null) => {
        if (!amount) return 'Не указано';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'выполнена': return '#4CAF50';
            case 'доставлено': return '#4CAF50';
            case 'получено': return '#4CAF50';
            case 'отменена': return '#f44336';
            case 'отменено': return '#f44336';
            default: return '#666';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'выполнена': return 'ВЫПОЛНЕНА';
            case 'доставлено': return 'ДОСТАВЛЕНО';
            case 'получено': return 'ПОЛУЧЕНО';
            case 'отменена': return 'ОТМЕНЕНА';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status?.toUpperCase() || 'НЕИЗВЕСТНО';
        }
    };

    const getTransactionTypeColor = (type: string | null) => {
        switch (type) {
            case 'доход': return '#4CAF50';
            case 'расход': return '#f44336';
            case 'зарплата': return '#2196F3';
            case 'комиссия': return '#ff8800';
            default: return '#666';
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className={styles.loading}>Загрузка...</div>
            </Layout>
        );
    }

    if (!data) {
        return (
            <Layout>
                <div className={styles.error}>Ошибка загрузки данных</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>Архив</h1>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>{data.statistics.завершенные_заявки || 0}</span>
                            <span className={styles.statLabel}>Завершенных заявок</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>{data.statistics.завершенные_закупки || 0}</span>
                            <span className={styles.statLabel}>Завершенных закупок</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>{data.statistics.завершенные_отгрузки || 0}</span>
                            <span className={styles.statLabel}>Завершенных отгрузок</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber} style={{ color: '#4CAF50' }}>
                                {formatCurrency(data.statistics.выручка_от_заявок)}
                            </span>
                            <span className={styles.statLabel}>Общая выручка</span>
                        </div>
                    </div>
                </div>

                <div className={styles.controls}>
                    <input
                        type="text"
                        placeholder="Поиск по архиву..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        Заявки ({data.completedOrders.length})
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'purchases' ? styles.active : ''}`}
                        onClick={() => setActiveTab('purchases')}
                    >
                        Закупки ({data.completedPurchases.length})
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'shipments' ? styles.active : ''}`}
                        onClick={() => setActiveTab('shipments')}
                    >
                        Отгрузки ({data.completedShipments.length})
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'payments' ? styles.active : ''}`}
                        onClick={() => setActiveTab('payments')}
                    >
                        Выплаты ({data.employeePayments.length})
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'finances' ? styles.active : ''}`}
                        onClick={() => setActiveTab('finances')}
                    >
                        Финансы ({data.financialRecords.length})
                    </button>
                </div>

                <div className={styles.content}>
                    {activeTab === 'orders' && (
                        <div className={styles.section}>
                            <h2>Завершенные заявки</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>№ Заявки</th>
                                            <th>Контрагент</th>
                                            <th>Менеджер</th>
                                            <th>Позиций</th>
                                            <th>Сумма</th>
                                            <th>Статус</th>
                                            <th>Дата создания</th>
                                            <th>Дата выполнения</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.completedOrders
                                            .filter(order =>
                                                order.клиент_название.toLowerCase().includes(search.toLowerCase()) ||
                                                (order.менеджер_фио && order.менеджер_фио.toLowerCase().includes(search.toLowerCase()))
                                            )
                                            .map((order) => (
                                                <tr
                                                    key={order.id}
                                                    className={styles.clickableRow}
                                                    onClick={() => router.push(`/orders/${order.id}`)}
                                                >
                                                    <td>#{order.id}</td>
                                                    <td>{order.клиент_название}</td>
                                                    <td>{order.менеджер_фио || 'Не назначен'}</td>
                                                    <td>{order.количество_позиций}</td>
                                                    <td>{formatCurrency(order.общая_сумма)}</td>
                                                    <td>
                                                        <span
                                                            className={styles.status}
                                                            style={{ backgroundColor: getStatusColor(order.статус) }}
                                                        >
                                                            {getStatusText(order.статус)}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(order.дата_создания)}</td>
                                                    <td>{order.дата_выполнения ? formatDate(order.дата_выполнения) : '-'}</td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'purchases' && (
                        <div className={styles.section}>
                            <h2>Завершенные закупки</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>№ Закупки</th>
                                            <th>Поставщик</th>
                                            <th>Позиций</th>
                                            <th>Сумма</th>
                                            <th>Статус</th>
                                            <th>Дата заказа</th>
                                            <th>Дата поступления</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.completedPurchases
                                            .filter(purchase =>
                                                purchase.поставщик_название.toLowerCase().includes(search.toLowerCase())
                                            )
                                            .map((purchase) => (
                                                <tr
                                                    key={purchase.id}
                                                    className={styles.clickableRow}
                                                    onClick={() => router.push(`/purchases/${purchase.id}`)}
                                                >
                                                    <td>#{purchase.id}</td>
                                                    <td>{purchase.поставщик_название}</td>
                                                    <td>{purchase.количество_позиций}</td>
                                                    <td>{formatCurrency(purchase.общая_сумма)}</td>
                                                    <td>
                                                        <span
                                                            className={styles.status}
                                                            style={{ backgroundColor: getStatusColor(purchase.статус) }}
                                                        >
                                                            {getStatusText(purchase.статус)}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(purchase.дата_заказа)}</td>
                                                    <td>{purchase.дата_поступления ? formatDate(purchase.дата_поступления) : '-'}</td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'shipments' && (
                        <div className={styles.section}>
                            <h2>Завершенные отгрузки</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>№ Отгрузки</th>
                                            <th>Номер отслеживания</th>
                                            <th>Заявка</th>
                                            <th>Контрагент</th>
                                            <th>Транспорт</th>
                                            <th>Статус</th>
                                            <th>Дата отгрузки</th>
                                            <th>Стоимость</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.completedShipments
                                            .filter(shipment =>
                                                shipment.клиент_название.toLowerCase().includes(search.toLowerCase()) ||
                                                shipment.транспорт_название.toLowerCase().includes(search.toLowerCase())
                                            )
                                            .map((shipment) => (
                                                <tr key={shipment.id} className={styles.clickableRow}>
                                                    <td>#{shipment.id}</td>
                                                    <td>{shipment.номер_отслеживания || 'Не присвоен'}</td>
                                                    <td>
                                                        <Link href={`/orders/${shipment.заявка_номер}`} className={styles.link}>
                                                            #{shipment.заявка_номер}
                                                        </Link>
                                                    </td>
                                                    <td>{shipment.клиент_название}</td>
                                                    <td>{shipment.транспорт_название}</td>
                                                    <td>
                                                        <span
                                                            className={styles.status}
                                                            style={{ backgroundColor: getStatusColor(shipment.статус) }}
                                                        >
                                                            {getStatusText(shipment.статус)}
                                                        </span>
                                                    </td>
                                                    <td>{formatDateTime(shipment.дата_отгрузки)}</td>
                                                    <td>{formatCurrency(shipment.стоимость_доставки)}</td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className={styles.section}>
                            <h2>История выплат сотрудникам</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>№ Выплаты</th>
                                            <th>Сотрудник</th>
                                            <th>Должность</th>
                                            <th>Сумма</th>
                                            <th>Тип</th>
                                            <th>Связанная заявка</th>
                                            <th>Дата</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.employeePayments
                                            .filter(payment =>
                                                payment.сотрудник_фио.toLowerCase().includes(search.toLowerCase()) ||
                                                payment.сотрудник_должность.toLowerCase().includes(search.toLowerCase())
                                            )
                                            .map((payment) => (
                                                <tr key={payment.id}>
                                                    <td>#{payment.id}</td>
                                                    <td>{payment.сотрудник_фио}</td>
                                                    <td>{payment.сотрудник_должность}</td>
                                                    <td>{formatCurrency(payment.сумма)}</td>
                                                    <td>{payment.тип || 'Зарплата'}</td>
                                                    <td>
                                                        {payment.заявка_номер ? (
                                                            <Link href={`/orders/${payment.заявка_номер}`} className={styles.link}>
                                                                #{payment.заявка_номер}
                                                            </Link>
                                                        ) : '-'}
                                                    </td>
                                                    <td>{formatDateTime(payment.дата)}</td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'finances' && (
                        <div className={styles.section}>
                            <h2>Финансовые записи</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>№ Записи</th>
                                            <th>Дата</th>
                                            <th>Тип</th>
                                            <th>Описание</th>
                                            <th>Сумма</th>
                                            <th>Баланс после</th>
                                            <th>Связанный документ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.financialRecords
                                            .filter(record =>
                                                (record.описание && record.описание.toLowerCase().includes(search.toLowerCase())) ||
                                                (record.тип && record.тип.toLowerCase().includes(search.toLowerCase()))
                                            )
                                            .map((record) => (
                                                <tr key={record.id}>
                                                    <td>#{record.id}</td>
                                                    <td>{formatDateTime(record.дата)}</td>
                                                    <td>
                                                        <span
                                                            className={styles.transactionType}
                                                            style={{ color: getTransactionTypeColor(record.тип) }}
                                                        >
                                                            {record.тип?.toUpperCase() || 'ОБЩЕЕ'}
                                                        </span>
                                                    </td>
                                                    <td>{record.описание || '-'}</td>
                                                    <td>
                                                        <span
                                                            className={record.сумма >= 0 ? styles.positiveAmount : styles.negativeAmount}
                                                        >
                                                            {formatCurrency(Math.abs(record.сумма))}
                                                        </span>
                                                    </td>
                                                    <td>{formatCurrency(record.баланс_после)}</td>
                                                    <td>
                                                        {record.заявка_номер && (
                                                            <Link href={`/orders/${record.заявка_номер}`} className={styles.link}>
                                                                Заявка #{record.заявка_номер}
                                                            </Link>
                                                        )}
                                                        {record.закупка_номер && (
                                                            <Link href={`/purchases/${record.закупка_номер}`} className={styles.link}>
                                                                Закупка #{record.закупка_номер}
                                                            </Link>
                                                        )}
                                                        {!record.заявка_номер && !record.закупка_номер && '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}