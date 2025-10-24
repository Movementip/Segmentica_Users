import React from 'react';
import styles from './DeleteConfirmation.module.css';

interface Order {
  id: number;
  клиент_название?: string;
  общая_сумма: number;
}

interface DeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  order: Order | null;
  loading?: boolean;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  order, 
  loading = false 
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Подтверждение удаления</h3>
        </div>
        
        <div className={styles.content}>
          <p>Вы уверены, что хотите удалить заявку?</p>
          <div className={styles.orderInfo}>
            <strong>Заявка #{order.id}</strong>
            {order.клиент_название && (
              <div>Клиент: {order.клиент_название}</div>
            )}
            <div>
              Сумма: {order.общая_сумма.toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB'
              })}
            </div>
          </div>
          <p className={styles.warning}>
            <strong>Внимание:</strong> Это действие нельзя отменить. Все данные заявки и связанные позиции будут удалены.
          </p>
        </div>
        
        <div className={styles.actions}>
          <button 
            type="button" 
            onClick={onClose} 
            className={styles.cancelButton}
            disabled={loading}
          >
            Отмена
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            className={styles.deleteButton}
            disabled={loading}
          >
            {loading ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmation;