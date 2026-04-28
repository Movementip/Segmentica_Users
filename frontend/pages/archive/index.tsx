import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"
import { AnimatePresence, motion } from "framer-motion"

import { ArchiveViewTabs, type ArchiveViewTab } from "@/components/archive/ArchiveViewTabs/ArchiveViewTabs"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import {
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"
import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
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
import { Layout } from "@/layout/Layout"
import { cn } from "@/lib/utils"
import { formatRuCurrency, formatRuDate, formatRuDateTime } from "@/utils/formatters"

import styles from "./Archive.module.css"

const MotionTableRow = motion(TableRow)

interface CompletedOrder {
  id: number
  клиент_id: number
  менеджер_id: number | null
  дата_создания: string
  дата_выполнения: string | null
  статус: string
  общая_сумма: number
  адрес_доставки: string | null
  клиент_название: string
  менеджер_фио: string | null
  количество_позиций: number
}

interface CompletedPurchase {
  id: number
  поставщик_id: number
  заявка_id: number | null
  дата_заказа: string
  дата_поступления: string | null
  статус: string
  общая_сумма: number
  поставщик_название: string
  количество_позиций: number
}

interface CompletedShipment {
  id: number
  заявка_id: number
  транспорт_id: number
  статус: string
  номер_отслеживания: string | null
  дата_отгрузки: string
  стоимость_доставки: number | null
  заявка_номер: number
  клиент_название: string
  транспорт_название: string
}

interface EmployeePayment {
  id: number
  дата?: string
  сумма?: number
  сотрудник_id?: number
  сотрудник_фио?: string
  сотрудник_должность?: string
  заявка_id?: number | null
  заявка_номер?: number | null
  [key: string]: unknown
}

interface FinancialRecord {
  id: number
  дата?: string
  сумма?: number
  тип?: string
  тип_операции?: string
  описание?: string
  комментарий?: string
  заявка_id?: number | null
  закупка_id?: number | null
  отгрузка_id?: number | null
  заявка_номер?: number | null
  закупка_номер?: number | null
  отгрузка_номер?: number | null
  [key: string]: unknown
}

interface ArchivedBitrixRequest {
  id: number
  source_form_name?: string | null
  source_entry_name?: string | null
  person_name?: string | null
  phone?: string | null
  email?: string | null
  product_name?: string | null
  message?: string | null
  imported_at?: string | null
  processed_at?: string | null
  notes?: string | null
}

interface ArchiveStatistics {
  завершенные_заявки: number
  завершенные_закупки: number
  завершенные_отгрузки: number
  всего_выплат: number
  финансовых_записей: number
  выручка_от_заявок: number | null
  затраты_на_закупки: number | null
  общие_выплаты: number | null
  заявок_битрикс?: number
}

interface ArchiveData {
  completedOrders: CompletedOrder[]
  completedPurchases: CompletedPurchase[]
  completedShipments: CompletedShipment[]
  employeePayments: EmployeePayment[]
  financialRecords: FinancialRecord[]
  bitrixRequests: ArchivedBitrixRequest[]
  statistics: ArchiveStatistics
}

type StatusFilter = "all" | "done" | "canceled"
type PeriodFilter = "all" | "30d" | "7d"

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: "all", label: "Весь период" },
  { value: "30d", label: "Последние 30 дней" },
  { value: "7d", label: "Последние 7 дней" },
]

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Все статусы" },
  { value: "done", label: "Завершено" },
  { value: "canceled", label: "Отменено" },
]

