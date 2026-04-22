import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { cn } from "@/lib/utils"

import styles from "./OrdersPageHeader.module.css"

type OrdersPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  refreshKey: number
  onRefresh: () => void
  onCreate: () => void
}

export function OrdersPageHeader({
  canCreate,
  isRefreshing,
  refreshKey,
  onRefresh,
  onCreate,
}: OrdersPageHeaderProps) {
  return (
    <PageHeader
      title="Заявки"
      subtitle="Управление заявками клиентов"
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

          {canCreate ? (
            <CreateEntityButton
              className={cn(styles.headerActionButtonDel)}
              onClick={onCreate}
            >
              Новая заявка
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
