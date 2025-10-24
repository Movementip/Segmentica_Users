import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Layout } from '../layout/Layout';
import { CreateTransportModal } from '../components/CreateTransportModal';
import styles from '../styles/Transport.module.css';

interface TransportCompany {
    id: number;
    название: string;
    телефон: string | null;
    email: string | null;
    тариф: number | null;
    created_at: string;
    общее_количество_отгрузок: number;
    активные_отгрузки: number;
    завершенные_отгрузки: number;
    средняя_стоимость: number | null;
    общая_выручка: number | null;
}

interface Shipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    транспорт_название: string;
    заявка_номер: number;
    клиент_название: string;
    заявка_статус: string;
}

interface TransportData {
    transport: TransportCompany[];
    recentShipments: Shipment[];
    activeShipments: Shipment[];
}

export default function Transport() {
    const [data, setData] = useState<TransportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<TransportCompany | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/transport');
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Error fetching transport data:', error);
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
        if (!status) return '#666';

        // Normalize the status for comparison
        const normalizedStatus = status.toLowerCase().trim();

        // Direct mapping for the specific order statuses we have in the system
        switch (normalizedStatus) {
            case 'новая':
                return '#2196F3'; // Blue
            case 'в обработке':
                return '#ff9800'; // Orange
            case 'подтверждена':
            case 'подтверждено':
                return '#2196F3'; // Blue
            case 'в работе':
                return '#2196F3'; // Blue
            case 'собрана':
                return '#9c27b0'; // Purple
            case 'отгружена':
                return '#4caf50'; // Green
            case 'выполнена':
            case 'выполнено':
                return '#4CAF50'; // Green
            case 'отменена':
            case 'отменено':
                return '#f44336'; // Red
            default:
                return '#666'; // Gray
        }
    };

    const getStatusText = (status: string) => {
        if (!status) return 'НЕОПРЕДЕЛЕНО';

        // Normalize the status for comparison
        const normalizedStatus = status.toLowerCase().trim();

        // Direct mapping for display text
        switch (normalizedStatus) {
            case 'новая':
                return 'НОВАЯ';
            case 'в обработке':
                return 'В ОБРАБОТКЕ';
            case 'подтверждена':
            case 'подтверждено':
                return 'ПОДТВЕРЖДЕНА';
            case 'в работе':
                return 'В РАБОТЕ';
            case 'собрана':
                return 'СОБРАНА';
            case 'отгружена':
                return 'ОТГРУЖЕНА';
            case 'выполнена':
            case 'выполнено':
                return 'ВЫПОЛНЕНА';
            case 'отменена':
            case 'отменено':
                return 'ОТМЕНЕНА';
            default:
                return status.toUpperCase();
        }
    };

    const filteredTransport = data?.transport?.filter(company => {
        if (!company) return false;

        const matchesSearch = company.название.toLowerCase().includes(search.toLowerCase()) ||
            (company.email && company.email.toLowerCase().includes(search.toLowerCase()));

        switch (filter) {
            case 'active':
                return matchesSearch && (company.активные_отгрузки || 0) > 0;
            case 'high-volume':
                return matchesSearch && (company.общее_количество_отгрузок || 0) >= 10;
            case 'new':
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return matchesSearch && new Date(company.created_at) > monthAgo;
            default:
                return matchesSearch;
        }
    }) || [];

    // Action handlers
    const handleCreateTransport = () => {
        setIsCreateModalOpen(true);
    };

    const handleDeleteTransport = (company: TransportCompany, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCompany(company);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedCompany) return;

        try {
            const response = await fetch(`/api/transport?id=${selectedCompany.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления компании');
            }

            await fetchData();
            setIsDeleteModalOpen(false);
            setSelectedCompany(null);
        } catch (error) {
            console.error('Error deleting transport company:', error);
            alert('Ошибка удаления компании: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleTransportCreated = () => {
        fetchData();
        setIsCreateModalOpen(false);
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
                    <h1>Транспортные компании</h1>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>{data?.transport?.length || 0}</span>
                            <span className={styles.statLabel}>Компаний</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber} style={{ color: '#2196F3' }}>
                                {data?.activeShipments?.length || 0}
                            </span>
                            <span className={styles.statLabel}>Активных отгрузок</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>
                                {data?.transport?.reduce((sum, company) => {
                                    const count = Number(company?.общее_количество_отгрузок) || 0;
                                    return sum + count;
                                }, 0) || 0}
                            </span>
                            <span className={styles.statLabel}>Всего отгрузок</span>
                        </div>
                    </div>
                </div>

                <div className={styles.controls}>
                    <input
                        type="text"
                        placeholder="Поиск по названию или email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className={styles.filterSelect}
                    >
                        <option value="all">Все компании</option>
                        <option value="active">С активными отгрузками</option>
                        <option value="high-volume">Высокая активность</option>
                        <option value="new">Новые компании</option>
                    </select>
                    <button
                        onClick={handleCreateTransport}
                        className={styles.addButton}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#000000',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        + Добавить компанию
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.mainSection}>
                        <h2>Список компаний</h2>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Компания</th>
                                        <th>Контакты</th>
                                        <th>Тариф</th>
                                        <th>Всего отгрузок</th>
                                        <th>Активные</th>
                                        <th>Завершенные</th>
                                        <th>Средняя стоимость</th>
                                        <th>Общая выручка</th>
                                        <th>Дата регистрации</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransport.map((company) => (
                                        <tr
                                            key={company.id}
                                            className={styles.clickableRow}
                                            onClick={() => router.push(`/transport/${company.id}`)}
                                        >
                                            <td>
                                                <div className={styles.companyName}>{company.название}</div>
                                            </td>
                                            <td>
                                                <div className={styles.contacts}>
                                                    {company.телефон && (
                                                        <div className={styles.phone}>{company.телефон}</div>
                                                    )}
                                                    {company.email && (
                                                        <div className={styles.email}>{company.email}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{formatCurrency(company.тариф)}</td>
                                            <td>
                                                <span className={styles.number}>
                                                    {company.общее_количество_отгрузок || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={styles.activeCount}
                                                    style={{ color: company.активные_отгрузки ? '#2196F3' : '#666' }}
                                                >
                                                    {company.активные_отгрузки || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.completedCount}>
                                                    {company.завершенные_отгрузки || 0}
                                                </span>
                                            </td>
                                            <td>{formatCurrency(company.средняя_стоимость)}</td>
                                            <td>
                                                <span className={styles.revenue}>
                                                    {formatCurrency(company.общая_выручка)}
                                                </span>
                                            </td>
                                            <td>{formatDate(company.created_at)}</td>
                                            <td>
                                                <button
                                                    onClick={(e) => handleDeleteTransport(company, e)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        backgroundColor: '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                    title={`Удалить ${company.название}`}
                                                >
                                                    Удалить
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={styles.sidebar}>
                        <div className={styles.sidebarSection}>
                            <h3>Активные отгрузки</h3>
                            <div className={styles.shipmentsList}>
                                {data?.activeShipments && data.activeShipments.length > 0 ? (
                                    data.activeShipments.slice(0, 10).map((shipment) => (
                                        <div key={shipment.id} className={styles.shipmentItem}>
                                            <div className={styles.shipmentHeader}>
                                                <span className={styles.trackingNumber}>
                                                    #{shipment.номер_отслеживания || shipment.id}
                                                </span>
                                                <span
                                                    className={styles.status}
                                                    style={{ backgroundColor: getStatusColor(shipment.заявка_статус) }}
                                                    title={`Статус заявки: "${shipment.заявка_статус}" (Оригинальный статус: "${shipment.статус}")`}
                                                >
                                                    {getStatusText(shipment.заявка_статус)}
                                                </span>
                                            </div>
                                            <div className={styles.shipmentDetails}>
                                                <div className={styles.shipmentCompany}>
                                                    {shipment.транспорт_название}
                                                </div>
                                                <div className={styles.shipmentClient}>
                                                    {shipment.клиент_название}
                                                </div>
                                                <div className={styles.shipmentDate}>
                                                    {formatDateTime(shipment.дата_отгрузки)}
                                                </div>
                                                <div className={styles.shipmentOrder}>
                                                    <Link href={`/orders/${shipment.заявка_номер}`}>
                                                        Заявка #{shipment.заявка_номер}
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className={styles.noData}>Нет активных отгрузок</p>
                                )}
                            </div>
                        </div>

                        <div className={styles.sidebarSection}>
                            <h3>Последние отгрузки</h3>
                            <div className={styles.shipmentsList}>
                                {data?.recentShipments?.slice(0, 10).map((shipment) => (
                                    <div key={shipment.id} className={styles.shipmentItem}>
                                        <div className={styles.shipmentHeader}>
                                            <span className={styles.trackingNumber}>
                                                #{shipment.номер_отслеживания || shipment.id}
                                            </span>
                                            <span
                                                className={styles.status}
                                                style={{ backgroundColor: getStatusColor(shipment.заявка_статус) }}
                                                title={`Статус заявки: "${shipment.заявка_статус}" (Оригинальный статус: "${shipment.статус}")`}
                                            >
                                                {getStatusText(shipment.заявка_статус)}
                                            </span>
                                        </div>
                                        <div className={styles.shipmentDetails}>
                                            <div className={styles.shipmentCompany}>
                                                {shipment.транспорт_название}
                                            </div>
                                            <div className={styles.shipmentClient}>
                                                {shipment.клиент_название}
                                            </div>
                                            <div className={styles.shipmentDate}>
                                                {formatDateTime(shipment.дата_отгрузки)}
                                            </div>
                                            <div className={styles.shipmentOrder}>
                                                <Link href={`/orders/${shipment.заявка_номер}`}>
                                                    Заявка #{shipment.заявка_номер}
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )) || []}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Модальные окна */}
            <CreateTransportModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onTransportCreated={handleTransportCreated}
            />

            {/* Модальное окно подтверждения удаления */}
            {isDeleteModalOpen && selectedCompany && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setIsDeleteModalOpen(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            padding: '24px',
                            borderRadius: '8px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Подтверждение удаления</h3>
                        <p style={{ margin: '0 0 16px 0' }}>Вы уверены, что хотите удалить транспортную компанию?</p>
                        <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: '12px',
                            borderRadius: '4px',
                            margin: '0 0 16px 0'
                        }}>
                            <strong>{selectedCompany.название}</strong>
                            {selectedCompany.телефон && <div>Телефон: {selectedCompany.телефон}</div>}
                            {selectedCompany.email && <div>Email: {selectedCompany.email}</div>}
                            <div>Отгрузок: {selectedCompany.общее_количество_отгрузок || 0}</div>
                        </div>
                        <p style={{
                            margin: '0 0 20px 0',
                            color: '#f44336',
                            fontSize: '14px'
                        }}>
                            <strong>Внимание:</strong> Это действие нельзя отменить. Компанию можно удалить только если у неё нет отгрузок.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#e0e0e0',
                                    color: '#333',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}