import React, { useState, useEffect } from 'react';
import styles from './CreateOrderModal.module.css';

interface Client {
  id: number;
  название: string;
}

interface Manager {
  id: number;
  фио: string;
  должность?: string;
}

interface Product {
  id: number;
  название: string;
  цена: number;
  артикул?: string;
}

interface OrderPosition {
  id?: number;
  товар_id: number;
  количество: number;
  цена: number;
}

interface Order {
  id: number;
  клиент_id: number;
  менеджер_id?: number;
  адрес_доставки?: string;
  статус: string;
}

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: any) => void;
  order: Order | null;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({ isOpen, onClose, onSubmit, order }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | ''>('');
  const [selectedManager, setSelectedManager] = useState<number | ''>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [status, setStatus] = useState('');
  const [positions, setPositions] = useState<OrderPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      loadClients();
      loadManagers();
      loadProducts();
      loadOrderData();
    }
  }, [isOpen, order]);

  const loadClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadManagers = async () => {
    try {
      const response = await fetch('/api/managers');
      if (response.ok) {
        const data = await response.json();
        setManagers(data);
      }
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadOrderData = async () => {
    if (!order) return;

    setSelectedClient(order.клиент_id);
    setSelectedManager(order.менеджер_id || '');
    setDeliveryAddress(order.адрес_доставки || '');
    setStatus(order.статус);

    // Load order positions
    try {
      const response = await fetch(`/api/orders/${order.id}/positions`);
      if (response.ok) {
        const positionsData = await response.json();
        setPositions(positionsData.map((pos: any) => ({
          id: pos.id,
          товар_id: pos.товар_id,
          количество: pos.количество,
          цена: pos.цена
        })));
      }
    } catch (error) {
      console.error('Error loading order positions:', error);
    }
  };

  const addPosition = () => {
    setPositions([...positions, { товар_id: 0, количество: 1, цена: 0 }]);
  };

  const updatePosition = (index: number, field: keyof OrderPosition, value: number) => {
    const updatedPositions = positions.map((pos, i) => {
      if (i === index) {
        const updatedPos = { ...pos, [field]: value };
        // Auto-update price when product is selected
        if (field === 'товар_id') {
          const product = products.find(p => p.id === value);
          if (product) {
            updatedPos.цена = product.цена;
          }
        }
        return updatedPos;
      }
      return pos;
    });
    setPositions(updatedPositions);
  };

  const removePosition = (index: number) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedClient) {
      setError('Выберите клиента');
      return;
    }

    if (positions.length === 0) {
      setError('Добавьте хотя бы одну позицию');
      return;
    }

    const invalidPositions = positions.filter(pos => !pos.товар_id || pos.количество <= 0 || pos.цена <= 0);
    if (invalidPositions.length > 0) {
      setError('Заполните все поля позиций корректно');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        id: order?.id,
        клиент_id: selectedClient,
        менеджер_id: selectedManager || null,
        адрес_доставки: deliveryAddress || null,
        статус: status,
        позиции: positions
      };

      await onSubmit(orderData);
      handleClose();
    } catch (error) {
      setError('Ошибка обновления заявки');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedClient('');
    setSelectedManager('');
    setDeliveryAddress('');
    setStatus('');
    setPositions([]);
    setError('');
    onClose();
  };

  const getTotalAmount = () => {
    return positions.reduce((sum, pos) => sum + (pos.количество * pos.цена), 0);
  };

  if (!isOpen || !order) return null;

  const statusOptions = [
    { value: 'новая', label: 'Новая' },
    { value: 'в_обработке', label: 'В обработке' },
    { value: 'подтверждена', label: 'Подтверждена' },
    { value: 'выполнена', label: 'Выполнена' },
    { value: 'отменена', label: 'Отменена' }
  ];

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Редактировать заявку #{order.id}</h2>
          <button className={styles.closeButton} onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Клиент *</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(Number(e.target.value) || '')}
              required
            >
              <option value="">Выберите клиента</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.название}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Менеджер</label>
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(Number(e.target.value) || '')}
            >
              <option value="">Выберите менеджера</option>
              {managers.map(manager => (
                <option key={manager.id} value={manager.id}>
                  {manager.фио} {manager.должность && `(${manager.должность})`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Статус *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Адрес доставки</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Введите адрес доставки"
            />
          </div>

          <div className={styles.positionsSection}>
            <div className={styles.positionsHeader}>
              <h3>Позиции заявки</h3>
              <button type="button" onClick={addPosition} className={styles.addButton}>
                + Добавить позицию
              </button>
            </div>

            {positions.map((position, index) => (
              <div key={index} className={styles.positionRow}>
                <select
                  value={position.товар_id}
                  onChange={(e) => updatePosition(index, 'товар_id', Number(e.target.value))}
                  required
                >
                  <option value="">Выберите товар</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.артикул ? `${product.артикул} - ` : ''}{product.название}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={position.количество}
                  onChange={(e) => updatePosition(index, 'количество', Number(e.target.value))}
                  placeholder="Кол-во"
                  min="1"
                  required
                />

                <input
                  type="number"
                  value={position.цена}
                  onChange={(e) => updatePosition(index, 'цена', Number(e.target.value))}
                  placeholder="Цена"
                  min="0"
                  step="0.01"
                  required
                />

                <span className={styles.positionTotal}>
                  {(position.количество * position.цена).toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB'
                  })}
                </span>

                <button
                  type="button"
                  onClick={() => removePosition(index)}
                  className={styles.removeButton}
                >
                  ×
                </button>
              </div>
            ))}

            {positions.length > 0 && (
              <div className={styles.totalAmount}>
                <strong>
                  Общая сумма: {getTotalAmount().toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB'
                  })}
                </strong>
              </div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.modalActions}>
            <button type="button" onClick={handleClose} className={styles.cancelButton}>
              Отмена
            </button>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditOrderModal;