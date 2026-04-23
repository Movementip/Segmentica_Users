import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"
import { PurchaseRowActionsMenu } from "@/components/purchases/PurchaseRowActionsMenu/PurchaseRowActionsMenu"
import type { Purchase } from "@/types/pages/purchases"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import styles from "./PurchasesTable.module.css"

const MotionTableRow = motion(TableRow)

type PurchaseStatusTone = "neutral" | "success" | "warning" | "danger" | "muted"

type PurchasesTableProps = {
  purchases: Purchase[]
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canOpenOrderForPurchase: (purchase: Purchase) => boolean
  formatDate: (date: string) => string
  formatDateTime: (date: string) => string
  formatCurrency: (amount: number) => string
  renderAttachmentBadges?: (purchaseId: number) => ReactNode
  onOpenPurchase: (purchase: Purchase) => void
  onEditPurchase: (purchase: Purchase) => void | Promise<void>
  onOpenOrder: (purchase: Purchase) => void
  onDeletePurchase: (purchase: Purchase) => void
}

function getPurchaseStatusTone(status: string): PurchaseStatusTone {
  switch ((status || "").trim().toLowerCase()) {
    case "получено":
      return "success"
    case "заказано":
    case "в пути":
      return "warning"
    case "отменено":
      return "danger"
    default:
      return "muted"
  }
}

export function PurchasesTable({
  purchases,
  canView,
  canEdit,
  canDelete,
  canOpenOrderForPurchase,
  formatDate,
  formatDateTime,
  formatCurrency,
  renderAttachmentBadges,
  onOpenPurchase,
  onEditPurchase,
  onOpenOrder,
  onDeletePurchase,
}: PurchasesTableProps) {
  return (
    <Table className={entityTableClassName}>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Поставщик</TableHead>
          <TableHead>Заявка</TableHead>
          <TableHead>Дата заказа</TableHead>
          <TableHead>Дата поступления</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className={`${styles.textRight} ${styles.sumColumn}`}>
            <div className={styles.sumColumnInner}>Сумма</div>
          </TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {purchases.map((purchase) => {
            const canOpenOrder = canOpenOrderForPurchase(purchase)
            const hasAnyMenuAction = canView || canEdit || canOpenOrder || canDelete

            return (
              <MotionTableRow
                key={purchase.id}
                className={cn(styles.tableRow, canView && styles.tableRowClickable)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={canView ? () => onOpenPurchase(purchase) : undefined}
              >
                <TableCell className={styles.tableCell}>
                  <div>
                    <span className={styles.purchaseId}>#{purchase.id}</span>
                    {renderAttachmentBadges ? (
                      renderAttachmentBadges(purchase.id)
                    ) : (
                      <OrderAttachmentBadges types={[]} />
                    )}
                  </div>
                </TableCell>
                <TableCell className={styles.tableCell}>
                  <div className={styles.supplierCell}>
                    <div className={styles.supplierName}>
                      {purchase.поставщик_название || `Поставщик #${purchase.поставщик_id}`}
                    </div>
                    {purchase.поставщик_телефон ? (
                      <div className={styles.supplierMeta}>{purchase.поставщик_телефон}</div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className={styles.tableCell}>
                  <div className={styles.orderCell}>
                    {purchase.заявка_id ? `#${purchase.заявка_id}` : "Не указана"}
                  </div>
                </TableCell>
                <TableCell className={styles.tableCell}>
                  <div className={styles.dateCell}>{formatDateTime(purchase.дата_заказа)}</div>
                </TableCell>
                <TableCell className={styles.tableCell}>
                  <div className={styles.dateCell}>
                    {purchase.дата_поступления ? formatDate(purchase.дата_поступления) : "Не указана"}
                  </div>
                </TableCell>
                <TableCell className={styles.tableCell}>
                  <EntityStatusBadge
                    value={purchase.статус}
                    tone={getPurchaseStatusTone(purchase.статус)}
                    compact
                  />
                </TableCell>
                <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                  <div className={styles.sumColumnInner}>{formatCurrency(purchase.общая_сумма)}</div>
                </TableCell>
                <TableCell className={styles.tableCell}>
                  {hasAnyMenuAction ? (
                    <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                      <PurchaseRowActionsMenu
                        purchase={purchase}
                        canView={canView}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        canOpenOrder={canOpenOrder}
                        onOpenPurchase={onOpenPurchase}
                        onEditPurchase={onEditPurchase}
                        onOpenOrder={onOpenOrder}
                        onDeletePurchase={onDeletePurchase}
                      />
                    </div>
                  ) : null}
                </TableCell>
              </MotionTableRow>
            )
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
