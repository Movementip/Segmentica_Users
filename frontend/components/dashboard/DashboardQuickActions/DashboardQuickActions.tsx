import type { ReactNode } from "react"
import Link from "next/link"

import styles from "./DashboardQuickActions.module.css"

export type DashboardQuickActionItem = {
  href: string
  icon: ReactNode
  title: string
  hint: string
}

type DashboardQuickActionsProps = {
  items: DashboardQuickActionItem[]
}

export function DashboardQuickActions({ items }: DashboardQuickActionsProps) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Link key={`${item.href}-${item.title}`} href={item.href} className={styles.card}>
          <div className={styles.icon}>{item.icon}</div>
          <div className={styles.title}>{item.title}</div>
          <div className={styles.hint}>{item.hint}</div>
        </Link>
      ))}
    </div>
  )
}
