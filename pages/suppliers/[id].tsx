import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import { CreatePurchaseModal } from '../../components/CreatePurchaseModal';
import { AddProductToSupplierModal } from '../../components/AddProductToSupplierModal';
import { ChangeSupplierRatingModal } from '../../components/ChangeSupplierRatingModal';
import styles from '../../layout/Layout.module.css';

interface SupplierProduct {
    id: number;
    товар_id: number;
    цена: number;
    срок_поставки: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

interface SupplierPurchase {
    id: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
    заявка_id?: number;
}

interface SupplierDetail {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    рейтинг: number;
    created_at: string;
    ассортимент: SupplierProduct[];
    закупки: SupplierPurchase[];
}

function SupplierDetailPage(): JSX.Element {
    const router = useRouter();
    const { id } = router.query;
    const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'products' | 'purchases'>('products');

    // Modal states
    const [isCreatePurchaseModalOpen, setIsCreatePurchaseModalOpen] = useState(false);
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [isChangeRatingModalOpen, setIsChangeRatingModalOpen] = useState(false);

    useEffect(() => {
        if (id) {
            fetchSupplierDetail();
        }
    }, [id]);

    const fetchSupplierDetail = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/suppliers/${id}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщика');
            }

            const data = await response.json();
            setSupplier(data);
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

