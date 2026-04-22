import { Skeleton } from "@/components/ui/skeleton"

import styles from "./CategoriesPageSkeleton.module.css"

export function CategoriesPageSkeleton() {
  return (
    <div className={styles.card} aria-busy="true" aria-label="Загрузка страницы категорий">
      <section className={styles.statsSection}>
        <Skeleton className={styles.titleSkeleton} />
        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.statCard}>
              <Skeleton className={styles.statValue} />
              <Skeleton className={styles.statLabel} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.treeCard}>
          <div className={styles.treeHeader}>
            <div>
              <Skeleton className={styles.sectionTitle} />
              <Skeleton className={styles.sectionText} />
            </div>
            <div className={styles.headerControls}>
              <Skeleton className={styles.search} />
              <Skeleton className={styles.button} />
            </div>
          </div>
          <Skeleton className={styles.viewport} />
        </div>

        <div className={styles.sidebar}>
          <Skeleton className={styles.sectionTitle} />
          <Skeleton className={styles.sectionText} />
          <Skeleton className={styles.heroTitle} />
          <Skeleton className={styles.heroMeta} />
          <div className={styles.detailRows}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={styles.detailRow}>
                <Skeleton className={styles.detailLabel} />
                <Skeleton className={styles.detailValue} />
              </div>
            ))}
          </div>
          <div className={styles.actionButtons}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className={styles.actionButton} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
