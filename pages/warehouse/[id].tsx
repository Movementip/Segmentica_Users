import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '../../layout/Layout';
import { EditProductModal } from '../../components/EditProductModal';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import styles from '../../styles/WarehouseDetail.module.css';

interface WarehouseItem {
  id: number;
  товар_id: number;
  количество: number;
  дата_последнего_поступления: string | null;
  updated_at: string;
  товар_название: string;
  товар_артикул: string;
  товар_категория: string;
  товар_единица: string;
  товар_мин_остаток: number;
  товар_цена_закупки: number;
  товар_цена_продажи: number;
  stock_status: 'critical' | 'low' | 'normal';
}

interface Movement {
  id: number;
  товар_id: number;
  тип_операции: string;
  количество: number;
  дата_операции: string;
  заявка_id: number | null;
  закупка_id: number | null;
  комментарий: string | null;
  заявка_номер: number | null;
  закупка_номер: number | null;
  клиент_название: string | null;
  поставщик_название: string | null;
}

interface WaitingOrder {
  id: number;
  заявка_id: number;
  товар_id: number;
  количество: number;
  цена: number;
  заявка_номер: number;
  заявка_статус: string;
  клиент_название: string;
  заявка_дата: string;
}

interface PendingPurchase {
  id: number;
  закупка_id: number;
  товар_id: number;
  количество: number;
  цена: number;
  закупка_номер: number;
  закупка_статус: string;
  поставщик_название: string;
  закупка_дата: string;
  ожидаемая_дата: string | null;
}

interface WarehouseDetailData {
  item: WarehouseItem;
  movements: Movement[];
  waitingOrders: WaitingOrder[];
  pendingPurchases: PendingPurchase[];
}

export default function WarehouseDetail() {
  const [data, setData] = useState<WarehouseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/warehouse/${id}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        console.error('Failed to fetch warehouse item details');
      }
    } catch (error) {
      console.error('Error fetching warehouse item details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = () => {
    setIsEditModalOpen(true);
  };

  const handleDeleteProduct = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!data?.item) return;

    try {
      const response = await fetch(`/api/warehouse?id=${data.item.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления товара');
      }

      // Navigate back to warehouse page after successful deletion
      router.push('/warehouse');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleProductUpdated = () => {
    fetchData();
    setIsEditModalOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return '#ff4444';
      case 'low': return '#ff8800';
      default: return '#4CAF50';
    }
  };

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'critical': return 'Критический';
      case 'low': return 'Низкий';
      default: return 'Нормальный';
    }
  };

  const getOperationTypeColor = (type: string) => {
    switch (type) {
      case 'поступление': return '#4CAF50';
      case 'отгрузка': return '#ff4444';
      case 'списание': return '#ff8800';
      case 'инвентаризация': return '#2196F3';
      default: return '#666';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'новая': return '#2196F3';
      case 'в обработке': return '#ff8800';
      case 'выполнена': return '#4CAF50';
      case 'отменена': return '#f44336';
      case 'заказано': return '#ff8800';
      case 'в пути': return '#2196F3';
      case 'получено': return '#4CAF50';
      default: return '#666';
    }
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
        <div className={styles.error}>Товар не найден</div>
      </Layout>
    );
  }

  const { item, movements, waitingOrders, pendingPurchases } = data;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Назад к складу
          </button>
          <h1>{item.товар_название}</h1>
          <div className={styles.headerActions}>
            <button 
              onClick={handleEditProduct}
              className={styles.editButton}
            >
              ✏️ Редактировать
            </button>
            <button 
              onClick={handleDeleteProduct}
              className={styles.deleteButton}
            >
              🗑️ Удалить
            </button>
          </div>
        </div>

        <div className={styles.itemInfo}>
          <div className={styles.infoCard}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Артикул:</span>
              <span className={styles.infoValue}>{item.товар_артикул}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Категория:</span>
              <span className={styles.infoValue}>{item.товар_категория}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Текущий остаток:</span>
              <span className={styles.infoValue}>
                <span className={styles.quantity}>
                  {item.количество} {item.товар_единица}
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Минимальный остаток:</span>
              <span className={styles.infoValue}>
                {item.товар_мин_остаток} {item.товар_единица}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Статус:</span>
              <span
                className={styles.status}
                style={{ backgroundColor: getStockStatusColor(item.stock_status) }}
              >
                {getStockStatusText(item.stock_status)}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Цена закупки:</span>
              <span className={styles.infoValue}>{formatCurrency(item.товар_цена_закупки)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Цена продажи:</span>
              <span className={styles.infoValue}>{formatCurrency(item.товар_цена_продажи)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Последнее поступление:</span>
              <span className={styles.infoValue}>
                {item.дата_последнего_поступления 
                  ? formatDate(item.дата_последнего_поступления)
                  : 'Нет данных'
                }
              </span>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h2>Ожидающие заявки</h2>
            {waitingOrders.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>№ Заявки</th>
                      <th>Клиент</th>
                      <th>Количество</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Дата создания</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingOrders.map((order) => (
                      <tr
                        key={order.id}
                        className={styles.clickableRow}
                        onClick={() => router.push(`/orders/${order.заявка_номер}`)}
                      >
                        <td>#{order.заявка_номер}</td>
                        <td>{order.клиент_название}</td>
                        <td>{order.количество} {item.товар_единица}</td>
                        <td>{formatCurrency(order.цена)}</td>
                        <td>{formatCurrency(order.количество * order.цена)}</td>
                        <td>
                          <span
                            className={styles.status}
                            style={{ backgroundColor: getStatusColor(order.заявка_статус) }}
                          >
                            {order.заявка_статус}
                          </span>
                        </td>
                        <td>{formatDate(order.заявка_дата)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.noData}>Нет ожидающих заявок</p>
            )}
          </div>

          <div className={styles.section}>
            <h2>Ожидаемые поступления</h2>
            {pendingPurchases.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>№ Закупки</th>
                      <th>Поставщик</th>
                      <th>Количество</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Дата создания</th>
                      <th>Ожидаемая дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPurchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className={styles.clickableRow}
                        onClick={() => router.push(`/purchases/${purchase.закупка_номер}`)}
                      >
                        <td>#{purchase.закупка_номер}</td>
                        <td>{purchase.поставщик_название}</td>
                        <td>{purchase.количество} {item.товар_единица}</td>
                        <td>{formatCurrency(purchase.цена)}</td>
                        <td>{formatCurrency(purchase.количество * purchase.цена)}</td>
                        <td>
                          <span
                            className={styles.status}
                            style={{ backgroundColor: getStatusColor(purchase.закупка_статус) }}
                          >
                            {purchase.закупка_статус}
                          </span>
                        </td>
                        <td>{formatDate(purchase.закупка_дата)}</td>
                        <td>
                          {purchase.ожидаемая_дата 
                            ? formatDate(purchase.ожидаемая_дата)
                            : 'Нет данных'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.noData}>Нет ожидаемых поступлений</p>
            )}
          </div>

          <div className={styles.section}>
            <h2>История движений</h2>
            <div className={styles.movementsList}>
              {movements.map((movement) => (
                <div key={movement.id} className={styles.movementItem}>
                  <div className={styles.movementType}>
                    <span
                      className={styles.operationType}
                      style={{ color: getOperationTypeColor(movement.тип_операции) }}
                    >
                      {movement.тип_операции}
                    </span>
                  </div>
                  <div className={styles.movementDetails}>
                    <div className={styles.movementQuantity}>
                      {movement.тип_операции === 'поступление' ? '+' : '-'}
                      {Math.abs(movement.количество)} {item.товар_единица}
                    </div>
                    <div className={styles.movementDate}>
                      {formatDateTime(movement.дата_операции)}
                    </div>
                    {movement.заявка_номер && (
                      <div className={styles.movementRef}>
                        <Link href={`/orders/${movement.заявка_номер}`}>
                          Заявка #{movement.заявка_номер}
                        </Link>
                      </div>
                    )}
                    {movement.закупка_номер && (
                      <div className={styles.movementRef}>
                        <Link href={`/purchases/${movement.закупка_номер}`}>
                          Закупка #{movement.закупка_номер}
                        </Link>
                      </div>
                    )}
                    {movement.комментарий && (
                      <div className={styles.movementComment}>
                        {movement.комментарий}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modals */}
        {data?.item && (
          <EditProductModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onProductUpdated={handleProductUpdated}
            product={{
              id: data.item.товар_id,
              название: data.item.товар_название,
              артикул: data.item.товар_артикул,
              категория: data.item.товар_категория,
              единица_измерения: data.item.товар_единица,
              минимальный_остаток: data.item.товар_мин_остаток,
              цена_закупки: data.item.товар_цена_закупки,
              цена_продажи: data.item.товар_цена_продажи
            }}
          />
        )}

        {data?.item && (
          <DeleteConfirmation
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            order={{
              id: data.item.id,
              клиент_название: data.item.товар_название,
              общая_сумма: data.item.количество * data.item.товар_цена_продажи
            }}
          />
        )}
      </div>
    </Layout>
  );
}