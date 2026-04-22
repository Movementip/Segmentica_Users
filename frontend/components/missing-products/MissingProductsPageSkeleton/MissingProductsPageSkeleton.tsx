import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function MissingProductsPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка недостающих товаров"
      title="Статистика недостающих товаров"
      columns={7}
      rows={7}
      actionColumn
    />
  )
}
