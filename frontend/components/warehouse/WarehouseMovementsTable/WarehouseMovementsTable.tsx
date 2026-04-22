import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import {
  getWarehouseMovementBadgeTone,
  getWarehouseMovementSignedQuantity,
  isWarehouseIncomingMovement,
} from "@/components/warehouse/utils"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Movement } from "@/types/pages/warehouse"

import styles from "./WarehouseMovementsTable.module.css"

const MotionTableRow = motion(TableRow)

type WarehouseMovementsTableProps = {
  movements: Movement[]
  formatDateTime: (value: string) => string
}

export function WarehouseMovementsTable({
  movements,
  formatDateTime,
}: WarehouseMovementsTableProps) {
  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <TableHeader>
        <TableRow>
          <TableHead>Тип</TableHead>
          <TableHead>Основание</TableHead>
          <TableHead>Товар</TableHead>
          <TableHead>Количество</TableHead>
          <TableHead>Комментарий</TableHead>
          <TableHead>Дата</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <AnimatePresence>
          {movements.map((movement) => {
            const tone = getWarehouseMovementBadgeTone(movement.тип_операции)
            const quantityClassName = isWarehouseIncomingMovement(movement.тип_операции)
              ? styles.quantityIn
              : styles.quantityOut

            return (
              <MotionTableRow
                key={movement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={styles.tableRow}
              >
                <TableCell className={styles.tableCell}>
                  <Badge className={`${styles.typeBadge} ${styles[tone]}`} variant="secondary">
                    {movement.тип_операции}
                  </Badge>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  {movement.заявка_номер ? (
                    <Link href={`/orders/${movement.заявка_номер}`} className={styles.referenceLink}>
                      Заявка #{movement.заявка_номер}
                    </Link>
                  ) : movement.закупка_номер ? (
                    <Link href={`/purchases/${movement.закупка_номер}`} className={styles.referenceLink}>
                      Закупка #{movement.закупка_номер}
                    </Link>
                  ) : movement.отгрузка_номер ? (
                    <Link href={`/shipments/${movement.отгрузка_номер}`} className={styles.referenceLink}>
                      Отгрузка #{movement.отгрузка_номер}
                    </Link>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <div className={styles.itemTitle}>{movement.товар_название || "—"}</div>
                  <div className={styles.itemSub}>{movement.товар_артикул || "—"}</div>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <span className={`${styles.quantity} ${quantityClassName}`}>
                    {getWarehouseMovementSignedQuantity(movement.тип_операции, movement.количество)}
                  </span>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <div className={styles.commentCell}>
                    {movement.комментарий ? movement.комментарий : <span className={styles.muted}>—</span>}
                  </div>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <div className={styles.dateCell}>{formatDateTime(movement.дата_операции)}</div>
                </TableCell>
              </MotionTableRow>
            )
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
