import { AnimatePresence, motion } from "framer-motion"
import {
  FiEdit2,
  FiMoreHorizontal,
  FiShoppingCart,
  FiTrash2,
} from "react-icons/fi"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import type { MissingProduct } from "@/types/pages/missing-products"
import {
  getMissingProductDeficitPercentage,
  getMissingProductStatusLabel,
} from "@/lib/missingProductsMeta"
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

import styles from "./MissingProductsTable.module.css"

const MotionTableRow = motion(TableRow)

type MissingProductsTableProps = {
  canDelete: boolean
  canEdit: boolean
  canGoToOrder: boolean
  hasRowActions: boolean
  items: MissingProduct[]
  onDeleteItem: (item: MissingProduct) => void
  onEditItem: (item: MissingProduct) => void
  onOpenOrder: (item: MissingProduct) => void
}

export function MissingProductsTable({
  canDelete,
  canEdit,
  canGoToOrder,
  hasRowActions,
  items,
  onDeleteItem,
  onEditItem,
  onOpenOrder,
}: MissingProductsTableProps) {
  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <colgroup>
        <col className={styles.colId} />
        <col className={styles.colOrder} />
        <col className={styles.colProduct} />
        <col className={styles.colQuantity} />
        <col className={styles.colQuantity} />
        <col className={styles.colDeficit} />
        <col className={styles.colStatus} />
        <col className={styles.colActions} />
      </colgroup>

      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Заявка</TableHead>
          <TableHead>Товар</TableHead>
          <TableHead className={styles.textRight}>Необходимо</TableHead>
          <TableHead className={styles.textRight}>Недостаёт</TableHead>
          <TableHead className={styles.textRight}>Дефицит</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className={styles.actionsHeader} />
        </TableRow>
      </TableHeader>

      <TableBody>
        <AnimatePresence>
          {items.map((item) => (
            <MotionTableRow
              key={item.id}
              className={styles.tableRow}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TableCell className={styles.tableCell}>
                <span className={styles.itemId}>#{item.id}</span>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <span className={styles.orderLink}>Заявка #{item.заявка_id}</span>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.itemTitle}>
                  {item.товар_название || `Товар #${item.товар_id}`}
                </div>
                <div className={styles.itemSub}>
                  {item.товар_артикул || "Артикул не указан"}
                </div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <span className={styles.numericValue}>
                  {item.необходимое_количество.toLocaleString("ru-RU")}
                </span>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <span className={styles.missingValue}>
                  {item.недостающее_количество.toLocaleString("ru-RU")}
                </span>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <span className={styles.percentValue}>
                  {getMissingProductDeficitPercentage(item)}%
                </span>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <EntityStatusBadge
                  value={item.статус}
                  label={getMissingProductStatusLabel(item.статус)}
                  compact
                />
              </TableCell>

              <TableCell className={styles.tableCell}>
                {hasRowActions ? (
                  <div
                    className={styles.actionsCell}
                    onClick={(event) => event.stopPropagation()}
                  >
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
                          />
                        )}
                      >
                        <FiMoreHorizontal size={18} />
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" sideOffset={6}>
                        {canEdit ? (
                          <DropdownMenuItem onClick={() => onEditItem(item)}>
                            <FiEdit2 className={styles.rowMenuIcon} />
                            Редактировать
                          </DropdownMenuItem>
                        ) : null}

                        {canGoToOrder ? (
                          <DropdownMenuItem onClick={() => onOpenOrder(item)}>
                            <FiShoppingCart className={styles.rowMenuIcon} />
                            Перейти к заявке
                          </DropdownMenuItem>
                        ) : null}

                        {canDelete ? (
                          <>
                            {(canEdit || canGoToOrder) ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem
                              variant="destructive"
                              className={styles.rowMenuItemDanger}
                              onClick={() => onDeleteItem(item)}
                            >
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
