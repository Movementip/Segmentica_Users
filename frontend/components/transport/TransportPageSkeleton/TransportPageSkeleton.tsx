import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"

export function TransportPageSkeleton() {
  return (
    <EntityIndexPageSkeleton
      ariaLabel="Загрузка транспортных компаний"
      title="Статистика транспортных компаний"
      columns={9}
      rows={7}
      actionColumn
    />
  )
}
