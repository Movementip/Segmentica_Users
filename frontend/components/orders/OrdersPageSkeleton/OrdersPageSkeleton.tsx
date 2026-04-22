import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function OrdersPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка заявок"
      title="Статистика заявок"
      columns={7}
      rows={7}
      actionColumn
    />
  )
}
