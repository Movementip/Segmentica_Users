import { EntityTableSkeleton, EntityTableSurface } from "@/components/EntityDataTable/EntityDataTable"
import { Skeleton } from "@/components/ui/skeleton"

import styles from "./WarehousePageSkeleton.module.css"

export function WarehousePageSkeleton() {
  return (
    <div className={styles.root} aria-busy="true" aria-label="Загрузка склада">
      <section className={styles.statsCard}>
        <Skeleton className={styles.title} />
        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.statCard}>
              <Skeleton className={styles.statValue} />
              <Skeleton className={styles.statLabel} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.attentionCard}>
        <div className={styles.attentionContent}>
          <Skeleton className={styles.attentionIcon} />

          <div className={styles.attentionCopy}>
            <Skeleton className={styles.attentionTitle} />
            <Skeleton className={styles.attentionText} />
          </div>
        </div>

        <Skeleton className={styles.attentionAction} />
      </section>

      <section className={styles.mainCard}>
        <div className={styles.tabsRow}>
          <Skeleton className={styles.tabs} />
        </div>

        <div className={styles.filtersRow}>
          <Skeleton className={styles.search} />
          <div className={styles.filterGroup}>
            <Skeleton className={styles.filter} />
            <Skeleton className={styles.filter} />
          </div>
        </div>

        <EntityTableSurface variant="embedded" clip="bottom">
          <EntityTableSkeleton columns={8} rows={7} actionColumn />
        </EntityTableSurface>
      </section>
    </div>
  )
}
