import { AnimatePresence, motion } from "framer-motion"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { TransportShipmentRowActionsMenu } from "@/components/transport/TransportShipmentRowActionsMenu/TransportShipmentRowActionsMenu"
import type { TransportShipment } from "@/components/transport/types"
import {
  getTransportShipmentStatusLabel,
  getTransportShipmentStatusTone,
} from "@/components/transport/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import styles from "./TransportShipmentsTable.module.css"

const MotionTableRow = motion(TableRow)

type TransportShipmentsTableProps = {
  formatDateTime: (date: string) => string
  shipments: TransportShipment[]
  onOpenOrder: (shipment: TransportShipment) => void
}

export function TransportShipmentsTable({
  formatDateTime,
  shipments,
  onOpenOrder,
}: TransportShipmentsTableProps) {
  return (
    <Table className={entityTableClassName}>
      <TableHeader>
        <TableRow>
          <TableHead>Отгрузка</TableHead>
          <TableHead>Компания</TableHead>
          <TableHead>Клиент</TableHead>
          <TableHead>Дата</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {shipments.map((shipment) => (
            <MotionTableRow
              key={shipment.id}
              className={styles.tableRow}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TableCell className={styles.tableCell}>
                <div className={styles.primaryText}>
                  #{shipment.номер_отслеживания || shipment.id}
                </div>
                <div className={styles.secondaryText}>Заявка #{shipment.заявка_номер}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.primaryText}>{shipment.транспорт_название}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.primaryText}>{shipment.клиент_название}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.secondaryText}>{formatDateTime(shipment.дата_отгрузки)}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <EntityStatusBadge
                  value={shipment.заявка_статус}
                  label={getTransportShipmentStatusLabel(shipment.заявка_статус)}
                  tone={getTransportShipmentStatusTone(shipment.заявка_статус)}
                  compact
                />
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.actionsCell}>
                  <TransportShipmentRowActionsMenu
                    onOpenOrder={() => onOpenOrder(shipment)}
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
