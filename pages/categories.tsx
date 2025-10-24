import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import { CreateCategoryModal } from '../components/CreateCategoryModal';
import styles from '../layout/Layout.module.css';

interface Category {
    id: number;
    название: string;
    описание?: string;
    родительская_категория_id?: number;
    родительская_категория_название?: string;
    активна: boolean;
    created_at: string;
}

function CategoriesPage(): JSX.Element {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/categories');

            if (!response.ok) {
                throw new Error('Ошибка загрузки категорий');
            }

            const data = await response.json();
            setCategories(data);
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

    const handleCreateCategory = () => {
        setIsCreateModalOpen(true);
    };

    const handleDeleteCategory = (category: Category, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCategory(category);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedCategory) return;

        try {
            const response = await fetch(`/api/categories?id=${selectedCategory.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления категории');
            }

            await fetchCategories();
            setIsDeleteModalOpen(false);
            setSelectedCategory(null);
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Ошибка удаления категории: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleCategoryCreated = () => {
        fetchCategories();
        setIsCreateModalOpen(false);
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка категорий...</p>
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
                        onClick={fetchCategories}
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
                        <h2>Список категорий ({categories.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Нажмите на любую категорию для просмотра подробностей
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleCreateCategory}
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
                            + Добавить категорию
                        </button>
                        <button
                            onClick={fetchCategories}
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

                {categories.length === 0 ? (
                    <p>Категории не найдены. Добавьте категории в базу данных.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Название</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Описание</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Родительская категория</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата создания</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Статус</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((category) => (
                                    <tr key={category.id}
                                        style={{
                                            borderBottom: '1px solid #e0e0e0',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onClick={() => router.push(`/categories/${category.id}`)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{category.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{category.название}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {category.описание || 'Не указано'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {category.родительская_категория_id
                                                ? (category.родительская_категория_название || `#${category.родительская_категория_id}`)
                                                : 'Основная категория'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {formatDate(category.created_at)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: category.активна ? '#4caf50' : '#f44336',
                                                color: 'white',
                                                fontSize: '12px'
                                            }}>
                                                {category.активна ? 'Активна' : 'Неактивна'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => handleDeleteCategory(category, e)}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title={`Удалить ${category.название}`}
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

            <CreateCategoryModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCategoryCreated={handleCategoryCreated}
            />

            {/* Generic Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedCategory && (
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
                        <p style={{ margin: '0 0 16px 0' }}>Вы уверены, что хотите удалить категорию?</p>
                        <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: '12px',
                            borderRadius: '4px',
                            margin: '0 0 16px 0'
                        }}>
                            <strong>{selectedCategory.название}</strong>
                            {selectedCategory.описание && <div>{selectedCategory.описание}</div>}
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

export default withLayout(CategoriesPage);