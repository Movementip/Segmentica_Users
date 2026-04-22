import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function PurchasesPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка закупок"
      title="Статистика закупок"
      columns={7}
      rows={7}
      actionColumn
    />
  )
}
