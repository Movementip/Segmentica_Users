import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { Htag } from '../components';
import { CreateProductModal } from '../components/CreateProductModal';
import styles from '../layout/Layout.module.css';
import * as XLSX from 'xlsx';
import { FiDownload } from 'react-icons/fi';

interface Product {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    цена_закупки?: number;
    цена_продажи: number;
    единица_измерения: string;
    минимальный_остаток: number;
    created_at: string;
}

function ProductsPage(): JSX.Element {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/products');

            if (!response.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const data = await response.json();
            setProducts(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const handleCreateProduct = () => {
        setIsCreateModalOpen(true);
    };

    const handleDeleteProduct = (product: Product, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedProduct(product);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedProduct) return;

        try {
            const response = await fetch(`/api/products?id=${selectedProduct.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления товара');
            }

            await fetchProducts();
            setIsDeleteModalOpen(false);
            setSelectedProduct(null);
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleProductCreated = () => {
        fetchProducts();
        setIsCreateModalOpen(false);
    };

    if (loading) {
        return (
            <>

                <div className={styles.card}>
                    <p>Загрузка товаров...</p>
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
                        onClick={fetchProducts}
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
                        <h2>Список товаров ({products.length})</h2>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
                            Нажмите на любой товар для просмотра подробностей
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => {
                                // Create worksheet from products data
                                const ws = XLSX.utils.json_to_sheet(products.map(p => ({
                                    'ID': p.id,
                                    'Название': p.название,
                                    'Артикул': p.артикул,
                                    'Категория': p.категория || '',
                                    'Цена закупки': p.цена_закупки || 0,
                                    'Цена продажи': p.цена_продажи,
                                    'Ед. измерения': p.единица_измерения,
                                    'Мин. остаток': p.минимальный_остаток,
                                    'Дата создания': new Date(p.created_at).toLocaleDateString('ru-RU')
                                })));

                                // Create workbook and add the worksheet
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, 'Товары');

                                // Generate Excel file
                                const date = new Date().toISOString().split('T')[0];
                                XLSX.writeFile(wb, `Товары_${date}.xlsx`);
                            }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#000000',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '14px',
                                fontWeight: 500
                            }}
                        >
                            <FiDownload size={16} /> Excel
                        </button>
                        <button
                            onClick={handleCreateProduct}
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
                            + Добавить товар
                        </button>
                        <button
                            onClick={fetchProducts}
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

                {products.length === 0 ? (
                    <p>Товары не найдены. Добавьте товары в базу данных.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Название</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Артикул</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Категория</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Цена закупки</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Цена продажи</th>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Ед. изм.</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.id}
                                        style={{
                                            borderBottom: '1px solid #e0e0e0',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onClick={() => router.push(`/products/${product.id}`)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '12px', fontWeight: '600' }}>#{product.id}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '600' }}>{product.название}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {product.артикул}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {product.категория || 'Не указана'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            {product.цена_закупки ? formatCurrency(product.цена_закупки) : '—'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                                            {formatCurrency(product.цена_продажи)}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {product.единица_измерения}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => handleDeleteProduct(product, e)}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title={`Удалить ${product.название}`}
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

            <CreateProductModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onProductCreated={handleProductCreated}
            />

            {/* Generic Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedProduct && (
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
                        <p style={{ margin: '0 0 16px 0' }}>Вы уверены, что хотите удалить товар?</p>
                        <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: '12px',
                            borderRadius: '4px',
                            margin: '0 0 16px 0'
                        }}>
                            <strong>{selectedProduct.название}</strong>
                            <div>Артикул: {selectedProduct.артикул}</div>
                            <div>Цена продажи: {formatCurrency(selectedProduct.цена_продажи)}</div>
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

export default withLayout(ProductsPage);