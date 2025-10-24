import React, { useState, useEffect } from 'react';
import styles from './Modal.module.css';

interface Category {
  id: number;
  название: string;
  родительская_категория_id?: number;
}

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: () => void;
}

export function CreateCategoryModal({ isOpen, onClose, onCategoryCreated }: CreateCategoryModalProps): JSX.Element {
  const [название, setНазвание] = useState('');
  const [описание, setОписание] = useState('');
  const [родительская_категория_id, setРодительскаяКатегорияId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const resetForm = () => {
    setНазвание('');
    setОписание('');
    setРодительскаяКатегорияId('');
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
      setError('Название категории обязательно');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          название: название.trim(),
          описание: описание.trim() || undefined,
          родительская_категория_id: родительская_категория_id ? parseInt(родительская_категория_id) : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания категории');
      }

      resetForm();
      onCategoryCreated();
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
          <h2>Добавить новую категорию</h2>
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
              placeholder="Введите название категории"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="описание">Описание</label>
            <textarea
              id="описание"
              value={описание}
              onChange={(e) => setОписание(e.target.value)}
              placeholder="Введите описание категории"
              rows={3}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="родительская_категория_id">Родительская категория</label>
            <select
              id="родительская_категория_id"
              value={родительская_категория_id}
              onChange={(e) => setРодительскаяКатегорияId(e.target.value)}
            >
              <option value="">Основная категория</option>
              {categories
                .filter(category => !category.родительская_категория_id) // Only show top-level categories as parents
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.название}
                  </option>
                ))}
            </select>
            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
              Можно выбрать только основные категории в качестве родительских
            </small>
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
              {loading ? 'Создание...' : 'Добавить категорию'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}