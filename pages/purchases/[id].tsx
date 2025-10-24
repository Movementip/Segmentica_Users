import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import styles from '../../layout/Layout.module.css';

interface PurchasePosition {
  id: number;
  товар_id: number;
  товар_название: string;
  товар_артикул: string;
  количество: number;
  цена: number;
  сумма: number;
}

interface Purchase {
  id: number;
  поставщик_id: number;
  поставщик_название: string;
  поставщик_телефон: string;
  поставщик_email: string;
  заявка_id?: number;
  дата_заказа: string;
  дата_поступления?: string;
  статус: string;
  общая_сумма: number;
  позиции: PurchasePosition[];
}

function PurchaseDetailPage(): JSX.Element {
  const router = useRouter();
  const { id } = router.query;
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchPurchase();
    }
  }, [id]);

  const fetchPurchase = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/purchases/${id}`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки закупки');
      }
      
      const data = await response.json();
      setPurchase(data);
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

  const handleBack = () => {
    router.push('/purchases');
  };

  const handleDelete = async () => {
    if (!confirm(`Вы уверены, что хотите удалить закупку #${id}? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/purchases?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления закупки');
      }

      alert(`Закупка #${id} успешно удалена`);
      router.push('/purchases');
    } catch (error) {
      alert(`Ошибка при удалении закупки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  if (loading) {
    return (
      <>
        <Htag tag="h1">Детали закупки</Htag>
        <div className={styles.card}>
          <p>Загрузка закупки...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Htag tag="h1">Детали закупки</Htag>
        <div className={styles.card}>
          <h2>Ошибка</h2>
          <p style={{ color: '#f44336' }}>{error}</p>
          <button 
            onClick={handleBack}
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
            Назад к списку
          </button>
        </div>
      </>
    );
  }

  if (!purchase) {
    return (
      <>
        <Htag tag="h1">Детали закупки</Htag>
        <div className={styles.card}>
          <p>Закупка не найдена</p>
          <button 
            onClick={handleBack}
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
            Назад к списку
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Htag tag="h1">Детали закупки #{purchase.id}</Htag>
      
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>Информация о закупке</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleBack}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3d5afe',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Назад к списку
            </button>
            <button 
              onClick={handleDelete}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🗑️ Удалить закупку
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Информация о поставщике</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Название</div>
                <div style={{ fontWeight: '600' }}>{purchase.поставщик_название}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Телефон</div>
                <div>{purchase.поставщик_телефон}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Email</div>
                <div>{purchase.поставщик_email}</div>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Информация о закупке</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>ID закупки</div>
                <div style={{ fontWeight: '600' }}>#{purchase.id}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Дата заказа</div>
                <div>{formatDateTime(purchase.дата_заказа)}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Дата поступления</div>
                <div>{purchase.дата_поступления ? formatDate(purchase.дата_поступления) : 'Не указана'}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Статус</div>
                <div>
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
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Общая сумма</div>
                <div style={{ fontWeight: '600', fontSize: '18px' }}>{formatCurrency(purchase.общая_сумма)}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Позиции закупки</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Товар</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Количество</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Цена за ед.</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {purchase.позиции.map((position) => (
                  <tr key={position.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '600' }}>{position.товар_название}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {position.товар_артикул}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {position.количество}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {formatCurrency(position.цена)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                      {formatCurrency(position.сумма)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default withLayout(PurchaseDetailPage);