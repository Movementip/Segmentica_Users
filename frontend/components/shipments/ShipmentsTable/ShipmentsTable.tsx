import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { ShipmentRowActionsMenu } from "@/components/shipments/ShipmentRowActionsMenu/ShipmentRowActionsMenu"
import {
  getShipmentStatusLabel,
  getShipmentStatusTone,
  type Shipment,
} from "@/components/shipments/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import styles from "./ShipmentsTable.module.css"

const MotionTableRow = motion(TableRow)

type ShipmentsTableProps = {
  canDelete: boolean
  canEdit: boolean
  canGoToOrder: boolean
  canPrint: boolean
  canTrack: boolean
  canView: boolean
  hasRowActions: boolean
  shipments: Shipment[]
  formatCurrency: (amount: number) => string
  formatDateTime: (value: string) => string
  getCostText: (shipment: Shipment) => string
  getTrackingUrl: (shipment: Shipment) => string | null
  getTransportText: (shipment: Shipment) => string
  renderAttachmentBadges: (shipmentId: number) => ReactNode
  onDeleteShipment: (shipment: Shipment) => void
  onEditShipment: (shipment: Shipment) => void | Promise<void>
  onOpenOrder: (shipment: Shipment) => void
  onOpenShipment: (shipment: Shipment) => void
  onPrintShipment: (shipment: Shipment) => void | Promise<void>
  onTrackShipment: (shipment: Shipment) => void
}

export function ShipmentsTable({
  canDelete,
  canEdit,
  canGoToOrder,
  canPrint,
  canTrack,
  canView,
  hasRowActions,
  shipments,
  formatCurrency,
  formatDateTime,
  getCostText,
  getTrackingUrl,
  getTransportText,
  renderAttachmentBadges,
  onDeleteShipment,
  onEditShipment,
  onOpenOrder,
  onOpenShipment,
  onPrintShipment,
  onTrackShipment,
}: ShipmentsTableProps) {
  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <colgroup>
        <col className={styles.colId} />
        <col className={styles.colOrder} />
        <col className={styles.colTransport} />
        <col className={styles.colDate} />
        <col className={styles.colTracking} />
        <col className={styles.colCost} />
        <col className={styles.colStatus} />
        <col className={styles.colActions} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Заявка</TableHead>
          <TableHead>Транспорт</TableHead>
          <TableHead>Дата</TableHead>
          <TableHead>Трек</TableHead>
          <TableHead className={`${styles.textRight} ${styles.sumColumn}`}>
            <div className={styles.sumColumnInner}>Стоимость</div>
          </TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className={styles.actionsHeader} />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {shipments.map((shipment) => (
            <MotionTableRow
              key={shipment.id}
              className={cn(styles.tableRow, canView && styles.tableRowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={canView ? () => onOpenShipment(shipment) : undefined}
            >
              <TableCell className={styles.tableCell}>
                <div className={styles.primaryCell}>
                  <span className={styles.shipmentId}>#{shipment.id}</span>
                  {renderAttachmentBadges(shipment.id)}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.primaryText}>
                  {shipment.заявка_id
                    ? shipment.заявка_номер || `Заявка #${shipment.заявка_id}`
                    : "Без заявки"}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.primaryText}>{getTransportText(shipment)}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.secondaryText}>{formatDateTime(shipment.дата_отгрузки)}</div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.secondaryText}>
                  {shipment.номер_отслеживания || "Не указан"}
                </div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                <div className={styles.sumColumnInner}>
                  {shipment.использовать_доставку === false || shipment.стоимость_доставки == null
                    ? getCostText(shipment)
                    : formatCurrency(shipment.стоимость_доставки)}
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <EntityStatusBadge
                  value={shipment.статус}
                  label={getShipmentStatusLabel(shipment.статус)}
                  tone={getShipmentStatusTone(shipment.статус)}
                  compact
                />
              </TableCell>

              <TableCell className={styles.tableCell}>
                {hasRowActions ? (
                  <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                    <ShipmentRowActionsMenu
                      canDelete={canDelete}
                      canEdit={canEdit}
                      canGoToOrder={canGoToOrder && Boolean(shipment.заявка_id)}
                      canPrint={canPrint}
                      canTrack={canTrack}
                      canView={canView}
                      shipment={shipment}
                      trackingEnabled={Boolean(getTrackingUrl(shipment))}
                      onDeleteShipment={onDeleteShipment}
                      onEditShipment={onEditShipment}
                      onOpenOrder={onOpenOrder}
                      onOpenShipment={onOpenShipment}
                      onPrintShipment={onPrintShipment}
                      onTrackShipment={onTrackShipment}
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
