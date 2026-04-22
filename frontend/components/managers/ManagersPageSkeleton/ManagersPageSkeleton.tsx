import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function ManagersPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка сотрудников"
      title="Статистика сотрудников"
      columns={6}
      rows={6}
      actionColumn
    />
  )
}
