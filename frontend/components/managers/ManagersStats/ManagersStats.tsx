import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

import type { Manager } from "../types"

type ManagersStatsProps = {
  managers: Manager[]
}

export function ManagersStats({ managers }: ManagersStatsProps) {
  const activeCount = managers.filter((manager) => manager.активен).length
  const inactiveCount = managers.filter((manager) => !manager.активен).length
  const positionsCount = new Set(
    managers.map((manager) => String(manager.должность || "").trim()).filter(Boolean)
  ).size

  return (
    <EntityStatsPanel
      title="Статистика сотрудников"
      items={[
        { label: "Всего сотрудников", value: managers.length },
        { label: "Активные", value: activeCount },
        { label: "Неактивные", value: inactiveCount },
        { label: "Должностей", value: positionsCount },
      ]}
    />
  )
}
