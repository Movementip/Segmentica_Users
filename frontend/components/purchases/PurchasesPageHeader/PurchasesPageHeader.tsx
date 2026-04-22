import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"

import styles from "./PurchasesPageHeader.module.css"

type PurchasesPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  refreshKey: number
  onRefresh: () => void
  onCreate: () => void
}

export function PurchasesPageHeader({
  canCreate,
  isRefreshing,
  refreshKey,
  onRefresh,
  onCreate,
}: PurchasesPageHeaderProps) {
  return (
    <PageHeader
      title="Закупки"
      subtitle="Управление закупками у поставщиков"
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
            <CreateEntityButton
              className={styles.headerActionButton}
              onClick={onCreate}
            >
              Новая закупка
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
