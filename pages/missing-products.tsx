import React, { useState, useEffect } from 'react';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import styles from '../layout/Layout.module.css';

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

interface Product {
    id: number;
    название: string;
    артикул: string;
}

interface Order {
    id: number;
}

function MissingProductsPage(): JSX.Element {
    const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        заявка_id: 0,
        товар_id: 0,
        необходимое_количество: 1,
        недостающее_количество: 1
    });

    useEffect(() => {
        fetchMissingProducts();
        fetchProducts();
        fetchOrders();
    }, []);

    const fetchMissingProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/missing-products');

            if (!response.ok) {
                throw new Error('Ошибка загрузки недостающих товаров');
            }

            const data = await response.json();
            setMissingProducts(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await fetch('/api/products');

            if (!response.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const data = await response.json();
            setProducts(data);
        } catch (err) {
            console.error('Error fetching products:', err);
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'в обработке': return '#2196F3';
            case 'заказано': return '#ff9800';
            case 'получено': return '#4CAF50';
            default: return '#9e9e9e';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'заказано': return 'ЗАКАЗАНО';
            case 'получено': return 'ПОЛУЧЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name.includes('id') || name.includes('количество') ? parseInt(value) : value
        }));
    };

    const handleAddMissingProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.заявка_id <= 0 || formData.товар_id <= 0 ||
            formData.необходимое_количество <= 0 || formData.недостающее_количество <= 0) {
            alert('Пожалуйста, заполните все поля корректно');
            return;
        }

        try {
            const response = await fetch('/api/missing-products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка добавления недостающего товара');
            }

            // Refresh the list
            fetchMissingProducts();
            setShowAddModal(false);
            // Reset form
            setFormData({
                заявка_id: 0,
                товар_id: 0,
                необходимое_количество: 1,
                недостающее_количество: 1
            });

            alert('Недостающий товар успешно добавлен');
        } catch (error) {
            alert(`Ошибка при добавлении недостающего товара: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        try {
            const response = await fetch('/api/missing-products', {
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
            fetchMissingProducts();

            alert('Статус успешно обновлен');
        } catch (error) {
            alert(`Ошибка при обновлении статуса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(`Вы уверены, что хотите удалить этот недостающий товар? Это действие нельзя отменить.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/missing-products?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления недостающего товара');
            }

            // Refresh the list
            fetchMissingProducts();

            alert('Недостающий товар успешно удален');
        } catch (error) {
            alert(`Ошибка при удалении недостающего товара: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка недостающих товаров...</p>
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
                        onClick={fetchMissingProducts}
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
                        <h2>Список недостающих товаров ({missingProducts.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Здесь отображаются товары, которых не хватает на складе для выполнения заявок
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
                            + Добавить недостающий товар
                        </button>
                        <button
                            onClick={fetchMissingProducts}
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

                {missingProducts.length === 0 ? (
                    <p>Недостающие товары не найдены.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Заявка</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Товар</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Необходимо</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Недостает</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Статус</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {missingProducts.map((product) => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{product.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>Заявка #{product.заявка_id}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{product.товар_название || `Товар #${product.товар_id}`}</div>
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                {product.товар_артикул}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            {product.необходимое_количество}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            {product.недостающее_количество}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: getStatusColor(product.статус),
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: '600'
                                            }}>
                                                {getStatusText(product.статус)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <select
                                                    value={product.статус}
                                                    onChange={(e) => handleUpdateStatus(product.id, e.target.value)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    <option value="в обработке">В обработке</option>
                                                    <option value="заказано">Заказано</option>
                                                    <option value="получено">Получено</option>
                                                </select>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        backgroundColor: '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                    title={`Удалить недостающий товар #${product.id}`}
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

            {/* Add Missing Product Modal */}
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
                        <h2 style={{ margin: '0 0 24px 0' }}>Добавить недостающий товар</h2>

                        <form onSubmit={handleAddMissingProduct}>
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
                                            Заявка #{order.id}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Товар:
                                </label>
                                <select
                                    name="товар_id"
                                    value={formData.товар_id}
                                    onChange={handleInputChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value={0}>Выберите товар</option>
                                    {products.map(product => (
                                        <option key={product.id} value={product.id}>
                                            {product.артикул} - {product.название}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                                    Необходимое количество:
                                </label>
                                <input
                                    type="number"
                                    name="необходимое_количество"
                                    min="1"
                                    value={formData.необходимое_количество}
                                    onChange={handleInputChange}
                                    required
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
                                    Недостающее количество:
                                </label>
                                <input
                                    type="number"
                                    name="недостающее_количество"
                                    min="1"
                                    value={formData.недостающее_количество}
                                    onChange={handleInputChange}
                                    required
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
                                    Добавить
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default withLayout(MissingProductsPage);