import React, { useState } from 'react';
import styles from './Modal.module.css';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: () => void;
}

export function CreateClientModal({ isOpen, onClose, onClientCreated }: CreateClientModalProps): JSX.Element {
  const [название, setНазвание] = useState('');
  const [телефон, setТелефон] = useState('');
  const [email, setEmail] = useState('');
  const [адрес, setАдрес] = useState('');
  const [тип, setТип] = useState('розничный');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setНазвание('');
    setТелефон('');
    setEmail('');
    setАдрес('');
    setТип('розничный');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!название.trim()) {
      setError('Название клиента обязательно');
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
      
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          название: название.trim(),
          телефон: телефон.trim() || undefined,
          email: email.trim() || undefined,
          адрес: адрес.trim() || undefined,
          тип: тип.trim() || 'розничный',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания клиента');
      }

      resetForm();
      onClientCreated();
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
          <h2>Добавить нового клиента</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="название">Название клиента *</label>
            <input
              id="название"
              type="text"
              value={название}
              onChange={(e) => setНазвание(e.target.value)}
              placeholder="Введите название клиента"
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
            <label htmlFor="адрес">Адрес</label>
            <textarea
              id="адрес"
              value={адрес}
              onChange={(e) => setАдрес(e.target.value)}
              placeholder="Введите адрес клиента"
              rows={3}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="тип">Тип клиента</label>
            <select
              id="тип"
              value={тип}
              onChange={(e) => setТип(e.target.value)}
            >
              <option value="розничный">Розничный</option>
              <option value="оптовый">Оптовый</option>
              <option value="корпоративный">Корпоративный</option>
            </select>
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
              {loading ? 'Создание...' : 'Добавить клиента'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}