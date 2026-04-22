import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { WarehouseRowActionsMenu } from "@/components/warehouse/WarehouseRowActionsMenu/WarehouseRowActionsMenu"
import {
  getWarehouseStockStatusLabel,
  getWarehouseStockStatusTone,
} from "@/components/warehouse/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { WarehouseItem } from "@/types/pages/warehouse"

import styles from "./WarehouseStockTable.module.css"

const MotionTableRow = motion(TableRow)

type WarehouseStockTableProps = {
  items: WarehouseItem[]
  showAttachments?: boolean
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canStockAdjust: boolean
  formatDate: (value: string) => string
  formatCurrency: (value: number) => string
  renderAttachmentBadges: (productId: number) => ReactNode
  onOpenItem: (item: WarehouseItem) => void
  onEditItem: (item: WarehouseItem) => void
  onAdjustStock: (item: WarehouseItem) => void
  onOpenHistory: (item: WarehouseItem) => void
  onDeleteItem: (item: WarehouseItem) => void
}

export function WarehouseStockTable({
  items,
  showAttachments = true,
  canView,
  canEdit,
  canDelete,
  canStockAdjust,
  formatDate,
  formatCurrency,
  renderAttachmentBadges,
  onOpenItem,
  onEditItem,
  onAdjustStock,
  onOpenHistory,
  onDeleteItem,
}: WarehouseStockTableProps) {
  const hasRowActions = canView || canEdit || canDelete || canStockAdjust

  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <colgroup>
        <col className={styles.colId} />
        <col className={styles.colName} />
        <col className={styles.colCategory} />
        <col className={styles.colStock} />
        <col className={styles.colStatus} />
        <col className={styles.colPurchase} />
        <col className={styles.colSale} />
        <col className={styles.colUpdated} />
        <col className={styles.colActions} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Название</TableHead>
          <TableHead>Категория</TableHead>
          <TableHead>Остаток</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className={styles.textRight}>Цена покупки</TableHead>
          <TableHead className={styles.textRight}>Цена продажи</TableHead>
          <TableHead>Обновлено</TableHead>
          <TableHead className={styles.actionsHeader} />
        </TableRow>
      </TableHeader>

      <TableBody>
        <AnimatePresence>
          {items.map((item) => (
            <MotionTableRow
              key={item.id}
              className={cn(styles.tableRow, canView && styles.tableRowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={canView ? () => onOpenItem(item) : undefined}
            >
              <TableCell className={styles.tableCell}>
                <div>
                  <div className={styles.itemId}>{item.id}</div>
                  {showAttachments ? renderAttachmentBadges(item.товар_id) : null}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.itemTitle}>{item.товар_название}</div>
                <div className={styles.itemSub}>{item.товар_артикул}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <span className={styles.categoryPill}>{item.товар_категория || "—"}</span>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.stockQty}>
                  {item.количество} {item.товар_единица}
                </div>
                <div className={styles.stockMin}>
                  Мин: {item.товар_мин_остаток} {item.товар_единица}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <EntityStatusBadge
                  value={item.stock_status}
                  label={getWarehouseStockStatusLabel(item.stock_status)}
                  tone={getWarehouseStockStatusTone(item.stock_status)}
                  compact
                />
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.amountCell}>{formatCurrency(item.товар_цена_закупки || 0)}</div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.amountCell}>{formatCurrency(item.товар_цена_продажи || 0)}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.dateCell}>{item.updated_at ? formatDate(item.updated_at) : "—"}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                {hasRowActions ? (
                  <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                    <WarehouseRowActionsMenu
                      item={item}
                      canView={canView}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canStockAdjust={canStockAdjust}
                      onOpenItem={onOpenItem}
                      onEditItem={onEditItem}
                      onAdjustStock={onAdjustStock}
                      onOpenHistory={onOpenHistory}
                      onDeleteItem={onDeleteItem}
                    />
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
