import { FiEdit2, FiExternalLink, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi"

import type { Purchase } from "@/components/purchases/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./PurchaseRowActionsMenu.module.css"

type PurchaseRowActionsMenuProps = {
  purchase: Purchase
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canOpenOrder: boolean
  onOpenPurchase: (purchase: Purchase) => void
  onEditPurchase: (purchase: Purchase) => void | Promise<void>
  onOpenOrder: (purchase: Purchase) => void
  onDeletePurchase: (purchase: Purchase) => void
}

export function PurchaseRowActionsMenu({
  purchase,
  canView,
  canEdit,
  canDelete,
  canOpenOrder,
  onOpenPurchase,
  onEditPurchase,
  onOpenOrder,
  onDeletePurchase,
}: PurchaseRowActionsMenuProps) {
  const hasPrimaryActions = canView || canEdit || canOpenOrder

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
          <DropdownMenuItem onClick={() => onOpenPurchase(purchase)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => void onEditPurchase(purchase)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canOpenOrder ? (
          <DropdownMenuItem onClick={() => onOpenOrder(purchase)}>
            <FiExternalLink className={styles.rowMenuIcon} />
            Открыть заявку
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            {hasPrimaryActions ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className={styles.rowMenuItemDanger}
              onClick={() => onDeletePurchase(purchase)}
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
