import { EntityTableSkeleton, EntityTableSurface } from "@/components/EntityDataTable/EntityDataTable"
import { Skeleton } from "@/components/ui/skeleton"

import styles from "./UsersPageSkeleton.module.css"

export function UsersPageSkeleton() {
  return (
    <div className={styles.card} aria-busy="true" aria-label="Загрузка сотрудников">
      <section className={styles.statsSection}>
        <p className={styles.statsTitle}>Статистика сотрудников</p>

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
      </section>

      <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
        <EntityTableSkeleton columns={6} rows={7} actionColumn={false} />
      </EntityTableSurface>
    </div>
  )
}
