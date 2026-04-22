import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import styles from "./EntityDataTable.module.css"

type EntityTableSurfaceProps = React.ComponentProps<"div"> & {
  variant?: "standalone" | "embedded"
  clip?: "all" | "bottom"
}

type EntityTableSkeletonProps = {
  columns?: number
  rows?: number
  actionColumn?: boolean
}

export const entityTableClassName = styles.table

export function EntityTableSurface({
  className,
  children,
  variant = "standalone",
  clip = "all",
  ...props
}: EntityTableSurfaceProps) {
  return (
    <div
      className={cn(styles.surface, className)}
      data-variant={variant}
      data-clip={clip}
      {...props}
    >
      {children}
    </div>
  )
}

export function EntityTableSkeleton({
  columns = 7,
  rows = 6,
  actionColumn = true,
}: EntityTableSkeletonProps) {
  const columnIndexes = Array.from({ length: columns })
  const rowIndexes = Array.from({ length: rows })
  const gridTemplateColumns = [
    ...columnIndexes.map((_, index) => (index === 0 ? "minmax(82px, 0.8fr)" : "minmax(112px, 1fr)")),
    actionColumn ? "56px" : null,
  ].filter(Boolean).join(" ")
  const rowStyle = {
    "--entity-skeleton-columns": gridTemplateColumns,
  } as React.CSSProperties

  return (
    <div className={styles.skeletonTable} aria-hidden="true">
      <div className={styles.skeletonHeader} style={rowStyle}>
        {columnIndexes.map((_, index) => (
          <Skeleton
            key={`skeleton-head-${index}`}
            className={cn(styles.skeletonHeaderCell, index === 0 && styles.skeletonFirstCell)}
          />
        ))}
        {actionColumn ? <Skeleton className={styles.skeletonActionCell} /> : null}
      </div>

      {rowIndexes.map((_, rowIndex) => (
        <div key={`skeleton-row-${rowIndex}`} className={styles.skeletonRow} style={rowStyle}>
          {columnIndexes.map((__, columnIndex) => (
            <Skeleton
              key={`skeleton-cell-${rowIndex}-${columnIndex}`}
              className={cn(styles.skeletonCell, columnIndex === 0 && styles.skeletonFirstCell)}
            />
          ))}
          {actionColumn ? <Skeleton className={styles.skeletonActionCell} /> : null}
        </div>
      ))}
    </div>
  )
}