export default function Archive(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [data, setData] = useState<ArchiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ArchiveViewTab>("orders")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all")
  const [tableKey, setTableKey] = useState(0)
  const hasRestoredFromQueryRef = useRef(false)

  const canOrdersTab = Boolean(user?.permissions?.includes("archive.orders.list"))
  const canPurchasesTab = Boolean(user?.permissions?.includes("archive.purchases.list"))
  const canShipmentsTab = Boolean(user?.permissions?.includes("archive.shipments.list"))
  const canPaymentsTab = Boolean(user?.permissions?.includes("archive.payments.list"))
  const canFinanceTab = Boolean(user?.permissions?.includes("archive.finance.list"))
  const canBitrixTab = Boolean(user?.permissions?.includes("archive.bitrix_requests.list"))

  const canOrdersRow = Boolean(user?.permissions?.includes("archive.orders.view"))
  const canPurchasesRow = Boolean(user?.permissions?.includes("archive.purchases.view"))
  const canShipmentsRow = Boolean(user?.permissions?.includes("archive.shipments.view"))

  const canArchive =
    canOrdersTab || canPurchasesTab || canShipmentsTab || canPaymentsTab || canFinanceTab || canBitrixTab

  const availableTabs = useMemo(() => {
    const tabs: Array<{ value: ArchiveViewTab; label: string }> = []
    if (canOrdersTab) tabs.push({ value: "orders", label: "Заявки" })
    if (canPurchasesTab) tabs.push({ value: "purchases", label: "Закупки" })
    if (canShipmentsTab) tabs.push({ value: "shipments", label: "Отгрузки" })
    if (canPaymentsTab) tabs.push({ value: "payments", label: "Выплаты" })
    if (canFinanceTab) tabs.push({ value: "finance", label: "Финансы" })
    if (canBitrixTab) tabs.push({ value: "bitrix", label: "Битрикс24" })
    return tabs
  }, [canBitrixTab, canFinanceTab, canOrdersTab, canPaymentsTab, canPurchasesTab, canShipmentsTab])

  useEffect(() => {
    if (authLoading) return
    const allowedValues = availableTabs.map((tab) => tab.value)
    if (!allowedValues.includes(activeTab)) {
      setActiveTab(availableTabs[0]?.value ?? "orders")
    }
  }, [activeTab, authLoading, availableTabs])

  useEffect(() => {
    if (authLoading) return
    if (!canArchive) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    void fetchData()
  }, [authLoading, canArchive])

  useEffect(() => {
    if (!router.isReady) return
    if (hasRestoredFromQueryRef.current) return

    const nextTab = (Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab) as
      | ArchiveViewTab
      | undefined
    const nextSearch = Array.isArray(router.query.search)
      ? router.query.search[0]
      : router.query.search
    const nextStatus = (Array.isArray(router.query.status)
      ? router.query.status[0]
      : router.query.status) as StatusFilter | undefined
    const nextPeriod = (Array.isArray(router.query.period)
      ? router.query.period[0]
      : router.query.period) as PeriodFilter | undefined

    if (availableTabs.some((tab) => tab.value === nextTab)) {
      setActiveTab(nextTab as ArchiveViewTab)
    }

    if (typeof nextSearch === "string") {
      setSearch(nextSearch)
      setDebouncedSearch(nextSearch)
    }

    if (nextStatus === "all" || nextStatus === "done" || nextStatus === "canceled") {
      setStatusFilter(nextStatus)
    }

    if (nextPeriod === "all" || nextPeriod === "30d" || nextPeriod === "7d") {
      setPeriodFilter(nextPeriod)
    }

    hasRestoredFromQueryRef.current = true
  }, [availableTabs, router.isReady, router.query])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!router.isReady) return
    if (!hasRestoredFromQueryRef.current) return

    const query: Record<string, string> = {}

    if (activeTab !== "orders") query.tab = activeTab
    if (debouncedSearch.trim()) query.search = debouncedSearch.trim()
    if (statusFilter !== "all") query.status = statusFilter
    if (periodFilter !== "all") query.period = periodFilter

    const currentTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    const currentSearch = Array.isArray(router.query.search)
      ? router.query.search[0]
      : router.query.search
    const currentStatus = Array.isArray(router.query.status)
      ? router.query.status[0]
      : router.query.status
    const currentPeriod = Array.isArray(router.query.period)
      ? router.query.period[0]
      : router.query.period

    const nextTab = query.tab || undefined
    const nextSearch = query.search || undefined
    const nextStatus = query.status || undefined
    const nextPeriod = query.period || undefined

    const unchanged =
      String(currentTab || "") === String(nextTab || "") &&
      String(currentSearch || "") === String(nextSearch || "") &&
      String(currentStatus || "") === String(nextStatus || "") &&
      String(currentPeriod || "") === String(nextPeriod || "")

    if (unchanged) return

    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [activeTab, debouncedSearch, periodFilter, router, router.isReady, router.query, statusFilter])

  useEffect(() => {
    if (loading) return
    setTableKey((current) => current + 1)
  }, [activeTab, loading])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/archive")
      if (!response.ok) throw new Error("Ошибка загрузки архива")
      const result = await response.json()
      setData(result)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки архива")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => formatRuDate(dateString)

  const formatDateTime = (dateString: string) => formatRuDateTime(dateString)

  const formatCurrency = useCallback((amount: number | null | undefined) => {
    return formatRuCurrency(amount, { fallback: "-" })
  }, [])

  const isWithinPeriod = useCallback(
    (dateString?: string | null) => {
      if (!dateString || periodFilter === "all") return true

      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return true

      const now = new Date()
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      if (periodFilter === "30d") return diffDays <= 30
      if (periodFilter === "7d") return diffDays <= 7
      return true
    },
    [periodFilter]
  )

  const getStatusTone = useCallback((statusRaw: string) => {
    const status = (statusRaw || "").toLowerCase()
    if (status === "выполнена" || status === "доставлено" || status === "получено") {
      return "success" as const
    }
    if (status === "отменена" || status === "отменено") {
      return "danger" as const
    }
    return "neutral" as const
  }, [])

  const matchesStatus = useCallback(
    (statusRaw: string) => {
      if (statusFilter === "all") return true
      const status = (statusRaw || "").toLowerCase()
      const isDone =
        status === "выполнена" || status === "доставлено" || status === "получено"
      const isCanceled = status === "отменена" || status === "отменено"
      if (statusFilter === "done") return isDone
      if (statusFilter === "canceled") return isCanceled
      return true
    },
    [statusFilter]
  )

  const normalizedQuery = debouncedSearch.trim().toLowerCase()

  const filteredOrders = useMemo(() => {
    if (!data) return []
    return data.completedOrders.filter((item) => {
      if (!matchesStatus(item.статус)) return false
      if (!isWithinPeriod(item.дата_выполнения || item.дата_создания)) return false
      if (!normalizedQuery) return true
      return (
        String(item.id).includes(normalizedQuery) ||
        (item.клиент_название || "").toLowerCase().includes(normalizedQuery) ||
        (item.менеджер_фио || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data, isWithinPeriod, matchesStatus, normalizedQuery])

  const filteredPurchases = useMemo(() => {
    if (!data) return []
    return data.completedPurchases.filter((item) => {
      if (!matchesStatus(item.статус)) return false
      if (!isWithinPeriod(item.дата_поступления || item.дата_заказа)) return false
      if (!normalizedQuery) return true
      return (
        String(item.id).includes(normalizedQuery) ||
        (item.поставщик_название || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data, isWithinPeriod, matchesStatus, normalizedQuery])

  const filteredShipments = useMemo(() => {
    if (!data) return []
    return data.completedShipments.filter((item) => {
      if (!matchesStatus(item.статус)) return false
      if (!isWithinPeriod(item.дата_отгрузки)) return false
      if (!normalizedQuery) return true
      return (
        String(item.id).includes(normalizedQuery) ||
        String(item.заявка_номер).includes(normalizedQuery) ||
        (item.клиент_название || "").toLowerCase().includes(normalizedQuery) ||
        (item.транспорт_название || "").toLowerCase().includes(normalizedQuery) ||
        (item.номер_отслеживания || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data, isWithinPeriod, matchesStatus, normalizedQuery])

  const filteredPayments = useMemo(() => {
    if (!data) return []
    return data.employeePayments.filter((item) => {
      if (!isWithinPeriod(item.дата)) return false
      if (!normalizedQuery) return true
      return (
        String(item.id).includes(normalizedQuery) ||
        String(item.заявка_номер || item.заявка_id || "").includes(normalizedQuery) ||
        String(item.сотрудник_фио || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data, isWithinPeriod, normalizedQuery])

  const paymentsByMonth = useMemo(() => {
    const totals = new Map<
      string,
      { month: string; count: number; total: number; uniqueEmployees: number }
    >()
    const employees = new Map<string, Set<string>>()

    filteredPayments.forEach((item) => {
      const date = item.дата ? new Date(item.дата) : null
      const key =
        date && !Number.isNaN(date.getTime())
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          : "—"

      const current = totals.get(key) || {
        month: key,
        count: 0,
        total: 0,
        uniqueEmployees: 0,
      }

      current.count += 1
      current.total += Number(item.сумма) || 0
      totals.set(key, current)

      const currentEmployees = employees.get(key) || new Set<string>()
      if (item.сотрудник_фио) currentEmployees.add(String(item.сотрудник_фио))
      employees.set(key, currentEmployees)
    })

    return Array.from(totals.values())
      .map((item) => ({
        ...item,
        uniqueEmployees: employees.get(item.month)?.size || 0,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
  }, [filteredPayments])

  const filteredFinance = useMemo(() => {
    if (!data) return []
    return data.financialRecords.filter((item) => {
      if (!isWithinPeriod(item.дата)) return false
      if (!normalizedQuery) return true
      return (
        String(item.id).includes(normalizedQuery) ||
        String(item.описание || item.комментарий || "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(item.заявка_номер || item.закупка_номер || item.отгрузка_номер || "").includes(
          normalizedQuery
        )
      )
    })
  }, [data, isWithinPeriod, normalizedQuery])

  const filteredBitrixRequests = useMemo(() => {
    if (!data) return []
    return (data.bitrixRequests || []).filter((item) => {
      if (!isWithinPeriod(item.processed_at || item.imported_at)) return false
      if (!normalizedQuery) return true
      return (
        String(item.id).includes(normalizedQuery) ||
        String(item.person_name || item.source_entry_name || "").toLowerCase().includes(normalizedQuery) ||
        String(item.phone || item.email || "").toLowerCase().includes(normalizedQuery) ||
        String(item.product_name || "").toLowerCase().includes(normalizedQuery) ||
        String(item.message || item.notes || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data, isWithinPeriod, normalizedQuery])

  const financeTotals = useMemo(() => {
    let income = 0
    let expense = 0

    filteredFinance.forEach((item) => {
      const rawType = String(item.тип_операции || item.тип || "").toLowerCase()
      const amount = Number(item.сумма) || 0
      const isExpense =
        rawType.includes("расход") ||
        rawType.includes("спис") ||
        rawType.includes("оплата") ||
        rawType.includes("покуп")

      if (isExpense) expense += amount
      else income += amount
    })

    return { income, expense }
  }, [filteredFinance])

  const stats = data?.statistics

  const archiveStatsItems = useMemo(
    () =>
      [
        canOrdersTab
          ? {
              label: "Завершенных заявок",
              value: (stats?.завершенные_заявки ?? 0).toLocaleString("ru-RU"),
            }
          : null,
        canPurchasesTab
          ? {
              label: "Завершенных закупок",
              value: (stats?.завершенные_закупки ?? 0).toLocaleString("ru-RU"),
            }
          : null,
        canShipmentsTab
          ? {
              label: "Завершенных отгрузок",
              value: (stats?.завершенные_отгрузки ?? 0).toLocaleString("ru-RU"),
            }
          : null,
        canOrdersTab
          ? {
              label: "Общая выручка",
              value: formatCurrency(stats?.выручка_от_заявок ?? 0),
            }
          : null,
        canBitrixTab
          ? {
              label: "Заявок Битрикс24",
              value: (stats?.заявок_битрикс ?? 0).toLocaleString("ru-RU"),
            }
          : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    [canBitrixTab, canOrdersTab, canPurchasesTab, canShipmentsTab, formatCurrency, stats]
  )

  const searchPlaceholder =
    activeTab === "payments"
      ? "Поиск по сотруднику или заявке..."
      : activeTab === "finance"
        ? "Поиск по описанию или номеру..."
        : activeTab === "bitrix"
          ? "Поиск по клиенту, товару или контакту..."
        : "Поиск по названию или коду..."

  const archiveSkeletonConfig = useMemo(() => {
    if (activeTab === "purchases") {
      return { columns: 7, rows: 7, actionColumn: false }
    }

    if (activeTab === "shipments") {
      return { columns: 8, rows: 7, actionColumn: false }
    }

    if (activeTab === "payments") {
      return { columns: 4, rows: 7, actionColumn: false }
    }

    if (activeTab === "finance") {
      return { columns: 5, rows: 7, actionColumn: false }
    }

    if (activeTab === "bitrix") {
      return { columns: 7, rows: 7, actionColumn: false }
    }

    return { columns: 8, rows: 7, actionColumn: false }
  }, [activeTab])

  const renderEmptyRow = (colSpan: number) => (
    <TableRow>
      <TableCell colSpan={colSpan} className={styles.emptyCell}>
        Нет данных
      </TableCell>
    </TableRow>
  )

  if (authLoading) {
    return (
      <Layout>
        <div className={styles.container}>
          <EntityIndexPageSkeleton
            ariaLabel="Загрузка архива"
            title="Статистика архива"
            columns={8}
            rows={7}
            actionColumn={false}
          />
        </div>
      </Layout>
    )
  }

  if (!canArchive) {
    return (
      <Layout>
        <NoAccessPage />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <PageHeader
            title="Архив"
            subtitle="Завершенные заявки, закупки и отгрузки"
          />
        </div>

        {loading ? (
          <EntityIndexPageSkeleton
            ariaLabel="Загрузка архива"
            title="Статистика архива"
            columns={archiveSkeletonConfig.columns}
            rows={archiveSkeletonConfig.rows}
            actionColumn={archiveSkeletonConfig.actionColumn}
          />
        ) : error || !data ? (
          <section className={styles.feedbackSurface}>
            <h2 className={styles.feedbackTitle}>Ошибка</h2>
            <p className={styles.feedbackText}>{error || "Ошибка загрузки данных"}</p>
            <button type="button" className={styles.retryButton} onClick={fetchData}>
              Повторить
            </button>
          </section>
        ) : (
          <section className={styles.tableSection}>
            <div className={styles.contentCard}>
              <EntityStatsPanel
                title="Статистика архива"
                items={archiveStatsItems}
                variant="embedded"
                className={styles.statsPanel}
              />

              <div className={styles.tabsWrap}>
                <ArchiveViewTabs
                  activeTab={activeTab}
                  tabs={availableTabs}
                  onChange={(tab) => setActiveTab(tab)}
                />
              </div>

              <div className={styles.tableHeader}>
                <DataSearchField
                  value={search}
                  onValueChange={setSearch}
                  placeholder={searchPlaceholder}
                  wrapperClassName={styles.searchField}
                />

                <div className={styles.tableHeaderActions}>
                  <Select
                    value={periodFilter}
                    items={PERIOD_OPTIONS}
                    onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}
                  >
                    <SelectTrigger
                      className={styles.filterSelect}
                      placeholder="Весь период"
                    />
                    <SelectContent>
                      {PERIOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {activeTab !== "payments" && activeTab !== "finance" && activeTab !== "bitrix" ? (
                    <Select
                      value={statusFilter}
                      items={STATUS_OPTIONS}
                      onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                    >
                      <SelectTrigger
                        className={styles.filterSelect}
                        placeholder="Все статусы"
                      />
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </div>

              {activeTab === "orders" ? (
                <EntityTableSurface
                  key={`orders-${tableKey}`}
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
              >
                <Table className={cn(entityTableClassName, styles.table)}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>Контрагент</TableHead>
                      <TableHead>Менеджер</TableHead>
                      <TableHead>Позиций</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата создания</TableHead>
                      <TableHead>Дата выполнения</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length ? (
                      <AnimatePresence>
                        {filteredOrders.map((item) => (
                          <MotionTableRow
                            key={item.id}
                            className={cn(
                              styles.tableRow,
                              canOrdersRow && styles.clickableRow
                            )}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                              if (!canOrdersRow) return
                              void router.push(`/orders/${item.id}`)
                            }}
                          >
                            <TableCell>#{item.id}</TableCell>
                            <TableCell>{item.клиент_название}</TableCell>
                            <TableCell>{item.менеджер_фио || "-"}</TableCell>
                            <TableCell>{item.количество_позиций}</TableCell>
                            <TableCell>{formatCurrency(item.общая_сумма)}</TableCell>
                            <TableCell>
                              <EntityStatusBadge
                                value={item.статус}
                                label={item.статус}
                                tone={getStatusTone(item.статус)}
                              />
                            </TableCell>
                            <TableCell>{formatDate(item.дата_создания)}</TableCell>
                            <TableCell>
                              {item.дата_выполнения ? formatDate(item.дата_выполнения) : "-"}
                            </TableCell>
                          </MotionTableRow>
                        ))}
                      </AnimatePresence>
                    ) : (
                      renderEmptyRow(8)
                    )}
                  </TableBody>
                </Table>
              </EntityTableSurface>
            ) : null}

            {activeTab === "purchases" ? (
              <EntityTableSurface
                key={`purchases-${tableKey}`}
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
              >
                <Table className={cn(entityTableClassName, styles.table)}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>Поставщик</TableHead>
                      <TableHead>Позиций</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата заказа</TableHead>
                      <TableHead>Дата поступления</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.length ? (
                      <AnimatePresence>
                        {filteredPurchases.map((item) => (
                          <MotionTableRow
                            key={item.id}
                            className={cn(
                              styles.tableRow,
                              canPurchasesRow && styles.clickableRow
                            )}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                              if (!canPurchasesRow) return
                              void router.push(`/purchases/${item.id}`)
                            }}
                          >
                            <TableCell>#{item.id}</TableCell>
                            <TableCell>{item.поставщик_название}</TableCell>
                            <TableCell>{item.количество_позиций}</TableCell>
                            <TableCell>{formatCurrency(item.общая_сумма)}</TableCell>
                            <TableCell>
                              <EntityStatusBadge
                                value={item.статус}
                                label={item.статус}
                                tone={getStatusTone(item.статус)}
                              />
                            </TableCell>
                            <TableCell>{formatDate(item.дата_заказа)}</TableCell>
                            <TableCell>
                              {item.дата_поступления ? formatDate(item.дата_поступления) : "-"}
                            </TableCell>
                          </MotionTableRow>
                        ))}
                      </AnimatePresence>
                    ) : (
                      renderEmptyRow(7)
                    )}
                  </TableBody>
                </Table>
              </EntityTableSurface>
            ) : null}

            {activeTab === "shipments" ? (
              <EntityTableSurface
                key={`shipments-${tableKey}`}
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
              >
                <Table className={cn(entityTableClassName, styles.table)}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>Трек</TableHead>
                      <TableHead>Заявка</TableHead>
                      <TableHead>Контрагент</TableHead>
                      <TableHead>Транспорт</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата отгрузки</TableHead>
                      <TableHead>Стоимость</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShipments.length ? (
                      <AnimatePresence>
                        {filteredShipments.map((item) => (
                          <MotionTableRow
                            key={item.id}
                            className={cn(
                              styles.tableRow,
                              canShipmentsRow && styles.clickableRow
                            )}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                              if (!canShipmentsRow) return
                              void router.push(`/shipments/${item.id}`)
                            }}
                          >
                            <TableCell>#{item.id}</TableCell>
                            <TableCell>{item.номер_отслеживания || "-"}</TableCell>
                            <TableCell>#{item.заявка_номер}</TableCell>
                            <TableCell>{item.клиент_название}</TableCell>
                            <TableCell>{item.транспорт_название}</TableCell>
                            <TableCell>
                              <EntityStatusBadge
                                value={item.статус}
                                label={item.статус}
                                tone={getStatusTone(item.статус)}
                              />
                            </TableCell>
                            <TableCell>{formatDateTime(item.дата_отгрузки)}</TableCell>
                            <TableCell>{formatCurrency(item.стоимость_доставки)}</TableCell>
                          </MotionTableRow>
                        ))}
                      </AnimatePresence>
                    ) : (
                      renderEmptyRow(8)
                    )}
                  </TableBody>
                </Table>
              </EntityTableSurface>
            ) : null}

            {activeTab === "payments" ? (
              <div className={styles.sectionStack}>
                <EntityTableSurface
                  key={`payments-summary-${tableKey}`}
                  variant="embedded"
                  clip="bottom"
                  className={styles.tableSurface}
                >
                  <Table className={cn(entityTableClassName, styles.table)}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Месяц</TableHead>
                        <TableHead>Выплат</TableHead>
                        <TableHead>Сотрудников</TableHead>
                        <TableHead>Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsByMonth.length ? (
                        <AnimatePresence>
                          {paymentsByMonth.map((item) => (
                            <MotionTableRow
                              key={item.month}
                              className={styles.tableRow}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <TableCell>{item.month}</TableCell>
                              <TableCell>{item.count.toLocaleString("ru-RU")}</TableCell>
                              <TableCell>
                                {item.uniqueEmployees.toLocaleString("ru-RU")}
                              </TableCell>
                              <TableCell>{formatCurrency(item.total)}</TableCell>
                            </MotionTableRow>
                          ))}
                        </AnimatePresence>
                      ) : (
                        renderEmptyRow(4)
                      )}
                    </TableBody>
                  </Table>
                </EntityTableSurface>

                <EntityTableSurface
                  key={`payments-details-${tableKey}`}
                  variant="embedded"
                  clip="bottom"
                  className={styles.tableSurface}
                >
                  <Table className={cn(entityTableClassName, styles.table)}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Заявка</TableHead>
                        <TableHead>Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.length ? (
                        <AnimatePresence>
                          {filteredPayments.map((item) => (
                            <MotionTableRow
                              key={item.id}
                              className={styles.tableRow}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <TableCell>{item.дата ? formatDate(item.дата) : "-"}</TableCell>
                              <TableCell>{item.сотрудник_фио || "-"}</TableCell>
                              <TableCell>
                                {item.заявка_номер
                                  ? `#${item.заявка_номер}`
                                  : item.заявка_id
                                    ? `#${item.заявка_id}`
                                    : "-"}
                              </TableCell>
                              <TableCell>{formatCurrency(item.сумма)}</TableCell>
                            </MotionTableRow>
                          ))}
                        </AnimatePresence>
                      ) : (
                        renderEmptyRow(4)
                      )}
                    </TableBody>
                  </Table>
                </EntityTableSurface>
              </div>
            ) : null}

            {activeTab === "bitrix" ? (
              <EntityTableSurface
                key={`bitrix-${tableKey}`}
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
              >
                <Table className={cn(entityTableClassName, styles.table)}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Контакты</TableHead>
                      <TableHead>Товар</TableHead>
                      <TableHead>Комментарий</TableHead>
                      <TableHead>Обработано</TableHead>
                      <TableHead>Заметка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBitrixRequests.length ? (
                      <AnimatePresence>
                        {filteredBitrixRequests.map((item) => (
                          <MotionTableRow
                            key={item.id}
                            className={styles.tableRow}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <TableCell>#{item.id}</TableCell>
                            <TableCell>{item.person_name || item.source_entry_name || "-"}</TableCell>
                            <TableCell>
                              {[item.phone, item.email].map((value) => value?.trim()).filter(Boolean).join(" · ") || "-"}
                            </TableCell>
                            <TableCell>{item.product_name || "-"}</TableCell>
                            <TableCell>{item.message || "-"}</TableCell>
                            <TableCell>{item.processed_at ? formatDateTime(item.processed_at) : "-"}</TableCell>
                            <TableCell>{item.notes || "-"}</TableCell>
                          </MotionTableRow>
                        ))}
                      </AnimatePresence>
                    ) : (
                      renderEmptyRow(7)
                    )}
                  </TableBody>
                </Table>
              </EntityTableSurface>
            ) : null}

            {activeTab === "finance" ? (
              <div className={styles.sectionStack}>
                <EntityStatsPanel
                  title="Финансы архива"
                  items={[
                    { label: "Приход", value: formatCurrency(financeTotals.income) },
                    { label: "Расход", value: formatCurrency(financeTotals.expense) },
                    {
                      label: "Записей",
                      value: filteredFinance.length.toLocaleString("ru-RU"),
                    },
                    {
                      label: "Разница",
                      value: formatCurrency(financeTotals.income - financeTotals.expense),
                    },
                  ]}
                  variant="embedded"
                  className={styles.financeStatsPanel}
                />

                <EntityTableSurface
                  key={`finance-${tableKey}`}
                  variant="embedded"
                  clip="bottom"
                  className={styles.tableSurface}
                >
                  <Table className={cn(entityTableClassName, styles.table)}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Источник</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead>Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinance.length ? (
                        <AnimatePresence>
                          {filteredFinance.map((item) => {
                            const rawType = String(item.тип_операции || item.тип || "").toLowerCase()
                            const isExpense =
                              rawType.includes("расход") ||
                              rawType.includes("спис") ||
                              rawType.includes("оплата") ||
                              rawType.includes("покуп")
                            const typeLabel = rawType ? (isExpense ? "РАСХОД" : "ПРИХОД") : "—"
                            const source = item.заявка_номер
                              ? `Заявка #${item.заявка_номер}`
                              : item.закупка_номер
                                ? `Закупка #${item.закупка_номер}`
                                : item.отгрузка_номер
                                  ? `Отгрузка #${item.отгрузка_номер}`
                                  : item.заявка_id
                                    ? `Заявка #${item.заявка_id}`
                                    : item.закупка_id
                                      ? `Закупка #${item.закупка_id}`
                                      : item.отгрузка_id
                                        ? `Отгрузка #${item.отгрузка_id}`
                                        : "-"

                            return (
                              <MotionTableRow
                                key={item.id}
                                className={styles.tableRow}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <TableCell>{item.дата ? formatDate(item.дата) : "-"}</TableCell>
                                <TableCell>
                                  <EntityStatusBadge
                                    value={typeLabel}
                                    label={typeLabel}
                                    tone={isExpense ? "danger" : "success"}
                                  />
                                </TableCell>
                                <TableCell>{source}</TableCell>
                                <TableCell>{item.описание || item.комментарий || "-"}</TableCell>
                                <TableCell>{formatCurrency(item.сумма)}</TableCell>
                              </MotionTableRow>
                            )
                          })}
                        </AnimatePresence>
                      ) : (
                        renderEmptyRow(5)
                      )}
                    </TableBody>
                  </Table>
                </EntityTableSurface>
              </div>
            ) : null}
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}
