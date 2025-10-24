import { useState, useEffect } from 'react';
import styles from '../styles/Modal.module.css';

interface Product {
  id: number;
  название: string;
  артикул: string;
  категория: string;
  единица_измерения: string;
  минимальный_остаток: number;
  цена_закупки: number;
  цена_продажи: number;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: () => void;
  product: Product | null;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  onProductUpdated,
  product
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    название: '',
    артикул: '',
    категория: '',
    единица_измерения: '',
    минимальный_остаток: '',
    цена_закупки: '',
    цена_продажи: ''
  });

  useEffect(() => {
    if (product) {
      setFormData({
        название: product.название || '',
        артикул: product.артикул || '',
        категория: product.категория || '',
        единица_измерения: product.единица_измерения || '',
        минимальный_остаток: product.минимальный_остаток?.toString() || '0',
        цена_закупки: product.цена_закупки?.toString() || '0',
        цена_продажи: product.цена_продажи?.toString() || '0'
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/warehouse', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: product.id,
          название: formData.название,
          артикул: formData.артикул,
          категория: formData.категория,
          единица_измерения: formData.единица_измерения,
          минимальный_остаток: parseInt(formData.минимальный_остаток) || 0,
          цена_закупки: parseFloat(formData.цена_закупки) || 0,
          цена_продажи: parseFloat(formData.цена_продажи) || 0
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления товара');
      }

      onProductUpdated();
      handleClose();
    } catch (error: any) {
      console.error('Error updating product:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen || !product) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Редактировать товар</h2>
          <button onClick={handleClose} className={styles.closeButton}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="название">Название товара *</label>
            <input
              type="text"
              id="название"
              name="название"
              value={formData.название}
              onChange={handleInputChange}
              required
              placeholder="Введите название товара"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="артикул">Артикул *</label>
              <input
                type="text"
                id="артикул"
                name="артикул"
                value={formData.артикул}
                onChange={handleInputChange}
                required
                placeholder="Введите артикул"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="категория">Категория *</label>
              <input
                type="text"
                id="категория"
                name="категория"
                value={formData.категория}
                onChange={handleInputChange}
                required
                placeholder="Введите категорию"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="единица_измерения">Единица измерения *</label>
              <select
                id="единица_измерения"
                name="единица_измерения"
                value={formData.единица_измерения}
                onChange={handleInputChange}
                required
              >
                <option value="">Выберите единицу</option>
                <option value="шт">шт (штуки)</option>
                <option value="кг">кг (килограммы)</option>
                <option value="л">л (литры)</option>
                <option value="м">м (метры)</option>
                <option value="м²">м² (квадратные метры)</option>
                <option value="м³">м³ (кубические метры)</option>
                <option value="упак">упак (упаковки)</option>
                <option value="комп">комп (комплекты)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="минимальный_остаток">Минимальный остаток</label>
              <input
                type="number"
                id="минимальный_остаток"
                name="минимальный_остаток"
                value={formData.минимальный_остаток}
                onChange={handleInputChange}
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="цена_закупки">Цена закупки (₽)</label>
              <input
                type="number"
                id="цена_закупки"
                name="цена_закупки"
                value={formData.цена_закупки}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="цена_продажи">Цена продажи (₽)</label>
              <input
                type="number"
                id="цена_продажи"
                name="цена_продажи"
                value={formData.цена_продажи}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
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
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
