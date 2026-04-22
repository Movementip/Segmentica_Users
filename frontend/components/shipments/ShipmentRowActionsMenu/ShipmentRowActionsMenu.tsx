import {
  FiEdit2,
  FiEye,
  FiFileText,
  FiMoreHorizontal,
  FiTrash2,
  FiTruck,
} from "react-icons/fi"

import type { Shipment } from "@/components/shipments/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./ShipmentRowActionsMenu.module.css"

type ShipmentRowActionsMenuProps = {
  canDelete: boolean
  canEdit: boolean
  canGoToOrder: boolean
  canPrint: boolean
  canTrack: boolean
  canView: boolean
  shipment: Shipment
  trackingEnabled: boolean
  onDeleteShipment: (shipment: Shipment) => void
  onEditShipment: (shipment: Shipment) => void | Promise<void>
  onOpenOrder: (shipment: Shipment) => void
  onOpenShipment: (shipment: Shipment) => void
  onPrintShipment: (shipment: Shipment) => void | Promise<void>
  onTrackShipment: (shipment: Shipment) => void
}

export function ShipmentRowActionsMenu({
  canDelete,
  canEdit,
  canGoToOrder,
  canPrint,
  canTrack,
  canView,
  shipment,
  trackingEnabled,
  onDeleteShipment,
  onEditShipment,
  onOpenOrder,
  onOpenShipment,
  onPrintShipment,
  onTrackShipment,
}: ShipmentRowActionsMenuProps) {
  const hasMainActions = canView || canGoToOrder || canTrack || canEdit || canPrint

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
          <DropdownMenuItem onClick={() => onOpenShipment(shipment)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canGoToOrder ? (
          <DropdownMenuItem onClick={() => onOpenOrder(shipment)}>
            <FiEye className={styles.rowMenuIcon} />
            Перейти к заявке
          </DropdownMenuItem>
        ) : null}

        {canTrack ? (
          <DropdownMenuItem disabled={!trackingEnabled} onClick={() => onTrackShipment(shipment)}>
            <FiTruck className={styles.rowMenuIcon} />
            Отследить груз
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => void onEditShipment(shipment)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canPrint ? (
          <DropdownMenuItem onClick={() => void onPrintShipment(shipment)}>
            <FiFileText className={styles.rowMenuIcon} />
            Печать
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            {hasMainActions ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant="destructive"
              className={styles.rowMenuItemDanger}
              onClick={() => onDeleteShipment(shipment)}
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
