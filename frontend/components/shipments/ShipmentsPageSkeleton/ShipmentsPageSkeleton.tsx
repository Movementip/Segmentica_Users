import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function ShipmentsPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка отгрузок"
      title="Статистика отгрузок"
      columns={7}
      rows={7}
      actionColumn
    />
  )
}
