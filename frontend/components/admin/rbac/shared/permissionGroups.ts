export type PermissionItemLike = {
  id: number
  key: string
  name?: string | null
  description?: string | null
}

type PermissionModuleConfig = {
  key: string
  label: string
}

export const PERMISSION_MODULES: PermissionModuleConfig[] = [
  { key: "dashboard", label: "Дашборд" },
  { key: "reports", label: "Отчеты" },
  { key: "orders", label: "Заявки" },
  { key: "clients", label: "Контрагенты" },
  { key: "purchases", label: "Закупки" },
  { key: "warehouse", label: "Склад" },
  { key: "products", label: "Товары" },
  { key: "categories", label: "Категории" },
  { key: "missing_products", label: "Недостающие товары" },
  { key: "suppliers", label: "Поставщики" },
  { key: "transport", label: "ТК" },
  { key: "shipments", label: "Отгрузки" },
  { key: "managers", label: "Сотрудники" },
  { key: "archive", label: "Архив" },
  { key: "admin", label: "Администрирование" },
  { key: "other", label: "Прочее" },
]

export const PERMISSION_MODULE_LABELS = new Map(
  PERMISSION_MODULES.map((item) => [item.key, item.label])
)

export const PERMISSION_MODULE_ORDER = new Map(
  PERMISSION_MODULES.map((item, index) => [item.key, index])
)

export function normalizePermissionKeyForGrouping(key: string): {
  groupKey: string
  sortKey: string
} {
  const normalizedKey = String(key || "").trim()
  if (!normalizedKey) return { groupKey: "other", sortKey: "" }

  if (normalizedKey.startsWith("page.")) {
    const pageKey = normalizedKey.split(".")[1] || "other"
    const mappedPageKey = pageKey === "applications" ? "orders" : pageKey
    return {
      groupKey: mappedPageKey || "other",
      sortKey: `${mappedPageKey}.page`,
    }
  }

  const prefix = normalizedKey.split(".")[0] || "other"
  const mappedPrefix =
    prefix === "applications"
      ? "orders"
      : prefix === "warehouse-products"
        ? "warehouse"
        : prefix

  return {
    groupKey: mappedPrefix || "other",
    sortKey: normalizedKey
      .replace(/^applications\./, "orders.")
      .replace(/^warehouse-products\./, "warehouse."),
  }
}

export function permActionRank(key: string): number {
  const parts = String(key || "").split(".")
  const action = parts[1] || ""

  if (action === "page") return 5
  if (action === "list") return 10
  if (action === "view") return 20
  if (action === "create") return 30
  if (action === "edit") return 40
  if (action === "delete") return 50
  if (action === "approve") return 60
  if (action === "attachments") return 70

  return 999
}

export function permKeyCompare<T extends PermissionItemLike>(a: T, b: T): number {
  const aNormalized = normalizePermissionKeyForGrouping(String(a.key || ""))
  const bNormalized = normalizePermissionKeyForGrouping(String(b.key || ""))

  const byPrefix = aNormalized.groupKey.localeCompare(
    bNormalized.groupKey,
    "ru"
  )
  if (byPrefix !== 0) return byPrefix

  const byAction =
    permActionRank(aNormalized.sortKey) - permActionRank(bNormalized.sortKey)
  if (byAction !== 0) return byAction

  return aNormalized.sortKey.localeCompare(bNormalized.sortKey, "ru")
}

export function getPermissionModuleLabel(groupKey: string): string {
  return PERMISSION_MODULE_LABELS.get(groupKey) || groupKey || "Прочее"
}
