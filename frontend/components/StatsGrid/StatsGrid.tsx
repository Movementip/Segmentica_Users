import type { CSSProperties } from "react"

import styles from "./StatsGrid.module.css"

export type StatItem = {
  label: string
  value: string | number
}

type StatsGridProps = {
  title?: string
  items: StatItem[]
}

export function StatsGrid({ title, items }: StatsGridProps) {
  return (
    <section className={styles.container}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <div
        className={styles.grid}
        style={{ "--stats-count": items.length } as CSSProperties}
      >
        {items.map((item) => (
          <div className={styles.card} key={item.label}>
            <div className={styles.value}>{item.value}</div>
            <div className={styles.label}>{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
