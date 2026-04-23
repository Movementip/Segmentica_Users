import type { Order } from "@/types/pages/orders"
import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type OrdersStatsProps = {
  orders: Order[]
  formatCurrency: (amount: number) => string
}

export function OrdersStats({ orders, formatCurrency }: OrdersStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика заявок"
      items={[
        {
          label: "Новые",
          value: orders.filter((order) => order.статус.toLowerCase() === "новая").length,
        },
        {
          label: "В обработке",
          value: orders.filter((order) => order.статус.toLowerCase() === "в обработке").length,
        },
        {
          label: "Выполнены",
          value: orders.filter((order) => order.статус.toLowerCase() === "выполнена").length,
        },
        {
          label: "Общая сумма",
          value: formatCurrency(orders.reduce((sum, order) => sum + order.общая_сумма, 0)),
        },
      ]}
    />
  )
}
