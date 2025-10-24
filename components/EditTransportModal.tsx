import React, { useState, useEffect } from 'react';

interface TransportCompany {
  id: number;
  название: string;
  телефон: string | null;
  email: string | null;
  тариф: number | null;
}

interface EditTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransportUpdated: () => void;
  company: TransportCompany;
}

export const EditTransportModal: React.FC<EditTransportModalProps> = ({
  isOpen,
  onClose,
  onTransportUpdated,
  company
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [формаДанные, setФормаДанные] = useState({
    название: '',
    телефон: '',
    email: '',
    тариф: ''
  });

  // Initialize form with company data when modal opens
  useEffect(() => {
    if (isOpen && company) {
      setФормаДанные({
        название: company.название || '',
        телефон: company.телефон || '',
        email: company.email || '',
        тариф: company.тариф ? company.тариф.toString() : ''
      });
      setError(null);
    }
  }, [isOpen, company]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setФормаДанные(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!формаДанные.название.trim()) {
      setError('Название компании обязательно');
      return false;
    }

    if (формаДанные.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(формаДанные.email)) {
      setError('Некорректный формат email');
      return false;
    }

    if (формаДанные.тариф && isNaN(parseFloat(формаДанные.тариф))) {
      setError('Тариф должен быть числом');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const requestBody = {
        название: формаДанные.название.trim(),
        телефон: формаДанные.телефон.trim() || null,
        email: формаДанные.email.trim() || null,
        тариф: формаДанные.тариф ? parseFloat(формаДанные.тариф) : null
      };

      const response = await fetch(`/api/transport/${company.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления информации о компании');
      }

      onTransportUpdated();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setФормаДанные({
      название: company.название || '',
      телефон: company.телефон || '',
      email: company.email || '',
      тариф: company.тариф ? company.тариф.toString() : ''
    });
    setError(null);
    onClose();
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
    }} onClick={handleCancel}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px 0' }}>Редактировать информацию о компании</h2>
        <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '14px' }}>
          Изменение сведений о транспортной компании
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
              Название компании: *
            </label>
            <input
              type="text"
              name="название"
              value={формаДанные.название}
              onChange={handleInputChange}
              required
              placeholder="Например: Деловые линии"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Телефон:
            </label>
            <input
              type="tel"
              name="телефон"
              value={формаДанные.телефон}
              onChange={handleInputChange}
              placeholder="Например: 88001234567"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Email:
            </label>
            <input
              type="email"
              name="email"
              value={формаДанные.email}
              onChange={handleInputChange}
              placeholder="Например: info@company.ru"
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
              Тариф за доставку (₽):
            </label>
            <input
              type="number"
              name="тариф"
              value={формаДанные.тариф}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              placeholder="Например: 50.00"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Базовый тариф за единицу доставки
            </small>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCancel}
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
              disabled={loading || !формаДанные.название.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor: loading || !формаДанные.название.trim() ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || !формаДанные.название.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};