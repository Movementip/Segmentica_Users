import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import styles from "./UsersPageHeader.module.css"

type UsersPageHeaderProps = {
  isRefreshing: boolean
  refreshKey: number
  onRefresh: () => void
  onOpenRbac: () => void
  onCreate: () => void
}

export function UsersPageHeader({
  isRefreshing,
  refreshKey,
  onRefresh,
  onOpenRbac,
  onCreate,
}: UsersPageHeaderProps) {
  return (
    <PageHeader
      title="Сотрудники"
      subtitle="Учетные записи сотрудников, роли и права доступа"
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

          <Button
            type="button"
            variant="outline"
            className={cn(styles.surfaceButton)}
            onClick={onOpenRbac}
          >
            Настройки RBAC
          </Button>

          <CreateEntityButton
            className={cn(styles.headerActionButtonDel)}
            onClick={onCreate}
          >
            Создать пользователя
          </CreateEntityButton>
        </>
      )}
    />
  )
}
