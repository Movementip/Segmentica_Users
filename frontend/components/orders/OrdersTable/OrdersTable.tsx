import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { OrderRowActionsMenu } from "@/components/orders/OrderRowActionsMenu/OrderRowActionsMenu"
import type { Order } from "@/components/orders/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getOrderExecutionModeLabel } from "@/lib/orderModes"
import { cn } from "@/lib/utils"

import styles from "./OrdersTable.module.css"

const MotionTableRow = motion(TableRow)

type OrdersTableProps = {
  orders: Order[]
  hasRowActions: boolean
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canCreatePurchaseForOrder: (order: Order) => boolean
  canAssembleForOrder: (order: Order) => boolean
  canCreateShipmentForOrder: (order: Order) => boolean
  canCompleteForOrder: (order: Order) => boolean
  getAssembleLabel: (order: Order) => string
  getShipmentLabel: (order: Order) => string
  formatDate: (date: string) => string
  formatCurrency: (amount: number) => string
  renderAttachmentBadges: (orderId: number) => ReactNode
  onOpenOrder: (order: Order) => void
  onEditOrder: (order: Order) => void | Promise<void>
  onCreatePurchase: (order: Order) => void | Promise<void>
  onAssembleOrder: (order: Order) => void | Promise<void>
  onCreateShipment: (order: Order) => void
  onCompleteOrder: (order: Order) => void | Promise<void>
  onOpenWorkflow: (order: Order) => void | Promise<void>
  onDeleteOrder: (order: Order) => void
}

export function OrdersTable({
  orders,
  hasRowActions,
  canView,
  canEdit,
  canDelete,
  canCreatePurchaseForOrder,
  canAssembleForOrder,
  canCreateShipmentForOrder,
  canCompleteForOrder,
  getAssembleLabel,
  getShipmentLabel,
  formatDate,
  formatCurrency,
  renderAttachmentBadges,
  onOpenOrder,
  onEditOrder,
  onCreatePurchase,
  onAssembleOrder,
  onCreateShipment,
  onCompleteOrder,
  onOpenWorkflow,
  onDeleteOrder,
}: OrdersTableProps) {
  return (
    <Table className={entityTableClassName}>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Контрагент</TableHead>
          <TableHead>Менеджер</TableHead>
          <TableHead>Дата</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className={`${styles.textRight} ${styles.sumColumn}`}>
            <div className={styles.sumColumnInner}>Сумма</div>
          </TableHead>
          <TableHead>Адрес</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {orders.map((order) => (
            <MotionTableRow
              key={order.id}
              className={cn(styles.tableRow, canView && styles.tableRowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={canView ? () => onOpenOrder(order) : undefined}
            >
              <TableCell className={styles.tableCell}>
                <div>
                  <span className={styles.orderId}>#{order.id}</span>
                  {order.режим_исполнения === "direct" ? (
                    <Badge variant="secondary" className={styles.modeBadge}>
                      {getOrderExecutionModeLabel(order.режим_исполнения)}
                    </Badge>
                  ) : null}
                  {renderAttachmentBadges(order.id)}
                </div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.clientCell}>
                  <div className={styles.clientName}>
                    {order.клиент_название || `Клиент ID: ${order.клиент_id}`}
                  </div>
                </div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.managerCell}>
                  {order.менеджер_фио || (order.менеджер_id ? `ID: ${order.менеджер_id}` : "Не назначен")}
                </div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.dateCell}>{formatDate(order.дата_создания)}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <EntityStatusBadge value={order.статус} compact />
              </TableCell>
              <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                <div className={styles.sumColumnInner}>{formatCurrency(order.общая_сумма)}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.addressCell}>{order.адрес_доставки || "Не указан"}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                {hasRowActions ? (
                  <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                    <OrderRowActionsMenu
                      order={order}
                      canView={canView}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canCreatePurchase={canCreatePurchaseForOrder(order)}
                      canAssemble={canAssembleForOrder(order)}
                      canCreateShipment={canCreateShipmentForOrder(order)}
                      canComplete={canCompleteForOrder(order)}
                      assembleLabel={getAssembleLabel(order)}
                      shipmentLabel={getShipmentLabel(order)}
                      onOpenOrder={onOpenOrder}
                      onEditOrder={onEditOrder}
                      onCreatePurchase={onCreatePurchase}
                      onAssembleOrder={onAssembleOrder}
                      onCreateShipment={onCreateShipment}
                      onCompleteOrder={onCompleteOrder}
                      onOpenWorkflow={onOpenWorkflow}
                      onDeleteOrder={onDeleteOrder}
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
