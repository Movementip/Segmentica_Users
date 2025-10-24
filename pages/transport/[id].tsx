import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Layout } from '../../layout/Layout';
import { EditTransportModal } from '../../components/EditTransportModal';
import styles from '../../styles/TransportDetail.module.css';

interface TransportCompany {
  id: number;
  название: string;
  телефон: string | null;
  email: string | null;
  тариф: number | null;
  created_at: string;
  общее_количество_отгрузок: number;
  активные_отгрузки: number;
  завершенные_отгрузки: number;
  средняя_стоимость: number | null;
  общая_выручка: number | null;
}

interface Shipment {
  id: number;
  заявка_id: number;
  транспорт_id: number;
  статус: string;
  номер_отслеживания: string | null;
  дата_отгрузки: string;
  стоимость_доставки: number | null;
  заявка_номер: number;
  клиент_название: string;
  адрес_доставки: string | null;
  сумма_заявки: number | null;
  заявка_статус?: string;
}

interface Performance {
  месяц: string;
  количество_отгрузок: number;
  средняя_стоимость: number;
  общая_выручка: number;
  успешные_доставки: number;
}

interface TransportDetailData {
  transport: TransportCompany;
  shipments: Shipment[];
  performance: Performance[];
  activeShipments: Shipment[];
}

