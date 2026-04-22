import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type TransportStatsProps = {
  activeShipmentsCount: number
  avgCost: number
  companiesCount: number
  formatCurrency: (amount: number | null) => string
  successRate: number
}

export function TransportStats({
  activeShipmentsCount,
  avgCost,
  companiesCount,
  formatCurrency,
  successRate,
}: TransportStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика транспортных компаний"
      items={[
        {
          label: "Компаний",
          value: companiesCount,
        },
        {
          label: "Активных отгрузок",
          value: activeShipmentsCount,
        },
        {
          label: "Средняя стоимость",
          value: formatCurrency(avgCost),
        },
        {
          label: "Успешность",
          value: `${successRate.toFixed(1)}%`,
        },
      ]}
    />
  )
}
