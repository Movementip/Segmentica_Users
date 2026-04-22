import { EntityTableSkeleton, EntityTableSurface } from "@/components/EntityDataTable/EntityDataTable"
import { Skeleton } from "@/components/ui/skeleton"

import styles from "./EntityIndexPageSkeleton.module.css"

type EntityIndexPageSkeletonProps = {
  ariaLabel: string
  title: string
  columns: number
  rows: number
  actionColumn?: boolean
}

export function EntityIndexPageSkeleton({
  ariaLabel,
  title,
  columns,
  rows,
  actionColumn = true,
}: EntityIndexPageSkeletonProps) {
  return (
    <div className={styles.card} aria-busy="true" aria-label={ariaLabel}>
      <section className={styles.statsSection}>
        <p className={styles.statsTitle}>{title}</p>

        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.statCard}>
              <Skeleton className={styles.statValue} />
              <Skeleton className={styles.statLabel} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.controlsSection}>
        <Skeleton className={styles.searchSkeleton} />
        <div className={styles.controlsGroup}>
          <Skeleton className={styles.filterSkeleton} />
          <Skeleton className={styles.sortLabelSkeleton} />
          <Skeleton className={styles.sortSkeleton} />
        </div>
      </section>

      <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
        <EntityTableSkeleton columns={columns} rows={rows} actionColumn={actionColumn} />
      </EntityTableSurface>
    </div>
  )
}
