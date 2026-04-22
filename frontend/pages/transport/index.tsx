import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import {
  EntityTableSkeleton,
  EntityTableSurface,
} from "@/components/EntityDataTable/EntityDataTable"
import { CreateTransportModalNew } from "@/components/modals/CreateTransportModalNew/CreateTransportModalNew"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import {
  EditTransportModalNew,
  type EditTransportModalTransportCompany,
} from "@/components/modals/EditTransportModalNew/EditTransportModalNew"
import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"
import { TransportCompaniesTable } from "@/components/transport/TransportCompaniesTable/TransportCompaniesTable"
import { TransportFilters } from "@/components/transport/TransportFilters/TransportFilters"
import { TransportPageHeader } from "@/components/transport/TransportPageHeader/TransportPageHeader"
import { TransportPageSkeleton } from "@/components/transport/TransportPageSkeleton/TransportPageSkeleton"
import { TransportShipmentsTable } from "@/components/transport/TransportShipmentsTable/TransportShipmentsTable"
import { TransportStats } from "@/components/transport/TransportStats/TransportStats"
import { TransportStatsDialog } from "@/components/transport/TransportStatsDialog/TransportStatsDialog"
import {
  TransportViewTabs,
} from "@/components/transport/TransportViewTabs/TransportViewTabs"
import {
  defaultTransportFilters,
  type TransportCompany,
  type TransportData,
  type TransportFiltersState,
  type TransportMonthShipmentRow,
  type TransportPerformanceRow,
  type TransportStatsResponse,
  type TransportViewTab,
} from "@/components/transport/types"
import { Button } from "@/components/ui/button"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"

import styles from "./Transport.module.css"

function TransportPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const canList = Boolean(user?.permissions?.includes("transport.list"))
  const canView = Boolean(user?.permissions?.includes("transport.view"))
  const canCreate = Boolean(user?.permissions?.includes("transport.create"))
  const canEdit = Boolean(user?.permissions?.includes("transport.edit"))
  const canDelete = Boolean(user?.permissions?.includes("transport.delete"))
  const canTransportStatsView = Boolean(user?.permissions?.includes("transport.stats.view"))
  const canTransportActiveShipmentsView = Boolean(
    user?.permissions?.includes("transport.active_shipments.view")
  )
  const canTransportRecentShipmentsView = Boolean(
    user?.permissions?.includes("transport.recent_shipments.view")
  )

  const [data, setData] = useState<TransportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tableKey, setTableKey] = useState(0)
  const [refreshClickKey, setRefreshClickKey] = useState(0)
  const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false)

  const [searchInputValue, setSearchInputValue] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [filters, setFilters] = useState<TransportFiltersState>(defaultTransportFilters)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TransportViewTab>("companies")

  const [attachmentsTypesByCompanyId, setAttachmentsTypesByCompanyId] = useState<
    Record<number, string[]>
  >({})

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<EditTransportModalTransportCompany | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<TransportCompany | null>(null)
  const [operationLoading, setOperationLoading] = useState(false)

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)
  const [statsCompany, setStatsCompany] = useState<TransportCompany | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState("")
  const [statsPerformance, setStatsPerformance] = useState<TransportPerformanceRow[]>([])
  const [statsPeriodTotals, setStatsPeriodTotals] = useState<
    TransportStatsResponse["periodTotals"] | null
  >(null)
  const [expandedMonth, setExpandedMonth] = useState("")
  const [monthShipmentsLoading, setMonthShipmentsLoading] = useState(false)
  const [monthShipmentsError, setMonthShipmentsError] = useState("")
  const [monthShipments, setMonthShipments] = useState<TransportMonthShipmentRow[]>([])
  const statsCompanyId = statsCompany?.id ?? null

  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const sortTriggerRef = useRef<HTMLButtonElement>(null)
  const filtersDropdownRef = useRef<HTMLDivElement>(null)
  const lastSyncedSignatureRef = useRef("")
  const hasInitializedTabTransitionRef = useRef(false)

  const syncTransportUrl = useCallback(
    (next: {
      activeShipments: TransportFiltersState["activeShipments"]
      companyName: string
      q: string
      rate: TransportFiltersState["rate"]
      sort: TransportFiltersState["sortBy"]
      tab: TransportViewTab
      totalShipments: TransportFiltersState["totalShipments"]
    }) => {
      const query = { ...router.query } as Record<string, string>

      if (next.tab !== "companies") query.tab = next.tab
      else delete query.tab

      if ((next.q || "").trim()) query.q = next.q.trim()
      else delete query.q

      if ((next.companyName || "").trim()) query.company = next.companyName.trim()
      else delete query.company

      if (next.rate !== "all") query.rate = next.rate
      else delete query.rate

      if (next.totalShipments !== "all") query.total = next.totalShipments
      else delete query.total

      if (next.activeShipments !== "all") query.active = next.activeShipments
      else delete query.active

      if (next.sort !== "shipments-desc") query.sort = next.sort
      else delete query.sort

      void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
    },
    [router]
  )

  useEffect(() => {
    if (!minRefreshSpinActive) return
    const timeoutId = window.setTimeout(() => setMinRefreshSpinActive(false), 525)
    return () => window.clearTimeout(timeoutId)
  }, [minRefreshSpinActive])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchInputValue)
    }, 250)
    return () => window.clearTimeout(timeoutId)
  }, [searchInputValue])

  useEffect(() => {
    if (!router.isReady) return

    const nextQ = Array.isArray(router.query.q) ? router.query.q[0] : router.query.q
    const nextCompany = Array.isArray(router.query.company)
      ? router.query.company[0]
      : router.query.company
    const nextRate = Array.isArray(router.query.rate) ? router.query.rate[0] : router.query.rate
    const nextTotal = Array.isArray(router.query.total)
      ? router.query.total[0]
      : router.query.total
    const nextActive = Array.isArray(router.query.active)
      ? router.query.active[0]
      : router.query.active
    const nextSort = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort
    const nextTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab

    const resolvedTab =
      nextTab === "activeShipments" && canTransportActiveShipmentsView
        ? "activeShipments"
        : nextTab === "recentShipments" && canTransportRecentShipmentsView
          ? "recentShipments"
          : "companies"

    const resolvedFilters: TransportFiltersState = {
      companyName: typeof nextCompany === "string" ? nextCompany : "",
      rate:
        nextRate === "lt-1000" || nextRate === "1000-5000" || nextRate === "gt-5000"
          ? nextRate
          : "all",
      totalShipments:
        nextTotal === "0" || nextTotal === "1-9" || nextTotal === "10+"
          ? nextTotal
          : "all",
      activeShipments:
        nextActive === "0" || nextActive === "1-4" || nextActive === "5+"
          ? nextActive
          : "all",
      sortBy:
        nextSort === "shipments-asc" ||
        nextSort === "revenue-desc" ||
        nextSort === "revenue-asc" ||
        nextSort === "created-desc" ||
        nextSort === "created-asc"
          ? nextSort
          : "shipments-desc",
    }

    const resolvedQuery = typeof nextQ === "string" ? nextQ : ""

    setActiveTab(resolvedTab)
    setSearchInputValue(resolvedQuery)
    setDebouncedSearchQuery(resolvedQuery)
    setFilters(resolvedFilters)

    lastSyncedSignatureRef.current = JSON.stringify({
      tab: resolvedTab,
      q: resolvedQuery,
      companyName: resolvedFilters.companyName,
      rate: resolvedFilters.rate,
      totalShipments: resolvedFilters.totalShipments,
      activeShipments: resolvedFilters.activeShipments,
      sort: resolvedFilters.sortBy,
    })
  }, [
    canTransportActiveShipmentsView,
    canTransportRecentShipmentsView,
    router.isReady,
    router.query.active,
    router.query.company,
    router.query.q,
    router.query.rate,
    router.query.sort,
    router.query.tab,
    router.query.total,
  ])

  useEffect(() => {
    if (!router.isReady) return

    const signature = JSON.stringify({
      tab: activeTab,
      q: debouncedSearchQuery,
      companyName: filters.companyName,
      rate: filters.rate,
      totalShipments: filters.totalShipments,
      activeShipments: filters.activeShipments,
      sort: filters.sortBy,
    })

    if (signature === lastSyncedSignatureRef.current) return
    lastSyncedSignatureRef.current = signature

    syncTransportUrl({
      activeShipments: filters.activeShipments,
      companyName: filters.companyName,
      q: debouncedSearchQuery,
      rate: filters.rate,
      sort: filters.sortBy,
      tab: activeTab,
      totalShipments: filters.totalShipments,
    })
  }, [activeTab, debouncedSearchQuery, filters, router.isReady, syncTransportUrl])

  useEffect(() => {
    if (!isFiltersOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : []
      const isInsideDropdown = path.length
        ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
        : Boolean(
            (event.target as Node | null) &&
              filtersDropdownRef.current?.contains(event.target as Node)
          )
      const targetElement = event.target instanceof Element ? event.target : null
      const isInsideSelectPortal = Boolean(
        targetElement?.closest('[data-slot="select-content"], [data-slot="select-item"]')
      )

      if (isInsideDropdown || isInsideSelectPortal) return
      setIsFiltersOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFiltersOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFiltersOpen])

  useEffect(() => {
    if (authLoading) return
    if (activeTab === "activeShipments" && !canTransportActiveShipmentsView) {
      setActiveTab("companies")
    }
    if (activeTab === "recentShipments" && !canTransportRecentShipmentsView) {
      setActiveTab("companies")
    }
  }, [
    activeTab,
    authLoading,
    canTransportActiveShipmentsView,
    canTransportRecentShipmentsView,
  ])

  useEffect(() => {
    setIsFiltersOpen(false)
  }, [activeTab])

  const fetchData = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        setError(null)
        setLoading(true)

        if (!canList) {
          setData(null)
          setAttachmentsTypesByCompanyId({})
          return
        }

        if (mode === "refresh") {
          setIsFetching(true)
          setTableKey((value) => value + 1)
        }

        const response = await fetch("/api/transport")
        const result = (await response.json().catch(() => null)) as TransportData | null

        if (!response.ok || !result) {
          throw new Error("Ошибка загрузки транспортных компаний")
        }

        const companyIds = (result.transport || [])
          .map((company) => Number(company.id))
          .filter((value) => Number.isInteger(value) && value > 0)

        let nextAttachmentsMap: Record<number, string[]> = {}

        if (companyIds.length > 0) {
          try {
            const summaryResponse = await fetch(
              `/api/attachments/summary?entity_type=transport&entity_ids=${encodeURIComponent(
                companyIds.join(",")
              )}`
            )

            if (summaryResponse.ok) {
              const summaryData = (await summaryResponse.json()) as Array<{
                entity_id: number
                types: string[]
              }>
              const nextMap: Record<number, string[]> = {}

              for (const item of Array.isArray(summaryData) ? summaryData : []) {
                const entityId = Number(item.entity_id)
                if (!Number.isInteger(entityId)) continue
                nextMap[entityId] = Array.isArray(item.types) ? item.types : []
              }

              nextAttachmentsMap = nextMap
            }
          } catch (attachmentsError) {
            console.error("Error fetching transport attachments summary:", attachmentsError)
          }
        }

        setAttachmentsTypesByCompanyId(nextAttachmentsMap)
        setData(result)
      } catch (fetchError) {
        console.error("Error fetching transport data:", fetchError)
        setError(
          fetchError instanceof Error ? fetchError.message : "Ошибка загрузки транспортных компаний"
        )
        setData(null)
      } finally {
        setLoading(false)
        setIsFetching(false)
      }
    },
    [canList]
  )

  useEffect(() => {
    if (authLoading || !canList) return
    void fetchData("initial")
  }, [authLoading, canList, fetchData])

  useEffect(() => {
    if (loading) return
    if (!hasInitializedTabTransitionRef.current) {
      hasInitializedTabTransitionRef.current = true
      return
    }

    setIsFetching(true)
    setTableKey((value) => value + 1)

    const timeoutId = window.setTimeout(() => setIsFetching(false), 180)
    return () => window.clearTimeout(timeoutId)
  }, [activeTab, loading])

  const filteredTransport = useMemo(() => {
    const companies = data?.transport || []
    const query = debouncedSearchQuery.trim().toLowerCase()

    const filtered = companies.filter((company) => {
      const matchesSearch =
        !query ||
        (company.название || "").toLowerCase().includes(query) ||
        (company.email || "").toLowerCase().includes(query) ||
        String(company.id).includes(query)

      if (!matchesSearch) return false

      const companyQuery = filters.companyName.trim().toLowerCase()
      if (companyQuery && !(company.название || "").toLowerCase().includes(companyQuery)) {
        return false
      }

      const rate = Number(company.тариф) || 0
      if (filters.rate === "lt-1000" && !(rate < 1000)) return false
      if (filters.rate === "1000-5000" && !(rate >= 1000 && rate <= 5000)) return false
      if (filters.rate === "gt-5000" && !(rate > 5000)) return false

      const total = Number(company.общее_количество_отгрузок) || 0
      if (filters.totalShipments === "0" && total !== 0) return false
      if (filters.totalShipments === "1-9" && !(total >= 1 && total <= 9)) return false
      if (filters.totalShipments === "10+" && !(total >= 10)) return false

      const active = Number(company.активные_отгрузки) || 0
      if (filters.activeShipments === "0" && active !== 0) return false
      if (filters.activeShipments === "1-4" && !(active >= 1 && active <= 4)) return false
      if (filters.activeShipments === "5+" && !(active >= 5)) return false

      return true
    })

    return [...filtered].sort((left, right) => {
      switch (filters.sortBy) {
        case "shipments-asc":
          return (left.общее_количество_отгрузок || 0) - (right.общее_количество_отгрузок || 0)
        case "revenue-desc":
          return (Number(right.общая_выручка) || 0) - (Number(left.общая_выручка) || 0)
        case "revenue-asc":
          return (Number(left.общая_выручка) || 0) - (Number(right.общая_выручка) || 0)
        case "created-desc":
          return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        case "created-asc":
          return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        case "shipments-desc":
        default:
          return (right.общее_количество_отгрузок || 0) - (left.общее_количество_отгрузок || 0)
      }
    })
  }, [data?.transport, debouncedSearchQuery, filters])

  const filteredActiveShipments = useMemo(() => {
    const shipments = data?.activeShipments || []
    const query = debouncedSearchQuery.trim().toLowerCase()
    if (!query) return shipments

    return shipments.filter((shipment) => {
      const tracking = shipment.номер_отслеживания?.toLowerCase() || ""
      const companyName = shipment.транспорт_название?.toLowerCase() || ""
      const clientName = shipment.клиент_название?.toLowerCase() || ""
      const status = shipment.заявка_статус?.toLowerCase() || ""

      return (
        tracking.includes(query) ||
        companyName.includes(query) ||
        clientName.includes(query) ||
        status.includes(query) ||
        String(shipment.id).includes(query) ||
        String(shipment.заявка_номер || "").includes(query)
      )
    })
  }, [data?.activeShipments, debouncedSearchQuery])

  const filteredRecentShipments = useMemo(() => {
    const shipments = data?.recentShipments || []
    const query = debouncedSearchQuery.trim().toLowerCase()
    if (!query) return shipments

    return shipments.filter((shipment) => {
      const tracking = shipment.номер_отслеживания?.toLowerCase() || ""
      const companyName = shipment.транспорт_название?.toLowerCase() || ""
      const clientName = shipment.клиент_название?.toLowerCase() || ""
      const status = shipment.заявка_статус?.toLowerCase() || ""

      return (
        tracking.includes(query) ||
        companyName.includes(query) ||
        clientName.includes(query) ||
        status.includes(query) ||
        String(shipment.id).includes(query) ||
        String(shipment.заявка_номер || "").includes(query)
      )
    })
  }, [data?.recentShipments, debouncedSearchQuery])

  const summary = useMemo(() => {
    const companies = data?.transport || []
    const totalShipments = companies.reduce(
      (sum, company) => sum + (Number(company.общее_количество_отгрузок) || 0),
      0
    )
    const successfulShipments = companies.reduce(
      (sum, company) => sum + (Number(company.завершенные_отгрузки) || 0),
      0
    )
    const averageCost = companies.length
      ? companies.reduce((sum, company) => sum + (Number(company.средняя_стоимость) || 0), 0) /
        companies.length
      : 0

    return {
      companiesCount: companies.length,
      activeShipmentsCount: data?.activeShipments?.length || 0,
      avgCost: averageCost,
      successRate: totalShipments ? (successfulShipments / totalShipments) * 100 : 0,
    }
  }, [data?.activeShipments, data?.transport])

  const renderAttachmentBadges = (companyId: number) => (
    <OrderAttachmentBadges types={attachmentsTypesByCompanyId[companyId] || []} />
  )

  const loadCompanyStats = useCallback(
    async (companyId: number) => {
      if (!canTransportStatsView) return

      try {
        setStatsLoading(true)
        setStatsError("")

        const response = await fetch(`/api/transport/stats?companyId=${companyId}`)
        const result = (await response.json().catch(() => null)) as TransportStatsResponse | null

        if (!response.ok || !result) {
          throw new Error("Не удалось загрузить статистику")
        }

        setStatsCompany((previous) => {
          if (!result.transport) return previous
          if (previous && previous.id === result.transport.id) {
            return { ...previous, ...result.transport }
          }
          return result.transport
        })
        setStatsPerformance(Array.isArray(result.performance) ? result.performance : [])
        setStatsPeriodTotals(result.periodTotals || null)
      } catch (fetchError) {
        setStatsError(fetchError instanceof Error ? fetchError.message : "Не удалось загрузить статистику")
        setStatsPerformance([])
        setStatsPeriodTotals(null)
      } finally {
        setStatsLoading(false)
      }
    },
    [canTransportStatsView]
  )

  const loadMonthShipments = useCallback(
    async (companyId: number, month: string) => {
      if (!canTransportStatsView) return

      try {
        setMonthShipmentsLoading(true)
        setMonthShipmentsError("")

        const response = await fetch(
          `/api/transport/stats-month?companyId=${companyId}&month=${encodeURIComponent(month)}`
        )
        const result = (await response.json().catch(() => null)) as {
          shipments: TransportMonthShipmentRow[]
          error?: string
        } | null

        if (!response.ok || !result) {
          throw new Error(result?.error || "Не удалось загрузить отгрузки за месяц")
        }

        setMonthShipments(Array.isArray(result.shipments) ? result.shipments : [])
      } catch (fetchError) {
        setMonthShipmentsError(
          fetchError instanceof Error ? fetchError.message : "Не удалось загрузить отгрузки за месяц"
        )
        setMonthShipments([])
      } finally {
        setMonthShipmentsLoading(false)
      }
    },
    [canTransportStatsView]
  )

  useEffect(() => {
    if (!isStatsModalOpen || !statsCompanyId) return

    void loadCompanyStats(statsCompanyId)
    setExpandedMonth("")
    setMonthShipments([])
    setMonthShipmentsError("")
  }, [isStatsModalOpen, loadCompanyStats, statsCompanyId])

  const handleToggleStatsMonth = useCallback(
    (month: string) => {
      if (!statsCompany) return

      if (expandedMonth === month) {
        setExpandedMonth("")
        setMonthShipments([])
        setMonthShipmentsError("")
        return
      }

      setExpandedMonth(month)
      setMonthShipments([])
      setMonthShipmentsError("")
      void loadMonthShipments(statsCompany.id, month)
    },
    [expandedMonth, loadMonthShipments, statsCompany]
  )

  const handleConfirmDelete = async () => {
    if (!selectedCompany || !canDelete) return

    try {
      setOperationLoading(true)
      const response = await fetch(`/api/transport?id=${selectedCompany.id}`, {
        method: "DELETE",
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || "Ошибка удаления компании")
      }

      await fetchData("refresh")
      setIsDeleteModalOpen(false)
      setSelectedCompany(null)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка удаления компании")
    } finally {
      setOperationLoading(false)
    }
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("ru-RU")

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("ru-RU")

  const formatMonth = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount == null || Number.isNaN(Number(amount))) return "Не указано"
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(Number(amount))
  }

  const currentTableColumns = activeTab === "companies" ? 9 : 5
  const isTableLoading = loading || isFetching

  const renderCurrentTable = () => {
    if (error && !data) {
      return (
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <Button type="button" className={styles.button} onClick={() => void fetchData("initial")}>
            Повторить попытку
          </Button>
        </div>
      )
    }

    if (activeTab === "companies") {
      if (filteredTransport.length === 0) {
        return (
          <div className={styles.emptyState}>
            <p>Транспортные компании не найдены</p>
            {canCreate ? (
              <CreateEntityButton onClick={() => setIsCreateModalOpen(true)}>
                Добавить первую ТК
              </CreateEntityButton>
            ) : null}
          </div>
        )
      }

      return (
        <EntityTableSurface
          variant="embedded"
          clip="bottom"
          className={styles.tableContainer}
          key={tableKey}
        >
          <TransportCompaniesTable
            companies={filteredTransport}
            canDelete={canDelete}
            canEdit={canEdit}
            canStatsView={canTransportStatsView}
            canView={canView}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            renderAttachmentBadges={renderAttachmentBadges}
            onDeleteCompany={(company) => {
              setSelectedCompany(company)
              setIsDeleteModalOpen(true)
            }}
            onEditCompany={(company) => {
              setEditCompany(company)
              setIsEditModalOpen(true)
            }}
            onOpenCompany={(company) => {
              void router.push(`/transport/${company.id}`)
            }}
            onOpenStats={(company) => {
              setStatsLoading(true)
              setStatsError("")
              setStatsPerformance([])
              setStatsPeriodTotals(null)
              setExpandedMonth("")
              setMonthShipmentsLoading(false)
              setMonthShipments([])
              setMonthShipmentsError("")
              setStatsCompany(company)
              setIsStatsModalOpen(true)
            }}
          />
        </EntityTableSurface>
      )
    }

    const shipments = activeTab === "activeShipments"
      ? filteredActiveShipments
      : filteredRecentShipments

    if (shipments.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p>{activeTab === "activeShipments" ? "Нет активных отгрузок" : "Нет последних отгрузок"}</p>
        </div>
      )
    }

    return (
      <EntityTableSurface
        variant="embedded"
        clip="bottom"
        className={styles.tableContainer}
        key={tableKey}
      >
        <TransportShipmentsTable
          shipments={shipments}
          formatDateTime={formatDateTime}
          onOpenOrder={(shipment) => {
            void router.push(`/orders/${shipment.заявка_номер}`)
          }}
        />
      </EntityTableSurface>
    )
  }

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canList) {
    return <NoAccessPage />
  }

  return (
    <div className={styles.container}>
      <TransportPageHeader
        canCreate={canCreate}
        isRefreshing={loading || isFetching || minRefreshSpinActive}
        permissions={user?.permissions}
        refreshKey={refreshClickKey}
        onCreate={() => setIsCreateModalOpen(true)}
        onImported={() => void fetchData("refresh")}
        onRefresh={() => {
          setRefreshClickKey((value) => value + 1)
          setMinRefreshSpinActive(true)
          void fetchData("refresh")
        }}
      />

      {loading && !data ? (
        <TransportPageSkeleton />
      ) : (
        <div className={styles.card}>
          <TransportStats
            activeShipmentsCount={summary.activeShipmentsCount}
            avgCost={summary.avgCost}
            companiesCount={summary.companiesCount}
            formatCurrency={formatCurrency}
            successRate={summary.successRate}
          />

          <div className={styles.tabsSection}>
            <TransportViewTabs
              activeTab={activeTab}
              activeShipmentsCount={data?.activeShipments?.length || 0}
              canActiveShipmentsView={canTransportActiveShipmentsView}
              canRecentShipmentsView={canTransportRecentShipmentsView}
              recentShipmentsCount={data?.recentShipments?.length || 0}
              onChange={setActiveTab}
            />
          </div>

          <TransportFilters
            filters={filters}
            filterTriggerRef={filterTriggerRef}
            filtersDropdownRef={filtersDropdownRef}
            isFiltersOpen={isFiltersOpen}
            searchInputValue={searchInputValue}
            searchPlaceholder={
              activeTab === "companies"
                ? "Поиск по названию или email..."
                : "Поиск по отгрузкам..."
            }
            setFilters={setFilters}
            setIsFiltersOpen={setIsFiltersOpen}
            sortTriggerRef={sortTriggerRef}
            showCompanyControls={activeTab === "companies"}
            onSearchInputChange={setSearchInputValue}
          />

          {isTableLoading ? (
            <EntityTableSurface
              variant="embedded"
              clip="bottom"
              className={styles.tableContainer}
              key={tableKey}
            >
              <EntityTableSkeleton columns={currentTableColumns} rows={7} actionColumn />
            </EntityTableSurface>
          ) : renderCurrentTable()}
        </div>
      )}

      <CreateTransportModalNew
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          setIsCreateModalOpen(false)
          void fetchData("refresh")
        }}
      />

      <EditTransportModalNew
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditCompany(null)
        }}
        onUpdated={() => {
          setIsEditModalOpen(false)
          setEditCompany(null)
          void fetchData("refresh")
        }}
        company={editCompany}
      />

      <DeleteConfirmation
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedCompany(null)
        }}
        onConfirm={handleConfirmDelete}
        loading={operationLoading}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить транспортную компанию?"
        warning="Это действие нельзя отменить. Карточка транспортной компании и связанные данные будут удалены."
        details={selectedCompany ? (
          <div className={deleteConfirmationStyles.positionsSection}>
            <div className={deleteConfirmationStyles.orderTitle}>
              {selectedCompany.название}
            </div>
            {selectedCompany.телефон ? (
              <div className={deleteConfirmationStyles.orderMeta}>
                Телефон: {selectedCompany.телефон}
              </div>
            ) : null}
            {selectedCompany.email ? (
              <div className={deleteConfirmationStyles.orderMeta}>
                Email: {selectedCompany.email}
              </div>
            ) : null}
          </div>
        ) : null}
      />

      <TransportStatsDialog
        open={isStatsModalOpen}
        company={statsCompany}
        error={statsError}
        expandedMonth={expandedMonth}
        formatCurrency={formatCurrency}
        formatDateTime={formatDateTime}
        formatMonth={formatMonth}
        loading={statsLoading}
        monthShipments={monthShipments}
        monthShipmentsError={monthShipmentsError}
        monthShipmentsLoading={monthShipmentsLoading}
        performance={statsPerformance}
        periodTotals={statsPeriodTotals}
        onClose={() => {
          setIsStatsModalOpen(false)
          setStatsCompany(null)
          setStatsLoading(false)
          setStatsError("")
          setStatsPerformance([])
          setStatsPeriodTotals(null)
          setExpandedMonth("")
          setMonthShipmentsLoading(false)
          setMonthShipments([])
          setMonthShipmentsError("")
        }}
        onToggleMonth={handleToggleStatsMonth}
      />
    </div>
  )
}

export default withLayout(TransportPage)
