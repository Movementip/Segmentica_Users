import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import { CreateManagerModal } from '../components/CreateManagerModal';
import styles from '../layout/Layout.module.css';

interface Manager {
    id: number;
    фио: string;
    должность: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен: boolean;
    created_at: string;
}

function ManagersPage(): JSX.Element {
    const router = useRouter();
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedManager, setSelectedManager] = useState<Manager | null>(null);

    useEffect(() => {
        fetchManagers();
    }, []);

    const fetchManagers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/managers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки сотрудников');
            }

            const data = await response.json();
            setManagers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateManager = () => {
        setIsCreateModalOpen(true);
    };

    const handleDeleteManager = (manager: Manager, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedManager(manager);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedManager) return;

        try {
            const response = await fetch(`/api/managers?id=${selectedManager.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления сотрудника');
            }

            await fetchManagers();
            setIsDeleteModalOpen(false);
            setSelectedManager(null);
        } catch (error) {
            console.error('Error deleting manager:', error);
            alert('Ошибка удаления сотрудника: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleManagerCreated = () => {
        fetchManagers();
        setIsCreateModalOpen(false);
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка сотрудников...</p>
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
                        onClick={fetchManagers}
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
                        <h2>Список сотрудников ({managers.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Нажмите на любого сотрудника для просмотра подробностей
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleCreateManager}
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
                            + Добавить сотрудника
                        </button>
                        <button
                            onClick={fetchManagers}
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

                {managers.length === 0 ? (
                    <p>Сотрудники не найдены. Добавьте сотрудников в базу данных.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ФИО</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Должность</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Контакты</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Статус</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {managers.map((manager) => (
                                    <tr key={manager.id}
                                        style={{
                                            borderBottom: '1px solid #e0e0e0',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onClick={() => router.push(`/managers/${manager.id}`)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{manager.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{manager.фио}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {manager.должность}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontSize: '14px' }}>
                                                {manager.телефон && <div>{manager.телефон}</div>}
                                                {manager.email && <div style={{ color: '#666' }}>{manager.email}</div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                backgroundColor: manager.активен ? '#e8f5e8' : '#ffebee',
                                                color: manager.активен ? '#2e7d32' : '#c62828'
                                            }}>
                                                {manager.активен ? 'Активен' : 'Неактивен'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => handleDeleteManager(manager, e)}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title={`Удалить ${manager.фио}`}
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

            <CreateManagerModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onManagerCreated={handleManagerCreated}
            />

            {/* Generic Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedManager && (
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
                        <p style={{ margin: '0 0 16px 0' }}>Вы уверены, что хотите удалить сотрудника?</p>
                        <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: '12px',
                            borderRadius: '4px',
                            margin: '0 0 16px 0'
                        }}>
                            <strong>{selectedManager.фио}</strong>
                            <div>Должность: {selectedManager.должность}</div>
                            {selectedManager.телефон && <div>Телефон: {selectedManager.телефон}</div>}
                            {selectedManager.email && <div>Email: {selectedManager.email}</div>}
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

export default withLayout(ManagersPage);