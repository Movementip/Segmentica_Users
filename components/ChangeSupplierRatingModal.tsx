import React, { useState } from 'react';

interface ChangeSupplierRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRatingChanged: () => void;
  поставщик_id: number;
  поставщик_название: string;
  текущий_рейтинг: number;
}

export const ChangeSupplierRatingModal: React.FC<ChangeSupplierRatingModalProps> = ({
  isOpen,
  onClose,
  onRatingChanged,
  поставщик_id,
  поставщик_название,
  текущий_рейтинг
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [новый_рейтинг, setНовый_рейтинг] = useState(текущий_рейтинг);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/suppliers/${поставщик_id}/actions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          рейтинг: новый_рейтинг
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка изменения рейтинга');
      }

      onRatingChanged();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const getRatingStars = (rating: number) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 5) return '#4caf50';
    if (rating >= 4) return '#ff9800';
    if (rating >= 3) return '#2196f3';
    return '#f44336';
  };

  const getRatingDescription = (rating: number) => {
    switch (rating) {
      case 1: return 'Очень плохо';
      case 2: return 'Плохо';
      case 3: return 'Удовлетворительно';
      case 4: return 'Хорошо';
      case 5: return 'Отлично';
      default: return '';
    }
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
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px 0' }}>Изменить рейтинг поставщика</h2>
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
            <div style={{ marginBottom: '12px' }}>
              <strong>Текущий рейтинг:</strong>
              <div style={{ 
                fontSize: '24px', 
                color: getRatingColor(текущий_рейтинг),
                margin: '8px 0'
              }}>
                {getRatingStars(текущий_рейтинг)} ({текущий_рейтинг}/5)
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                {getRatingDescription(текущий_рейтинг)}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Новый рейтинг:
            </label>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setНовый_рейтинг(rating)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: новый_рейтинг >= rating ? getRatingColor(rating) : '#f0f0f0',
                    color: новый_рейтинг >= rating ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    transition: 'all 0.2s'
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: '20px', 
                color: getRatingColor(новый_рейтинг),
                marginBottom: '4px'
              }}>
                {getRatingStars(новый_рейтинг)} ({новый_рейтинг}/5)
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                {getRatingDescription(новый_рейтинг)}
              </div>
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
              disabled={loading || новый_рейтинг === текущий_рейтинг}
              style={{
                padding: '10px 20px',
                backgroundColor: loading || новый_рейтинг === текущий_рейтинг ? '#ccc' : '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || новый_рейтинг === текущий_рейтинг ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Сохранение...' : 'Сохранить рейтинг'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};