import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

import styles from "./DashboardSummaryStats.module.css"

export type DashboardSummaryStatItem = {
  label: string
  value: string | number
  tone?: "default" | "warning"
}

type DashboardSummaryStatsProps = {
  items: DashboardSummaryStatItem[]
  className?: string
}

export function DashboardSummaryStats({
  items,
  className,
}: DashboardSummaryStatsProps) {
  return (
    <section
      className={cn(styles.surface, className)}
      style={{ "--dashboard-stats-count": items.length } as CSSProperties}
    >
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.label} className={styles.item}>
            <div className={styles.value} data-tone={item.tone ?? "default"}>
              {item.value}
            </div>
            <div className={styles.label}>{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
