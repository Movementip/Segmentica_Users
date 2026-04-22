import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"

import styles from "./ShipmentsPageHeader.module.css"

type ShipmentsPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  refreshKey: number
  onCreate: () => void
  onRefresh: () => void
}

export function ShipmentsPageHeader({
  canCreate,
  isRefreshing,
  refreshKey,
  onCreate,
  onRefresh,
}: ShipmentsPageHeaderProps) {
  return (
    <PageHeader
      title="Отгрузки"
      subtitle="Управление отгрузками товаров клиентам"
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

          {canCreate ? (
            <CreateEntityButton className={styles.headerActionButton} onClick={onCreate}>
              Добавить отгрузку
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
