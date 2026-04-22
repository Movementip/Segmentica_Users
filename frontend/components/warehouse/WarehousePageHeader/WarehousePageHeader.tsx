import { FiArrowDownLeft, FiArrowUpRight } from "react-icons/fi"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { Button } from "@/components/ui/button"

import styles from "./WarehousePageHeader.module.css"

type WarehousePageHeaderProps = {
  canCreate: boolean
  canMovementCreate: boolean
  onCreate: () => void
  onOpenIncome: () => void
  onOpenExpense: () => void
}

export function WarehousePageHeader({
  canCreate,
  canMovementCreate,
  onCreate,
  onOpenIncome,
  onOpenExpense,
}: WarehousePageHeaderProps) {
  return (
    <PageHeader
      title="Управление складом"
      subtitle="Складские остатки, движения товаров и контроль запасов"
      actions={(
        <>
          {canMovementCreate ? (
            <Button
              type="button"
              variant="outline"
              className={styles.actionButton}
              onClick={onOpenExpense}
            >
              <FiArrowUpRight data-icon="inline-start" className="size-4" />
              Расход
            </Button>
          ) : null}

          {canMovementCreate ? (
            <Button
              type="button"
              variant="outline"
              className={styles.actionButton}
              onClick={onOpenIncome}
            >
              <FiArrowDownLeft data-icon="inline-start" className="size-4" />
              Приход
            </Button>
          ) : null}

          {canCreate ? (
            <CreateEntityButton className={styles.createButton} onClick={onCreate}>
              Добавить товар
            </CreateEntityButton>
          ) : null}
        </>
      )}
    />
  )
}
