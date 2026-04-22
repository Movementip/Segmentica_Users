import type { ReactNode } from "react"
import { FiCheck, FiRefreshCw, FiSave, FiTrash2 } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import styles from "./ManagerHrHeader.module.css"

type ManagerHrHeaderProps = {
  title: string
  subtitle: string
  saveStateLabel: string
  isActive: boolean
  extraActions?: ReactNode
  canSave: boolean
  canDelete: boolean
  saveDisabled: boolean
  saving: boolean
  onRefresh: () => void
  onSave: () => void
  onDelete: () => void
}

export function ManagerHrHeader({
  title,
  subtitle,
  saveStateLabel,
  isActive,
  extraActions,
  canSave,
  canDelete,
  saveDisabled,
  saving,
  onRefresh,
  onSave,
  onDelete,
}: ManagerHrHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.saveState}>
            <FiCheck className={styles.saveStateIcon} />
            <span>{saveStateLabel}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <Badge
            className={cn(
              styles.statusBadge,
              isActive ? styles.statusBadgeActive : styles.statusBadgeInactive
            )}
          >
            {isActive ? "Работает" : "Неактивен"}
          </Badge>

          {extraActions}

          <Button type="button" variant="outline" className={styles.button} onClick={onRefresh}>
            <FiRefreshCw className={styles.icon} />
            Обновить
          </Button>

          {canSave ? (
            <Button
              type="button"
              variant="default"
              className={styles.button}
              onClick={onSave}
              disabled={saveDisabled}
            >
              <FiSave className={styles.icon} />
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          ) : null}

          {canDelete ? (
            <Button type="button" variant="destructive" className={styles.button} onClick={onDelete}>
              <FiTrash2 className={styles.icon} />
              Удалить
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
