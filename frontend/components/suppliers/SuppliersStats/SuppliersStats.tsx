import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type SuppliersStatsProps = {
  totalProducts: number
  totalPurchaseSum: number
  totalSuppliers: number
  suppliersInTransit: number
  formatCurrency: (amount: number) => string
}

export function SuppliersStats({
  totalProducts,
  totalPurchaseSum,
  totalSuppliers,
  suppliersInTransit,
  formatCurrency,
}: SuppliersStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика поставщиков"
      items={[
        {
          label: "Всего поставщиков",
          value: totalSuppliers,
        },
        {
          label: "Всего товаров",
          value: totalProducts,
        },
        {
          label: "Сумма товаров",
          value: formatCurrency(totalPurchaseSum),
        },
        {
          label: "Поставщики в работе",
          value: suppliersInTransit,
        },
      ]}
    />
  )
}
