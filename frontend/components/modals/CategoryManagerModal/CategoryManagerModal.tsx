import React, { useState, useEffect } from 'react';
import styles from '../shared/Modal.module.css';

interface Category {
  id: number;
  название: string;
  описание?: string;
  родительская_категория_id?: number;
  активна: boolean;
  created_at: string;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesUpdated
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

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
      } else {
        setError('Ошибка загрузки категорий');
      }
    } catch (error) {
      setError('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsAdding(true);
    setError(null);

    const categoryData = {
      название: newCategoryName.trim(),
      описание: newCategoryDescription.trim() || null,
      родительская_категория_id: parentCategoryId ? parseInt(parentCategoryId) : null
    };

    console.log('Creating category with data:', categoryData);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData),
      });

      if (response.ok) {
        await fetchCategories();
        setNewCategoryName('');
        setNewCategoryDescription('');
        setParentCategoryId('');
        onCategoriesUpdated();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Category creation error:', errorData);
        setError(errorData.error || `Ошибка создания категории (${response.status})`);
      }
    } catch (error) {
      console.error('Network error:', error);
      setError('Ошибка сети: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return;

    try {
      const response = await fetch(`/api/categories?id=${categoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCategories();
        onCategoriesUpdated();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Ошибка удаления категории');
      }
    } catch (error) {
      alert('Ошибка удаления категории');
    }
  };

  const getCategoryHierarchy = (category: Category) => {
    const parent = categories.find(cat => cat.id === category.родительская_категория_id);
    return parent ? `${parent.название} → ${category.название}` : category.название;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: '600px', maxHeight: '80vh' }}>
        <div className={styles.modalHeader}>
          <h2>Управление категориями</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        <div className={styles.modalForm} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Add new category form */}
          <form onSubmit={handleAddCategory} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Добавить новую категорию</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="categoryName">Название категории *</label>
              <input
                type="text"
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
                placeholder="Введите название категории"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="categoryDescription">Описание</label>
              <input
                type="text"
                id="categoryDescription"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Описание категории (необязательно)"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="parentCategory">Родительская категория</label>
              <select
                id="parentCategory"
                value={parentCategoryId}
                onChange={(e) => setParentCategoryId(e.target.value)}
              >
                <option value="">Нет (основная категория)</option>
                {categories.filter(cat => !cat.родительская_категория_id).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.название}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isAdding || !newCategoryName.trim()}
              style={{ marginTop: '10px' }}
            >
              {isAdding ? 'Добавление...' : 'Добавить категорию'}
            </button>
          </form>

          {/* Categories list */}
          <div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Существующие категории</h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Загрузка категорий...
              </div>
            ) : categories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Категории не найдены
              </div>
            ) : (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 15px',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {getCategoryHierarchy(category)}
                      </div>
                      {category.описание && (
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {category.описание}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      style={{
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className={styles.errorMessage} style={{ marginTop: '15px' }}>
              {error}
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button
            onClick={onClose}
            className={styles.cancelButton}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};