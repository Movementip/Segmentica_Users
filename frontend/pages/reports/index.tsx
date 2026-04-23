import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  type TooltipValueType,
  XAxis,
  YAxis,
  type PieLabelRenderProps,
} from "recharts"

import { EntityTableSurface, entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { ReportsSummaryStats } from "@/components/reports/ReportsSummaryStats/ReportsSummaryStats"
import { SegmentedTabs, type SegmentedTabItem } from "@/components/SegmentedTabs/SegmentedTabs"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { withLayout } from "@/layout"
import {
  REPORT_TAB_PERMISSIONS,
  REPORT_VIEW_PERMISSIONS,
} from "@/lib/reportsRbac"
import { cn } from "@/lib/utils"
import type { ReportPeriod, ReportsAnalyticsTab } from "@/types/pages/reports"

import styles from "./Reports.module.css"

const ACCOUNT_LABELS: Record<string, string> = {
  "10.мат": "10.мат Материалы и сырье",
  "10.дет": "10.дет Детали, комплектующие и полуфабрикаты",
  "10.см": "10.см Топливо",
  "10.зап": "10.зап Запасные части",
  "10.стр": "10.стр Строительные материалы",
  "10.хоз": "10.хоз Хозяйственные принадлежности и инвентарь",
  "10.спец": "10.спец Специальная одежда",
  "10.тара": "10.тара Тара",
  "10.пр": "10.пр Прочие материалы",
  "20": "20 Основное производство",
  "23": "23 Вспомогательные производства",
  "25": "25 Общепроизводственные расходы",
  "26": "26 Общехозяйственные (управленческие) расходы",
  "29": "29 Обслуживающие производства и хозяйства",
  "44": "44 Расходы на продажу (коммерческие расходы)",
  "91.02": "91.02 Прочие расходы",
  "97": "97 Расходы будущих периодов",
}

interface DashboardStats {
  activeOrders: number
  totalProducts: number
  activeSuppliers: number
  lowStockItems: number
  recentOrders: Array<{ id: number; client: string; amount: number; status: string; created_at: string }>
  stockByCategory: Array<{ category: string; count: number }>
  warehouseMovements: Array<{ id: number; product_name: string; quantity: number; operation_type: string; operation_date: string }>
  salesByPeriod: Array<{ период: string; количество_продаж: number; общая_сумма: number; средний_чек: number }>
}

type ViewRow = Record<string, unknown>

type OverviewData = {
  byMonth: Array<{ month: string; revenue: number; expense: number; profit: number; orders: number }>
  byCategory: Array<{ name: string; value: number; percent: number }>
}

type AccountAnalyticsRow = {
  account: string
  amount: number
  share: number
  quantity?: number
  items?: number
  positions?: number
  products?: number
}

type AccountingMovementRow = {
  account: string
  openingAmount: number
  incomingAmount: number
  outgoingAmount: number
  closingAmount: number
  openingQuantity: number
  incomingQuantity: number
  outgoingQuantity: number
  closingQuantity: number
}

type ExpenseMonthRow = {
  month: string
  total: number
  accounts: Array<{
    account: string
    amount: number
    share: number
  }>
}

type ExpenseDetailRow = {
  account: string
  productId: number | null
  productName: string
  nomenclatureType: string | null
  amount: number
  records: number
  share: number
  shareWithinAccount: number
}

type AccountsData = {
  inventoryByAccount: AccountAnalyticsRow[]
  accountingMovement: AccountingMovementRow[]
  expenseByAccount: AccountAnalyticsRow[]
  expenseStructure: {
    topAccounts: string[]
    byMonth: ExpenseMonthRow[]
  }
  expenseDetails: ExpenseDetailRow[]
  totals: {
    inventoryAmount: number
    expenseAmount: number
  }
}

type TopProductRow = {
  product_id: number
  product_name: string
  sold_units: number
  revenue: number
  margin_percent: number
  trend_percent: number
}

type TopClientRow = {
  client_id: number
  client_name: string
  orders_count: number
  revenue: number
  avg_check: number
  growth_percent: number
}

type TransportPerformanceRow = {
  transport_id: number
  transport_name: string
  shipments: number
  on_time: number
  rating_percent: number
  avg_cost: number
}

const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "all", label: "Весь период" },
  { value: "6m", label: "Последние 6 месяцев" },
  { value: "3m", label: "Последние 3 месяца" },
  { value: "1m", label: "Последний месяц" },
]

const VIEWS_BY_TAB: Record<Exclude<ReportsAnalyticsTab, "custom">, string[]> = {
  overview: ["продажи_по_периодам", "анализ_недостач"],
  sales: ["продажи_по_периодам"],
  products: ["движения_склада_детализированные", "анализ_недостач", "анализ_поставщиков"],
  clients: ["анализ_клиентов"],
  logistics: ["статистика_транспортных_компаний"],
}

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#ec4899"]
const chartTick = { fontSize: 12, fill: "var(--muted-foreground)" }
const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  color: "var(--popover-foreground)",
}

