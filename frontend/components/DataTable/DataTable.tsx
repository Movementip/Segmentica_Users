import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import styles from "./DataTable.module.css"

const MotionTableRow = motion(TableRow)

export type DataTableColumn<T> = {
  key: string
  title?: ReactNode
  className?: string
  cellClassName?: string
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  rows: T[]
  columns: Array<DataTableColumn<T>>
  getRowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  className?: string
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <Table className={cn(styles.table, className)}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.title}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {rows.map((row) => (
            <MotionTableRow
              key={getRowKey(row)}
              className={cn(styles.row, onRowClick && styles.rowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.key} className={column.cellClassName}>
                  {column.render(row)}
                </TableCell>
              ))}
            </MotionTableRow>
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
