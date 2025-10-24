import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import styles from '../../layout/Layout.module.css';

interface ProductDetail {
  id: number;
  название: string;
  артикул: string;
  категория?: string;
  цена_закупки?: number;
  цена_продажи: number;
  единица_измерения: string;
  минимальный_остаток: number;
  created_at: string;
  категория_id?: number;
}

function ProductDetailPage(): JSX.Element {
  const router = useRouter();
  const { id } = router.query;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState({
    название: '',
    артикул: '',
    категория: '',
    цена_закупки: '',
    цена_продажи: '',
    единица_измерения: 'шт',
    минимальный_остаток: '0'
  });

  useEffect(() => {
    if (id) {
      fetchProductDetail();
    }
  }, [id]);

  const fetchProductDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products?id=${id}`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки товара');
      }
      
      const data = await response.json();
      setProduct(data);
      
      // Initialize form data for editing
      setFormData({
        название: data.название || '',
        артикул: data.артикул || '',
        категория: data.категория || '',
        цена_закупки: data.цена_закупки ? data.цена_закупки.toString() : '',
        цена_продажи: data.цена_продажи ? data.цена_продажи.toString() : '',
        единица_измерения: data.единица_измерения || 'шт',
        минимальный_остаток: data.минимальный_остаток ? data.минимальный_остаток.toString() : '0'
      });
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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset form to original values
    if (product) {
      setFormData({
        название: product.название || '',
        артикул: product.артикул || '',
        категория: product.категория || '',
        цена_закупки: product.цена_закупки ? product.цена_закупки.toString() : '',
        цена_продажи: product.цена_продажи ? product.цена_продажи.toString() : '',
        единица_измерения: product.единица_измерения || 'шт',
        минимальный_остаток: product.минимальный_остаток ? product.минимальный_остаток.toString() : '0'
      });
    }
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: product?.id,
          название: formData.название,
          артикул: formData.артикул,
          категория: formData.категория || null,
          цена_закупки: formData.цена_закупки ? parseFloat(formData.цена_закупки) : null,
          цена_продажи: formData.цена_продажи ? parseFloat(formData.цена_продажи) : null,
          единица_измерения: formData.единица_измерения,
          минимальный_остаток: parseInt(formData.минимальный_остаток) || 0,
          категория_id: product?.категория_id || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления товара');
      }

      const updatedProduct = await response.json();
      setProduct(updatedProduct);
      setIsEditing(false);
      
      // Show success message
      alert('Товар успешно обновлен');
    } catch (err) {
      console.error('Error updating product:', err);
      alert('Ошибка обновления товара: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    
    if (!confirm(`Вы уверены, что хотите удалить товар ${product.название}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/products?id=${product.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления товара');
      }

      alert('Товар успешно удален');
      router.push('/products');
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Ошибка удаления товара: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <>
        <Htag tag="h1">Загрузка товара...</Htag>
        <div className={styles.card}>
          <p>Пожалуйста, подождите...</p>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Htag tag="h1">Ошибка</Htag>
        <div className={styles.card}>
          <p style={{ color: '#f44336' }}>{error || 'Товар не найден'}</p>
          <Link href="/products">
            <button style={{
              padding: '8px 16px',
              backgroundColor: '#3d5afe',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '16px'
            }}>
              Вернуться к списку товаров
            </button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link href="/products">
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            ← Назад к товарам
          </button>
        </Link>
        <Htag tag="h1">{isEditing ? 'Редактирование товара' : product.название}</Htag>
      </div>

      <div className={styles.card}>
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <h2>Редактирование информации о товаре</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Название *
                </label>
                <input
                  type="text"
                  name="название"
                  value={formData.название}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Артикул *
                </label>
                <input
                  type="text"
                  name="артикул"
                  value={formData.артикул}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Категория
                </label>
                <input
                  type="text"
                  name="категория"
                  value={formData.категория}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Цена закупки (руб.)
                </label>
                <input
                  type="number"
                  name="цена_закупки"
                  value={formData.цена_закупки}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Цена продажи (руб.) *
                </label>
                <input
                  type="number"
                  name="цена_продажи"
                  value={formData.цена_продажи}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Единица измерения
                </label>
                <select
                  name="единица_измерения"
                  value={formData.единица_измерения}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                >
                  <option value="шт">шт</option>
                  <option value="кг">кг</option>
                  <option value="л">л</option>
                  <option value="м">м</option>
                  <option value="упак">упак</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Минимальный остаток
                </label>
                <input
                  type="number"
                  name="минимальный_остаток"
                  value={formData.минимальный_остаток}
                  onChange={handleInputChange}
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  padding: '12px 24px',
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
                  padding: '12px 24px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Сохранить изменения
              </button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2>Информация о товаре</h2>
                <p><strong>ID:</strong> #{product.id}</p>
                <p><strong>Название:</strong> {product.название}</p>
                <p><strong>Артикул:</strong> {product.артикул}</p>
                <p><strong>Дата регистрации:</strong> {formatDate(product.created_at)}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div>
                <h3>Цены</h3>
                <p><strong>Цена закупки:</strong> {product.цена_закупки ? formatCurrency(product.цена_закупки) : 'Не указана'}</p>
                <p><strong>Цена продажи:</strong> {formatCurrency(product.цена_продажи)}</p>
              </div>
              
              <div>
                <h3>Параметры</h3>
                <p><strong>Категория:</strong> {product.категория || 'Не указана'}</p>
                <p><strong>Единица измерения:</strong> {product.единица_измерения}</p>
                <p><strong>Минимальный остаток:</strong> {product.минимальный_остаток} {product.единица_измерения}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button 
                onClick={handleEdit}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Редактировать
              </button>
              <button 
                onClick={handleDelete}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Удалить товар
              </button>
              <button 
                onClick={fetchProductDetail}
                style={{
                  padding: '12px 24px',
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
          </>
        )}
      </div>
    </>
  );
}

export default withLayout(ProductDetailPage);