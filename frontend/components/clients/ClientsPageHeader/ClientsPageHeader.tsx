import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { ReferenceDataActions } from "@/components/pages/ReferenceDataActions/ReferenceDataActions"
import { cn } from "@/lib/utils"

import styles from "./ClientsPageHeader.module.css"

type ClientsPageHeaderProps = {
  canCreate: boolean
  permissions?: string[]
  isRefreshing: boolean
  refreshKey: number
  operationLoading?: boolean
  onRefresh: () => void
  onCreate: () => void
  onImported: () => void | Promise<void>
}

export function ClientsPageHeader({
  canCreate,
  permissions,
  isRefreshing,
  refreshKey,
  operationLoading,
  onRefresh,
  onCreate,
  onImported,
}: ClientsPageHeaderProps) {
  return (
    <PageHeader
      title="Контрагенты"
      subtitle="Справочник контрагентов и их реквизитов"
      actions={(
        <>
          <RefreshButton
            className={cn(styles.surfaceButton)}
            isRefreshing={isRefreshing}
            refreshKey={refreshKey}
            iconClassName={styles.spin}
            disabled={operationLoading}
            onClick={(event) => {
              event.currentTarget.blur()
              onRefresh()
            }}
          />

          <ReferenceDataActions
            catalogKey="clients"
            permissions={permissions}
            onImported={onImported}
          />

          {canCreate ? (
            <CreateEntityButton
              className={cn(styles.createButton)}
              onClick={onCreate}
            >
              Добавить контрагента
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
