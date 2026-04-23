import { AnimatePresence, motion } from "framer-motion"
import { FiEdit2, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi"

import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type { Manager } from "@/types/pages/managers"
import styles from "./ManagersTable.module.css"

const MotionTableRow = motion(TableRow)

type ManagersTableProps = {
  managers: Manager[]
  attachmentsTypesByManagerId: Record<number, string[]>
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  formatDate: (value?: string) => string
  onOpenManager: (manager: Manager) => void
  onEditManager: (manager: Manager) => void
  onDeleteManager: (manager: Manager) => void
}

export function ManagersTable({
  managers,
  attachmentsTypesByManagerId,
  canView,
  canEdit,
  canDelete,
  formatDate,
  onOpenManager,
  onEditManager,
  onDeleteManager,
}: ManagersTableProps) {
  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <colgroup>
        <col className={styles.colId} />
        <col className={styles.colName} />
        <col className={styles.colPosition} />
        <col className={styles.colHireDate} />
        <col className={styles.colContacts} />
        <col className={styles.colStatus} />
        <col className={styles.colActions} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>ФИО</TableHead>
          <TableHead>Должность</TableHead>
          <TableHead>Дата приёма</TableHead>
          <TableHead>Контакты</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {managers.map((manager) => (
            <MotionTableRow
              key={manager.id}
              className={cn(styles.tableRow, canView && styles.tableRowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={canView ? () => onOpenManager(manager) : undefined}
            >
              <TableCell className={styles.tableCell}>
                <div className={styles.idValue}>#{manager.id}</div>
                <div className={styles.attachmentWrap}>
                  <OrderAttachmentBadges
                    types={attachmentsTypesByManagerId[manager.id] || []}
                    reserveSpace
                  />
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.itemTitle}>{manager.фио}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.itemTitle}>{manager.должность}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.dateText}>{formatDate(manager.дата_приема)}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.contactsCell}>
                  <span className={styles.itemTitle}>{manager.телефон || "—"}</span>
                  {manager.email ? <span className={styles.itemSub}>{manager.email}</span> : null}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <EntityStatusBadge
                  value={manager.активен ? "Активен" : "Неактивен"}
                  label={manager.активен ? "Активен" : "Неактивен"}
                  tone={manager.активен ? "success" : "danger"}
                  compact
                />
              </TableCell>

              <TableCell className={styles.tableCell}>
                {canView || canEdit || canDelete ? (
                  <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => onOpenManager(manager)}>
                            <FiEye className={styles.rowMenuIcon} />
                            Просмотр
                          </DropdownMenuItem>
                        ) : null}
                        {canEdit ? (
                          <DropdownMenuItem onClick={() => onEditManager(manager)}>
                            <FiEdit2 className={styles.rowMenuIcon} />
                            Редактировать
                          </DropdownMenuItem>
                        ) : null}
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className={styles.rowMenuItemDanger} onClick={() => onDeleteManager(manager)}>
                              <FiTrash2 className={styles.rowMenuIconDel} />
                              Удалить
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}
              </TableCell>
            </MotionTableRow>
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
