import { FiEye, FiMoreHorizontal } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./TransportShipmentRowActionsMenu.module.css"

type TransportShipmentRowActionsMenuProps = {
  onOpenOrder: () => void
}

export function TransportShipmentRowActionsMenu({
  onOpenOrder,
}: TransportShipmentRowActionsMenuProps) {
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
        <DropdownMenuItem onClick={onOpenOrder}>
          <FiEye className={styles.rowMenuIcon} />
          Открыть заявку
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
