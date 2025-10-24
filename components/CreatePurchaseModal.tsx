import React, { useState, useEffect } from 'react';

interface Product {
  id: number;
  название: string;
  артикул: string;
  единица_измерения: string;
}

interface PurchasePosition {
  товар_id: number;
  количество: number;
  цена: number;
}

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseCreated: () => void;
  поставщик_id: number;
  поставщик_название: string;
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchaseCreated,
  поставщик_id,
  поставщик_название
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [формаДанные, setФормаДанные] = useState({
    статус: 'заказано',
    дата_поступления: ''
  });
  const [позиции, setПозиции] = useState<PurchasePosition[]>([
    { товар_id: 0, количество: 1, цена: 0 }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setФормаДанные(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePositionChange = (index: number, field: keyof PurchasePosition, value: string | number) => {
    const newPositions = [...позиции];
    newPositions[index] = {
      ...newPositions[index],
      [field]: typeof value === 'string' ? parseFloat(value) || 0 : value
    };
    setПозиции(newPositions);
  };

  const addPosition = () => {
    setПозиции([...позиции, { товар_id: 0, количество: 1, цена: 0 }]);
  };

  const removePosition = (index: number) => {
    if (позиции.length > 1) {
      setПозиции(позиции.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate positions
      const validPositions = позиции.filter(pos => pos.товар_id > 0 && pos.количество > 0 && pos.цена > 0);
      
      if (validPositions.length === 0) {
        throw new Error('Добавьте хотя бы одну позицию с корректными данными');
      }

      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          поставщик_id,
          статус: формаДанные.статус,
          дата_поступления: формаДанные.дата_поступления || null,
          позиции: validPositions
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания закупки');
      }

      onPurchaseCreated();
      onClose();
      // Reset form
      setФормаДанные({ статус: 'заказано', дата_поступления: '' });
      setПозиции([{ товар_id: 0, количество: 1, цена: 0 }]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const getTotalAmount = () => {
    return позиции.reduce((sum, pos) => sum + (pos.количество * pos.цена), 0);
  };

  if (!isOpen) return null;

  return (
    <div style={{
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
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 24px 0' }}>Создать закупку</h2>
        <p style={{ margin: '0 0 24px 0', color: '#666' }}>
          Поставщик: <strong>{поставщик_название}</strong>
        </p>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                Статус закупки:
              </label>
              <select
                name="статус"
                value={формаДанные.статус}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              >
                <option value="заказано">Заказано</option>
                <option value="в пути">В пути</option>
                <option value="получено">Получено</option>
                <option value="отменено">Отменено</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                Дата поступления (опционально):
              </label>
              <input
                type="datetime-local"
                name="дата_поступления"
                value={формаДанные.дата_поступления}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Позиции закупки</h3>
              <button
                type="button"
                onClick={addPosition}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Добавить позицию
              </button>
            </div>

            {позиции.map((position, index) => (
              <div key={index} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '4px', 
                padding: '16px', 
                marginBottom: '12px',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                      Товар:
                    </label>
                    <select
                      value={position.товар_id}
                      onChange={(e) => handlePositionChange(index, 'товар_id', parseInt(e.target.value))}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    >
                      <option value={0}>Выберите товар</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.артикул} - {product.название}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                      Количество:
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={position.количество}
                      onChange={(e) => handlePositionChange(index, 'количество', e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                      Цена за ед.:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={position.цена}
                      onChange={(e) => handlePositionChange(index, 'цена', e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removePosition(index)}
                    disabled={позиции.length === 1}
                    style={{
                      padding: '8px',
                      backgroundColor: позиции.length === 1 ? '#ccc' : '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: позиции.length === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    🗑️
                  </button>
                </div>

                {position.товар_id > 0 && position.количество > 0 && position.цена > 0 && (
                  <div style={{ marginTop: '8px', textAlign: 'right', fontWeight: '600', color: '#333' }}>
                    Сумма: {(position.количество * position.цена).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB'
                    })}
                  </div>
                )}
              </div>
            ))}

            <div style={{ textAlign: 'right', fontSize: '18px', fontWeight: 'bold', marginTop: '16px' }}>
              Общая сумма: {getTotalAmount().toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB'
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || getTotalAmount() === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: loading || getTotalAmount() === 0 ? '#ccc' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || getTotalAmount() === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Создание...' : 'Создать закупку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};