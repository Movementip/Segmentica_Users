import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import styles from '../layout/Layout.module.css';

interface Shipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string;
    дата_отгрузки: string;
    стоимость_доставки: number;
    заявка_номер?: string;
    транспорт_название?: string;
}

interface Order {
    id: number;
    номер_заявки: string;
}

interface Transport {
    id: number;
    название: string;
}

function ShipmentsPage(): JSX.Element {
    const router = useRouter();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transports, setTransports] = useState<Transport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        заявка_id: 0,
        транспорт_id: 0,
        статус: 'в пути',
        номер_отслеживания: '',
        стоимость_доставки: 0
    });
    const [editingId, setEditingId] = useState<number | null>(null);

    useEffect(() => {
        fetchShipments();
        fetchOrders();
        fetchTransports();
    }, []);

    const fetchShipments = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/shipments');

            if (!response.ok) {
                throw new Error('Ошибка загрузки отгрузок');
            }

            const data = await response.json();
            setShipments(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await fetch('/api/orders');

            if (!response.ok) {
                throw new Error('Ошибка загрузки заявок');
            }

            const data = await response.json();
            setOrders(data);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    };

    const fetchTransports = async () => {
        try {
            const response = await fetch('/api/transport');

            if (!response.ok) {
                throw new Error('Ошибка загрузки транспортных компаний');
            }

            const data = await response.json();
            // The transport API returns an object with a 'transport' property
            setTransports(data.transport || []);
        } catch (err) {
            console.error('Error fetching transports:', err);
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
            case 'в пути': return '#2196F3';
            case 'доставлено': return '#4CAF50';
            case 'отменено': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'в пути': return 'В ПУТИ';
            case 'доставлено': return 'ДОСТАВЛЕНО';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'заявка_id' || name === 'транспорт_id' || name === 'стоимость_доставки' ?
                parseFloat(value) || 0 : value
        }));
    };

    const handleAddShipment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.заявка_id <= 0 || formData.транспорт_id <= 0) {
            alert('Пожалуйста, выберите заявку и транспортную компанию');
            return;
        }

        try {
            const response = await fetch('/api/shipments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка добавления отгрузки');
            }

            // Refresh the list
            fetchShipments();
            setShowAddModal(false);
            // Reset form
            setFormData({
                заявка_id: 0,
                транспорт_id: 0,
                статус: 'в пути',
                номер_отслеживания: '',
                стоимость_доставки: 0
            });

            alert('Отгрузка успешно добавлена');
        } catch (error) {
            alert(`Ошибка при добавлении отгрузки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        try {
            const response = await fetch('/api/shipments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, статус: status }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления статуса');
            }

            // Refresh the list
            fetchShipments();

            alert('Статус успешно обновлен');
        } catch (error) {
            alert(`Ошибка при обновлении статуса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handleUpdateTracking = async (id: number, trackingNumber: string) => {
        try {
            const response = await fetch('/api/shipments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, номер_отслеживания: trackingNumber }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления номера отслеживания');
            }

            // Refresh the list
            fetchShipments();

            alert('Номер отслеживания успешно обновлен');
        } catch (error) {
            alert(`Ошибка при обновлении номера отслеживания: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(`Вы уверены, что хотите удалить эту отгрузку? Это действие нельзя отменить.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/shipments?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления отгрузки');
            }

            // Refresh the list
            fetchShipments();

            alert('Отгрузка успешно удалена');
        } catch (error) {
            alert(`Ошибка при удалении отгрузки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка отгрузок...</p>
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
                        onClick={fetchShipments}
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
        <>


            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2>Список отгрузок ({shipments.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Здесь отображаются все отгрузки товаров клиентам
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setShowAddModal(true)}
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
                            + Добавить отгрузку
                        </button>
                        <button
                            onClick={fetchShipments}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#000000',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Обновить
                        </button>
                    </div>
                </div>

                {shipments.length === 0 ? (
                    <p>Отгрузки не найдены.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Заявка</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Транспорт</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата отгрузки</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Номер отслеживания</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Стоимость</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Статус</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shipments.map((shipment) => (
                                    <tr key={shipment.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{shipment.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{shipment.заявка_номер || `Заявка #${shipment.заявка_id}`}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{shipment.транспорт_название || `ТК #${shipment.транспорт_id}`}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {formatDateTime(shipment.дата_отгрузки)}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {shipment.номер_отслеживания || 'Не указан'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            {shipment.стоимость_доставки ? formatCurrency(shipment.стоимость_доставки) : 'Не указана'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: getStatusColor(shipment.статус),
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: '600'
                                            }}>
                                                {getStatusText(shipment.статус)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <select
                                                    value={shipment.статус}
                                                    onChange={(e) => handleUpdateStatus(shipment.id, e.target.value)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    <option value="в пути">В пути</option>
                                                    <option value="доставлено">Доставлено</option>
                                                    <option value="отменено">Отменено</option>
                                                </select>
                                                <button
                                                    onClick={() => handleDelete(shipment.id)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        backgroundColor: '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                    title={`Удалить отгрузку #${shipment.id}`}
                                                >
                                                    Удалить
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Shipment Modal */}
            {showAddModal && (
                <div style={{
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
                }} onClick={() => setShowAddModal(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '8px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 24px 0' }}>{editingId ? 'Редактировать отгрузку' : 'Добавить отгрузку'}</h2>

                        <form onSubmit={handleAddShipment}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Заявка:
                                </label>
                                <select
                                    name="заявка_id"
                                    value={formData.заявка_id}
                                    onChange={handleInputChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value={0}>Выберите заявку</option>
                                    {orders.map(order => (
                                        <option key={order.id} value={order.id}>
                                            #{order.номер_заявки} - Заявка #{order.id}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Транспортная компания:
                                </label>
                                <select
                                    name="транспорт_id"
                                    value={formData.транспорт_id}
                                    onChange={handleInputChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value={0}>Выберите транспортную компанию</option>
                                    {transports.map(transport => (
                                        <option key={transport.id} value={transport.id}>
                                            {transport.название}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Статус:
                                </label>
                                <select
                                    name="статус"
                                    value={formData.статус}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value="в пути">В пути</option>
                                    <option value="доставлено">Доставлено</option>
                                    <option value="отменено">Отменено</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Номер отслеживания:
                                </label>
                                <input
                                    type="text"
                                    name="номер_отслеживания"
                                    value={formData.номер_отслеживания}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Стоимость доставки:
                                </label>
                                <input
                                    type="number"
                                    name="стоимость_доставки"
                                    min="0"
                                    step="0.01"
                                    value={formData.стоимость_доставки}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{
                                        padding: '10px 20px',
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
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#4caf50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {editingId ? 'Сохранить' : 'Добавить'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default withLayout(ShipmentsPage);