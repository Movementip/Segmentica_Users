import { Skeleton } from "@/components/ui/skeleton"

import styles from "./EntityStatsPanel.module.css"

type EntityStatsPanelItem = {
  label: string
  value: string | number
  tone?: "default" | "warning"
}

type EntityStatsPanelProps = {
  title: string
  items: EntityStatsPanelItem[]
  variant?: "embedded" | "standalone"
  className?: string
  loading?: boolean
}

export function EntityStatsPanel({
  title,
  items,
  variant = "embedded",
  className,
  loading = false,
}: EntityStatsPanelProps) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(" ")} data-variant={variant}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.grid}>
        {items.map((item, index) => (
          <div key={item.label || index} className={styles.item}>
            {loading ? (
              <>
                <Skeleton className={styles.skeletonValue} />
                <Skeleton className={styles.skeletonLabel} />
              </>
            ) : (
              <>
                <div className={styles.value} data-tone={item.tone ?? "default"}>
                  {item.value}
                </div>
                <div className={styles.label}>{item.label}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
