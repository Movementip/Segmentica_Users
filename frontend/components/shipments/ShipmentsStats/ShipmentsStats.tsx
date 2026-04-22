import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type ShipmentsStatsProps = {
  canceledCount: number
  deliveredCount: number
  inTransitCount: number
  successRate: number
}

export function ShipmentsStats({
  canceledCount,
  deliveredCount,
  inTransitCount,
  successRate,
}: ShipmentsStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика отгрузок"
      items={[
        { label: "В пути", value: inTransitCount },
        { label: "Доставлено", value: deliveredCount },
        { label: "Отменено", value: canceledCount },
        { label: "Успешность", value: `${successRate.toFixed(1)}%` },
      ]}
    />
  )
}
