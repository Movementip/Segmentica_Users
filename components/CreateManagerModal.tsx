import React, { useState } from 'react';
import styles from './Modal.module.css';

interface CreateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManagerCreated: () => void;
}

export function CreateManagerModal({ isOpen, onClose, onManagerCreated }: CreateManagerModalProps): JSX.Element {
  const [фио, setФио] = useState('');
  const [должность, setДолжность] = useState('');
  const [телефон, setТелефон] = useState('');
  const [email, setEmail] = useState('');
  const [ставка, setСтавка] = useState('');
  const [дата_приема, setДата_приема] = useState('');
  const [активен, setАктивен] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setФио('');
    setДолжность('');
    setТелефон('');
    setEmail('');
    setСтавка('');
    setДата_приема('');
    setАктивен(true);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!фио.trim()) {
      setError('ФИО обязательно');
      return;
    }
    
    if (!должность.trim()) {
      setError('Должность обязательна');
      return;
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Некорректный формат email');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          фио: фио.trim(),
          должность: должность.trim(),
          телефон: телефон.trim() || undefined,
          email: email.trim() || undefined,
          ставка: ставка ? parseFloat(ставка) : undefined,
          дата_приема: дата_приема || undefined,
          активен: активен
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания сотрудника');
      }

      resetForm();
      onManagerCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return <></>;
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Добавить нового сотрудника</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="фио">ФИО *</label>
            <input
              id="фио"
              type="text"
              value={фио}
              onChange={(e) => setФио(e.target.value)}
              placeholder="Введите ФИО сотрудника"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="должность">Должность *</label>
            <input
              id="должность"
              type="text"
              value={должность}
              onChange={(e) => setДолжность(e.target.value)}
              placeholder="Введите должность"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="телефон">Телефон</label>
            <input
              id="телефон"
              type="text"
              value={телефон}
              onChange={(e) => setТелефон(e.target.value)}
              placeholder="Введите номер телефона"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введите email"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="ставка">Ставка (руб.)</label>
            <input
              id="ставка"
              type="number"
              value={ставка}
              onChange={(e) => setСтавка(e.target.value)}
              placeholder="Введите ставку"
              step="0.01"
              min="0"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="дата_приема">Дата приема</label>
            <input
              id="дата_приема"
              type="date"
              value={дата_приема}
              onChange={(e) => setДата_приема(e.target.value)}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>
              <input
                type="checkbox"
                checked={активен}
                onChange={(e) => setАктивен(e.target.checked)}
              />
              Активен
            </label>
          </div>
          
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
          
          <div className={styles.actions}>
            <button 
              type="button" 
              onClick={handleClose}
              disabled={loading}
              className={styles.cancelButton}
            >
              Отмена
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className={styles.submitButton}
            >
              {loading ? 'Создание...' : 'Добавить сотрудника'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}