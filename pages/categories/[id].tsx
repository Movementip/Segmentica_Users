import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import styles from '../../layout/Layout.module.css';

interface CategoryDetail {
  id: number;
  название: string;
  описание?: string;
  родительская_категория_id?: number;
  родительская_категория_название?: string;
  активна: boolean;
  created_at: string;
  подкатегории: CategoryDetail[];
  товары: number;
}

function CategoryDetailPage(): JSX.Element {
  const router = useRouter();
  const { id } = router.query;
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState({
    название: '',
    описание: '',
    родительская_категория_id: ''
  });

  useEffect(() => {
    if (id) {
      fetchCategoryDetail();
    }
  }, [id]);

  const fetchCategoryDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/categories?id=${id}`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки категории');
      }
      
      const data = await response.json();
      setCategory(data);
      
      // Initialize form data for editing
      setFormData({
        название: data.название || '',
        описание: data.описание || '',
        родительская_категория_id: data.родительская_категория_id ? data.родительская_категория_id.toString() : ''
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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset form to original values
    if (category) {
      setFormData({
        название: category.название || '',
        описание: category.описание || '',
        родительская_категория_id: category.родительская_категория_id ? category.родительская_категория_id.toString() : ''
      });
    }
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: category?.id,
          название: formData.название,
          описание: formData.описание || null,
          родительская_категория_id: formData.родительская_категория_id ? parseInt(formData.родительская_категория_id) : null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления категории');
      }

      const updatedCategory = await response.json();
      setCategory(updatedCategory);
      setIsEditing(false);
      
      // Show success message
      alert('Категория успешно обновлена');
    } catch (err) {
      console.error('Error updating category:', err);
      alert('Ошибка обновления категории: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    
    if (!confirm(`Вы уверены, что хотите удалить категорию ${category.название}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/categories?id=${category.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления категории');
      }

      alert('Категория успешно удалена');
      router.push('/categories');
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Ошибка удаления категории: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <>
        <Htag tag="h1">Загрузка категории...</Htag>
        <div className={styles.card}>
          <p>Пожалуйста, подождите...</p>
        </div>
      </>
    );
  }

  if (error || !category) {
    return (
      <>
        <Htag tag="h1">Ошибка</Htag>
        <div className={styles.card}>
          <p style={{ color: '#f44336' }}>{error || 'Категория не найдена'}</p>
          <Link href="/categories">
            <button style={{
              padding: '8px 16px',
              backgroundColor: '#3d5afe',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '16px'
            }}>
              Вернуться к списку категорий
            </button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link href="/categories">
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            ← Назад к категориям
          </button>
        </Link>
        <Htag tag="h1">{isEditing ? 'Редактирование категории' : category.название}</Htag>
      </div>

      <div className={styles.card}>
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <h2>Редактирование информации о категории</h2>
            
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
                  Родительская категория
                </label>
                <select
                  name="родительская_категория_id"
                  value={formData.родительская_категория_id}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                >
                  <option value="">Основная категория</option>
                  {/* We'll need to fetch all categories for this dropdown */}
                  <option value="1">Пример категории</option>
                </select>
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Описание
                </label>
                <textarea
                  name="описание"
                  value={formData.описание}
                  onChange={handleInputChange}
                  rows={4}
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
                <h2>Информация о категории</h2>
                <p><strong>ID:</strong> #{category.id}</p>
                <p><strong>Название:</strong> {category.название}</p>
                <p><strong>Дата создания:</strong> {formatDate(category.created_at)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: category.активна ? '#e8f5e8' : '#ffebee',
                  color: category.активна ? '#2e7d32' : '#c62828',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {category.активна ? 'Активна' : 'Неактивна'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div>
                <h3>Описание</h3>
                <p>{category.описание || 'Не указано'}</p>
              </div>
              
              <div>
                <h3>Иерархия</h3>
                <p>
                  <strong>Родительская категория:</strong> 
                  {category.родительская_категория_id 
                    ? ` ${category.родительская_категория_название || `#${category.родительская_категория_id}`}` 
                    : ' Основная категория'}
                </p>
                <p><strong>Подкатегории:</strong> {category.подкатегории?.length || 0}</p>
                <p><strong>Товаров в категории:</strong> {category.товары || 0}</p>
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
                Удалить категорию
              </button>
              <button 
                onClick={fetchCategoryDetail}
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

export default withLayout(CategoryDetailPage);