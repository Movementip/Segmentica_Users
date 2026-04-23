import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"

import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import { CreateProductModal } from "@/components/modals/CreateProductModal/CreateProductModal"
import { EditProductModal } from "@/components/modals/EditProductModal/EditProductModal"
import { ProductPriceHistoryModal } from "@/components/modals/ProductPriceHistoryModal/ProductPriceHistoryModal"
import styles from "@/components/products/Products.module.css"
import { ProductsFilters } from "@/components/products/ProductsFilters/ProductsFilters"
import { ProductsPageHeader } from "@/components/products/ProductsPageHeader/ProductsPageHeader"
import { ProductsStats } from "@/components/products/ProductsStats/ProductsStats"
import { ProductsTable } from "@/components/products/ProductsTable/ProductsTable"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { WarehouseAttachmentBadges } from "@/components/warehouse/WarehouseAttachmentBadges/WarehouseAttachmentBadges"
import { useAuth } from "@/hooks/use-auth"
import { withLayout } from "@/layout"
import { defaultProductFilters, productSortOptions } from "@/lib/productsMeta"
import type {
  Product,
  ProductAttachmentSummaryItem,
  ProductFilters,
  ProductImportResponse,
} from "@/types/pages/products"
import { formatRuCurrency } from "@/utils/formatters"

function ProductsPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [tableKey, setTableKey] = useState(0)
  const [refreshClickKey, setRefreshClickKey] = useState(0)
  const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false)
  const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filters, setFilters] = useState<ProductFilters>(defaultProductFilters)

  const [attachmentsTypesByProductId, setAttachmentsTypesByProductId] = useState<Record<number, string[]>>({})

  const canList = Boolean(user?.permissions?.includes("products.list"))
  const canView = Boolean(user?.permissions?.includes("products.view"))
  const canCreate = Boolean(user?.permissions?.includes("products.create"))
  const canEdit = Boolean(user?.permissions?.includes("products.edit"))
  const canDelete = Boolean(user?.permissions?.includes("products.delete"))
  const canPriceHistoryView = Boolean(user?.permissions?.includes("products.price_history.view"))
  const canAttachmentsView = Boolean(user?.permissions?.includes("products.attachments.view"))

  useEffect(() => {
    if (!router.isReady) return

    const nextSearch = Array.isArray(router.query.search) ? router.query.search[0] : router.query.search
    const nextCategory = Array.isArray(router.query.category) ? router.query.category[0] : router.query.category
    const nextUnit = Array.isArray(router.query.unit) ? router.query.unit[0] : router.query.unit
    const nextSortBy = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort

    if (typeof nextSearch === "string") {
      setSearch(nextSearch)
      setDebouncedSearch(nextSearch)
    }

    setFilters((previous) => ({
      category: typeof nextCategory === "string" ? nextCategory : previous.category,
      unit: typeof nextUnit === "string" ? nextUnit : previous.unit,
      sortBy: productSortOptions.some((option) => option.value === nextSortBy)
        ? (nextSortBy as ProductFilters["sortBy"])
        : previous.sortBy,
    }))
  }, [router.isReady, router.query.category, router.query.search, router.query.sort, router.query.unit])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!router.isReady) return

    const query: Record<string, string> = {}
    if (debouncedSearch.trim()) query.search = debouncedSearch
    if (filters.category !== "all") query.category = filters.category
    if (filters.unit !== "all") query.unit = filters.unit
    if (filters.sortBy !== "date-desc") query.sort = filters.sortBy

    const currentSearch = Array.isArray(router.query.search) ? router.query.search[0] : router.query.search
    const currentCategory = Array.isArray(router.query.category) ? router.query.category[0] : router.query.category
    const currentUnit = Array.isArray(router.query.unit) ? router.query.unit[0] : router.query.unit
    const currentSort = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort

    const unchanged =
      String(currentSearch || "") === String(query.search || "") &&
      String(currentCategory || "") === String(query.category || "") &&
      String(currentUnit || "") === String(query.unit || "") &&
      String(currentSort || "") === String(query.sort || "")

    if (unchanged) return

    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [debouncedSearch, filters, router])

  useEffect(() => {
    if (!minRefreshSpinActive) return
    const timeoutId = window.setTimeout(() => setMinRefreshSpinActive(false), 525)
    return () => window.clearTimeout(timeoutId)
  }, [minRefreshSpinActive])

  const fetchProducts = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      setError(null)

      setLoading(true)
      if (mode === "refresh") {
        setIsFetching(true)
        setTableKey((value) => value + 1)
      }

      const response = await fetch("/api/products")
      if (!response.ok) {
        throw new Error("Ошибка загрузки товаров")
      }

      const result = (await response.json()) as Product[]
      const nextProducts = Array.isArray(result) ? result : []
      let nextAttachmentsMap: Record<number, string[]> = {}

      const ids = nextProducts
        .map((product) => Number(product.id))
        .filter((value) => Number.isInteger(value) && value > 0)

      if (ids.length > 0 && canAttachmentsView) {
        try {
          const summaryResponse = await fetch(
            `/api/attachments/summary?entity_type=product&entity_ids=${encodeURIComponent(ids.join(","))}`
          )

          if (summaryResponse.ok) {
            const summaryData = (await summaryResponse.json()) as ProductAttachmentSummaryItem[]
            const nextMap: Record<number, string[]> = {}

            for (const item of Array.isArray(summaryData) ? summaryData : []) {
              const entityId = Number(item.entity_id)
              if (!Number.isInteger(entityId)) continue
              nextMap[entityId] = Array.isArray(item.types) ? item.types : []
            }

            nextAttachmentsMap = nextMap
          }
        } catch (attachmentsError) {
          console.error("Error fetching products attachments summary:", attachmentsError)
        }
      }

      setAttachmentsTypesByProductId(nextAttachmentsMap)
      setProducts(nextProducts)
    } catch (fetchError) {
      console.error("Error fetching products:", fetchError)
      setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
      setProducts([])
      setAttachmentsTypesByProductId({})
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [canAttachmentsView])

  useEffect(() => {
    if (authLoading || !canList) return
    void fetchProducts("initial")
  }, [authLoading, canList, fetchProducts])

  const handleRefresh = () => {
    if (isFetching) return
    setRefreshClickKey((value) => value + 1)
    setMinRefreshSpinActive(true)
    void fetchProducts("refresh")
  }

  const handleCreateProduct = () => {
    if (!canCreate) return
    setIsCreateModalOpen(true)
  }

  const handleEditProduct = (product: Product) => {
    if (!canEdit) return
    setSelectedProduct(product)
    setIsEditProductModalOpen(true)
  }

  const handleOpenPriceHistory = (product: Product) => {
    if (!canPriceHistoryView) return
    setSelectedProduct(product)
    setIsPriceHistoryModalOpen(true)
  }

  const handleOpenProduct = (productId: number) => {
    if (!canView) return
    void router.push(`/products/${productId}`)
  }

  const handleDeleteProduct = (product: Product) => {
    if (!canDelete) return
    setSelectedProduct(product)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedProduct || !canDelete) return

    try {
      setIsDeleting(true)

      const response = await fetch(`/api/products?id=${selectedProduct.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as ProductImportResponse | null
        throw new Error(errorData?.error || "Ошибка удаления товара")
      }

      await fetchProducts("refresh")
      setIsDeleteModalOpen(false)
      setSelectedProduct(null)
    } catch (deleteError) {
      console.error("Error deleting product:", deleteError)
      alert(
        `Ошибка удаления товара: ${
          deleteError instanceof Error ? deleteError.message : "Unknown error"
        }`
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleProductCreated = () => {
    void fetchProducts("refresh")
    setIsCreateModalOpen(false)
  }

  const handleProductUpdated = () => {
    void fetchProducts("refresh")
    setIsEditProductModalOpen(false)
    setSelectedProduct(null)
  }

  const formatCurrency = (amount: number) => formatRuCurrency(amount)

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => (product.категория || "Не указана").trim()).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right, "ru")),
    [products]
  )

  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => (product.единица_измерения || "").trim()).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right, "ru")),
    [products]
  )

  const filteredProducts = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()

    let result = products.filter((product) => {
      const matchesSearch =
        !query ||
        (product.название || "").toLowerCase().includes(query) ||
        (product.артикул || "").toLowerCase().includes(query)

      const productCategory = product.категория || "Не указана"
      const matchesCategory = filters.category === "all" || productCategory === filters.category
      const matchesUnit = filters.unit === "all" || product.единица_измерения === filters.unit

      return matchesSearch && matchesCategory && matchesUnit
    })

    result = [...result].sort((left, right) => {
      switch (filters.sortBy) {
        case "date-asc":
          return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        case "price-purchase-asc":
          return (left.цена_закупки || 0) - (right.цена_закупки || 0)
        case "price-purchase-desc":
          return (right.цена_закупки || 0) - (left.цена_закупки || 0)
        case "price-sale-asc":
          return left.цена_продажи - right.цена_продажи
        case "price-sale-desc":
          return right.цена_продажи - left.цена_продажи
        case "name-asc":
          return (left.название || "").localeCompare(right.название || "", "ru")
        case "name-desc":
          return (right.название || "").localeCompare(left.название || "", "ru")
        case "date-desc":
        default:
          return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      }
    })

    return result
  }, [debouncedSearch, filters, products])

  const totalProducts = products.length
  const activeProducts = products.length
  const lowStockCount = 0
  const totalValue = products.reduce((sum, product) => sum + (product.цена_закупки || 0), 0)

  const renderAttachmentBadges = (productId: number) => {
    const types = attachmentsTypesByProductId[productId] || []
    return <WarehouseAttachmentBadges types={types} />
  }

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canList) {
    return <NoAccessPage />
  }

  return (
    <div className={styles.container}>
      <ProductsPageHeader
        canCreate={canCreate}
        isRefreshing={loading || isFetching || minRefreshSpinActive}
        permissions={user?.permissions}
        refreshClickKey={refreshClickKey}
        onCreateProduct={handleCreateProduct}
        onImported={() => fetchProducts("refresh")}
        onRefresh={handleRefresh}
      />

      {loading && products.length === 0 ? (
        <EntityIndexPageSkeleton
          ariaLabel="Загрузка товаров"
          title="Статистика товаров"
          columns={7}
          rows={7}
          actionColumn
        />
      ) : (
        <section className={styles.card}>
          <ProductsStats
            activeProducts={activeProducts}
            lowStockCount={lowStockCount}
            totalProducts={totalProducts}
            totalValue={totalValue}
            formatCurrency={formatCurrency}
          />

          <ProductsFilters
            categoryOptions={categoryOptions}
            filters={filters}
            search={search}
            sortOptions={productSortOptions}
            unitOptions={unitOptions}
            onFiltersChange={setFilters}
            onSearchChange={setSearch}
          />

          {error ? <div className={styles.inlineError}>{error}</div> : null}

          <ProductsTable
            canAttachmentsView={canAttachmentsView}
            canCreate={canCreate}
            canDelete={canDelete}
            canEdit={canEdit}
            canPriceHistoryView={canPriceHistoryView}
            canView={canView}
            error={error}
            formatCurrency={formatCurrency}
            isLoading={loading}
            products={filteredProducts}
            renderAttachmentBadges={renderAttachmentBadges}
            tableKeyValue={tableKey}
            onCreateProduct={handleCreateProduct}
            onDeleteProduct={handleDeleteProduct}
            onEditProduct={handleEditProduct}
            onOpenPriceHistory={handleOpenPriceHistory}
            onOpenProduct={handleOpenProduct}
            onRetry={() => void fetchProducts("initial")}
          />
        </section>
      )}

      <CreateProductModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProductCreated={handleProductCreated}
      />

      <EditProductModal
        isOpen={isEditProductModalOpen}
        onClose={() => {
          setIsEditProductModalOpen(false)
          setSelectedProduct(null)
        }}
        onProductUpdated={handleProductUpdated}
        product={selectedProduct}
      />

      <ProductPriceHistoryModal
        isOpen={isPriceHistoryModalOpen}
        onClose={() => {
          setIsPriceHistoryModalOpen(false)
          setSelectedProduct(null)
        }}
        productId={selectedProduct?.id ?? null}
        productName={selectedProduct?.название}
      />

      <DeleteConfirmation
        isOpen={isDeleteModalOpen && !!selectedProduct}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedProduct(null)
        }}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этот товар?"
        warning="Это действие нельзя отменить. Карточка товара и связанные с ней данные будут удалены."
        details={
          selectedProduct ? (
            <div className={deleteConfirmationStyles.positionsSection}>
              <div className={deleteConfirmationStyles.orderTitle}>{selectedProduct.название}</div>
              <div className={deleteConfirmationStyles.orderMeta}>
                Артикул: {selectedProduct.артикул || "—"}
              </div>
              <div className={deleteConfirmationStyles.orderMeta}>
                Цена продажи: {formatCurrency(selectedProduct.цена_продажи || 0)}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  )
}

export default withLayout(ProductsPage)
