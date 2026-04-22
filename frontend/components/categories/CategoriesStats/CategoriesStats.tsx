import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

type CategoriesStatsProps = {
  totalCategories: number
  totalRootCategories: number
  totalSubcategories: number
  totalColumns: number
}

export function CategoriesStats({
  totalCategories,
  totalRootCategories,
  totalSubcategories,
  totalColumns,
}: CategoriesStatsProps) {
  return (
    <EntityStatsPanel
      title="Статистика категорий"
      items={[
        {
          label: "Всего категорий",
          value: totalCategories,
        },
        {
          label: "Корневых узлов",
          value: totalRootCategories,
        },
        {
          label: "Подкатегорий",
          value: totalSubcategories,
        },
        {
          label: "Колонок дерева",
          value: totalColumns,
        },
      ]}
    />
  )
}
