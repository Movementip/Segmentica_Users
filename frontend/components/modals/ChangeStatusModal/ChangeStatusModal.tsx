import React, { useState } from 'react';
import { getEntityStatusAppearance } from '@/lib/entityStatuses';

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: () => void;
  purchase_id: number;
  current_status: string;
}

export const ChangeStatusModal: React.FC<ChangeStatusModalProps> = ({
  isOpen,
  onClose,
  onStatusChanged,
  purchase_id,
  current_status
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [новый_статус, setНовый_статус] = useState(current_status);
  const [дата_поступления, setДата_поступления] = useState('');

  const statusOptions = [
    { value: 'заказано', label: 'Заказано', icon: '📋' },
    { value: 'в пути', label: 'В пути', icon: '🚚' },
    { value: 'получено', label: 'Получено', icon: '✅' },
    { value: 'отменено', label: 'Отменено', icon: '❌' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const requestBody: any = { статус: новый_статус };
      
      if (дата_поступления) {
        requestBody.дата_поступления = дата_поступления;
      }

      const response = await fetch(`/api/purchases/${purchase_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка изменения статуса');
      }

      onStatusChanged();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status) || statusOptions[0];
    const appearance = getEntityStatusAppearance(option.value);
    return {
      ...option,
      color: appearance?.light || '#9e9e9e',
    };
  };

  if (!isOpen) return null;

  const currentStatusInfo = getStatusInfo(current_status);
  const newStatusInfo = getStatusInfo(новый_статус);

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
        <h2 style={{ margin: '0 0 16px 0' }}>Изменить статус закупки</h2>
        <p style={{ margin: '0 0 24px 0', color: '#666' }}>
          Закупка: <strong>#{purchase_id}</strong>
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
            <div style={{ marginBottom: '12px' }}>
              <strong>Текущий статус:</strong>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: currentStatusInfo.color + '20',
                color: currentStatusInfo.color,
                borderRadius: '4px',
                margin: '8px 0',
                fontWeight: '600'
              }}>
                <span>{currentStatusInfo.icon}</span>
                {currentStatusInfo.label}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Новый статус:
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {statusOptions.map((option) => {
                const optionInfo = getStatusInfo(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setНовый_статус(option.value)}
                    style={{
                      padding: '12px',
                      backgroundColor: новый_статус === option.value ? optionInfo.color : '#f0f0f0',
                      color: новый_статус === option.value ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>{option.icon}</span>
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: newStatusInfo.color + '20',
              color: newStatusInfo.color,
              borderRadius: '4px',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              Выбранный статус: {newStatusInfo.icon} {newStatusInfo.label}
            </div>
          </div>

          {новый_статус === 'получено' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                Дата поступления (опционально):
              </label>
              <input
                type="datetime-local"
                value={дата_поступления}
                onChange={(e) => setДата_поступления(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                Если не указано, будет использовано текущее время
              </small>
            </div>
          )}

          {новый_статус === 'получено' && current_status !== 'получено' && (
            <div style={{
              padding: '12px',
              backgroundColor: '#e8f5e8',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              <strong>📦 Важно:</strong> При изменении статуса на &quot;Получено&quot; товары будут автоматически добавлены на склад.
            </div>
          )}

          {current_status === 'получено' && новый_статус !== 'получено' && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fff3e0',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              <strong>⚠️ Внимание:</strong> При изменении статуса с &quot;Получено&quot; товары будут удалены со склада (если достаточно количества).
            </div>
          )}

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
              disabled={loading || новый_статус === current_status}
              style={{
                padding: '10px 20px',
                backgroundColor: loading || новый_статус === current_status ? '#ccc' : newStatusInfo.color,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || новый_статус === current_status ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Сохранение...' : 'Изменить статус'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
