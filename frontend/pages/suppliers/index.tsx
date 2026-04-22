import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import {
  EntityTableSkeleton,
  EntityTableSurface,
} from "@/components/EntityDataTable/EntityDataTable"
import { CreateSupplierModalV2 } from "@/components/modals/CreateSupplierModalV2/CreateSupplierModalV2"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import {
  EditSupplierModal,
  type EditSupplierModalSupplier,
} from "@/components/modals/EditSupplierModal/EditSupplierModal"
import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"
import { SuppliersFilters } from "@/components/suppliers/SuppliersFilters/SuppliersFilters"
import { SuppliersPageHeader } from "@/components/suppliers/SuppliersPageHeader/SuppliersPageHeader"
import { SuppliersPageSkeleton } from "@/components/suppliers/SuppliersPageSkeleton/SuppliersPageSkeleton"
import { SuppliersStats } from "@/components/suppliers/SuppliersStats/SuppliersStats"
import { SuppliersTable } from "@/components/suppliers/SuppliersTable/SuppliersTable"
import type {
  Supplier,
  SupplierAttachmentSummaryItem,
  SupplierOption,
  SuppliersFiltersState,
} from "@/components/suppliers/types"
import { defaultSuppliersFilters } from "@/components/suppliers/types"
import { Button } from "@/components/ui/button"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"
import { normalizeSupplierContragentType } from "@/lib/supplierContragents"

import styles from "./Suppliers.module.css"

function SuppliersPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const canList = Boolean(user?.permissions?.includes("suppliers.list"))
  const canView = Boolean(user?.permissions?.includes("suppliers.view"))
  const canCreate = Boolean(user?.permissions?.includes("suppliers.create"))
  const canEdit = Boolean(user?.permissions?.includes("suppliers.edit"))
  const canDelete = Boolean(user?.permissions?.includes("suppliers.delete"))
  const canOrdersHistoryView = Boolean(
    user?.permissions?.includes("suppliers.orders_history.view")
  )
  const canPurchasesList = Boolean(user?.permissions?.includes("purchases.list"))
  const canAttachmentsView = Boolean(
    user?.permissions?.includes("suppliers.attachments.view")
  )

  const canShowOrdersHistory = canOrdersHistoryView && canPurchasesList

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tableKey, setTableKey] = useState(0)
  const [refreshClickKey, setRefreshClickKey] = useState(0)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<EditSupplierModalSupplier | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [operationLoading, setOperationLoading] = useState(false)

  const [attachmentsTypesBySupplierId, setAttachmentsTypesBySupplierId] = useState<
    Record<number, string[]>
  >({})

  const [searchInputValue, setSearchInputValue] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [supplierQuery, setSupplierQuery] = useState("")
  const [filters, setFilters] = useState<SuppliersFiltersState>(defaultSuppliersFilters)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const sortTriggerRef = useRef<HTMLButtonElement>(null)
  const filtersDropdownRef = useRef<HTMLDivElement>(null)
  const lastSyncedSignatureRef = useRef("")

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

  const syncSuppliersUrl = useCallback(
    (next: {
      q: string
      inTransit: string
      rating: string
      supplierName: string
      type: string
      sort: string
    }) => {
      const query = { ...router.query } as Record<string, string>

      if ((next.q || "").trim()) query.q = String(next.q).trim()
      else delete query.q

      if (next.inTransit && next.inTransit !== "all") query.inTransit = String(next.inTransit)
      else delete query.inTransit

      if (next.rating && next.rating !== "all") query.rating = String(next.rating)
      else delete query.rating

      if ((next.supplierName || "").trim()) query.name = String(next.supplierName).trim()
      else delete query.name

      if (next.type && next.type !== "all") query.type = String(next.type)
      else delete query.type

      if (next.sort && next.sort !== "name-asc") query.sort = String(next.sort)
      else delete query.sort

      void router.replace(
        {
          pathname: router.pathname,
          query,
        },
        undefined,
        { shallow: true }
      )
    },
    [router]
  )

  useEffect(() => {
    if (!router.isReady) return

    const nextQ = Array.isArray(router.query.q) ? router.query.q[0] : router.query.q
    const nextInTransit = Array.isArray(router.query.inTransit)
      ? router.query.inTransit[0]
      : router.query.inTransit
    const nextRating = Array.isArray(router.query.rating)
      ? router.query.rating[0]
      : router.query.rating
    const nextName = Array.isArray(router.query.name) ? router.query.name[0] : router.query.name
    const nextType = Array.isArray(router.query.type) ? router.query.type[0] : router.query.type
    const nextSort = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort

    setSearchInputValue(typeof nextQ === "string" ? nextQ : "")
    setDebouncedSearchQuery(typeof nextQ === "string" ? nextQ : "")
    setSupplierQuery(typeof nextName === "string" ? nextName : "")
    setFilters({
      inTransit: typeof nextInTransit === "string" ? nextInTransit : "all",
      supplierName: typeof nextName === "string" ? nextName : "",
      type: typeof nextType === "string" ? nextType : "all",
      rating: typeof nextRating === "string" ? nextRating : "all",
      sortBy:
        typeof nextSort === "string"
          ? (nextSort as SuppliersFiltersState["sortBy"])
          : "name-asc",
    })

    lastSyncedSignatureRef.current = JSON.stringify({
      q: typeof nextQ === "string" ? nextQ : "",
      inTransit: typeof nextInTransit === "string" ? nextInTransit : "all",
      rating: typeof nextRating === "string" ? nextRating : "all",
      supplierName: typeof nextName === "string" ? nextName : "",
      type: typeof nextType === "string" ? nextType : "all",
      sort: typeof nextSort === "string" ? nextSort : "name-asc",
    })
  }, [router.isReady, router.query.inTransit, router.query.name, router.query.q, router.query.rating, router.query.sort, router.query.type])

  useEffect(() => {
    if (!router.isReady) return

    const signature = JSON.stringify({
      q: debouncedSearchQuery,
      inTransit: filters.inTransit,
      rating: filters.rating,
      supplierName: filters.supplierName,
      type: filters.type,
      sort: filters.sortBy,
    })

    if (signature === lastSyncedSignatureRef.current) return
    lastSyncedSignatureRef.current = signature

    syncSuppliersUrl({
      q: debouncedSearchQuery,
      inTransit: filters.inTransit,
      rating: filters.rating,
      supplierName: filters.supplierName,
      type: filters.type,
      sort: filters.sortBy,
    })
  }, [debouncedSearchQuery, filters.inTransit, filters.rating, filters.sortBy, filters.supplierName, filters.type, router.isReady, syncSuppliersUrl])

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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFiltersOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isFiltersOpen])

  const fetchSuppliers = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      setError(null)
      setLoading(true)

      if (!canList) {
        setSuppliers([])
        setAttachmentsTypesBySupplierId({})
        return
      }

      if (mode === "refresh") {
        setIsFetching(true)
        setTableKey((value) => value + 1)
      }

      const response = await fetch("/api/suppliers")
      if (!response.ok) {
        throw new Error("Ошибка загрузки поставщиков")
      }

      const data = (await response.json()) as Supplier[]
      const nextSuppliers = Array.isArray(data) ? data : []
      setSuppliers(nextSuppliers)

      if (!canAttachmentsView) {
        setAttachmentsTypesBySupplierId({})
        return
      }

      const supplierIds = nextSuppliers
        .map((supplier) => Number(supplier.id))
        .filter((value) => Number.isInteger(value) && value > 0)

      if (supplierIds.length === 0) {
        setAttachmentsTypesBySupplierId({})
        return
      }

      try {
        const summaryResponse = await fetch(
          `/api/attachments/summary?entity_type=supplier&entity_ids=${encodeURIComponent(supplierIds.join(","))}`
        )

        if (summaryResponse.ok) {
          const summaryData = (await summaryResponse.json()) as SupplierAttachmentSummaryItem[]
          const nextMap: Record<number, string[]> = {}

          for (const item of Array.isArray(summaryData) ? summaryData : []) {
            const supplierId = Number(item.entity_id)
            if (!Number.isInteger(supplierId)) continue
            nextMap[supplierId] = Array.isArray(item.types) ? item.types : []
          }

          setAttachmentsTypesBySupplierId(nextMap)
        }
      } catch (attachmentsError) {
        console.error("Error fetching supplier attachments summary:", attachmentsError)
        setAttachmentsTypesBySupplierId({})
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
      if (mode === "initial") {
        setSuppliers([])
        setAttachmentsTypesBySupplierId({})
      }
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [canAttachmentsView, canList])

  useEffect(() => {
    if (authLoading || !canList) return
    void fetchSuppliers("initial")
  }, [authLoading, canList, fetchSuppliers])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount)

  const supplierNameOptions = useMemo((): SupplierOption[] => {
    const map = new Map<number, string>()
    for (const supplier of suppliers) {
      const name = (supplier.название || "").trim()
      if (!name) continue
      if (!map.has(supplier.id)) map.set(supplier.id, name)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "ru"))
  }, [suppliers])

  const filteredSupplierOptions = useMemo(() => {
    const query = supplierQuery.trim().toLowerCase()
    if (!query) return supplierNameOptions
    return supplierNameOptions.filter((supplier) =>
      supplier.name.toLowerCase().includes(query)
    )
  }, [supplierNameOptions, supplierQuery])

  const filteredSuppliers = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase()
    let list = suppliers

    if (query) {
      list = list.filter((supplier) => {
        const name = supplier.название?.toLowerCase() || ""
        const phone = supplier.телефон?.toLowerCase() || ""
        const email = supplier.email?.toLowerCase() || ""
        return (
          name.includes(query) ||
          phone.includes(query) ||
          email.includes(query) ||
          String(supplier.id).includes(query)
        )
      })
    }

    if (filters.inTransit !== "all") {
      const mustBeInTransit = filters.inTransit === "yes"
      list = list.filter(
        (supplier) => ((supplier.закупки_в_пути || 0) > 0) === mustBeInTransit
      )
    }

    if (filters.rating !== "all") {
      const expectedRating = Number(filters.rating)
      if (!Number.isNaN(expectedRating)) {
        list = list.filter(
          (supplier) => Math.floor(Number(supplier.рейтинг) || 0) === expectedRating
        )
      }
    }

    if (filters.type !== "all") {
      list = list.filter(
        (supplier) => normalizeSupplierContragentType(supplier.тип) === filters.type
      )
    }

    if (filters.supplierName.trim()) {
      const supplierName = filters.supplierName.trim().toLowerCase()
      list = list.filter((supplier) =>
        (supplier.название || "").toLowerCase().includes(supplierName)
      )
    }

    const sorted = [...list]
    sorted.sort((left, right) => {
      switch (filters.sortBy) {
        case "rating-desc":
          return (Number(right.рейтинг) || 0) - (Number(left.рейтинг) || 0)
        case "sum-desc":
          return (
            (Number(right.общая_сумма_закупок) || 0) -
            (Number(left.общая_сумма_закупок) || 0)
          )
        case "products-desc":
          return (
            (Number(right.количество_товаров) || 0) -
            (Number(left.количество_товаров) || 0)
          )
        case "name-desc":
          return (right.название || "").localeCompare(left.название || "", "ru")
        case "name-asc":
        default:
          return (left.название || "").localeCompare(right.название || "", "ru")
      }
    })

    return sorted
  }, [debouncedSearchQuery, filters.inTransit, filters.rating, filters.sortBy, filters.supplierName, filters.type, suppliers])

  const summary = useMemo(() => {
    const totalProducts = suppliers.reduce(
      (sum, supplier) => sum + (supplier.количество_товаров || 0),
      0
    )
    const totalPurchaseSum = suppliers.reduce(
      (sum, supplier) => sum + (supplier.общая_сумма_закупок || 0),
      0
    )
    const suppliersInTransit = suppliers.filter(
      (supplier) => (supplier.закупки_в_пути || 0) > 0
    ).length

    return {
      totalSuppliers: suppliers.length,
      totalProducts,
      totalPurchaseSum,
      suppliersInTransit,
    }
  }, [suppliers])

  const renderAttachmentBadges = (supplierId: number) => {
    const types = attachmentsTypesBySupplierId[supplierId] || []
    return <OrderAttachmentBadges types={types} />
  }

  const openEditModal = async (supplier: Supplier) => {
    if (!canEdit) return

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`)
      if (!response.ok) {
        throw new Error("Ошибка загрузки карточки поставщика")
      }

      const detail = (await response.json()) as EditSupplierModalSupplier
      setEditSupplier(detail)
      setIsEditModalOpen(true)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки карточки поставщика")
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedSupplier || !canDelete) return

    try {
      setOperationLoading(true)
      const response = await fetch(`/api/suppliers?id=${selectedSupplier.id}`, {
        method: "DELETE",
      })

      const errorData = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(errorData.error || "Ошибка удаления поставщика")
      }

      await fetchSuppliers("refresh")
      setIsDeleteModalOpen(false)
      setSelectedSupplier(null)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка удаления поставщика")
    } finally {
      setOperationLoading(false)
    }
  }

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canList) {
    return <NoAccessPage />
  }

  return (
    <div className={styles.container}>
      <SuppliersPageHeader
        canCreate={canCreate}
        isRefreshing={loading || isFetching || minRefreshSpinActive}
        permissions={user?.permissions}
        refreshKey={refreshClickKey}
        onCreate={() => setIsCreateModalOpen(true)}
        onImported={() => void fetchSuppliers("refresh")}
        onRefresh={() => {
          setRefreshClickKey((value) => value + 1)
          setMinRefreshSpinActive(true)
          void fetchSuppliers("refresh")
        }}
      />

      {loading && suppliers.length === 0 ? (
        <SuppliersPageSkeleton />
      ) : (
        <div className={styles.card}>
          <SuppliersStats
            totalProducts={summary.totalProducts}
            totalPurchaseSum={summary.totalPurchaseSum}
            totalSuppliers={summary.totalSuppliers}
            suppliersInTransit={summary.suppliersInTransit}
            formatCurrency={formatCurrency}
          />

          <SuppliersFilters
            searchInputValue={searchInputValue}
            onSearchInputChange={setSearchInputValue}
            isFiltersOpen={isFiltersOpen}
            setIsFiltersOpen={setIsFiltersOpen}
            filters={filters}
            setFilters={setFilters}
            syncSuppliersUrl={syncSuppliersUrl}
            supplierQuery={supplierQuery}
            setSupplierQuery={setSupplierQuery}
            filteredSupplierOptions={filteredSupplierOptions}
            filtersDropdownRef={filtersDropdownRef}
            filterTriggerRef={filterTriggerRef}
            sortTriggerRef={sortTriggerRef}
          />

          {loading ? (
            <EntityTableSurface
              variant="embedded"
              clip="bottom"
              className={styles.tableContainer}
              key={tableKey}
            >
              <EntityTableSkeleton columns={8} rows={7} actionColumn />
            </EntityTableSurface>
          ) : error && suppliers.length === 0 ? (
            <div className={styles.errorState}>
              <p className={styles.errorText}>{error}</p>
              <Button type="button" className={styles.button} onClick={() => void fetchSuppliers("initial")}>
                Повторить попытку
              </Button>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Поставщики не найдены</p>
              {canCreate ? (
                <CreateEntityButton onClick={() => setIsCreateModalOpen(true)}>
                  Добавить первого поставщика
                </CreateEntityButton>
              ) : null}
            </div>
          ) : (
            <EntityTableSurface
              variant="embedded"
              clip="bottom"
              className={styles.tableContainer}
              key={tableKey}
            >
              <SuppliersTable
                suppliers={filteredSuppliers}
                canDelete={canDelete}
                canEdit={canEdit}
                canShowOrdersHistory={canShowOrdersHistory}
                canView={canView}
                formatCurrency={formatCurrency}
                renderAttachmentBadges={renderAttachmentBadges}
                onDeleteSupplier={(supplier) => {
                  if (!canDelete) return
                  setSelectedSupplier(supplier)
                  setIsDeleteModalOpen(true)
                }}
                onEditSupplier={(supplier) => void openEditModal(supplier)}
                onOpenSupplier={(supplier) => {
                  void router.push(`/suppliers/${supplier.id}`)
                }}
                onOpenSupplierOrdersHistory={(supplier) => {
                  void router.push({
                    pathname: "/purchases",
                    query: {
                      supplier_id: String(supplier.id),
                      supplier: supplier.название || "",
                    },
                  })
                }}
              />
            </EntityTableSurface>
          )}
        </div>
      )}

      <CreateSupplierModalV2
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSupplierCreated={() => {
          setIsCreateModalOpen(false)
          void fetchSuppliers("refresh")
        }}
      />

      <EditSupplierModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditSupplier(null)
        }}
        onUpdated={() => {
          setIsEditModalOpen(false)
          setEditSupplier(null)
          void fetchSuppliers("refresh")
        }}
        supplier={editSupplier}
      />

      <DeleteConfirmation
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedSupplier(null)
        }}
        onConfirm={handleConfirmDelete}
        loading={operationLoading}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этого поставщика?"
        warning="Это действие нельзя отменить. Карточка поставщика и связанные данные будут удалены."
        details={selectedSupplier ? (
          <div className={deleteConfirmationStyles.positionsSection}>
            <div className={deleteConfirmationStyles.orderTitle}>
              {selectedSupplier.название}
            </div>
            {selectedSupplier.телефон ? (
              <div className={deleteConfirmationStyles.orderMeta}>
                Телефон: {selectedSupplier.телефон}
              </div>
            ) : null}
            {selectedSupplier.email ? (
              <div className={deleteConfirmationStyles.orderMeta}>
                Email: {selectedSupplier.email}
              </div>
            ) : null}
          </div>
        ) : null}
      />
    </div>
  )
}

export default withLayout(SuppliersPage)
