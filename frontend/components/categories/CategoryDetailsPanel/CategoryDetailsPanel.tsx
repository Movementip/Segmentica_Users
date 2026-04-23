import type { ReactNode } from "react"
import { FiEdit3, FiExternalLink, FiSlash, FiTrash2 } from "react-icons/fi"

import type { Category } from "@/types/pages/categories"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import styles from "./CategoryDetailsPanel.module.css"

type CategoryDetailsPanelProps = {
  category: Category | null
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canDisable: boolean
  formatDate: (dateString: string) => string
  onOpenCategory: (category: Category) => void
  onEditCategory: (category: Category) => void
  onToggleCategoryActive: (category: Category) => void
  onDeleteCategory: (category: Category) => void
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className={styles.detailRow}>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.detailValue}>{value}</div>
    </div>
  )
}

export function CategoryDetailsPanel({
  category,
  canView,
  canEdit,
  canDelete,
  canDisable,
  formatDate,
  onOpenCategory,
  onEditCategory,
  onToggleCategoryActive,
  onDeleteCategory,
}: CategoryDetailsPanelProps) {
  return (
    <aside className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Детали категории</h2>
        <p className={styles.description}>
          Выберите узел на карте, чтобы посмотреть детали и действия.
        </p>
      </div>

      {category ? (
        <div className={styles.body}>
          <div className={styles.hero}>
            <div className={styles.heroTitle}>{category.название}</div>
            <div className={styles.heroMeta}>
              <Badge
                variant="outline"
                className={cn(
                  styles.statusBadge,
                  category.активна ? styles.activeBadge : styles.inactiveBadge
                )}
              >
                {category.активна ? "Активна" : "Неактивна"}
              </Badge>
              <span className={styles.heroId}>ID #{category.id}</span>
            </div>
          </div>

          <div className={styles.details}>
            <DetailRow
              label="Родитель"
              value={category.родительская_категория_название || "Корневая категория"}
            />
            <DetailRow label="Дата создания" value={formatDate(category.created_at)} />
            <DetailRow label="Описание" value={category.описание || "Не указано"} />
          </div>

          <div className={styles.actions}>
            {canView ? (
              <Button
                type="button"
                variant="outline"
                className={styles.actionButton}
                onClick={() => onOpenCategory(category)}
              >
                <FiExternalLink />
                Открыть категорию
              </Button>
            ) : null}

            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                className={styles.actionButton}
                onClick={() => onEditCategory(category)}
              >
                <FiEdit3 />
                Редактировать
              </Button>
            ) : null}

            {canDisable ? (
              <Button
                type="button"
                variant="outline"
                className={styles.actionButton}
                onClick={() => onToggleCategoryActive(category)}
              >
                <FiSlash />
                {category.активна ? "Отключить" : "Включить"}
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                className={styles.deleteButton}
                onClick={() => onDeleteCategory(category)}
              >
                <FiTrash2 />
                Удалить
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Ничего не выбрано</div>
          <div className={styles.emptyText}>
            Кликните по узлу на древе, чтобы увидеть подробности категории.
          </div>
        </div>
      )}
    </aside>
  )
}
