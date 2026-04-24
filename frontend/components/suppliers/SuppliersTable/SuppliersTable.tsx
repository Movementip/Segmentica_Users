import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { FiMail, FiPhone } from "react-icons/fi"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { SupplierRowActionsMenu } from "@/components/suppliers/SupplierRowActionsMenu/SupplierRowActionsMenu"
import { SupplierTypeBadge } from "@/components/suppliers/SupplierTypeBadge/SupplierTypeBadge"
import type { Supplier } from "@/types/pages/suppliers"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import styles from "./SuppliersTable.module.css"

const MotionTableRow = motion(TableRow)

type SuppliersTableProps = {
  suppliers: Supplier[]
  canDelete: boolean
  canEdit: boolean
  canShowOrdersHistory: boolean
  canView: boolean
  formatCurrency: (amount: number) => string
  renderAttachmentBadges: (supplierId: number) => ReactNode
  onDeleteSupplier: (supplier: Supplier) => void
  onEditSupplier: (supplier: Supplier) => void
  onOpenSupplier: (supplier: Supplier) => void
  onOpenSupplierOrdersHistory: (supplier: Supplier) => void
}

export function SuppliersTable({
  suppliers,
  canDelete,
  canEdit,
  canShowOrdersHistory,
  canView,
  formatCurrency,
  renderAttachmentBadges,
  onDeleteSupplier,
  onEditSupplier,
  onOpenSupplier,
  onOpenSupplierOrdersHistory,
}: SuppliersTableProps) {
  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Поставщик</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead className={styles.textRight}>Рейтинг</TableHead>
          <TableHead className={styles.textRight}>Товаров</TableHead>
          <TableHead className={styles.textRight}>В работе</TableHead>
          <TableHead className={`${styles.textRight} ${styles.sumColumn}`}>
            <div className={styles.sumColumnInner}>Сумма товаров</div>
          </TableHead>
          <TableHead>Контакты</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {suppliers.map((supplier) => (
            <MotionTableRow
              key={supplier.id}
              className={cn(styles.tableRow, canView && styles.tableRowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={canView ? () => onOpenSupplier(supplier) : undefined}
            >
              <TableCell className={styles.tableCell}>
                <div>
                  <span className={styles.supplierId}>#{supplier.id}</span>
                  {renderAttachmentBadges(supplier.id)}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.supplierName}>{supplier.название}</div>
                {supplier.created_at ? (
                  <div className={styles.supplierMeta}>
                    Создан: {new Date(supplier.created_at).toLocaleDateString("ru-RU")}
                  </div>
                ) : null}
              </TableCell>

              <TableCell className={styles.tableCell}>
                <SupplierTypeBadge value={supplier.тип} />
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.metricValue}>
                  {Number(supplier.рейтинг || 0).toFixed(1)}
                </div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.metricValue}>
                  {(supplier.количество_товаров || 0).toLocaleString("ru-RU")}
                </div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.metricValue}>
                  {(supplier.закупки_в_пути || 0).toLocaleString("ru-RU")}
                </div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.sumColumn}`}>
                <div className={styles.sumColumnInner}>
                  {formatCurrency(Number(supplier.общая_сумма_закупок || 0))}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.contactsCell}>
                  {supplier.телефон ? (
                    <div className={styles.contactLine}>
                      <FiPhone className={styles.contactIcon} />
                      <span>{supplier.телефон}</span>
                    </div>
                  ) : null}
                  {supplier.email ? (
                    <div className={styles.contactLine}>
                      <FiMail className={styles.contactIcon} />
                      <span>{supplier.email}</span>
                    </div>
                  ) : null}
                  {!supplier.телефон && !supplier.email ? (
                    <span className={styles.mutedText}>Не указаны</span>
                  ) : null}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                  <SupplierRowActionsMenu
                    supplier={supplier}
                    canDelete={canDelete}
                    canEdit={canEdit}
                    canShowOrdersHistory={canShowOrdersHistory}
                    canView={canView}
                    onDeleteSupplier={onDeleteSupplier}
                    onEditSupplier={onEditSupplier}
                    onOpenSupplier={onOpenSupplier}
                    onOpenSupplierOrdersHistory={onOpenSupplierOrdersHistory}
                  />
                </div>
              </TableCell>
            </MotionTableRow>
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
