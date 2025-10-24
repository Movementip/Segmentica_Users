import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import EditOrderModal from '../../components/EditOrderModal';
import { exportToExcel, exportToWord } from '../../utils/exportUtils';
import styles from '../../styles/OrderDetail.module.css';

interface OrderPosition {
    id: number;
    товар_id: number;
    количество: number;
    цена: number;
    сумма: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

interface MissingProduct {
    id: number;
    заявка_id: number;
    товар_id: number;
    необходимое_количество: number;
    недостающее_количество: number;
    статус: string;
    товар_название?: string;
    товар_артикул?: string;
}

interface OrderDetail {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    адрес_доставки?: string;
    клиент_название?: string;
    клиент_телефон?: string;
    клиент_email?: string;
    клиент_адрес?: string;
    клиент_тип?: string;
    менеджер_фио?: string;
    менеджер_телефон?: string;
    позиции: OrderPosition[];
    недостающие_товары?: MissingProduct[];
}

function OrderDetailPage(): JSX.Element {
    const router = useRouter();
    const { id } = router.query;
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);

    useEffect(() => {
        if (id) {
            fetchOrderDetail();
        }
    }, [id]);

    const fetchOrderDetail = async () => {
        try {
            setLoading(true);

            // Fetch order details
            const orderResponse = await fetch(`/api/orders/${id}`);

            if (!orderResponse.ok) {
                throw new Error('Ошибка загрузки заявки');
            }

            const orderData = await orderResponse.json();

            // Fetch missing products for this order
            const missingResponse = await fetch(`/api/missing-products?order_id=${id}`);

            if (missingResponse.ok) {
                const missingData = await missingResponse.json();
                orderData.недостающие_товары = missingData;
            }

            setOrder(orderData);
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
            case 'собрана': return '#9c27b0';
            case 'отгружена': return '#4caf50';
            case 'выполнена': return '#4caf50';
            case 'отменена': return '#f44336';
            default: return '#666';
        }
    };

    const getMissingStatusColor = (status: string) => {
        switch (status) {
            case 'в обработке': return '#2196f3';
            case 'заказано': return '#ff9800';
            case 'получено': return '#4caf50';
            default: return '#666';
        }
    };

