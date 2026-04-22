import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"

import styles from "./MissingProductsPageHeader.module.css"

type MissingProductsPageHeaderProps = {
  canCreate: boolean
  isRefreshing: boolean
  onCreate: () => void
  onRefresh: () => void
  refreshKey: string | number
  selectedOrderId: number | null
}

export function MissingProductsPageHeader({
  canCreate,
  isRefreshing,
  onCreate,
  onRefresh,
  refreshKey,
  selectedOrderId,
}: MissingProductsPageHeaderProps) {
  const subtitle = selectedOrderId
    ? `Товары с недостаточным остатком, требующие пополнения или обработки по заявкам. Активен фильтр по заявке #${selectedOrderId}.`
    : "Товары с недостаточным остатком, требующие пополнения или обработки по заявкам."

  return (
    <PageHeader
      title="Недостающие товары"
      subtitle={subtitle}
      actions={(
        <>
          <RefreshButton
            className={styles.surfaceButton}
            isRefreshing={isRefreshing}
            refreshKey={refreshKey}
            iconClassName={styles.spinning}
            onClick={(event) => {
              event.currentTarget.blur()
              onRefresh()
            }}
          />

          {canCreate ? (
            <CreateEntityButton className={styles.createButton} onClick={onCreate}>
              Добавить недостающий товар
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
