import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { ReferenceDataActions } from "@/components/reference-data/ReferenceDataActions/ReferenceDataActions"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { cn } from "@/lib/utils"

import styles from "./ManagersPageHeader.module.css"

type ManagersPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  refreshKey: number
  permissions: string[] | undefined
  onRefresh: () => void
  onCreate: () => void
  onImported: () => void | Promise<void>
}

export function ManagersPageHeader({
  canCreate,
  isRefreshing,
  refreshKey,
  permissions,
  onRefresh,
  onCreate,
  onImported,
}: ManagersPageHeaderProps) {
  return (
    <PageHeader
      title="Сотрудники"
      subtitle="Справочник сотрудников и кадровых учетных записей"
      actions={(
        <>
          <RefreshButton
            className={cn(styles.surfaceButton)}
            isRefreshing={isRefreshing}
            refreshKey={refreshKey}
            iconClassName={styles.spin}
            onClick={(event) => {
              event.currentTarget.blur()
              onRefresh()
            }}
          />

          <ReferenceDataActions
            catalogKey="managers"
            permissions={permissions}
            onImported={onImported}
          />

          {canCreate ? (
            <CreateEntityButton
              className={cn(styles.headerActionButtonDel)}
              onClick={onCreate}
            >
              Добавить сотрудника
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
