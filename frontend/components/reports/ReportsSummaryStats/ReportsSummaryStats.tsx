import type { CSSProperties } from "react"

import styles from "./ReportsSummaryStats.module.css"

export type ReportsSummaryStatItem = {
  label: string
  value: string | number
}

type ReportsSummaryStatsProps = {
  items: ReportsSummaryStatItem[]
}

export function ReportsSummaryStats({ items }: ReportsSummaryStatsProps) {
  return (
    <section
      className={styles.surface}
      style={{ "--reports-stats-count": items.length } as CSSProperties}
    >
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.label} className={styles.item}>
            <div className={styles.value}>{item.value}</div>
            <div className={styles.label}>{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
