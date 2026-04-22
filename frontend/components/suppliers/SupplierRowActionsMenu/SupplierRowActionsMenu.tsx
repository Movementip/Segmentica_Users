import {
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiTrash2,
  FiTruck,
} from "react-icons/fi"

import type { Supplier } from "@/components/suppliers/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./SupplierRowActionsMenu.module.css"

type SupplierRowActionsMenuProps = {
  supplier: Supplier
  canDelete: boolean
  canEdit: boolean
  canShowOrdersHistory: boolean
  canView: boolean
  onDeleteSupplier: (supplier: Supplier) => void
  onEditSupplier: (supplier: Supplier) => void
  onOpenSupplier: (supplier: Supplier) => void
  onOpenSupplierOrdersHistory: (supplier: Supplier) => void
}

export function SupplierRowActionsMenu({
  supplier,
  canDelete,
  canEdit,
  canShowOrdersHistory,
  canView,
  onDeleteSupplier,
  onEditSupplier,
  onOpenSupplier,
  onOpenSupplierOrdersHistory,
}: SupplierRowActionsMenuProps) {
  const hasAnyAction = canView || canEdit || canShowOrdersHistory || canDelete

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
          <DropdownMenuItem onClick={() => onOpenSupplier(supplier)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => onEditSupplier(supplier)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canShowOrdersHistory ? (
          <DropdownMenuItem onClick={() => onOpenSupplierOrdersHistory(supplier)}>
            <FiTruck className={styles.rowMenuIcon} />
            История закупок
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            {(canView || canEdit || canShowOrdersHistory) ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant="destructive"
              className={styles.rowMenuItemDanger}
              onClick={() => onDeleteSupplier(supplier)}
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
