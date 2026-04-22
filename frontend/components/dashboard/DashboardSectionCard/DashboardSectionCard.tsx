import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

import styles from "./DashboardSectionCard.module.css"

type DashboardSectionCardProps = HTMLAttributes<HTMLElement> & {
  title: string
  description?: string
  action?: ReactNode
  contentClassName?: string
}

export function DashboardSectionCard({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
  ...props
}: DashboardSectionCardProps) {
  return (
    <section className={cn(styles.surface, className)} {...props}>
      <div className={styles.header}>
        <div className={styles.copy}>
          <h2 className={styles.title}>{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>

        {action ? <div className={styles.action}>{action}</div> : null}
      </div>

      <div className={cn(styles.content, contentClassName)}>{children}</div>
    </section>
  )
}
