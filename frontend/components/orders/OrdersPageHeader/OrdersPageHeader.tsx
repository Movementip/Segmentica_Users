import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { cn } from "@/lib/utils"

import styles from "./OrdersPageHeader.module.css"

type OrdersPageHeaderProps = {
  canCreate: boolean
  canOpenBitrixRequests: boolean
  bitrixNewCount?: number
  isRefreshing: boolean
  refreshKey: number
  onRefresh: () => void
  onCreate: () => void
  onOpenBitrixRequests: () => void
}

export function OrdersPageHeader({
  canCreate,
  canOpenBitrixRequests,
  bitrixNewCount = 0,
  isRefreshing,
  refreshKey,
  onRefresh,
  onCreate,
  onOpenBitrixRequests,
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

          {canOpenBitrixRequests ? (
            <CreateEntityButton
              className={cn(styles.headerActionButtonDel)}
              onClick={onOpenBitrixRequests}
            >
              <span>Заявки с Битрикс24</span>
              {bitrixNewCount > 0 ? (
                <span className={styles.counterBadge}>{bitrixNewCount.toLocaleString("ru-RU")}</span>
              ) : null}
            </CreateEntityButton>
          ) : null}

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
