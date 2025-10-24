import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import { CreateSupplierModal } from '../components/CreateSupplierModal';
import styles from '../layout/Layout.module.css';

interface Supplier {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    created_at: string;
    количество_товаров?: number;
    общая_сумма_закупок?: number;
}

function SuppliersPage(): JSX.Element {
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/suppliers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщиков');
            }

            const data = await response.json();
            setSuppliers(data);
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const handleCreateSupplier = () => {
        setIsCreateModalOpen(true);
    };

    const handleDeleteSupplier = (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedSupplier(supplier);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedSupplier) return;

        try {
            const response = await fetch(`/api/suppliers?id=${selectedSupplier.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления поставщика');
            }

            await fetchSuppliers();
            setIsDeleteModalOpen(false);
            setSelectedSupplier(null);
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('Ошибка удаления поставщика: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleSupplierCreated = () => {
        fetchSuppliers();
        setIsCreateModalOpen(false);
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка поставщиков...</p>
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
                        onClick={fetchSuppliers}
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
                        <h2>Список поставщиков ({suppliers.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Нажмите на любого поставщика для просмотра подробностей
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleCreateSupplier}
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
                            + Добавить поставщика
                        </button>
                        <button
                            onClick={fetchSuppliers}
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

                {suppliers.length === 0 ? (
                    <p>Поставщики не найдены. Добавьте поставщиков в базу данных.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Название</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Контакты</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Товаров</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Сумма закупок</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата регистрации</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suppliers.map((supplier) => (
                                    <tr key={supplier.id}
                                        style={{
                                            borderBottom: '1px solid #e0e0e0',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onClick={() => router.push(`/suppliers/${supplier.id}`)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{supplier.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{supplier.название}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontSize: '14px' }}>
                                                {supplier.телефон && <div>{supplier.телефон}</div>}
                                                {supplier.email && <div style={{ color: '#666' }}>{supplier.email}</div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                                            {supplier.количество_товаров || 0}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                                            {formatCurrency(supplier.общая_сумма_закупок || 0)}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {formatDate(supplier.created_at)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => handleDeleteSupplier(supplier, e)}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title={`Удалить ${supplier.название}`}
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

            <div className={styles.card}>
                <h2>Статистика поставщиков</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3' }}>
                            {suppliers.reduce((sum, s) => sum + (s.количество_товаров || 0), 0)}
                        </div>
                        <div>Всего товаров</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
                            {formatCurrency(suppliers.reduce((sum, s) => sum + (s.общая_сумма_закупок || 0), 0))}
                        </div>
                        <div>Общая сумма</div>
                    </div>
                </div>
            </div>

            <CreateSupplierModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSupplierCreated={handleSupplierCreated}
            />

            {/* Generic Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedSupplier && (
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
                        <p style={{ margin: '0 0 16px 0' }}>Вы уверены, что хотите удалить поставщика?</p>
                        <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: '12px',
                            borderRadius: '4px',
                            margin: '0 0 16px 0'
                        }}>
                            <strong>{selectedSupplier.название}</strong>
                            {selectedSupplier.телефон && <div>Телефон: {selectedSupplier.телефон}</div>}
                            {selectedSupplier.email && <div>Email: {selectedSupplier.email}</div>}
                        </div>
                        <p style={{
                            margin: '0 0 20px 0',
                            color: '#f44336',
                            fontSize: '14px'
                        }}>
                            <strong>Внимание:</strong> Это действие нельзя отменить.
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
        </>
    );
}

export default withLayout(SuppliersPage);