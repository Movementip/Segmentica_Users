import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { ReferenceDataActions } from "@/components/reference-data/ReferenceDataActions/ReferenceDataActions"

import styles from "./TransportPageHeader.module.css"

type TransportPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  permissions?: string[]
  refreshKey: number
  onCreate: () => void
  onImported: () => void | Promise<void>
  onRefresh: () => void
}

export function TransportPageHeader({
  canCreate,
  isRefreshing,
  permissions,
  refreshKey,
  onCreate,
  onImported,
  onRefresh,
}: TransportPageHeaderProps) {
  return (
    <PageHeader
      title="Транспортные компании"
      subtitle="Управление ТК и отгрузками"
      actions={(
        <>
          <RefreshButton
            className={styles.surfaceButton}
            isRefreshing={isRefreshing}
            refreshKey={refreshKey}
            iconClassName={styles.spin}
            onClick={(event) => {
              event.currentTarget.blur()
              onRefresh()
            }}
          />

          <ReferenceDataActions
            catalogKey="transport"
            permissions={permissions}
            onImported={onImported}
          />

          {canCreate ? (
            <CreateEntityButton className={styles.headerActionButton} onClick={onCreate}>
              Добавить ТК
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
