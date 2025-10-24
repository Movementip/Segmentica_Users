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
  товар_id: number;
  количество: number;
  цена: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: any) => void;
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | ''>('');
  const [selectedManager, setSelectedManager] = useState<number | ''>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [positions, setPositions] = useState<OrderPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadClients();
      loadManagers();
      loadProducts();
    }
  }, [isOpen]);

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

  const addPosition = () => {
    setPositions([...positions, { товар_id: 0, количество: 1, цена: 0 }]);
  };

  const updatePosition = (index: number, field: keyof OrderPosition, value: number) => {
    const updatedPositions = positions.map((pos, i) => {
      if (i === index) {
        const updatedPos = { ...pos, [field]: value };
        // Auto-update price when product is selected (use the selling price from database)
        if (field === 'товар_id') {
          const product = products.find(p => p.id === value);
          if (product) {
            updatedPos.цена = product.цена; // Use the selling price from database
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

    const invalidPositions = positions.filter(pos => {
      if (!pos.товар_id || pos.количество <= 0 || pos.цена <= 0) {
        return true;
      }
      // Check if price is at least 90% of the base price
      const product = products.find(p => p.id === pos.товар_id);
      if (product && pos.цена < product.цена * 0.9) {
        return true;
      }
      return false;
    });
    if (invalidPositions.length > 0) {
      setError('Заполните все поля позиций корректно. Цена не может быть ниже 90% от базовой цены');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        клиент_id: selectedClient,
        менеджер_id: selectedManager || null,
        адрес_доставки: deliveryAddress || null,
        позиции: positions
      };

      console.log('Sending order data:', orderData); // Debug log
      await onSubmit(orderData);
      handleClose();
    } catch (error) {
      console.error('Error in CreateOrderModal:', error); // Debug log
      setError('Ошибка создания заявки: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedClient('');
    setSelectedManager('');
    setDeliveryAddress('');
    setPositions([]);
    setError('');
    onClose();
  };

  const getTotalAmount = () => {
    return positions.reduce((sum, pos) => sum + (pos.количество * pos.цена), 0);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Создать новую заявку</h2>
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

            {positions.map((position, index) => {
              const selectedProduct = products.find(p => p.id === position.товар_id);
              const minPrice = selectedProduct ? selectedProduct.цена * 0.9 : 0;
              
              return (
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

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input
                    type="number"
                    value={position.цена}
                    onChange={(e) => updatePosition(index, 'цена', Number(e.target.value))}
                    placeholder="Цена"
                    min="0"
                    step="0.01"
                    required
                    style={{
                      borderColor: selectedProduct && position.цена < minPrice ? '#dc3545' : '#ddd'
                    }}
                  />
                  {selectedProduct && (
                    <small style={{ 
                      color: position.цена < minPrice ? '#dc3545' : '#666',
                      fontSize: '11px',
                      marginTop: '2px'
                    }}>
                      Мин: {minPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                    </small>
                  )}
                </div>

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
              );
            })}

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
              {loading ? 'Создание...' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderModal;