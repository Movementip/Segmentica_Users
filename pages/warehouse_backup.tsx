import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Layout } from '../layout/Layout';
import { CreateProductModal } from '../components/CreateProductModal';
import { EditProductModal } from '../components/EditProductModal';
import DeleteConfirmation from '../components/DeleteConfirmation';
import styles from '../styles/Warehouse.module.css';

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
  товар_название: string;
  товар_артикул: string;
  заявка_номер: number | null;
  закупка_номер: number | null;
}

interface WarehouseData {
  warehouse: WarehouseItem[];
  movements: Movement[];
  lowStock: WarehouseItem[];
}

export default function Warehouse() {
  const [data, setData] = useState<WarehouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/warehouse');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
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

  // Use defensive programming to handle potential undefined data
  const filteredItems = data?.warehouse?.filter(item => {
    if (!item) return false;
    
    const matchesSearch = item.товар_название.toLowerCase().includes(search.toLowerCase()) ||
                         item.товар_артикул.toLowerCase().includes(search.toLowerCase());
    
    switch (filter) {
      case 'critical':
        return matchesSearch && item.stock_status === 'critical';
      case 'low':
        return matchesSearch && (item.stock_status === 'low' || item.stock_status === 'critical');
      case 'normal':
        return matchesSearch && item.stock_status === 'normal';
      default:
        return matchesSearch;
    }
  }) || [];

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
        <div className={styles.error}>Ошибка загрузки данных</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Склад</h1>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>{data?.warehouse?.length || 0}</span>
              <span className={styles.statLabel}>Всего товаров</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber} style={{ color: '#ff4444' }}>
                {data?.lowStock?.length || 0}
              </span>
              <span className={styles.statLabel}>Требуют пополнения</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>
                {data?.warehouse?.reduce((sum, item) => sum + (item?.количество || 0), 0) || 0}
              </span>
              <span className={styles.statLabel}>Общий остаток</span>
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Поиск по названию или артикулу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Все товары</option>
            <option value="critical">Критический остаток</option>
            <option value="low">Низкий остаток</option>
            <option value="normal">Нормальный остаток</option>
          </select>
        </div>

        <div className={styles.content}>
          <div className={styles.mainSection}>
            <h2>Остатки на складе</h2>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Артикул</th>
                    <th>Категория</th>
                    <th>Остаток</th>
                    <th>Мин. остаток</th>
                    <th>Статус</th>
                    <th>Последнее поступление</th>
                    <th>Цена закупки</th>
                    <th>Цена продажи</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={styles.clickableRow}
                      onClick={() => router.push(`/warehouse/${item.id}`)}
                    >
                      <td>{item.товар_название}</td>
                      <td>{item.товар_артикул}</td>
                      <td>{item.товар_категория}</td>
                      <td>
                        <span className={styles.quantity}>
                          {item.количество} {item.товар_единица}
                        </span>
                      </td>
                      <td>{item.товар_мин_остаток} {item.товар_единица}</td>
                      <td>
                        <span
                          className={styles.status}
                          style={{ backgroundColor: getStockStatusColor(item.stock_status) }}
                        >
                          {getStockStatusText(item.stock_status)}
                        </span>
                      </td>
                      <td>
                        {item.дата_последнего_поступления 
                          ? formatDate(item.дата_последнего_поступления)
                          : 'Нет данных'
                        }
                      </td>
                      <td>{formatCurrency(item.товар_цена_закупки)}</td>
                      <td>{formatCurrency(item.товар_цена_продажи)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <h3>Критические остатки</h3>
              {data?.lowStock && data.lowStock.length > 0 ? (
                <div className={styles.lowStockList}>
                  {data.lowStock.slice(0, 5).map((item) => (
                    <div key={item.id} className={styles.lowStockItem}>
                      <div className={styles.lowStockName}>{item.товар_название}</div>
                      <div className={styles.lowStockQuantity}>
                        <span style={{ color: getStockStatusColor(item.stock_status) }}>
                          {item.количество}/{item.товар_мин_остаток} {item.товар_единица}
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.lowStock.length > 5 && (
                    <div className={styles.moreItems}>
                      и еще {data.lowStock.length - 5} товаров...
                    </div>
                  )}
                </div>
              ) : (
                <p className={styles.noData}>Все товары в норме</p>
              )}
            </div>

            <div className={styles.sidebarSection}>
              <h3>Последние движения</h3>
              <div className={styles.movementsList}>
                {data?.movements?.slice(0, 10).map((movement) => (
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
                      <div className={styles.movementProduct}>
                        {movement.товар_название}
                      </div>
                      <div className={styles.movementQuantity}>
                        {movement.тип_операции === 'поступление' ? '+' : '-'}
                        {Math.abs(movement.количество)}
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
                    </div>
                  </div>
                )) || []}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}