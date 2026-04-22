import {
  FiActivity,
  FiCheckCircle,
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiPackage,
  FiShoppingCart,
  FiTrash2,
  FiTruck,
} from "react-icons/fi"

import type { Order } from "@/components/orders/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./OrderRowActionsMenu.module.css"

type OrderRowActionsMenuProps = {
  order: Order
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canCreatePurchase: boolean
  canAssemble: boolean
  canCreateShipment: boolean
  canComplete: boolean
  assembleLabel: string
  shipmentLabel: string
  onOpenOrder: (order: Order) => void
  onEditOrder: (order: Order) => void | Promise<void>
  onCreatePurchase: (order: Order) => void | Promise<void>
  onAssembleOrder: (order: Order) => void | Promise<void>
  onCreateShipment: (order: Order) => void
  onCompleteOrder: (order: Order) => void | Promise<void>
  onOpenWorkflow: (order: Order) => void | Promise<void>
  onDeleteOrder: (order: Order) => void
}

export function OrderRowActionsMenu({
  order,
  canView,
  canEdit,
  canDelete,
  canCreatePurchase,
  canAssemble,
  canCreateShipment,
  canComplete,
  assembleLabel,
  shipmentLabel,
  onOpenOrder,
  onEditOrder,
  onCreatePurchase,
  onAssembleOrder,
  onCreateShipment,
  onCompleteOrder,
  onOpenWorkflow,
  onDeleteOrder,
}: OrderRowActionsMenuProps) {
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
          <DropdownMenuItem onClick={() => onOpenOrder(order)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => void onEditOrder(order)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canCreatePurchase ? (
          <DropdownMenuItem onClick={() => void onCreatePurchase(order)}>
            <FiShoppingCart className={styles.rowMenuIcon} />
            Создать закупку
          </DropdownMenuItem>
        ) : null}

        {canAssemble ? (
          <DropdownMenuItem onClick={() => void onAssembleOrder(order)}>
            <FiPackage className={styles.rowMenuIcon} />
            {assembleLabel}
          </DropdownMenuItem>
        ) : null}

        {canCreateShipment ? (
          <DropdownMenuItem onClick={() => onCreateShipment(order)}>
            <FiTruck className={styles.rowMenuIcon} />
            {shipmentLabel}
          </DropdownMenuItem>
        ) : null}

        {canComplete ? (
          <DropdownMenuItem onClick={() => void onCompleteOrder(order)}>
            <FiCheckCircle className={styles.rowMenuIcon} />
            Завершить заявку
          </DropdownMenuItem>
        ) : null}

        {canView ? (
          <DropdownMenuItem onClick={() => void onOpenWorkflow(order)}>
            <FiActivity className={styles.rowMenuIcon} />
            Статус заявки
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.rowMenuItemDanger}
              onClick={() => onDeleteOrder(order)}
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
