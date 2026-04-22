import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import {
  EntityTableSkeleton,
  EntityTableSurface,
} from "@/components/EntityDataTable/EntityDataTable"
import { MissingProductsFilters } from "@/components/missing-products/MissingProductsFilters/MissingProductsFilters"
import { MissingProductsPageHeader } from "@/components/missing-products/MissingProductsPageHeader/MissingProductsPageHeader"
import { MissingProductsPageSkeleton } from "@/components/missing-products/MissingProductsPageSkeleton/MissingProductsPageSkeleton"
import { MissingProductsStats } from "@/components/missing-products/MissingProductsStats/MissingProductsStats"
import { MissingProductsTable } from "@/components/missing-products/MissingProductsTable/MissingProductsTable"
import type {
  MissingProduct,
  MissingProductsFiltersState,
  MissingProductsOrderOption,
  MissingProductsProductOption,
} from "@/components/missing-products/types"
import { defaultMissingProductsFilters } from "@/components/missing-products/types"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import { AddMissingProductModal } from "@/components/modals/AddMissingProductModal/AddMissingProductModal"
import { EditMissingProductModal } from "@/components/modals/EditMissingProductModal/EditMissingProductModal"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { Button } from "@/components/ui/button"
import { WarehouseAttentionBanner } from "@/components/warehouse/WarehouseAttentionBanner/WarehouseAttentionBanner"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"

import styles from "./MissingProducts.module.css"

function MissingProductsPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const filtersDropdownRef = useRef<HTMLDivElement | null>(null)
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null)
  const tableCardRef = useRef<HTMLElement | null>(null)
  const lastSyncedQueryRef = useRef("")
  const lastAppliedRouterQueryRef = useRef("")

  const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([])
  const [products, setProducts] = useState<MissingProductsProductOption[]>([])
  const [orders, setOrders] = useState<MissingProductsOrderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false)
  const [refreshClickKey, setRefreshClickKey] = useState(0)
  const [tableKey, setTableKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<MissingProduct | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<MissingProductsFiltersState>(
    defaultMissingProductsFilters
  )

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<MissingProduct | null>(null)

  const canList = Boolean(user?.permissions?.includes("missing_products.list"))
  const canCreate = Boolean(user?.permissions?.includes("missing_products.create"))
  const canEdit = Boolean(user?.permissions?.includes("missing_products.edit"))
  const canDelete = Boolean(user?.permissions?.includes("missing_products.delete"))
  const canMissingProductsOrderView = Boolean(
    user?.permissions?.includes("missing_products.order.view")
  )
  const canOrdersView = Boolean(user?.permissions?.includes("orders.view"))
  const canOrdersList = Boolean(user?.permissions?.includes("orders.list"))
  const canProductsList = Boolean(user?.permissions?.includes("products.list"))

  const canGoToOrder = canOrdersView && canMissingProductsOrderView
  const hasRowActions = canEdit || canGoToOrder || canDelete

  const syncMissingProductsUrl = useCallback(
    (next: {
      q: string
      status: string
      orderId: string
      productId: string
      sort: string
    }) => {
      const query = { ...router.query } as Record<string, string>

      if ((next.q || "").trim()) query.q = String(next.q).trim()
      else delete query.q

      if (next.status && next.status !== "all") query.status = String(next.status)
      else delete query.status

      if (next.orderId && next.orderId !== "all") query.orderId = String(next.orderId)
      else delete query.orderId

      if (next.productId && next.productId !== "all") query.productId = String(next.productId)
      else delete query.productId

      if (next.sort && next.sort !== "missing_desc") query.sort = String(next.sort)
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

    const signature = JSON.stringify(router.query)
    if (signature === lastAppliedRouterQueryRef.current) return
    lastAppliedRouterQueryRef.current = signature

    const qRaw = router.query.q
    const statusRaw = router.query.status
    const orderIdRaw = router.query.orderId
    const productIdRaw = router.query.productId
    const sortRaw = router.query.sort

    const nextSearch = Array.isArray(qRaw) ? qRaw[0] : qRaw
    const nextStatus = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw
    const nextOrderId = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw
    const nextProductId = Array.isArray(productIdRaw) ? productIdRaw[0] : productIdRaw
    const nextSort = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw

    setSearchTerm(typeof nextSearch === "string" ? nextSearch : "")
    setFilters({
      status: typeof nextStatus === "string" ? nextStatus : "all",
      orderId: typeof nextOrderId === "string" ? nextOrderId : "all",
      productId: typeof nextProductId === "string" ? nextProductId : "all",
      sortBy:
        typeof nextSort === "string"
          ? (nextSort as MissingProductsFiltersState["sortBy"])
          : "missing_desc",
    })

    lastSyncedQueryRef.current = JSON.stringify({
      q: typeof nextSearch === "string" ? nextSearch : "",
      status: typeof nextStatus === "string" ? nextStatus : "all",
      orderId: typeof nextOrderId === "string" ? nextOrderId : "all",
      productId: typeof nextProductId === "string" ? nextProductId : "all",
      sort: typeof nextSort === "string" ? nextSort : "missing_desc",
    })
  }, [router.isReady, router.query])

  useEffect(() => {
    if (!router.isReady) return

    const signature = JSON.stringify({
      q: searchTerm,
      status: filters.status,
      orderId: filters.orderId,
      productId: filters.productId,
      sort: filters.sortBy,
    })

    if (signature === lastSyncedQueryRef.current) return
    lastSyncedQueryRef.current = signature

    syncMissingProductsUrl({
      q: searchTerm,
      status: filters.status,
      orderId: filters.orderId,
      productId: filters.productId,
      sort: filters.sortBy,
    })
  }, [filters.orderId, filters.productId, filters.sortBy, filters.status, router.isReady, searchTerm, syncMissingProductsUrl])

  useEffect(() => {
    if (!minRefreshSpinActive) return
    const timeoutId = window.setTimeout(() => setMinRefreshSpinActive(false), 525)
    return () => window.clearTimeout(timeoutId)
  }, [minRefreshSpinActive])

  useEffect(() => {
    if (!isFiltersOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : []
      const isInsideDropdown = path.length
        ? path.includes(filtersDropdownRef.current as unknown as EventTarget) ||
          path.includes(filterTriggerRef.current as unknown as EventTarget)
        : Boolean(
            (event.target as Node | null) &&
              (filtersDropdownRef.current?.contains(event.target as Node) ||
                filterTriggerRef.current?.contains(event.target as Node))
          )

      const targetElement = event.target instanceof Element ? event.target : null
      const isInsidePortal = Boolean(
        targetElement?.closest(
          '[data-slot="select-content"], [data-slot="select-item"], [data-slot="search-select-menu"]'
        )
      )

      if (isInsideDropdown || isInsidePortal) return
      setIsFiltersOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFiltersOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isFiltersOpen])

  const fetchMissingProducts = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        setError(null)
        setLoading(true)

        if (!canList) {
          setMissingProducts([])
          return
        }

        if (mode === "refresh") {
          setIsFetching(true)
          setTableKey((value) => value + 1)
        }

        const response = await fetch("/api/missing-products")
        if (!response.ok) {
          throw new Error("Ошибка загрузки недостающих товаров")
        }

        const result = (await response.json()) as MissingProduct[]
        setMissingProducts(Array.isArray(result) ? result : [])
      } catch (fetchError) {
        setError(
          fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка"
        )
        if (mode === "initial") {
          setMissingProducts([])
        }
      } finally {
        setLoading(false)
        setIsFetching(false)
      }
    },
    [canList]
  )

  const fetchProducts = useCallback(async () => {
    if (!canProductsList) {
      setProducts([])
      return
    }

    try {
      const response = await fetch("/api/products")
      if (!response.ok) {
        throw new Error("Ошибка загрузки товаров")
      }

      const result = (await response.json()) as MissingProductsProductOption[]
      setProducts(Array.isArray(result) ? result : [])
    } catch (fetchError) {
      console.error("Error fetching products:", fetchError)
      setProducts([])
    }
  }, [canProductsList])

  const fetchOrders = useCallback(async () => {
    if (!canOrdersList) {
      setOrders([])
      return
    }

    try {
      const response = await fetch("/api/orders")
      if (!response.ok) {
        throw new Error("Ошибка загрузки заявок")
      }

      const result = (await response.json()) as MissingProductsOrderOption[]
      setOrders(Array.isArray(result) ? result : [])
    } catch (fetchError) {
      console.error("Error fetching orders:", fetchError)
      setOrders([])
    }
  }, [canOrdersList])

  useEffect(() => {
    if (authLoading || !canList) return
    void fetchMissingProducts("initial")
    void fetchProducts()
    void fetchOrders()
  }, [authLoading, canList, fetchMissingProducts, fetchOrders, fetchProducts])

  const scopedMissingProducts = useMemo(() => {
    if (filters.orderId === "all") return missingProducts
    return missingProducts.filter(
      (item) => String(item.заявка_id) === String(filters.orderId)
    )
  }, [filters.orderId, missingProducts])

  const filteredMissingProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const filtered = scopedMissingProducts.filter((item) => {
      const name = item.товар_название?.toLowerCase() || ""
      const article = item.товар_артикул?.toLowerCase() || ""
      const orderLabel = `заявка #${item.заявка_id}`.toLowerCase()

      if (filters.status !== "all" && item.статус !== filters.status) {
        return false
      }

      if (filters.productId !== "all" && String(item.товар_id) !== filters.productId) {
        return false
      }

      if (!query) return true

      return (
        name.includes(query) ||
        article.includes(query) ||
        orderLabel.includes(query) ||
        String(item.id).includes(query)
      )
    })

    return [...filtered].sort((left, right) => {
      switch (filters.sortBy) {
        case "missing_asc":
          return left.недостающее_количество - right.недостающее_количество
        case "required_desc":
          return right.необходимое_количество - left.необходимое_количество
        case "required_asc":
          return left.необходимое_количество - right.необходимое_количество
        case "status":
          return left.статус.localeCompare(right.статус, "ru")
        case "product":
          return (left.товар_название || "").localeCompare(
            right.товар_название || "",
            "ru"
          )
        case "order":
          return left.заявка_id - right.заявка_id
        case "missing_desc":
        default:
          return right.недостающее_количество - left.недостающее_количество
      }
    })
  }, [filters.productId, filters.sortBy, filters.status, scopedMissingProducts, searchTerm])

  const summary = useMemo(() => {
    const totalMissing = scopedMissingProducts.length
    const criticalCount = scopedMissingProducts.filter(
      (item) => item.недостающее_количество >= item.необходимое_количество
    ).length
    const processingCount = scopedMissingProducts.filter(
      (item) => item.статус === "в обработке"
    ).length
    const orderedCount = scopedMissingProducts.filter(
      (item) => item.статус === "заказано"
    ).length
    const totalUnitsMissing = scopedMissingProducts.reduce(
      (sum, item) => sum + item.недостающее_количество,
      0
    )

    return {
      totalMissing,
      criticalCount,
      processingCount,
      orderedCount,
      totalUnitsMissing,
    }
  }, [scopedMissingProducts])

  const selectedOrderId = useMemo(() => {
    if (filters.orderId === "all") return null
    const parsed = Number.parseInt(filters.orderId, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [filters.orderId])

  const handleRefresh = () => {
    setRefreshClickKey((value) => value + 1)
    setMinRefreshSpinActive(true)
    void Promise.all([
      fetchMissingProducts("refresh"),
      fetchProducts(),
      fetchOrders(),
    ])
  }

  const handleOpenDelete = (product: MissingProduct) => {
    if (!canDelete) return
    setDeletingProduct(product)
    setDeleteError(null)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingProduct || !canDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(
        `/api/missing-products?id=${deletingProduct.id}`,
        { method: "DELETE" }
      )
      const errorData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(errorData?.error || "Ошибка удаления недостающего товара")
      }

      await fetchMissingProducts("refresh")
      setIsDeleteDialogOpen(false)
      setDeletingProduct(null)
    } catch (deleteFetchError) {
      setDeleteError(
        deleteFetchError instanceof Error
          ? deleteFetchError.message
          : "Неизвестная ошибка"
      )
    } finally {
      setIsDeleting(false)
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
      <MissingProductsPageHeader
        canCreate={canCreate}
        isRefreshing={loading || isFetching || minRefreshSpinActive}
        onCreate={() => setIsAddModalOpen(true)}
        onRefresh={handleRefresh}
        refreshKey={refreshClickKey}
        selectedOrderId={selectedOrderId}
      />

      {loading && missingProducts.length === 0 ? (
        <MissingProductsPageSkeleton />
      ) : (
        <>
          {summary.criticalCount > 0 ? (
            <WarehouseAttentionBanner
              description={`${summary.criticalCount} ${
                summary.criticalCount === 1 ? "позиция требует" : "позиции требуют"
              } срочного пополнения.`}
              onView={() =>
                tableCardRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            />
          ) : null}

          <section className={styles.card} ref={tableCardRef}>
            <MissingProductsStats
              totalMissing={summary.totalMissing}
              criticalCount={summary.criticalCount}
              totalUnitsMissing={summary.totalUnitsMissing}
              processingCount={summary.processingCount}
              orderedCount={summary.orderedCount}
            />

            <MissingProductsFilters
              filters={filters}
              isFiltersOpen={isFiltersOpen}
              orderOptions={orders}
              productOptions={products}
              filtersDropdownRef={filtersDropdownRef}
              filterTriggerRef={filterTriggerRef}
              onFiltersChange={setFilters}
              onSearchTermChange={setSearchTerm}
              searchTerm={searchTerm}
              setIsFiltersOpen={setIsFiltersOpen}
            />

            {error ? <div className={styles.inlineError}>{error}</div> : null}

            {loading ? (
              <EntityTableSurface
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
                key={tableKey}
              >
                <EntityTableSkeleton columns={7} rows={7} actionColumn />
              </EntityTableSurface>
            ) : error && missingProducts.length === 0 ? (
              <div className={styles.errorState}>
                <p className={styles.errorText}>{error}</p>
                <Button
                  type="button"
                  className={styles.retryButton}
                  onClick={() => void fetchMissingProducts("initial")}
                >
                  Повторить попытку
                </Button>
              </div>
            ) : filteredMissingProducts.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Недостающие товары не найдены</p>
                {canCreate ? (
                  <CreateEntityButton onClick={() => setIsAddModalOpen(true)}>
                    Создать первую позицию
                  </CreateEntityButton>
                ) : null}
              </div>
            ) : (
              <EntityTableSurface
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
                key={tableKey}
              >
                <MissingProductsTable
                  canDelete={canDelete}
                  canEdit={canEdit}
                  canGoToOrder={canGoToOrder}
                  hasRowActions={hasRowActions}
                  items={filteredMissingProducts}
                  onDeleteItem={handleOpenDelete}
                  onEditItem={(item) => {
                    setEditingProduct(item)
                    setIsEditModalOpen(true)
                  }}
                  onOpenOrder={(item) => {
                    void router.push(`/orders/${item.заявка_id}`)
                  }}
                />
              </EntityTableSurface>
            )}
          </section>
        </>
      )}

      {canCreate ? (
        <AddMissingProductModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCreated={async () => {
            await fetchMissingProducts("refresh")
          }}
          products={products}
          orders={orders}
        />
      ) : null}

      {canEdit ? (
        <EditMissingProductModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingProduct(null)
          }}
          onUpdated={async () => {
            setIsEditModalOpen(false)
            setEditingProduct(null)
            await fetchMissingProducts("refresh")
          }}
          missingProduct={editingProduct}
          products={products}
          orders={orders}
        />
      ) : null}

      <DeleteConfirmation
        isOpen={isDeleteDialogOpen && !!deletingProduct}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setDeletingProduct(null)
          setDeleteError(null)
        }}
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этот недостающий товар?"
        warning="Это действие нельзя отменить. Позиция будет удалена из списка контроля недостающих товаров."
        details={deletingProduct ? (
          <div className={deleteConfirmationStyles.positionsSection}>
            <div className={deleteConfirmationStyles.orderTitle}>
              Позиция #{deletingProduct.id}
            </div>
            <div className={deleteConfirmationStyles.orderMeta}>
              Заявка: #{deletingProduct.заявка_id}
            </div>
            <div className={deleteConfirmationStyles.orderMeta}>
              Товар: {deletingProduct.товар_название || `#${deletingProduct.товар_id}`}
            </div>
            {deleteError ? (
              <div className={styles.deleteError}>{deleteError}</div>
            ) : null}
          </div>
        ) : null}
      />
    </div>
  )
}

export default withLayout(MissingProductsPage)
