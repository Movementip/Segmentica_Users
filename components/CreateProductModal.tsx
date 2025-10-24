import React, { useState } from 'react';
import styles from './Modal.module.css';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: () => void;
}

export function CreateProductModal({ isOpen, onClose, onProductCreated }: CreateProductModalProps): JSX.Element {
  const [название, setНазвание] = useState('');
  const [артикул, setАртикул] = useState('');
  const [категория, setКатегория] = useState('');
  const [цена_закупки, setЦенаЗакупки] = useState('');
  const [цена_продажи, setЦенаПродажи] = useState('');
  const [единица_измерения, setЕдиницаИзмерения] = useState('шт');
  const [минимальный_остаток, setМинимальныйОстаток] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setНазвание('');
    setАртикул('');
    setКатегория('');
    setЦенаЗакупки('');
    setЦенаПродажи('');
    setЕдиницаИзмерения('шт');
    setМинимальныйОстаток('0');
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
      setError('Название товара обязательно');
      return;
    }
    
    if (!артикул.trim()) {
      setError('Артикул обязателен');
      return;
    }
    
    if (!цена_продажи || parseFloat(цена_продажи) <= 0) {
      setError('Цена продажи обязательна и должна быть больше 0');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          название: название.trim(),
          артикул: артикул.trim(),
          категория: категория.trim() || undefined,
          цена_закупки: цена_закупки ? parseFloat(цена_закупки) : undefined,
          цена_продажи: parseFloat(цена_продажи),
          единица_измерения: единица_измерения,
          минимальный_остаток: parseInt(минимальный_остаток) || 0
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания товара');
      }

      resetForm();
      onProductCreated();
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
          <h2>Добавить новый товар</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="название">Название *</label>
            <input
              id="название"
              type="text"
              value={название}
              onChange={(e) => setНазвание(e.target.value)}
              placeholder="Введите название товара"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="артикул">Артикул *</label>
            <input
              id="артикул"
              type="text"
              value={артикул}
              onChange={(e) => setАртикул(e.target.value)}
              placeholder="Введите артикул"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="категория">Категория</label>
            <input
              id="категория"
              type="text"
              value={категория}
              onChange={(e) => setКатегория(e.target.value)}
              placeholder="Введите категорию"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="цена_закупки">Цена закупки (руб.)</label>
            <input
              id="цена_закупки"
              type="number"
              value={цена_закупки}
              onChange={(e) => setЦенаЗакупки(e.target.value)}
              placeholder="Введите цену закупки"
              step="0.01"
              min="0"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="цена_продажи">Цена продажи (руб.) *</label>
            <input
              id="цена_продажи"
              type="number"
              value={цена_продажи}
              onChange={(e) => setЦенаПродажи(e.target.value)}
              placeholder="Введите цену продажи"
              step="0.01"
              min="0"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="единица_измерения">Единица измерения</label>
            <select
              id="единица_измерения"
              value={единица_измерения}
              onChange={(e) => setЕдиницаИзмерения(e.target.value)}
            >
              <option value="шт">шт</option>
              <option value="кг">кг</option>
              <option value="л">л</option>
              <option value="м">м</option>
              <option value="упак">упак</option>
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="минимальный_остаток">Минимальный остаток</label>
            <input
              id="минимальный_остаток"
              type="number"
              value={минимальный_остаток}
              onChange={(e) => setМинимальныйОстаток(e.target.value)}
              placeholder="Введите минимальный остаток"
              min="0"
            />
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
              {loading ? 'Создание...' : 'Добавить товар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}