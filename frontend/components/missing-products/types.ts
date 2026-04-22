export interface MissingProduct {
  id: number
  заявка_id: number
  товар_id: number
  необходимое_количество: number
  недостающее_количество: number
  статус: string
  товар_название?: string
  товар_артикул?: string
  created_at?: string
}

export interface MissingProductsProductOption {
  id: number
  название: string
  артикул: string
}

export interface MissingProductsOrderOption {
  id: number
}

export type MissingProductsSortValue =
  | "missing_desc"
  | "missing_asc"
  | "required_desc"
  | "required_asc"
  | "status"
  | "product"
  | "order"

export type MissingProductsFiltersState = {
  status: string
  orderId: string
  productId: string
  sortBy: MissingProductsSortValue
}

export type MissingProductFormData = {
  заявка_id: string
  товар_id: string
  необходимое_количество: string
  недостающее_количество: string
  статус: string
}

export const defaultMissingProductsFilters: MissingProductsFiltersState = {
  status: "all",
  orderId: "all",
  productId: "all",
  sortBy: "missing_desc",
}

export const missingProductStatusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "в обработке", label: "В обработке" },
  { value: "заказано", label: "Заказано" },
  { value: "получено", label: "Получено" },
] as const

export const missingProductEditStatusOptions = missingProductStatusOptions.filter(
  (option) => option.value !== "all"
)

export const missingProductSortOptions: Array<{
  value: MissingProductsSortValue
  label: string
}> = [
  { value: "missing_desc", label: "По недостаче (убыв.)" },
  { value: "missing_asc", label: "По недостаче (возр.)" },
  { value: "required_desc", label: "По требуемому (убыв.)" },
  { value: "required_asc", label: "По требуемому (возр.)" },
  { value: "status", label: "По статусу" },
  { value: "product", label: "По товару" },
  { value: "order", label: "По заявке" },
]

export function getMissingProductStatusLabel(status: string) {
  switch (status) {
    case "в обработке":
      return "В обработке"
    case "заказано":
      return "Заказано"
    case "получено":
      return "Получено"
    default:
      return status || "Не указан"
  }
}

export function getMissingProductDeficitPercentage(product: MissingProduct) {
  if (!product.необходимое_количество || product.необходимое_количество <= 0) {
    return 0
  }

  return Math.min(
    100,
    Math.round(
      (product.недостающее_количество / product.необходимое_количество) * 100
    )
  )
}
