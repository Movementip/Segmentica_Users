import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type MissingProductsStatsProps = {
  totalMissing: number
  criticalCount: number
  totalUnitsMissing: number
  processingCount: number
  orderedCount: number
}

export function MissingProductsStats({
  totalMissing,
  criticalCount,
  totalUnitsMissing,
  processingCount,
  orderedCount,
}: MissingProductsStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика недостающих товаров"
      items={[
        {
          label: "Всего позиций",
          value: totalMissing.toLocaleString("ru-RU"),
        },
        {
          label: "Критичных",
          value: criticalCount.toLocaleString("ru-RU"),
          tone: criticalCount > 0 ? "warning" : "default",
        },
        {
          label: "Недостаёт единиц",
          value: totalUnitsMissing.toLocaleString("ru-RU"),
        },
        {
          label: "В работе / заказано",
          value: (processingCount + orderedCount).toLocaleString("ru-RU"),
        },
      ]}
    />
  )
}
