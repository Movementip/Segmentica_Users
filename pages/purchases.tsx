import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import styles from '../layout/Layout.module.css';
import { CreatePurchaseModal } from '../components/CreatePurchaseModal';

interface Purchase {
    id: number;
    поставщик_id: number;
    поставщик_название?: string;
    поставщик_телефон?: string;
    поставщик_email?: string;
    заявка_id?: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
}

interface Supplier {
    id: number;
    название: string;
    телефон: string;
    email: string;
}

function PurchasesPage(): JSX.Element {
    const router = useRouter();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSupplierSelect, setShowSupplierSelect] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<{ id: number, название: string } | null>(null);

    useEffect(() => {
        fetchPurchases();
        fetchSuppliers();
    }, []);

    const fetchPurchases = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/purchases');

            if (!response.ok) {
                throw new Error('Ошибка загрузки закупок');
            }

            const data = await response.json();
            setPurchases(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/suppliers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщиков');
            }

            const data = await response.json();
            setSuppliers(data);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
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
            case 'в обработке': return '#ff9800';
            case 'получено': return '#4CAF50';
            case 'отменено': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'новая': return 'НОВАЯ';
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'получено': return 'ПОЛУЧЕНО';
            case 'отменено': return 'ОТМЕНЕНО';
            default: return status.toUpperCase();
        }
    };

    const handleCreatePurchase = () => {
        // Show supplier selection dialog
        if (suppliers.length > 0) {
            setShowSupplierSelect(true);
        } else {
            alert('Сначала добавьте поставщиков в систему');
        }
    };

    const handleSupplierSelect = (supplier: Supplier) => {
        setSelectedSupplier({
            id: supplier.id,
            название: supplier.название
        });
        setShowSupplierSelect(false);
        setShowCreateModal(true);
    };

    const handleDeletePurchase = async (purchase: Purchase, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm(`Вы уверены, что хотите удалить закупку #${purchase.id}? Это действие нельзя отменить.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/purchases?id=${purchase.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления закупки');
            }

            // Refresh the list
            fetchPurchases();

            alert(`Закупка #${purchase.id} успешно удалена`);
        } catch (error) {
            alert(`Ошибка при удалении закупки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handlePurchaseClick = (purchaseId: number) => {
        router.push(`/purchases/${purchaseId}`);
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка закупок...</p>
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
                        onClick={fetchPurchases}
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
                        <h2>Список закупок ({purchases.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Нажмите на любую закупку для просмотра подробностей
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleCreatePurchase}
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
                            + Создать закупку
                        </button>
                        <button
                            onClick={fetchPurchases}
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

                {purchases.length === 0 ? (
                    <p>Закупки не найдены. Создайте закупки в системе.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Поставщик</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Заявка</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата заказа</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата поступления</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Статус</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Сумма</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.map((purchase) => (
                                    <tr key={purchase.id}
                                        style={{
                                            borderBottom: '1px solid #e0e0e0',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onClick={() => handlePurchaseClick(purchase.id)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{purchase.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{purchase.поставщик_название || `Поставщик #${purchase.поставщик_id}`}</div>
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                {purchase.поставщик_телефон}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {purchase.заявка_id ? `#${purchase.заявка_id}` : 'Не указана'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {formatDateTime(purchase.дата_заказа)}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {purchase.дата_поступления ? formatDate(purchase.дата_поступления) : 'Не указана'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: getStatusColor(purchase.статус),
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: '600'
                                            }}>
                                                {getStatusText(purchase.статус)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                                            {formatCurrency(purchase.общая_сумма)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => handleDeletePurchase(purchase, e)}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title={`Удалить закупку #${purchase.id}`}
                                            >
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Supplier Selection Modal */}
            {showSupplierSelect && (
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
                }} onClick={() => setShowSupplierSelect(false)}>
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
                        <h2 style={{ margin: '0 0 24px 0' }}>Выберите поставщика</h2>

                        <div style={{ display: 'grid', gap: '12px' }}>
                            {suppliers.map(supplier => (
                                <div
                                    key={supplier.id}
                                    onClick={() => handleSupplierSelect(supplier)}
                                    style={{
                                        padding: '16px',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        backgroundColor: '#f9f9f9'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                >
                                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{supplier.название}</div>
                                    <div style={{ color: '#666', marginTop: '4px' }}>
                                        {supplier.телефон} | {supplier.email}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button
                                onClick={() => setShowSupplierSelect(false)}
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
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && selectedSupplier && (
                <CreatePurchaseModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onPurchaseCreated={fetchPurchases}
                    поставщик_id={selectedSupplier.id}
                    поставщик_название={selectedSupplier.название}
                />
            )}
        </>
    );
}

export default withLayout(PurchasesPage);