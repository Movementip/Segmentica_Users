import { FiEdit2, FiEye, FiMoreHorizontal, FiShoppingCart, FiTrash2 } from "react-icons/fi"

import type { ClientContragent } from "@/lib/clientContragents"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./ClientRowActionsMenu.module.css"

type ClientRowActionsMenuProps = {
  client: ClientContragent
  canView: boolean
  canEdit: boolean
  canHistory: boolean
  canDelete: boolean
  onOpenClient: (client: ClientContragent) => void
  onEditClient: (client: ClientContragent) => void | Promise<void>
  onOpenHistory: (client: ClientContragent) => void
  onDeleteClient: (client: ClientContragent) => void
}

export function ClientRowActionsMenu({
  client,
  canView,
  canEdit,
  canHistory,
  canDelete,
  onOpenClient,
  onEditClient,
  onOpenHistory,
  onDeleteClient,
}: ClientRowActionsMenuProps) {
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
          <DropdownMenuItem onClick={() => onOpenClient(client)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => void onEditClient(client)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canHistory ? (
          <DropdownMenuItem onClick={() => onOpenHistory(client)}>
            <FiShoppingCart className={styles.rowMenuIcon} />
            История заказов
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.rowMenuItemDanger}
              onClick={() => onDeleteClient(client)}
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
