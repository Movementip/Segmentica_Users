import {
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiSliders,
  FiTrash2,
} from "react-icons/fi"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WarehouseItem } from "@/types/pages/warehouse"

import styles from "./WarehouseRowActionsMenu.module.css"

type WarehouseRowActionsMenuProps = {
  item: WarehouseItem
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canStockAdjust: boolean
  onOpenItem: (item: WarehouseItem) => void
  onEditItem: (item: WarehouseItem) => void
  onAdjustStock: (item: WarehouseItem) => void
  onOpenHistory: (item: WarehouseItem) => void
  onDeleteItem: (item: WarehouseItem) => void
}

export function WarehouseRowActionsMenu({
  item,
  canView,
  canEdit,
  canDelete,
  canStockAdjust,
  onOpenItem,
  onEditItem,
  onAdjustStock,
  onOpenHistory,
  onDeleteItem,
}: WarehouseRowActionsMenuProps) {
  const hasAnyAction = canView || canEdit || canDelete || canStockAdjust

  if (!hasAnyAction) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={styles.menuButton}
            aria-label="Действия"
            title="Действия"
            onClick={(event) => event.stopPropagation()}
          />
        )}
      >
        <FiMoreHorizontal size={18} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6}>
        {canView ? (
          <DropdownMenuItem onClick={() => onOpenItem(item)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => onEditItem(item)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canStockAdjust ? (
          <DropdownMenuItem onClick={() => onAdjustStock(item)}>
            <FiSliders className={styles.rowMenuIcon} />
            Корректировка остатка
          </DropdownMenuItem>
        ) : null}

        {canView ? (
          <DropdownMenuItem onClick={() => onOpenHistory(item)}>
            <FiEye className={styles.rowMenuIcon} />
            История движений
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.rowMenuItemDanger}
              variant="destructive"
              onClick={() => onDeleteItem(item)}
            >
              <FiTrash2 className={styles.rowMenuIconDel} />
              Удалить
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
