import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type PurchasesStatsProps = {
  activePurchasesCount: number
  inTransitCount: number
  monthSum: number
  completedThisYearCount: number
  formatCurrency: (amount: number) => string
}

export function PurchasesStats({
  activePurchasesCount,
  inTransitCount,
  monthSum,
  completedThisYearCount,
  formatCurrency,
}: PurchasesStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика закупок"
      items={[
        {
          label: "Активных закупок",
          value: activePurchasesCount,
        },
        {
          label: "В пути",
          value: inTransitCount,
        },
        {
          label: "Сумма в этом месяце",
          value: formatCurrency(monthSum),
        },
        {
          label: "Завершено в этом году",
          value: completedThisYearCount,
        },
      ]}
    />
  )
}
