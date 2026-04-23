import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel";

type ProductsStatsProps = {
    activeProducts: number
    lowStockCount: number
    totalProducts: number
    totalValue: number
    formatCurrency: (amount: number) => string
}

export function ProductsStats({
    activeProducts,
    lowStockCount,
    totalProducts,
    totalValue,
    formatCurrency,
}: ProductsStatsProps) {
    return (
        <EntityStatsPanel
            title="Статистика товаров"
            items={[
                {
                    label: "Всего товаров",
                    value: totalProducts.toLocaleString("ru-RU"),
                },
                {
                    label: "Активных",
                    value: activeProducts.toLocaleString("ru-RU"),
                },
                {
                    label: "Низкий остаток",
                    value: lowStockCount.toLocaleString("ru-RU"),
                },
                {
                    label: "Стоимость остатков",
                    value: formatCurrency(totalValue),
                },
            ]}
        />
    );
}
