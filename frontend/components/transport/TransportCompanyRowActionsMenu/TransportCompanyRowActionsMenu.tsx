import {
  FiArchive,
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiTrash2,
} from "react-icons/fi"

import type { TransportCompany } from "@/types/pages/transport"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import styles from "./TransportCompanyRowActionsMenu.module.css"

type TransportCompanyRowActionsMenuProps = {
  canDelete: boolean
  canEdit: boolean
  canStatsView: boolean
  canView: boolean
  company: TransportCompany
  onDeleteCompany: (company: TransportCompany) => void
  onEditCompany: (company: TransportCompany) => void
  onOpenCompany: (company: TransportCompany) => void
  onOpenStats: (company: TransportCompany) => void
}

export function TransportCompanyRowActionsMenu({
  canDelete,
  canEdit,
  canStatsView,
  canView,
  company,
  onDeleteCompany,
  onEditCompany,
  onOpenCompany,
  onOpenStats,
}: TransportCompanyRowActionsMenuProps) {
  const hasAnyAction = canView || canStatsView || canEdit || canDelete

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
          <DropdownMenuItem onClick={() => onOpenCompany(company)}>
            <FiEye className={styles.rowMenuIcon} />
            Просмотр
          </DropdownMenuItem>
        ) : null}

        {canStatsView ? (
          <DropdownMenuItem onClick={() => onOpenStats(company)}>
            <FiArchive className={styles.rowMenuIcon} />
            Статистика
          </DropdownMenuItem>
        ) : null}

        {canEdit ? (
          <DropdownMenuItem onClick={() => onEditCompany(company)}>
            <FiEdit2 className={styles.rowMenuIcon} />
            Редактировать
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            {(canView || canStatsView || canEdit) ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant="destructive"
              className={styles.rowMenuItemDanger}
              onClick={() => onDeleteCompany(company)}
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