export default function TransportDetail() {
  const [data, setData] = useState<TransportDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/transport/${id}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        console.error('Failed to fetch transport details');
      }
    } catch (error) {
      console.error('Error fetching transport details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Не указано';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getStatusClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'доставлено':
        return 'completed';
      case 'в пути':
        return 'shipped';
      case 'в обработке':
        return 'processing';
      case 'отменено':
        return 'cancelled';
      default:
        return 'pending';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'в пути': return 'В ПУТИ';
      case 'доставлено': return 'ДОСТАВЛЕНО';
      case 'в обработке': return 'В ОБРАБОТКЕ';
      case 'отменено': return 'ОТМЕНЕНО';
      default: return status?.toUpperCase() || 'НЕИЗВЕСТНО';
    }
  };

  const calculateSuccessRate = (successful: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((successful / total) * 100);
  };

  const handleEditCompany = () => {
    setIsEditModalOpen(true);
  };

  const handleTransportUpdated = () => {
    fetchData(); // Refresh data after update
    setIsEditModalOpen(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>Загрузка...</div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className={styles.error}>Транспортная компания не найдена</div>
      </Layout>
    );
  }

  const { transport, shipments, performance, activeShipments } = data;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Назад к списку
          </button>
          <h1>{transport.название}</h1>
          <button 
            onClick={handleEditCompany}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ✏️ Редактировать
          </button>
        </div>

        <div className={styles.companyInfo}>
          <div className={styles.infoCard}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Название:</span>
              <span className={styles.infoValue}>{transport.название}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Телефон:</span>
              <span className={styles.infoValue}>{transport.телефон || 'Не указан'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email:</span>
              <span className={styles.infoValue}>{transport.email || 'Не указан'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Тариф:</span>
              <span className={styles.infoValue}>{formatCurrency(transport.тариф)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Всего отгрузок:</span>
              <span className={styles.infoValue}>
                <span className={styles.totalShipments}>
                  {transport.общее_количество_отгрузок || 0}
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Активные отгрузки:</span>
              <span className={styles.infoValue}>
                <span className={styles.activeShipments}>
                  {transport.активные_отгрузки || 0}
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Процент успешности:</span>
              <span className={styles.infoValue}>
                <span className={styles.successRate}>
                  {calculateSuccessRate(transport.завершенные_отгрузки || 0, transport.общее_количество_отгрузок || 0)}%
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Средняя стоимость:</span>
              <span className={styles.infoValue}>{formatCurrency(transport.средняя_стоимость)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Общая выручка:</span>
              <span className={styles.infoValue}>
                <span className={styles.totalRevenue}>
                  {formatCurrency(transport.общая_выручка)}
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Дата регистрации:</span>
              <span className={styles.infoValue}>{formatDate(transport.created_at)}</span>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h2>Активные отгрузки</h2>
            {activeShipments.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>№ Отгрузки</th>
                      <th>Номер отслеживания</th>
                      <th>Заявка</th>
                      <th>Клиент</th>
                      <th>Адрес доставки</th>
                      <th>Статус</th>
                      <th>Дата отгрузки</th>
                      <th>Стоимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeShipments.map((shipment) => (
                      <tr key={shipment.id} className={styles.clickableRow}>
                        <td>#{shipment.id}</td>
                        <td>{shipment.номер_отслеживания || 'Не присвоен'}</td>
                        <td>
                          <Link href={`/orders/${shipment.заявка_номер}`} className={styles.link}>
                            #{shipment.заявка_номер}
                          </Link>
                        </td>
                        <td>{shipment.клиент_название}</td>
                        <td>{shipment.адрес_доставки || 'Не указан'}</td>
                        <td>
                          <span
                            className={`${styles.status} ${styles[getStatusClass(shipment.заявка_статус || shipment.статус)]}`}
                          >
                            {getStatusText(shipment.заявка_статус || shipment.статус)}
                          </span>
                        </td>
                        <td>{formatDateTime(shipment.дата_отгрузки)}</td>
                        <td>{formatCurrency(shipment.стоимость_доставки)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.noData}>Нет активных отгрузок</p>
            )}
          </div>

          <div className={styles.section}>
            <h2>История отгрузок</h2>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№ Отгрузки</th>
                    <th>Номер отслеживания</th>
                    <th>Заявка</th>
                    <th>Клиент</th>
                    <th>Адрес доставки</th>
                    <th>Статус</th>
                    <th>Дата отгрузки</th>
                    <th>Стоимость</th>
                    <th>Сумма заявки</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id} className={styles.clickableRow}>
                      <td>#{shipment.id}</td>
                      <td>{shipment.номер_отслеживания || 'Не присвоен'}</td>
                      <td>
                        <Link href={`/orders/${shipment.заявка_номер}`} className={styles.link}>
                          #{shipment.заявка_номер}
                        </Link>
                      </td>
                      <td>{shipment.клиент_название}</td>
                      <td>{shipment.адрес_доставки || 'Не указан'}</td>
                      <td>
                        <span
                          className={`${styles.status} ${styles[getStatusClass(shipment.заявка_статус || shipment.статус)]}`}
                        >
                          {getStatusText(shipment.заявка_статус || shipment.статус)}
                        </span>
                      </td>
                      <td>{formatDateTime(shipment.дата_отгрузки)}</td>
                      <td>{formatCurrency(shipment.стоимость_доставки)}</td>
                      <td>{formatCurrency(shipment.сумма_заявки)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {performance.length > 0 && (
            <div className={styles.section}>
              <h2>Статистика по месяцам</h2>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Месяц</th>
                      <th>Количество отгрузок</th>
                      <th>Успешные доставки</th>
                      <th>Процент успешности</th>
                      <th>Средняя стоимость</th>
                      <th>Общая выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((month, index) => (
                      <tr key={index}>
                        <td>{formatDate(month.месяц)}</td>
                        <td>{month.количество_отгрузок}</td>
                        <td>{month.успешные_доставки}</td>
                        <td>
                          <span className={styles.successRate}>
                            {calculateSuccessRate(month.успешные_доставки, month.количество_отгрузок)}%
                          </span>
                        </td>
                        <td>{formatCurrency(month.средняя_стоимость)}</td>
                        <td>
                          <span className={styles.revenue}>
                            {formatCurrency(month.общая_выручка)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно редактирования */}
      {data && (
        <EditTransportModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onTransportUpdated={handleTransportUpdated}
          company={transport}
        />
      )}
    </Layout>
  );
}