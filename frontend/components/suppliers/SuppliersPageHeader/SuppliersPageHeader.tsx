import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { ReferenceDataActions } from "@/components/pages/ReferenceDataActions/ReferenceDataActions"

import styles from "./SuppliersPageHeader.module.css"

type SuppliersPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  permissions?: string[]
  refreshKey: number
  onCreate: () => void
  onImported: () => void | Promise<void>
  onRefresh: () => void
}

export function SuppliersPageHeader({
  canCreate,
  isRefreshing,
  permissions,
  refreshKey,
  onCreate,
  onImported,
  onRefresh,
}: SuppliersPageHeaderProps) {
  return (
    <PageHeader
      title="Поставщики"
      subtitle="Управление базой поставщиков, ассортиментом и активными закупками"
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
            catalogKey="suppliers"
            permissions={permissions}
            onImported={onImported}
          />

          {canCreate ? (
            <CreateEntityButton className={styles.headerActionButton} onClick={onCreate}>
              Добавить поставщика
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
