import React, { useState, useEffect } from 'react';

interface Product {
  id: number;
  название: string;
  артикул: string;
  единица_измерения: string;
  категория?: string;
}

interface AddProductToSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdded: () => void;
  поставщик_id: number;
  поставщик_название: string;
}

export const AddProductToSupplierModal: React.FC<AddProductToSupplierModalProps> = ({
  isOpen,
  onClose,
  onProductAdded,
  поставщик_id,
  поставщик_название
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [формаДанные, setФормаДанные] = useState({
    товар_id: '',
    цена: '',
    срок_поставки: ''
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/suppliers/${поставщик_id}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          товар_id: parseInt(формаДанные.товар_id),
          цена: parseFloat(формаДанные.цена),
          срок_поставки: parseInt(формаДанные.срок_поставки)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка добавления товара');
      }

      onProductAdded();
      onClose();
      // Reset form
      setФормаДанные({
        товар_id: '',
        цена: '',
        срок_поставки: ''
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedProduct = products.find(p => p.id === parseInt(формаДанные.товар_id));

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
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px 0' }}>Добавить товар в ассортимент</h2>
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
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Товар: *
            </label>
            <select
              name="товар_id"
              value={формаДанные.товар_id}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="">Выберите товар</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.артикул} - {product.название}
                  {product.категория && ` (${product.категория})`}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div style={{
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '16px'
            }}>
              <strong>Выбранный товар:</strong>
              <div>Название: {selectedProduct.название}</div>
              <div>Артикул: {selectedProduct.артикул}</div>
              <div>Единица измерения: {selectedProduct.единица_измерения}</div>
              {selectedProduct.категория && <div>Категория: {selectedProduct.категория}</div>}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Цена за единицу (₽): *
            </label>
            <input
              type="number"
              name="цена"
              value={формаДанные.цена}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              required
              placeholder="Например: 1500.00"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Срок поставки (дни): *
            </label>
            <input
              type="number"
              name="срок_поставки"
              value={формаДанные.срок_поставки}
              onChange={handleInputChange}
              min="1"
              step="1"
              required
              placeholder="Например: 7"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Количество дней, за которое поставщик доставит товар
            </small>
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
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: loading ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Добавление...' : 'Добавить товар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};