const titleForView = (viewName: string): string => {
  const map: Record<string, string> = {
    анализ_клиентов: "Топ клиенты",
    продажи_по_периодам: "Продажи по периодам",
    анализ_недостач: "Недостачи",
    движения_склада_детализированные: "Движения склада",
    статистика_транспортных_компаний: "Эффективность транспортных компаний",
    анализ_поставщиков: "Анализ поставщиков",
    финансовый_обзор: "Финансовый обзор",
    эффективность_сотрудников: "Эффективность сотрудников",
  }
  return map[viewName] || viewName
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") {
    const trimmed = value.trim()

    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const date = new Date(trimmed)
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      }
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const number = Number(trimmed)
      if (Number.isFinite(number)) {
        const hasFraction = Math.abs(number % 1) > 1e-9
        return new Intl.NumberFormat("ru-RU", {
          maximumFractionDigits: hasFraction ? 2 : 0,
        }).format(number)
      }
    }
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value)
    const hasFraction = Math.abs(value % 1) > 1e-9
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(value)
  }

  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const findDateColumnKey = (columns: string[]): string | null => {
  if (!columns.length) return null
  return columns.find((key) => /дата|date/i.test(key)) || columns.find((key) => /_at$/i.test(key)) || null
}

const getAccountLabel = (account: string): string => ACCOUNT_LABELS[account] || account

const normalizeReportTitle = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

type ReportsTooltipFormatter = NonNullable<TooltipProps<TooltipValueType, string | number>["formatter"]>
type ReportsTooltipLabelFormatter = NonNullable<TooltipProps<TooltipValueType, string | number>["labelFormatter"]>

const formatCurrencyValue = (amount: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount)

const formatTooltipCurrency: ReportsTooltipFormatter = (value) => formatCurrencyValue(Number(value) || 0)
const formatTooltipCount: ReportsTooltipFormatter = (value) => String(value ?? 0)
const formatTooltipLabel: ReportsTooltipLabelFormatter = (label) => String(label ?? "")
const formatTooltipExpense: ReportsTooltipFormatter = (value, name) => [
  formatCurrencyValue(Number(value) || 0),
  getAccountLabel(String(name ?? "")),
]
const formatPieCategoryLabel = (payload: PieLabelRenderProps) => {
  const label = String(payload.name ?? "")
  const rawPercent = Number(
    (payload.payload as { percent?: number } | undefined)?.percent ?? payload.percent ?? 0
  )
  const percent = rawPercent <= 1 ? rawPercent * 100 : rawPercent
  const formattedPercent = Number.isFinite(percent)
    ? (Number.isInteger(percent) ? String(percent) : percent.toFixed(1))
    : "0"
  return `${label} ${formattedPercent}%`
}

function ReportsPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [period, setPeriod] = useState<ReportPeriod>("6m")
  const [activeTab, setActiveTab] = useState<ReportsAnalyticsTab>("overview")
  const [displayedTab, setDisplayedTab] = useState<ReportsAnalyticsTab>("overview")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [viewsCache, setViewsCache] = useState<Record<string, { rows: ViewRow[]; columns: string[] }>>({})
  const [viewsLoading, setViewsLoading] = useState<Record<string, boolean>>({})

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)

  const [accountsData, setAccountsData] = useState<AccountsData | null>(null)
  const [accountsLoading, setAccountsLoading] = useState(false)

  const [topProducts, setTopProducts] = useState<TopProductRow[] | null>(null)
  const [topProductsLoading, setTopProductsLoading] = useState(false)

  const [topClients, setTopClients] = useState<TopClientRow[] | null>(null)
  const [topClientsLoading, setTopClientsLoading] = useState(false)

  const [transportPerf, setTransportPerf] = useState<TransportPerformanceRow[] | null>(null)
  const [transportPerfLoading, setTransportPerfLoading] = useState(false)

  const canOverviewTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.overview))
  const canSalesTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.sales))
  const canProductsTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.products))
  const canClientsTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.clients))
  const canLogisticsTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.logistics))
  const canCustomTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.custom))
  const canReports =
    canOverviewTab ||
    canSalesTab ||
    canProductsTab ||
    canClientsTab ||
    canLogisticsTab ||
    canCustomTab

  useEffect(() => {
    if (authLoading) return

    const allowedTabs: ReportsAnalyticsTab[] = []
    if (canOverviewTab) allowedTabs.push("overview")
    if (canSalesTab) allowedTabs.push("sales")
    if (canProductsTab) allowedTabs.push("products")
    if (canClientsTab) allowedTabs.push("clients")
    if (canLogisticsTab) allowedTabs.push("logistics")
    if (canCustomTab) allowedTabs.push("custom")

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] ?? "overview")
    }
  }, [
    activeTab,
    authLoading,
    canClientsTab,
    canCustomTab,
    canLogisticsTab,
    canOverviewTab,
    canProductsTab,
    canSalesTab,
  ])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/dashboard")
        if (!response.ok) throw new Error("Failed to load stats")
        const data = (await response.json()) as DashboardStats
        setStats(data)
      } catch {
        setStats(null)
      } finally {
        setLoading(false)
      }
    }

    if (!canReports) {
      setStats(null)
      setLoading(false)
      return
    }

    void fetchStats()
  }, [canReports])

  useEffect(() => {
    if (!router.isReady) return

    const nextTabRaw = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    const nextTab = nextTabRaw as ReportsAnalyticsTab | undefined

    if (
      nextTab === "overview" ||
      nextTab === "sales" ||
      nextTab === "products" ||
      nextTab === "clients" ||
      nextTab === "logistics" ||
      nextTab === "custom"
    ) {
      setActiveTab(nextTab)
    }
  }, [router.isReady, router.query.tab])

  useEffect(() => {
    if (!router.isReady) return

    const query: Record<string, string> = {}
    if (activeTab !== "overview") query.tab = activeTab

    const currentTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    const unchanged = String(currentTab || "") === String(query.tab || "")
    if (unchanged) return

    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [activeTab, router])

  useEffect(() => {
    if (activeTab !== "overview" && activeTab !== "sales") return
    if ((activeTab === "overview" && !canOverviewTab) || (activeTab === "sales" && !canSalesTab)) {
      return
    }

    const run = async () => {
      try {
        setOverviewLoading(true)
        const response = await fetch(`/api/reports/overview?period=${encodeURIComponent(period)}`)
        if (!response.ok) throw new Error("Failed")
        const json = (await response.json()) as OverviewData
        setOverviewData(json)
      } catch {
        setOverviewData(null)
      } finally {
        setOverviewLoading(false)
      }
    }

    void run()
  }, [activeTab, canOverviewTab, canSalesTab, period])

  useEffect(() => {
    if (activeTab !== "overview" || !canOverviewTab) return

    const run = async () => {
      try {
        setAccountsLoading(true)
        const response = await fetch(`/api/reports/accounts?period=${encodeURIComponent(period)}`)
        if (!response.ok) throw new Error("Failed")
        const json = (await response.json()) as AccountsData
        setAccountsData(json)
      } catch {
        setAccountsData(null)
      } finally {
        setAccountsLoading(false)
      }
    }

    void run()
  }, [activeTab, canOverviewTab, period])

  useEffect(() => {
    if (activeTab !== "logistics" || !canLogisticsTab) return

    const run = async () => {
      try {
        setTransportPerfLoading(true)
        const response = await fetch(`/api/reports/transport-performance?period=${encodeURIComponent(period)}`)
        if (!response.ok) throw new Error("Failed")
        const json = await response.json()
        setTransportPerf(Array.isArray(json?.data) ? json.data : [])
      } catch {
        setTransportPerf(null)
      } finally {
        setTransportPerfLoading(false)
      }
    }

    void run()
  }, [activeTab, canLogisticsTab, period])

  useEffect(() => {
    if (activeTab !== "clients" || !canClientsTab) return

    const run = async () => {
      try {
        setTopClientsLoading(true)
        const response = await fetch(`/api/reports/top-clients?period=${encodeURIComponent(period)}`)
        if (!response.ok) throw new Error("Failed")
        const json = await response.json()
        setTopClients(Array.isArray(json?.data) ? json.data : [])
      } catch {
        setTopClients(null)
      } finally {
        setTopClientsLoading(false)
      }
    }

    void run()
  }, [activeTab, canClientsTab, period])

  useEffect(() => {
    if (activeTab !== "products" || !canProductsTab) return

    const run = async () => {
      try {
        setTopProductsLoading(true)
        const response = await fetch(`/api/reports/top-products?period=${encodeURIComponent(period)}`)
        if (!response.ok) throw new Error("Failed")
        const json = await response.json()
        setTopProducts(Array.isArray(json?.data) ? json.data : [])
      } catch {
        setTopProducts(null)
      } finally {
        setTopProductsLoading(false)
      }
    }

    void run()
  }, [activeTab, canProductsTab, period])

  const ensureViewLoaded = useCallback(async (viewName: string) => {
    if (!user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName])) return
    if (viewsCache[viewName]) return
    if (viewsLoading[viewName]) return

    setViewsLoading((state) => ({ ...state, [viewName]: true }))

    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(viewName)}`)
      if (!response.ok) throw new Error("Failed")
      const json = await response.json()
      const rows: ViewRow[] = Array.isArray(json?.data) ? json.data : []
      const columns = rows.length ? Object.keys(rows[0]) : []
      setViewsCache((state) => ({ ...state, [viewName]: { rows, columns } }))
    } catch {
      setViewsCache((state) => ({ ...state, [viewName]: { rows: [], columns: [] } }))
    } finally {
      setViewsLoading((state) => ({ ...state, [viewName]: false }))
    }
  }, [user?.permissions, viewsCache, viewsLoading])

  useEffect(() => {
    if (activeTab === "custom") return

    const neededViews = (VIEWS_BY_TAB[activeTab] || []).filter((viewName) =>
      user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName])
    )

    neededViews.forEach((viewName) => {
      void ensureViewLoaded(viewName)
    })
  }, [activeTab, ensureViewLoaded, user?.permissions])

  const reports = [
    {
      id: 1,
      title: "Анализ контрагентов",
      description: "Статистика по контрагентам, категории, средний чек и активность",
      viewName: "анализ_клиентов",
    },
    {
      id: 2,
      title: "Анализ недостач",
      description: "Отчет по недостающим товарам и их влиянию на продажи",
      viewName: "анализ_недостач",
    },
    {
      id: 3,
      title: "Анализ поставщиков",
      description: "Рейтинг и эффективность работы поставщиков",
      viewName: "анализ_поставщиков",
    },
    {
      id: 4,
      title: "Движения склада",
      description: "Подробная информация о движении товаров на складе",
      viewName: "движения_склада_детализированные",
    },
    {
      id: 5,
      title: "Продажи по периодам",
      description: "Анализ продаж в разрезе временных периодов",
      viewName: "продажи_по_периодам",
    },
    {
      id: 6,
      title: "Статистика ТК",
      description: "Анализ работы транспортных компаний",
      viewName: "статистика_транспортных_компаний",
    },
    {
      id: 7,
      title: "Финансовый обзор",
      description: "Основные финансовые показатели и метрики",
      viewName: "финансовый_обзор",
    },
  ].filter((report) => user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[report.viewName]))

  const periodMonths = period === "all" ? Infinity : period === "6m" ? 6 : period === "3m" ? 3 : 1

  const salesRows = useMemo(() => {
    const rows = stats?.salesByPeriod || []
    if (period === "all") return rows
    return rows.slice(0, periodMonths)
  }, [period, periodMonths, stats?.salesByPeriod])

  const metrics = useMemo(() => {
    const revenue = salesRows.reduce((sum, row) => sum + Number(row.общая_сумма || 0), 0)
    const orders = salesRows.reduce((sum, row) => sum + Number(row.количество_продаж || 0), 0)
    const avgCheck = orders > 0 ? revenue / orders : 0
    const shipped = (stats?.warehouseMovements || []).filter(
      (movement) => String(movement.operation_type).toLowerCase() === "расход"
    ).length

    return { revenue, orders, shipped, avgCheck }
  }, [salesRows, stats?.warehouseMovements])

  const expenseStructureChartData = useMemo(() => {
    const rows = accountsData?.expenseStructure?.byMonth || []
    return rows.map((row) => {
      const values = row.accounts.reduce<Record<string, number>>((accumulator, entry) => {
        accumulator[entry.account] = Number(entry.amount) || 0
        return accumulator
      }, {})

      return {
        month: row.month,
        total: Number(row.total) || 0,
        ...values,
      }
    })
  }, [accountsData])

  const expenseStructureKeys = accountsData?.expenseStructure?.topAccounts || []

  const formatCurrency = (amount: number) => formatCurrencyValue(amount)

  const salesChartData = overviewData?.byMonth || []
  const categoryChartData = overviewData?.byCategory || []

  const reportTabs = useMemo((): Array<SegmentedTabItem<ReportsAnalyticsTab>> => {
    const next: Array<SegmentedTabItem<ReportsAnalyticsTab>> = []
    if (canOverviewTab) next.push({ value: "overview", label: "Общий обзор" })
    if (canSalesTab) next.push({ value: "sales", label: "Продажи" })
    if (canProductsTab) next.push({ value: "products", label: "Товары" })
    if (canClientsTab) next.push({ value: "clients", label: "Клиенты" })
    if (canLogisticsTab) next.push({ value: "logistics", label: "Логистика" })
    if (canCustomTab) next.push({ value: "custom", label: "Пользовательские отчеты" })
    return next
  }, [canClientsTab, canCustomTab, canLogisticsTab, canOverviewTab, canProductsTab, canSalesTab])

  const productViewNames = useMemo(
    () =>
      (VIEWS_BY_TAB.products || []).filter((viewName) =>
        user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName])
      ),
    [user?.permissions]
  )

  const areProductViewsReady = productViewNames.every(
    (viewName) => Boolean(viewsCache[viewName]) && !viewsLoading[viewName]
  )

  const isProductsTabLoading =
    activeTab === "products" &&
    canProductsTab &&
    (topProductsLoading || topProducts === null || !areProductViewsReady)

  const isClientsTabLoading =
    activeTab === "clients" &&
    canClientsTab &&
    (topClientsLoading || topClients === null)

  const isLogisticsTabLoading =
    activeTab === "logistics" &&
    canLogisticsTab &&
    (transportPerfLoading || transportPerf === null)

  const isSalesTabLoading =
    activeTab === "sales" &&
    canSalesTab &&
    (overviewLoading || overviewData === null)

  const isCustomTabLoading = false

  const activeTabContentLoading =
    isSalesTabLoading ||
    isProductsTabLoading ||
    isClientsTabLoading ||
    isLogisticsTabLoading ||
    isCustomTabLoading

  const [isTabLoaderVisible, setIsTabLoaderVisible] = useState(false)

  useEffect(() => {
    if (activeTab !== displayedTab || activeTabContentLoading) {
      setIsTabLoaderVisible(true)
    }
  }, [activeTab, displayedTab, activeTabContentLoading])

  useEffect(() => {
    if (activeTab === displayedTab || activeTabContentLoading) return

    setDisplayedTab(activeTab)
  }, [activeTab, displayedTab, activeTabContentLoading])

  useEffect(() => {
    if (activeTab !== displayedTab || activeTabContentLoading) return

    let frameA = 0
    let frameB = 0
    let frameC = 0

    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        frameC = window.requestAnimationFrame(() => {
          setIsTabLoaderVisible(false)
        })
      })
    })

    return () => {
      if (frameA) window.cancelAnimationFrame(frameA)
      if (frameB) window.cancelAnimationFrame(frameB)
      if (frameC) window.cancelAnimationFrame(frameC)
    }
  }, [activeTab, displayedTab, activeTabContentLoading])

  const isWithinPeriod = (raw: unknown) => {
    if (period === "all") return true
    if (!raw) return true

    const date = new Date(String(raw))
    if (Number.isNaN(date.getTime())) return true

    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - periodMonths)

    return date >= start
  }

  const renderEmptyTableRow = (colSpan: number, message = "Нет данных") => (
    <TableRow>
      <TableCell colSpan={colSpan} className={styles.emptyRowCell}>
        <div className={styles.emptyRow}>{message}</div>
      </TableCell>
    </TableRow>
  )

  const renderViewBlock = (viewName: string) => {
    if (!user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName])) return null

    const cached = viewsCache[viewName]
    const isLoading = Boolean(viewsLoading[viewName])
    const rows = cached?.rows || []
    const columns = cached?.columns || []
    const dateKey = findDateColumnKey(columns)
    const filteredRows = dateKey ? rows.filter((row) => isWithinPeriod(row[dateKey])) : rows
    const visibleRows = filteredRows.slice(0, 20)
    const visibleCols = columns.slice(0, 8)
    const displayCols = visibleCols.length ? visibleCols : ["result"]

    return (
      <Card key={viewName} className={styles.sectionCard}>
        <CardHeader className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <CardTitle className={styles.sectionTitle}>{titleForView(viewName)}</CardTitle>
          </div>
          <Link
            href={`/reports/view?name=${encodeURIComponent(viewName)}&tab=${encodeURIComponent(activeTab)}`}
            className={styles.sectionActionLink}
          >
            <Button type="button" variant="outline" className={styles.surfaceButton}>
              Просмотреть
            </Button>
          </Link>
        </CardHeader>
        <CardContent className={styles.tableCardContent}>
          <EntityTableSurface variant="embedded" className={styles.tableSurface}>
            <Table className={cn(entityTableClassName, styles.table)}>
              <TableHeader>
                <TableRow>
                  {displayCols.map((column) => (
                    <TableHead key={column}>
                      {column === "result" ? "Результат" : normalizeReportTitle(column)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? renderEmptyTableRow(Math.max(1, displayCols.length), "Загрузка отчета...")
                  : visibleRows.length
                    ? visibleRows.map((row, index) => (
                        <TableRow key={`${viewName}-${index}`} className={styles.tableRow}>
                          {visibleCols.map((column) => (
                            <TableCell key={column} title={formatCell(row?.[column])} className={styles.textCell}>
                              <div className={styles.cellContent}>{formatCell(row?.[column])}</div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : renderEmptyTableRow(Math.max(1, displayCols.length))}
              </TableBody>
            </Table>
          </EntityTableSurface>
        </CardContent>
      </Card>
    )
  }

  if (authLoading || loading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canReports) {
    return <NoAccessPage />
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Отчеты и аналитика"
        subtitle="Комплексный анализ бизнес-процессов и ключевых показателей"
        actions={(
          <Select
            value={period}
            items={PERIOD_OPTIONS}
            onValueChange={(nextValue) => setPeriod(nextValue as ReportPeriod)}
          >
            <SelectTrigger className={styles.periodSelect} />
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      <div className={styles.surface}>
        <ReportsSummaryStats
          items={[
            { label: "Выручка", value: formatCurrency(metrics.revenue) },
            { label: "Заявки", value: metrics.orders.toLocaleString("ru-RU") },
            { label: "Отгружено", value: metrics.shipped.toLocaleString("ru-RU") },
            { label: "Средний чек", value: formatCurrency(metrics.avgCheck) },
          ]}
        />

        <div className={styles.tabsSection}>
          <SegmentedTabs
            value={activeTab}
            items={reportTabs}
            ariaLabel="Разделы отчетов"
            onChange={setActiveTab}
          />
        </div>

        <div className={styles.blocksWrap}>
          <div className={styles.blocksContent}>
          {displayedTab === "overview" && canOverviewTab ? (
            <div className={styles.blocksGrid}>
              <Card className={styles.sectionCard}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Динамика выручки и прибыли</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.chartCardContent}>
                  <div className={styles.chartBox}>
                    {overviewLoading || !overviewData ? (
                      <PageLoader label="Загрузка отчета..." />
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={salesChartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={chartTick} />
                          <YAxis tick={chartTick} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={formatTooltipCurrency}
                            labelFormatter={formatTooltipLabel}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="expense" name="Расход" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={styles.sectionCard}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>По категориям</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.chartCardContent}>
                  <div className={styles.chartBox}>
                    {overviewLoading || !overviewData ? (
                      <PageLoader label="Загрузка отчета..." />
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={formatTooltipCount}
                          />
                          <Pie
                            data={categoryChartData}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={90}
                            label={formatPieCategoryLabel}
                          >
                            {categoryChartData.map((_, index) => (
                              <Cell key={`category-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Динамика заказов</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.chartCardContent}>
                  <div className={styles.chartBox}>
                    {overviewLoading || !overviewData ? (
                      <PageLoader label="Загрузка отчета..." />
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={salesChartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={chartTick} />
                          <YAxis tick={chartTick} />
                          <Tooltip contentStyle={chartTooltipStyle} formatter={formatTooltipCount} />
                          <Legend />
                          <Bar dataKey="orders" name="Заявки" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Остатки по счетам учета</CardTitle>
                    {!accountsLoading && accountsData ? (
                      <CardDescription className={styles.sectionDescription}>
                        Всего в остатках: {formatCurrency(Number(accountsData.totals.inventoryAmount) || 0)}
                      </CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Счет</TableHead>
                          <TableHead className={styles.numericHead}>Сумма</TableHead>
                          <TableHead className={styles.numericHead}>Кол-во</TableHead>
                          <TableHead className={styles.numericHead}>Товаров</TableHead>
                          <TableHead className={styles.numericHead}>Доля</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountsLoading
                          ? renderEmptyTableRow(5, "Загрузка отчета...")
                          : accountsData?.inventoryByAccount?.length
                            ? accountsData.inventoryByAccount.map((row) => (
                                <TableRow key={`inventory-${row.account}`} className={styles.tableRow}>
                                  <TableCell className={styles.textCell}>
                                    <div className={styles.cellContent}>{getAccountLabel(row.account)}</div>
                                  </TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.amount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.quantity) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.items) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{`${Number(row.share || 0).toFixed(1)}%`}</TableCell>
                                </TableRow>
                              ))
                            : renderEmptyTableRow(5)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>

              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Движение по счетам учета</CardTitle>
                    <CardDescription className={styles.sectionDescription}>
                      Остаток на начало, закупки, выбытие и остаток на конец периода
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Счет</TableHead>
                          <TableHead className={styles.numericHead}>Начало</TableHead>
                          <TableHead className={styles.numericHead}>Закупки</TableHead>
                          <TableHead className={styles.numericHead}>Выбытие</TableHead>
                          <TableHead className={styles.numericHead}>Конец</TableHead>
                          <TableHead className={styles.numericHead}>Кол-во начало</TableHead>
                          <TableHead className={styles.numericHead}>Кол-во приход</TableHead>
                          <TableHead className={styles.numericHead}>Кол-во расход</TableHead>
                          <TableHead className={styles.numericHead}>Кол-во конец</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountsLoading
                          ? renderEmptyTableRow(9, "Загрузка отчета...")
                          : accountsData?.accountingMovement?.length
                            ? accountsData.accountingMovement.map((row) => (
                                <TableRow key={`movement-${row.account}`} className={styles.tableRow}>
                                  <TableCell className={styles.textCell}><div className={styles.cellContent}>{getAccountLabel(row.account)}</div></TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.openingAmount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.incomingAmount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.outgoingAmount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.closingAmount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.openingQuantity) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.incomingQuantity) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.outgoingQuantity) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.closingQuantity) || 0)}</TableCell>
                                </TableRow>
                              ))
                            : renderEmptyTableRow(9)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>

              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Расходы по счетам затрат</CardTitle>
                    {!accountsLoading && accountsData ? (
                      <CardDescription className={styles.sectionDescription}>
                        Учтено расходов за период: {formatCurrency(Number(accountsData.totals.expenseAmount) || 0)}
                      </CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Счет</TableHead>
                          <TableHead className={styles.numericHead}>Сумма</TableHead>
                          <TableHead className={styles.numericHead}>Позиций</TableHead>
                          <TableHead className={styles.numericHead}>Товаров</TableHead>
                          <TableHead className={styles.numericHead}>Доля</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountsLoading
                          ? renderEmptyTableRow(5, "Загрузка отчета...")
                          : accountsData?.expenseByAccount?.length
                            ? accountsData.expenseByAccount.map((row) => (
                                <TableRow key={`expense-${row.account}`} className={styles.tableRow}>
                                  <TableCell className={styles.textCell}><div className={styles.cellContent}>{getAccountLabel(row.account)}</div></TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.amount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.positions) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.products) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{`${Number(row.share || 0).toFixed(1)}%`}</TableCell>
                                </TableRow>
                              ))
                            : renderEmptyTableRow(5)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>

              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Структура затрат по месяцам</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.chartCardContent}>
                  <div className={styles.chartBox}>
                    {accountsLoading ? (
                      <PageLoader label="Загрузка отчета..." />
                    ) : expenseStructureChartData.length ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={expenseStructureChartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={chartTick} />
                          <YAxis tick={chartTick} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={formatTooltipExpense}
                            labelFormatter={formatTooltipLabel}
                          />
                          <Legend formatter={(value: string) => getAccountLabel(value)} />
                          {expenseStructureKeys.map((account, index) => (
                            <Bar
                              key={account}
                              dataKey={account}
                              name={account}
                              stackId="expense-accounts"
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                              radius={index === expenseStructureKeys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.emptyState}>Нет данных</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Детализация расходов до товара</CardTitle>
                    {!accountsLoading && accountsData?.expenseDetails?.length ? (
                      <CardDescription className={styles.sectionDescription}>
                        Топ позиций по расходам внутри счетов затрат
                      </CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Счет</TableHead>
                          <TableHead>Товар</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead className={styles.numericHead}>Сумма</TableHead>
                          <TableHead className={styles.numericHead}>Записей</TableHead>
                          <TableHead className={styles.numericHead}>Доля в счете</TableHead>
                          <TableHead className={styles.numericHead}>Доля общая</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountsLoading
                          ? renderEmptyTableRow(7, "Загрузка отчета...")
                          : accountsData?.expenseDetails?.length
                            ? accountsData.expenseDetails.map((row) => (
                                <TableRow key={`expense-detail-${row.account}-${row.productId ?? row.productName}`} className={styles.tableRow}>
                                  <TableCell className={styles.textCell}><div className={styles.cellContent}>{getAccountLabel(row.account)}</div></TableCell>
                                  <TableCell className={styles.textCell}><div className={styles.cellContent}>{row.productName}</div></TableCell>
                                  <TableCell className={styles.textCell}>{row.nomenclatureType ? formatCell(row.nomenclatureType) : "-"}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCurrency(Number(row.amount) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{formatCell(Number(row.records) || 0)}</TableCell>
                                  <TableCell className={styles.numericCell}>{`${Number(row.shareWithinAccount || 0).toFixed(1)}%`}</TableCell>
                                  <TableCell className={styles.numericCell}>{`${Number(row.share || 0).toFixed(1)}%`}</TableCell>
                                </TableRow>
                              ))
                            : renderEmptyTableRow(7)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {displayedTab === "sales" && canSalesTab ? (
            <div className={styles.blocksGrid}>
              <Card className={styles.sectionCard}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Продажи по месяцам</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.chartCardContent}>
                  <div className={styles.chartBox}>
                    {overviewLoading || !overviewData ? (
                      <PageLoader label="Загрузка отчета..." />
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={salesChartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={chartTick} />
                          <YAxis tick={chartTick} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={formatTooltipCurrency}
                            labelFormatter={formatTooltipLabel}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="expense" name="Расход" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={styles.sectionCard}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Рентабельность по категориям</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.chartCardContent}>
                  <div className={styles.progressList}>
                    {overviewLoading || !overviewData ? (
                      <PageLoader label="Загрузка отчета..." />
                    ) : overviewData.byCategory.length ? (
                      overviewData.byCategory.map((category, index) => {
                        const value = Math.max(0, Math.min(100, Number(category.percent) || 0))
                        const color = CHART_COLORS[index % CHART_COLORS.length]

                        return (
                          <div key={category.name} className={styles.progressRow}>
                            <div className={styles.progressRowHead}>
                              <div className={styles.progressName}>{category.name}</div>
                              <div className={styles.progressValue}>{value.toFixed(1)}%</div>
                            </div>
                            <div className={styles.progressTrack}>
                              <div
                                className={styles.progressBar}
                                style={{
                                  width: `${value}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className={styles.emptyState}>Нет данных</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {displayedTab === "products" && canProductsTab ? (
            <div className={styles.blocksGrid}>
              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Топ товаров по продажам</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Товар</TableHead>
                          <TableHead className={styles.numericHead}>Продано</TableHead>
                          <TableHead className={styles.numericHead}>Выручка</TableHead>
                          <TableHead className={styles.numericHead}>Маржа</TableHead>
                          <TableHead className={styles.numericHead}>Динамика</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProductsLoading
                          ? renderEmptyTableRow(5, "Загрузка отчета...")
                          : topProducts && topProducts.length
                            ? topProducts.map((row) => {
                                const margin = Number(row.margin_percent) || 0
                                const trend = Number(row.trend_percent) || 0
                                const trendText = `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`

                                return (
                                  <TableRow key={row.product_id} className={styles.tableRow}>
                                    <TableCell className={styles.textCell}>
                                      <div className={styles.cellContent}>{row.product_name}</div>
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>
                                      {`${Number(row.sold_units || 0).toLocaleString("ru-RU")} шт`}
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>{formatCurrency(Number(row.revenue) || 0)}</TableCell>
                                    <TableCell className={styles.numericCell}>
                                      <Badge variant="outline" className={styles.successBadge}>
                                        {`${margin.toFixed(1)}%`}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>
                                      <span className={trend >= 0 ? styles.positiveText : styles.negativeText}>
                                        {trendText}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            : renderEmptyTableRow(5)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>

              {(VIEWS_BY_TAB.products || []).map((viewName) => renderViewBlock(viewName))}
            </div>
          ) : null}

          {displayedTab === "clients" && canClientsTab ? (
            <div className={styles.blocksGrid}>
              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Топ клиенты</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Клиент</TableHead>
                          <TableHead className={styles.numericHead}>Заказы</TableHead>
                          <TableHead className={styles.numericHead}>Выручка</TableHead>
                          <TableHead className={styles.numericHead}>Средний чек</TableHead>
                          <TableHead className={styles.numericHead}>Рост</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topClientsLoading
                          ? renderEmptyTableRow(5, "Загрузка отчета...")
                          : topClients && topClients.length
                            ? topClients.map((row) => {
                                const growth = Number(row.growth_percent) || 0
                                const growthText = `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`

                                return (
                                  <TableRow key={row.client_id} className={styles.tableRow}>
                                    <TableCell className={styles.textCell}>
                                      <div className={styles.cellContent}>{row.client_name}</div>
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>{Number(row.orders_count || 0).toLocaleString("ru-RU")}</TableCell>
                                    <TableCell className={styles.numericCell}>{formatCurrency(Number(row.revenue) || 0)}</TableCell>
                                    <TableCell className={styles.numericCell}>{formatCurrency(Number(row.avg_check) || 0)}</TableCell>
                                    <TableCell className={styles.numericCell}>
                                      <span className={growth >= 0 ? styles.positiveText : styles.negativeText}>
                                        {growthText}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            : renderEmptyTableRow(5)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {displayedTab === "logistics" && canLogisticsTab ? (
            <div className={styles.blocksGrid}>
              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Эффективность транспортных компаний</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Транспортная компания</TableHead>
                          <TableHead className={styles.numericHead}>Отгрузки</TableHead>
                          <TableHead className={styles.numericHead}>Вовремя</TableHead>
                          <TableHead className={styles.numericHead}>Рейтинг</TableHead>
                          <TableHead className={styles.numericHead}>Средняя стоимость</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transportPerfLoading
                          ? renderEmptyTableRow(5, "Загрузка отчета...")
                          : transportPerf && transportPerf.length
                            ? transportPerf.map((row) => {
                                const rating = Math.max(0, Math.min(100, Number(row.rating_percent) || 0))
                                const shipments = Number(row.shipments) || 0
                                const onTime = Number(row.on_time) || 0

                                return (
                                  <TableRow key={row.transport_id} className={styles.tableRow}>
                                    <TableCell className={styles.textCell}>
                                      <div className={styles.cellContent}>{row.transport_name}</div>
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>{shipments.toLocaleString("ru-RU")}</TableCell>
                                    <TableCell className={styles.numericCell}>
                                      <div className={styles.inlineMetric}>
                                        <span>{onTime.toLocaleString("ru-RU")}</span>
                                        <Badge variant="outline" className={styles.successBadge}>
                                          {`${rating.toFixed(1)}%`}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>
                                      <div className={styles.ratingCell}>
                                        <div className={styles.ratingTrack}>
                                          <div
                                            className={styles.ratingFill}
                                            style={{ width: `${rating}%` }}
                                          />
                                        </div>
                                        <span className={styles.ratingValue}>{`${rating.toFixed(1)}%`}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className={styles.numericCell}>{formatCurrency(Number(row.avg_cost) || 0)}</TableCell>
                                  </TableRow>
                                )
                              })
                            : renderEmptyTableRow(5)}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {displayedTab === "custom" && canCustomTab ? (
            <div className={styles.blocksGrid}>
              <Card className={cn(styles.sectionCard, styles.sectionCardWide)}>
                <CardHeader className={styles.sectionHeader}>
                  <div className={styles.sectionCopy}>
                    <CardTitle className={styles.sectionTitle}>Пользовательские отчеты</CardTitle>
                    <CardDescription className={styles.sectionDescription}>
                      Отчеты из базы данных
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className={styles.tableCardContent}>
                  <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Отчет</TableHead>
                          <TableHead>Описание</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.length ? (
                          reports.map((report) => (
                            <TableRow
                              key={report.id}
                              className={cn(styles.tableRow, styles.clickableRow)}
                              onClick={() =>
                                void router.push(
                                  `/reports/view?name=${encodeURIComponent(report.viewName)}&tab=custom`
                                )
                              }
                              role="link"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  void router.push(
                                    `/reports/view?name=${encodeURIComponent(report.viewName)}&tab=custom`
                                  )
                                }
                              }}
                            >
                              <TableCell className={styles.textCell}>
                                <div className={styles.customReportTitle}>{report.title}</div>
                              </TableCell>
                              <TableCell className={styles.textCell}>
                                <div className={styles.customReportDesc}>{report.description}</div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          renderEmptyTableRow(2)
                        )}
                      </TableBody>
                    </Table>
                  </EntityTableSurface>
                </CardContent>
              </Card>
            </div>
          ) : null}
          </div>
          {isTabLoaderVisible ? (
            <div className={styles.tabLoadingState}>
              <PageLoader label="Загрузка отчета..." />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default withLayout(ReportsPage)