    const getMissingStatusText = (status: string) => {
        switch (status) {
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'заказано': return 'ЗАКАЗАНО';
            case 'получено': return 'ПОЛУЧЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;

        try {
            setOperationLoading(true);
            setError(null); // Clear any previous errors

            console.log('Changing status to:', newStatus); // Debug log

            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: order.id,
                    клиент_id: order.клиент_id,
                    менеджер_id: order.менеджер_id,
                    адрес_доставки: order.адрес_доставки,
                    статус: newStatus
                }),
            });

            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData); // Debug log
                throw new Error(errorData.error || 'Ошибка изменения статуса');
            }

            const result = await response.json();
            console.log('Status changed successfully:', result); // Debug log

            await fetchOrderDetail(); // Refresh order data
        } catch (error) {
            console.error('Error changing status:', error);
            setError('Ошибка изменения статуса заявки: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setOperationLoading(false);
        }
    };

    const handleEditOrder = async (orderData: any) => {
        try {
            setOperationLoading(true);
            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) {
                throw new Error('Ошибка обновления заявки');
            }

            await fetchOrderDetail(); // Refresh order data
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        } finally {
            setOperationLoading(false);
        }
    };

    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Close the export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleExportExcel = () => {
        if (order) {
            exportToExcel(order);
            setShowExportMenu(false);
        }
    };

    const handleExportWord = () => {
        if (order) {
            exportToWord(order);
            setShowExportMenu(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <Htag tag="h1">Загрузка заявки...</Htag>
                <div className={styles.card}>
                    <p>Пожалуйста, подождите...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className={styles.container}>
                <Htag tag="h1">Ошибка</Htag>
                <div className={styles.card}>
                    <p style={{ color: '#f44336' }}>{error || 'Заявка не найдена'}</p>
                    <div className={styles.buttonGroup} style={{ marginTop: '16px' }}>
                        <Link
                            href="/orders"
                            className={`${styles.button} ${styles.buttonPrimary}`}
                        >
                            Назад к списку заявок
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Htag tag="h1">Заявка #{order.id}</Htag>
                <div className={styles.buttonGroup}>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className={`${styles.button} ${styles.buttonSecondary} noPrint`}
                    >
                        Редактировать
                    </button>
                    <div className={styles.exportContainer} ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className={`${styles.button} ${styles.buttonPrimary} noPrint`}
                        >
                            Экспорт
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '8px' }}>
                                <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        {showExportMenu && (
                            <div className={styles.exportMenu}>

                                <button
                                    onClick={handleExportExcel}
                                    className={styles.exportButton}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M14 2V8H20" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M8 13H16" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M8 17H12" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M8 9H8.01" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Сохранить в Excel
                                </button>
                                <button
                                    onClick={handleExportWord}
                                    className={styles.exportButton}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M14 2V8H20" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M16 13H8" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M16 17H8" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M10 9H8" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Сохранить в Word
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.sectionTitle}>Детали заявки</h2>
                        <p className={styles.infoLabel}>
                            Заявка от {formatDate(order.дата_создания)}
                        </p>
                    </div>
                </div>

                <div className={styles.infoGrid}>
                    <div>
                        <h3 className={styles.sectionTitle}>Информация о клиенте</h3>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Клиент</p>
                            <p className={styles.infoValue}>{order.клиент_название || 'Не указан'}</p>
                        </div>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Телефон</p>
                            <p className={styles.infoValue}>{order.клиент_телефон || 'Не указан'}</p>
                        </div>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Email</p>
                            <p className={styles.infoValue}>{order.клиент_email || 'Не указан'}</p>
                        </div>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Адрес</p>
                            <p className={styles.infoValue}>{order.клиент_адрес || 'Не указан'}</p>
                        </div>
                    </div>

                    <div>
                        <h3 className={styles.sectionTitle}>Информация о заявке</h3>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Статус</p>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className={`${styles.statusBadge} ${order.статус.toLowerCase() === 'новая' ? styles.statusNew :
                                        order.статус.toLowerCase() === 'в обработке' ? styles.statusInProgress :
                                            order.статус.toLowerCase() === 'отгружена' ? styles.statusShipped :
                                                order.статус.toLowerCase() === 'выполнена' ? styles.statusCompleted :
                                                    order.статус.toLowerCase() === 'отменена' ? styles.statusCancelled : ''
                                    }`}>
                                    {order.статус.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Менеджер</p>
                            <p className={styles.infoValue}>{order.менеджер_фио || 'Не назначен'}</p>
                        </div>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Адрес доставки</p>
                            <p className={styles.infoValue}>{order.адрес_доставки || 'Не указан'}</p>
                        </div>
                        <div className={styles.infoGroup}>
                            <p className={styles.infoLabel}>Дата создания</p>
                            <p className={styles.infoValue}>{formatDate(order.дата_создания)}</p>
                        </div>
                        {order.дата_выполнения && (
                            <div className={styles.infoGroup}>
                                <p className={styles.infoLabel}>Дата выполнения</p>
                                <p className={styles.infoValue}>{formatDate(order.дата_выполнения)}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className={styles.sectionTitle}>Позиции заявки</h3>
                        <p className={styles.infoValue} style={{ fontSize: '18px', fontWeight: '600' }}>
                            Итого: {formatCurrency(order.общая_сумма)}
                        </p>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Товар</th>
                                    <th style={{ textAlign: 'right' }}>Количество</th>
                                    <th style={{ textAlign: 'right' }}>Цена</th>
                                    <th style={{ textAlign: 'right' }}>Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.позиции.map((position) => (
                                    <tr key={position.id}>
                                        <td>
                                            <div className={styles.productName}>{position.товар_название}</div>
                                            <div className={styles.productMeta}>
                                                {position.товар_артикул} • {position.товар_категория || 'Без категории'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {position.количество} {position.товар_единица_измерения}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatCurrency(position.цена)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                            {formatCurrency(position.сумма)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className={styles.totalRow}>
                                    <td colSpan={3} style={{ textAlign: 'right' }}>Итого:</td>
                                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                        {formatCurrency(order.общая_сумма)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Missing Products Section */}
                {order.недостающие_товары && order.недостающие_товары.length > 0 && (
                    <div className={styles.missingProducts}>
                        <h3 className={styles.sectionTitle} style={{ color: '#dc3545' }}>Недостающие товары</h3>

                        <div className={styles.tableContainer}>
                            <table className={`${styles.table} ${styles.missingTable}`}>
                                <thead>
                                    <tr>
                                        <th>Товар</th>
                                        <th style={{ textAlign: 'right' }}>Необходимо</th>
                                        <th style={{ textAlign: 'right' }}>Недостает</th>
                                        <th style={{ textAlign: 'center' }}>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.недостающие_товары.map((missing) => (
                                        <tr key={missing.id}>
                                            <td>
                                                <div className={styles.productName}>
                                                    {missing.товар_название || `Товар #${missing.товар_id}`}
                                                </div>
                                                {missing.товар_артикул && (
                                                    <div className={styles.productMeta}>
                                                        {missing.товар_артикул}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {missing.необходимое_количество}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {missing.недостающее_количество}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`${styles.statusBadge} ${missing.статус === 'получено' ? styles.missingStatusReceived :
                                                        missing.статус === 'в обработке' ? styles.missingStatusInProgress :
                                                            styles.missingStatus
                                                    }`}>
                                                    {getMissingStatusText(missing.статус)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className={styles.actions}>
                            <Link
                                href="/missing-products"
                                className={`${styles.button} ${styles.buttonDanger}`}
                            >
                                Перейти к управлению недостающими товарами
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            <EditOrderModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                order={order}
                onSubmit={handleEditOrder}
            />
        </div>
    );
}

export default withLayout(OrderDetailPage);