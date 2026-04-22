import type { ReactNode } from "react"

import styles from "./PageHeader.module.css"

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.content}>
        <div className={styles.copy}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>

        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  )
}
