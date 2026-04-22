import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/router"
import {
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiTrash2,
  FiTrendingUp,
} from "react-icons/fi"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import {
  EntityTableSkeleton,
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"
import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import { CreateProductModal } from "@/components/modals/CreateProductModal/CreateProductModal"
import { EditProductModal } from "@/components/modals/EditProductModal/EditProductModal"
import { ProductPriceHistoryModal } from "@/components/modals/ProductPriceHistoryModal/ProductPriceHistoryModal"
import { ReferenceDataActions } from "@/components/pages/ReferenceDataActions/ReferenceDataActions"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { WarehouseAttachmentBadges } from "@/components/warehouse/WarehouseAttachmentBadges/WarehouseAttachmentBadges"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"
import { Button } from "@/components/ui/button"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

import styles from "./Products.module.css"

const MotionTableRow = motion(TableRow)

interface Product {
  id: number
  название: string
  артикул: string
  категория?: string
  цена_закупки?: number
  цена_продажи: number
  единица_измерения: string
  минимальный_остаток: number
  created_at: string
}

type AttachmentSummaryItem = {
  entity_id: number
  types: string[]
}

type ProductFilters = {
  category: string
  unit: string
  sortBy:
    | "date-desc"
    | "date-asc"
    | "name-asc"
    | "name-desc"
    | "price-purchase-asc"
    | "price-purchase-desc"
    | "price-sale-asc"
    | "price-sale-desc"
}

type ProductImportResponse = {
  created_count?: number
  updated_count?: number
  skipped_count?: number
  error?: string
  message?: string
}

const defaultFilters: ProductFilters = {
  category: "all",
  unit: "all",
  sortBy: "date-desc",
}

const sortOptions: Array<{ value: ProductFilters["sortBy"]; label: string }> = [
  { value: "date-desc", label: "По дате (новые сначала)" },
  { value: "date-asc", label: "По дате (старые сначала)" },
  { value: "name-asc", label: "По названию (А-Я)" },
  { value: "name-desc", label: "По названию (Я-А)" },
  { value: "price-purchase-asc", label: "По закупке (по возрастанию)" },
  { value: "price-purchase-desc", label: "По закупке (по убыванию)" },
  { value: "price-sale-asc", label: "По продаже (по возрастанию)" },
  { value: "price-sale-desc", label: "По продаже (по убыванию)" },
]

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
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters)

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
      sortBy: sortOptions.some((option) => option.value === nextSortBy)
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
            const summaryData = (await summaryResponse.json()) as AttachmentSummaryItem[]
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount)

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
      <PageHeader
        title="Товары"
        subtitle="Каталог товаров и управление номенклатурой"
        actions={(
          <>
            <RefreshButton
              className={styles.surfaceButton}
              isRefreshing={loading || isFetching || minRefreshSpinActive}
              refreshKey={refreshClickKey}
              iconClassName={styles.spinning}
              onClick={(event) => {
                event.currentTarget.blur()
                handleRefresh()
              }}
            />

            <ReferenceDataActions
              catalogKey="products"
              permissions={user?.permissions}
              onImported={() => fetchProducts("refresh")}
            />

            {canCreate ? (
              <CreateEntityButton className={styles.createButton} onClick={handleCreateProduct}>
                Добавить товар
              </CreateEntityButton>
            ) : null}
          </>
        )}
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

          <section className={styles.controlsSection}>
            <DataSearchField
              value={search}
              onValueChange={setSearch}
              placeholder="Поиск по названию или артикулу..."
              wrapperClassName={styles.search}
            />

            <div className={styles.controlsGroup}>
              <div className={styles.selectWrap}>
                <Select
                  value={filters.category}
                  items={[
                    { value: "all", label: "Все категории" },
                    ...categoryOptions.map((category) => ({ value: category, label: category })),
                  ]}
                  onValueChange={(value) =>
                    setFilters((previous) => ({ ...previous, category: String(value) }))
                  }
                >
                  <SelectTrigger className={styles.selectTrigger} />
                  <SelectContent align="end">
                    <SelectItem value="all">Все категории</SelectItem>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.selectWrap}>
                <Select
                  value={filters.unit}
                  items={[
                    { value: "all", label: "Все единицы" },
                    ...unitOptions.map((unit) => ({ value: unit, label: unit })),
                  ]}
                  onValueChange={(value) =>
                    setFilters((previous) => ({ ...previous, unit: String(value) }))
                  }
                >
                  <SelectTrigger className={styles.selectTrigger} />
                  <SelectContent align="end">
                    <SelectItem value="all">Все единицы</SelectItem>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.sortGroup}>
                <span className={styles.sortLabel}>Сортировка:</span>
                <div className={styles.sortWrap}>
                  <Select
                    value={filters.sortBy}
                    items={sortOptions}
                    onValueChange={(value) =>
                      setFilters((previous) => ({
                        ...previous,
                        sortBy: String(value) as ProductFilters["sortBy"],
                      }))
                    }
                  >
                    <SelectTrigger className={styles.sortTrigger} />
                    <SelectContent align="end">
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

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
          ) : error && products.length === 0 ? (
            <div className={styles.errorState}>
              <p className={styles.errorText}>{error}</p>
              <Button type="button" className={styles.retryButton} onClick={() => void fetchProducts("initial")}>
                Повторить попытку
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Товары не найдены</p>
              {canCreate ? (
                <CreateEntityButton className={styles.createButton} onClick={handleCreateProduct}>
                  Создать первый товар
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
              <Table className={`${entityTableClassName} ${styles.table}`}>
            <colgroup>
              <col className={styles.colId} />
              <col className={styles.colName} />
              <col className={styles.colArticle} />
              <col className={styles.colCategory} />
              <col className={styles.colPurchase} />
              <col className={styles.colSale} />
              <col className={styles.colUnit} />
              <col className={styles.colActions} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead className={styles.textRight}>Цена закупки</TableHead>
                <TableHead className={styles.textRight}>Цена продажи</TableHead>
                <TableHead>Ед. изм.</TableHead>
                <TableHead className={styles.actionsHeader} />
              </TableRow>
            </TableHeader>

            <TableBody>
              <AnimatePresence>
                {filteredProducts.map((product) => (
                    <MotionTableRow
                      key={product.id}
                      className={`${styles.tableRow} ${canView ? styles.tableRowClickable : ""}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={canView ? () => handleOpenProduct(product.id) : undefined}
                    >
                      <TableCell className={styles.tableCell}>
                        <div>
                          <div className={styles.itemId}>#{product.id}</div>
                          {canAttachmentsView ? renderAttachmentBadges(product.id) : null}
                        </div>
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.nameCell}`}>
                        <div className={styles.itemTitle}>{product.название}</div>
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.articleCell}`}>
                        <div className={styles.itemSub}>{product.артикул || "—"}</div>
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.categoryCell}`}>
                        <span className={styles.categoryPill}>{product.категория || "Не указана"}</span>
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        <div className={styles.amountCell}>
                          {product.цена_закупки ? formatCurrency(product.цена_закупки) : "—"}
                        </div>
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        <div className={styles.amountCell}>{formatCurrency(product.цена_продажи)}</div>
                      </TableCell>

                      <TableCell className={styles.tableCell}>
                        <div className={styles.unitCell}>{product.единица_измерения}</div>
                      </TableCell>

                      <TableCell className={styles.tableCell}>
                        <div
                          className={styles.actionsCell}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={(
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className={styles.menuButton}
                                  aria-label="Действия"
                                  title="Действия"
                                />
                              )}
                            >
                              <FiMoreHorizontal size={18} />
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" sideOffset={6}>
                              {canView ? (
                                <DropdownMenuItem onClick={() => handleOpenProduct(product.id)}>
                                  <FiEye className={styles.rowMenuIcon} />
                                  Просмотр
                                </DropdownMenuItem>
                              ) : null}

                              {canEdit ? (
                                <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                  <FiEdit2 className={styles.rowMenuIcon} />
                                  Редактировать
                                </DropdownMenuItem>
                              ) : null}

                              {canPriceHistoryView ? (
                                <DropdownMenuItem onClick={() => handleOpenPriceHistory(product)}>
                                  <FiTrendingUp className={styles.rowMenuIcon} />
                                  История цен
                                </DropdownMenuItem>
                              ) : null}

                              {canDelete ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    className={styles.rowMenuItemDanger}
                                    onClick={() => handleDeleteProduct(product)}
                                  >
                                    <FiTrash2 className={styles.rowMenuIconDel} />
                                    Удалить
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </MotionTableRow>
                ))}
              </AnimatePresence>
            </TableBody>
              </Table>
            </EntityTableSurface>
          )}
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
