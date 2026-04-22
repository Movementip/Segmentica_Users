import Link from "next/link"

import { PageHeader } from "@/components/PageHeader/PageHeader"
import { UsersAdmin } from "@/components/admin/rbac/UsersAdmin/UsersAdmin"

import styles from "./AdminOverview.module.css"

type AdminOverviewProps = {
  canViewDocuments: boolean
}

export function AdminOverview({ canViewDocuments }: AdminOverviewProps) {
  return (
    <div className={styles.container}>
      <PageHeader
        title="Администрирование"
        subtitle="RBAC, доступы сотрудников и системные инструменты"
        actions={(
          <div className={styles.actions}>
            {canViewDocuments ? (
              <Link href="/documents" className={styles.surfaceLink}>
                Документы
              </Link>
            ) : null}
            <Link href="/admin/schedule-board" className={styles.surfaceLink}>
              График сотрудников
            </Link>
            <Link href="/admin/settings" className={styles.surfaceLink}>
              Настройки системы
            </Link>
            <Link href="/admin/data-exchange" className={styles.surfaceLink}>
              Обмен данными
            </Link>
          </div>
        )}
      />

      <div className={styles.content}>
        <UsersAdmin embedded />
      </div>
    </div>
  )
}