    const getRatingStars = (rating: number) => {
        return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 5) return '#4caf50';
        if (rating >= 4) return '#ff9800';
        if (rating >= 3) return '#2196f3';
        return '#f44336';
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'заказано': return '#2196f3';
            case 'в пути': return '#ff9800';
            case 'получено': return '#4caf50';
            case 'отменено': return '#f44336';
            default: return '#666';
        }
    };

    // Modal handlers
    const handleCreatePurchase = () => {
        setIsCreatePurchaseModalOpen(true);
    };

    const handleAddProduct = () => {
        setIsAddProductModalOpen(true);
    };

    const handleChangeRating = () => {
        setIsChangeRatingModalOpen(true);
    };

    const handlePurchaseCreated = () => {
        fetchSupplierDetail(); // Refresh data
        setIsCreatePurchaseModalOpen(false);
    };

    const handleProductAdded = () => {
        fetchSupplierDetail(); // Refresh data
        setIsAddProductModalOpen(false);
    };

    const handleRatingChanged = () => {
        fetchSupplierDetail(); // Refresh data
        setIsChangeRatingModalOpen(false);
    };

    if (loading) {
        return (
            <>
                <Htag tag="h1">Загрузка поставщика...</Htag>
                <div className={styles.card}>
                    <p>Пожалуйста, подождите...</p>
                </div>
            </>
        );
    }

    if (error || !supplier) {
        return (
            <>
                <Htag tag="h1">Ошибка</Htag>
                <div className={styles.card}>
                    <p style={{ color: '#f44336' }}>{error || 'Поставщик не найден'}</p>
                    <Link href="/suppliers">
                        <button style={{
                            padding: '8px 16px',
                            backgroundColor: '#3d5afe',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '16px'
                        }}>
                            Вернуться к списку поставщиков
                        </button>
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <Link href="/suppliers">
                    <button style={{
                        padding: '8px 16px',
                        backgroundColor: '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        ← Назад к поставщикам
                    </button>
                </Link>
                <Htag tag="h1">{supplier.название}</Htag>
            </div>

            {/* Основная информация о поставщике */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h2>Информация о поставщике</h2>
                        <p><strong>ID:</strong> #{supplier.id}</p>
                        <p><strong>Название:</strong> {supplier.название}</p>
                        <p><strong>Дата регистрации:</strong> {formatDate(supplier.created_at)}</p>
                    </div>

                </div>

                {/* Контактная информация */}
                <div>
                    <h3>Контактная информация</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        <div>
                            <p><strong>Телефон:</strong> {supplier.телефон || 'Не указан'}</p>
                        </div>
                        <div>
                            <p><strong>Email:</strong> {supplier.email || 'Не указан'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Вкладки */}
            <div className={styles.card}>
                <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: '24px' }}>
                    <button
                        onClick={() => setActiveTab('products')}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: activeTab === 'products' ? '#3d5afe' : 'transparent',
                            color: activeTab === 'products' ? 'white' : '#666',
                            border: 'none',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            marginRight: '8px',
                            fontWeight: '600'
                        }}
                    >
                        Ассортимент ({supplier.ассортимент.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('purchases')}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: activeTab === 'purchases' ? '#3d5afe' : 'transparent',
                            color: activeTab === 'purchases' ? 'white' : '#666',
                            border: 'none',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        История закупок ({supplier.закупки.length})
                    </button>
                </div>

                {/* Ассортимент товаров */}
                {activeTab === 'products' && (
                    <div>
                        <h2>Ассортимент товаров</h2>
                        {supplier.ассортимент.length === 0 ? (
                            <p>У поставщика нет товаров в ассортименте</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Артикул</th>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Название</th>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Категория</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Цена</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Срок поставки</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supplier.ассортимент.map((product) => (
                                            <tr key={product.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                                                <td style={{ padding: '12px', fontWeight: '600', fontFamily: 'monospace' }}>
                                                    {product.товар_артикул}
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: '600' }}>{product.товар_название}</div>
                                                        <small style={{ color: '#666' }}>ID: {product.товар_id}</small>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    {product.товар_категория || 'Не указана'}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                                                    {formatCurrency(product.цена)} / {product.товар_единица_измерения}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        backgroundColor: product.срок_поставки <= 3 ? '#e8f5e8' : '#fff3e0',
                                                        color: product.срок_поставки <= 3 ? '#2e7d32' : '#ef6c00',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: '600'
                                                    }}>
                                                        {product.срок_поставки} дн.
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* История закупок */}
                {activeTab === 'purchases' && (
                    <div>
                        <h2>История закупок</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '8px 0 16px 0' }}>
                            💡 Нажмите на любую закупку для просмотра подробностей
                        </p>
                        {supplier.закупки.length === 0 ? (
                            <p>Закупки у данного поставщика не найдены</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID закупки</th>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата заказа</th>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Дата поступления</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Статус</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Сумма</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Заявка</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supplier.закупки.map((purchase) => (
                                            <tr key={purchase.id}
                                                style={{
                                                    borderBottom: '1px solid #e0e0e0',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onClick={() => router.push(`/purchases/${purchase.id}`)}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td style={{ padding: '12px', fontWeight: '600' }}>#{purchase.id}</td>
                                                <td style={{ padding: '12px' }}>{formatDate(purchase.дата_заказа)}</td>
                                                <td style={{ padding: '12px' }}>
                                                    {purchase.дата_поступления ? formatDate(purchase.дата_поступления) : 'Не поступило'}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        backgroundColor: getStatusColor(purchase.статус) + '20',
                                                        color: getStatusColor(purchase.статус)
                                                    }}>
                                                        {purchase.статус}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                                                    {formatCurrency(purchase.общая_сумма)}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {purchase.заявка_id ? (
                                                        <Link href={`/orders/${purchase.заявка_id}`}>
                                                            <span style={{ color: '#3d5afe', cursor: 'pointer' }}>
                                                                #{purchase.заявка_id}
                                                            </span>
                                                        </Link>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Дополнительные действия */}
            <div className={styles.card}>
                <h2>Действия</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleCreatePurchase}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Создать закупку
                    </button>
                    <button
                        onClick={handleAddProduct}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Добавить товар
                    </button>
                    <button
                        onClick={handleChangeRating}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Изменить рейтинг
                    </button>
                    <button
                        onClick={fetchSupplierDetail}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#9c27b0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Обновить данные
                    </button>
                </div>
            </div>

            {/* Модальные окна */}
            {supplier && (
                <>
                    <CreatePurchaseModal
                        isOpen={isCreatePurchaseModalOpen}
                        onClose={() => setIsCreatePurchaseModalOpen(false)}
                        onPurchaseCreated={handlePurchaseCreated}
                        поставщик_id={supplier.id}
                        поставщик_название={supplier.название}
                    />

                    <AddProductToSupplierModal
                        isOpen={isAddProductModalOpen}
                        onClose={() => setIsAddProductModalOpen(false)}
                        onProductAdded={handleProductAdded}
                        поставщик_id={supplier.id}
                        поставщик_название={supplier.название}
                    />

                    <ChangeSupplierRatingModal
                        isOpen={isChangeRatingModalOpen}
                        onClose={() => setIsChangeRatingModalOpen(false)}
                        onRatingChanged={handleRatingChanged}
                        поставщик_id={supplier.id}
                        поставщик_название={supplier.название}
                        текущий_рейтинг={supplier.рейтинг}
                    />
                </>
            )}
        </>
    );
}

export default withLayout(SupplierDetailPage);