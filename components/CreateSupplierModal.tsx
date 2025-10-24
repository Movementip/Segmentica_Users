import React, { useState } from 'react';
import styles from '../styles/Modal.module.css';

interface CreateSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierCreated: () => void;
}

export const CreateSupplierModal: React.FC<CreateSupplierModalProps> = ({
  isOpen,
  onClose,
  onSupplierCreated
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    название: '',
    телефон: '',
    email: '',
    рейтинг: '5'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          название: formData.название,
          телефон: formData.телефон || null,
          email: formData.email || null,
          рейтинг: parseInt(formData.рейтинг) || 5
        }),
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Ошибка обработки ответа сервера');
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'Ошибка создания поставщика');
      }

      console.log('Supplier created successfully:', responseData);
      onSupplierCreated();
      handleClose();
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      setError(error.message || 'Неизвестная ошибка при создании поставщика');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setFormData({
      название: '',
      телефон: '',
      email: '',
      рейтинг: '5'
    });
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Добавить нового поставщика</h2>
          <button onClick={handleClose} className={styles.closeButton}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="название">Название компании *</label>
            <input
              type="text"
              id="название"
              name="название"
              value={formData.название}
              onChange={handleInputChange}
              required
              placeholder="Введите название компании"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="телефон">Телефон</label>
              <input
                type="tel"
                id="телефон"
                name="телефон"
                value={formData.телефон}
                onChange={handleInputChange}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="info@company.com"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="рейтинг">Рейтинг</label>
            <select
              id="рейтинг"
              name="рейтинг"
              value={formData.рейтинг}
              onChange={handleInputChange}
            >
              <option value="5">5 ★★★★★ (Отличный)</option>
              <option value="4">4 ★★★★☆ (Хороший)</option>
              <option value="3">3 ★★★☆☆ (Удовлетворительный)</option>
              <option value="2">2 ★★☆☆☆ (Плохой)</option>
              <option value="1">1 ★☆☆☆☆ (Очень плохой)</option>
            </select>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Создание...' : 'Добавить поставщика'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};