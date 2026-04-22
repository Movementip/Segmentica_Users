import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function SuppliersPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка поставщиков"
      title="Статистика поставщиков"
      columns={8}
      rows={7}
      actionColumn
    />
  )
}
