import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import styles from '../../styles/ClientDetail.module.css';

interface Client {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    тип?: string;
    created_at: string;
}

interface Order {
    id: number;
    номер: number;
    дата_создания: string;
    статус: string;
    общая_сумма: number;
}

function ClientDetailPage(): JSX.Element {
    const router = useRouter();
    const { id } = router.query;
    const [client, setClient] = useState<Client | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            fetchClientData();
        }
    }, [id]);

    const fetchClientData = async () => {
        try {
            setLoading(true);

            // Fetch client details
            const clientResponse = await fetch(`/api/clients?id=${id}`);
            if (!clientResponse.ok) {
                throw new Error('Ошибка загрузки данных клиента');
            }

            const clientData = await clientResponse.json();
            setClient(clientData);

            // Fetch client orders
            const ordersResponse = await fetch(`/api/orders?client_id=${id}`);
            if (ordersResponse.ok) {
                const ordersData = await ordersResponse.json();
                setOrders(ordersData);
            }
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
            day: '2-digit'
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU', {
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
        switch (status) {
            case 'новая': return '#2196F3';
            case 'подтверждена': return '#ff9800';
            case 'собрана': return '#9c27b0';
            case 'отгружена': return '#ff8800';
            case 'выполнена': return '#4CAF50';
            case 'отменена': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'новая': return 'НОВАЯ';
            case 'подтверждена': return 'ПОДТВЕРЖДЕНА';
            case 'собрана': return 'СОБРАНА';
            case 'отгружена': return 'ОТГРУЖЕНА';
            case 'выполнена': return 'ВЫПОЛНЕНА';
            case 'отменена': return 'ОТМЕНЕНА';
            default: return status.toUpperCase();
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <button onClick={() => router.back()} className={styles.backButton}>
                        ← Назад к списку
                    </button>
                </div>
                <div className={styles.card}>
                    <p>Загрузка клиента...</p>
                </div>
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <button onClick={() => router.back()} className={styles.backButton}>
                        ← Назад к списку
                    </button>
                    <Htag tag="h1">Ошибка</Htag>
                </div>
                <div className={styles.card}>
                    <p style={{ color: '#f44336' }}>
                        {error || 'Клиент не найден'}
                    </p>
                    <button
                        onClick={() => router.back()}
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
                        Вернуться к списку клиентов
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={() => router.back()} className={styles.backButton}>
                    ← Назад к списку
                </button>
                <Htag tag="h1">{client.название}</Htag>
            </div>

            <div className={styles.content}>
                <div className={styles.section}>
                    <h2>Информация о клиенте</h2>
                    <div className={styles.card}>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>ID:</span>
                                <span className={styles.infoValue}>#{client.id}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Название:</span>
                                <span className={styles.infoValue}>{client.название}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Тип:</span>
                                <span className={styles.infoValue}>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        backgroundColor: client.тип === 'оптовый' ? '#2196f3' :
                                            client.тип === 'корпоративный' ? '#9c27b0' : '#4caf50',
                                        color: 'white'
                                    }}>
                                        {client.тип || 'розничный'}
                                    </span>
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Телефон:</span>
                                <span className={styles.infoValue}>
                                    {client.телефон || 'Не указан'}
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Email:</span>
                                <span className={styles.infoValue}>
                                    {client.email || 'Не указан'}
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Адрес:</span>
                                <span className={styles.infoValue}>
                                    {client.адрес || 'Не указан'}
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Дата регистрации:</span>
                                <span className={styles.infoValue}>
                                    {client.created_at ? formatDate(client.created_at) : 'Не указана'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2>Заявки клиента ({orders.length})</h2>
                    {orders.length > 0 ? (
                        <div className={styles.card}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Номер</th>
                                            <th>Дата создания</th>
                                            <th>Статус</th>
                                            <th>Сумма</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((order) => (
                                            <tr
                                                key={order.id}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => router.push(`/orders/${order.id}`)}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td>#{order.id}</td>
                                                <td>{formatDateTime(order.дата_создания)}</td>
                                                <td>
                                                    <span
                                                        className={styles.status}
                                                        style={{ backgroundColor: getStatusColor(order.статус) }}
                                                    >
                                                        {getStatusText(order.статус)}
                                                    </span>
                                                </td>
                                                <td>{formatCurrency(order.общая_сумма)}</td>
                                                <td>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/orders/${order.id}`);
                                                        }}
                                                        className={styles.actionButton}
                                                    >
                                                        Подробнее
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.card}>
                            <p>У клиента пока нет заявок</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default withLayout(ClientDetailPage);