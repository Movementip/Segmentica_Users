import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import styles from '../../layout/Layout.module.css';

interface ManagerDetail {
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

function ManagerDetailPage(): JSX.Element {
  const router = useRouter();
  const { id } = router.query;
  const [manager, setManager] = useState<ManagerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState({
    фио: '',
    должность: '',
    телефон: '',
    email: '',
    ставка: '',
    дата_приема: '',
    активен: true
  });

  useEffect(() => {
    if (id) {
      fetchManagerDetail();
    }
  }, [id]);

  const fetchManagerDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/managers?id=${id}`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки сотрудника');
      }
      
      const data = await response.json();
      setManager(data);
      
      // Initialize form data for editing
      setFormData({
        фио: data.фио || '',
        должность: data.должность || '',
        телефон: data.телефон || '',
        email: data.email || '',
        ставка: data.ставка ? data.ставка.toString() : '',
        дата_приема: data.дата_приема || '',
        активен: data.активен !== undefined ? data.активен : true
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
    if (manager) {
      setFormData({
        фио: manager.фио || '',
        должность: manager.должность || '',
        телефон: manager.телефон || '',
        email: manager.email || '',
        ставка: manager.ставка ? manager.ставка.toString() : '',
        дата_приема: manager.дата_приема || '',
        активен: manager.активен !== undefined ? manager.активен : true
      });
    }
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/managers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: manager?.id,
          фио: formData.фио,
          должность: formData.должность,
          телефон: formData.телефон || null,
          email: formData.email || null,
          ставка: formData.ставка ? parseFloat(formData.ставка) : null,
          дата_приема: formData.дата_приема || null,
          активен: formData.активен
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления сотрудника');
      }

      const updatedManager = await response.json();
      setManager(updatedManager);
      setIsEditing(false);
      
      // Show success message
      alert('Сотрудник успешно обновлен');
    } catch (err) {
      console.error('Error updating manager:', err);
      alert('Ошибка обновления сотрудника: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!manager) return;
    
    if (!confirm(`Вы уверены, что хотите удалить сотрудника ${manager.фио}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/managers?id=${manager.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления сотрудника');
      }

      alert('Сотрудник успешно удален');
      router.push('/managers');
    } catch (err) {
      console.error('Error deleting manager:', err);
      alert('Ошибка удаления сотрудника: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <>
        <Htag tag="h1">Загрузка сотрудника...</Htag>
        <div className={styles.card}>
          <p>Пожалуйста, подождите...</p>
        </div>
      </>
    );
  }

  if (error || !manager) {
    return (
      <>
        <Htag tag="h1">Ошибка</Htag>
        <div className={styles.card}>
          <p style={{ color: '#f44336' }}>{error || 'Сотрудник не найден'}</p>
          <Link href="/managers">
            <button style={{
              padding: '8px 16px',
              backgroundColor: '#3d5afe',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '16px'
            }}>
              Вернуться к списку сотрудников
            </button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link href="/managers">
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            ← Назад к сотрудникам
          </button>
        </Link>
        <Htag tag="h1">{isEditing ? 'Редактирование сотрудника' : manager.фио}</Htag>
      </div>

      <div className={styles.card}>
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <h2>Редактирование информации о сотруднике</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  ФИО *
                </label>
                <input
                  type="text"
                  name="фио"
                  value={formData.фио}
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
                  Должность *
                </label>
                <input
                  type="text"
                  name="должность"
                  value={formData.должность}
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
                  Телефон
                </label>
                <input
                  type="text"
                  name="телефон"
                  value={formData.телефон}
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
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
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
                  Ставка (руб.)
                </label>
                <input
                  type="number"
                  name="ставка"
                  value={formData.ставка}
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
                  Дата приема
                </label>
                <input
                  type="date"
                  name="дата_приема"
                  value={formData.дата_приема}
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
                  Активен
                </label>
                <input
                  type="checkbox"
                  name="активен"
                  checked={formData.активен}
                  onChange={handleInputChange}
                  style={{ transform: 'scale(1.5)' }}
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
                <h2>Информация о сотруднике</h2>
                <p><strong>ID:</strong> #{manager.id}</p>
                <p><strong>ФИО:</strong> {manager.фио}</p>
                <p><strong>Должность:</strong> {manager.должность}</p>
                <p><strong>Дата регистрации:</strong> {formatDate(manager.created_at)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: manager.активен ? '#e8f5e8' : '#ffebee',
                  color: manager.активен ? '#2e7d32' : '#c62828',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {manager.активен ? 'Активен' : 'Неактивен'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div>
                <h3>Контактная информация</h3>
                <p><strong>Телефон:</strong> {manager.телефон || 'Не указан'}</p>
                <p><strong>Email:</strong> {manager.email || 'Не указан'}</p>
              </div>
              
              <div>
                <h3>Финансовая информация</h3>
                <p><strong>Ставка:</strong> {manager.ставка ? formatCurrency(manager.ставка) : 'Не указана'}</p>
                <p><strong>Дата приема:</strong> {manager.дата_приема ? formatDate(manager.дата_приема) : 'Не указана'}</p>
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
                Удалить сотрудника
              </button>
              <button 
                onClick={fetchManagerDetail}
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

export default withLayout(ManagerDetailPage);