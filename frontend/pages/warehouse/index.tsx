import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { EntityTableSkeleton, EntityTableSurface } from "@/components/EntityDataTable/EntityDataTable"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { WarehouseAttachmentBadges } from "@/components/warehouse/WarehouseAttachmentBadges/WarehouseAttachmentBadges"
import { WarehouseAttentionBanner } from "@/components/warehouse/WarehouseAttentionBanner/WarehouseAttentionBanner"
import { WarehouseFilters } from "@/components/warehouse/WarehouseFilters/WarehouseFilters"
import { WarehouseMovementsTable } from "@/components/warehouse/WarehouseMovementsTable/WarehouseMovementsTable"
import { WarehousePageHeader } from "@/components/warehouse/WarehousePageHeader/WarehousePageHeader"
import { WarehousePageSkeleton } from "@/components/warehouse/WarehousePageSkeleton/WarehousePageSkeleton"
import { WarehouseStats } from "@/components/warehouse/WarehouseStats/WarehouseStats"
import { WarehouseStockTable } from "@/components/warehouse/WarehouseStockTable/WarehouseStockTable"
import {
  WarehouseViewTabs,
  type WarehouseViewTab,
} from "@/components/warehouse/WarehouseViewTabs/WarehouseViewTabs"
import { getWarehouseStockStatusLabel } from "@/components/warehouse/utils"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"
import { AdjustStockModal } from "@/components/modals/AdjustStockModal/AdjustStockModal"
import { CreateProductModal } from "@/components/modals/CreateProductModal/CreateProductModal"
import { EditProductModal } from "@/components/modals/EditProductModal/EditProductModal"
import { WarehouseMovementModal } from "@/components/modals/WarehouseMovementModal/WarehouseMovementModal"
import type { WarehouseData, WarehouseItem } from "@/types/pages/warehouse"

import styles from "./Warehouse.module.css"

function WarehousePage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [data, setData] = useState<WarehouseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tableKey, setTableKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<"all" | "critical" | "low" | "normal">("all")
  const [category, setCategory] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeTab, setActiveTab] = useState<WarehouseViewTab>("stock")

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<WarehouseItem | null>(null)
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementModalInitialType, setMovementModalInitialType] = useState<"приход" | "расход">("приход")
  const [isImportingExcel, setIsImportingExcel] = useState(false)

  const [attachmentsTypesByProductId, setAttachmentsTypesByProductId] = useState<Record<number, string[]>>({})
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canList = Boolean(user?.permissions?.includes("warehouse.list"))
  const canView = Boolean(user?.permissions?.includes("warehouse.view"))
  const canProductCreate = Boolean(user?.permissions?.includes("products.create"))
  const canWarehouseCreate = Boolean(user?.permissions?.includes("warehouse.create"))
  const canCreate = canProductCreate && canWarehouseCreate
  const canEdit = Boolean(user?.permissions?.includes("warehouse.edit"))
  const canDelete = Boolean(user?.permissions?.includes("warehouse.delete"))
  const canMovementCreate = Boolean(user?.permissions?.includes("warehouse.movement.create"))
  const canStockAdjust = Boolean(user?.permissions?.includes("warehouse.stock.adjust"))
  const canMovementsView = Boolean(user?.permissions?.includes("warehouse.movements.view"))
  const canCriticalView = Boolean(user?.permissions?.includes("warehouse.critical.view"))
  const canExportExcel = Boolean(user?.permissions?.includes("warehouse.export.excel"))
  const canImportExcel = Boolean(user?.permissions?.includes("warehouse.import.excel"))
  const canWarehouseProductAttachmentsView = Boolean(
    user?.permissions?.includes("warehouse-products.attachments.view")
  )

  useEffect(() => {
    if (authLoading) return
    if (activeTab === "movements" && !canMovementsView) setActiveTab("stock")
    if (activeTab === "critical" && !canCriticalView) setActiveTab("stock")
  }, [activeTab, authLoading, canCriticalView, canMovementsView])

  useEffect(() => {
    if (!router.isReady) return

    const queryTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    const querySearch = Array.isArray(router.query.search) ? router.query.search[0] : router.query.search
    const queryCategory = Array.isArray(router.query.category) ? router.query.category[0] : router.query.category
    const queryFilter = Array.isArray(router.query.filter) ? router.query.filter[0] : router.query.filter

    if (queryTab === "stock" || queryTab === "movements" || queryTab === "critical") {
      setActiveTab(queryTab)
    }

    if (typeof querySearch === "string") {
      setSearch(querySearch)
      setDebouncedSearch(querySearch)
    }

    if (typeof queryCategory === "string") setCategory(queryCategory)

    if (
      queryFilter === "all" ||
      queryFilter === "critical" ||
      queryFilter === "low" ||
      queryFilter === "normal"
    ) {
      setFilter(queryFilter)
    }
  }, [router.isReady, router.query.category, router.query.filter, router.query.search, router.query.tab])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!router.isReady) return

    const query: Record<string, string> = {}

    if (activeTab !== "stock") query.tab = activeTab
    if (debouncedSearch.trim()) query.search = debouncedSearch
    if (category !== "all") query.category = category
    if (activeTab === "stock" && filter !== "all") query.filter = filter

    const currentTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    const currentSearch = Array.isArray(router.query.search) ? router.query.search[0] : router.query.search
    const currentCategory = Array.isArray(router.query.category) ? router.query.category[0] : router.query.category
    const currentFilter = Array.isArray(router.query.filter) ? router.query.filter[0] : router.query.filter

    const unchanged =
      String(currentTab || "") === String(query.tab || "") &&
      String(currentSearch || "") === String(query.search || "") &&
      String(currentCategory || "") === String(query.category || "") &&
      String(currentFilter || "") === String(query.filter || "")

    if (unchanged) return

    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [activeTab, category, debouncedSearch, filter, router])

  const fetchData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      setError(null)
      setLoading(true)
      if (mode === "refresh") {
        setTableKey((value) => value + 1)
      }

      const response = await fetch("/api/warehouse")
      const result = await response.json().catch(() => null)

      if (!response.ok || !result) {
        throw new Error(result?.error || "Не удалось загрузить данные склада")
      }

      let nextAttachmentsMap: Record<number, string[]> = {}

      const productIds = (result?.warehouse || [])
        .map((item: WarehouseItem) => Number(item.товар_id))
        .filter((value: number) => Number.isInteger(value) && value > 0)

      if (productIds.length > 0 && canWarehouseProductAttachmentsView) {
        try {
          const summaryResponse = await fetch(
            `/api/attachments/summary?entity_type=product&entity_ids=${encodeURIComponent(productIds.join(","))}&perm_scope=warehouse`
          )

          if (summaryResponse.ok) {
            const summaryData = (await summaryResponse.json()) as Array<{ entity_id: number; types: string[] }>
            const nextMap: Record<number, string[]> = {}

            for (const item of Array.isArray(summaryData) ? summaryData : []) {
              const entityId = Number(item.entity_id)
              if (!Number.isInteger(entityId)) continue
              nextMap[entityId] = Array.isArray(item.types) ? item.types : []
            }

            nextAttachmentsMap = nextMap
          }
        } catch (attachmentsError) {
          console.error("Error fetching warehouse product attachments summary:", attachmentsError)
        }
      }

      setAttachmentsTypesByProductId(nextAttachmentsMap)
      setData(result)
    } catch (fetchError) {
      console.error("Error fetching warehouse data:", fetchError)
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки данных")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [canWarehouseProductAttachmentsView])

  useEffect(() => {
    if (authLoading || !canList) return
    void fetchData("initial")
  }, [authLoading, canList, fetchData])

  const handleImportExcelFile = async (file: File) => {
    if (!canImportExcel || !file) return

    setIsImportingExcel(true)

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const worksheetName = workbook.SheetNames?.[0]
      if (!worksheetName) throw new Error("Файл Excel пуст")

      const worksheet = workbook.Sheets[worksheetName]
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as Record<string, unknown>[]

      const normalizedRows = rawRows
        .map((row) => {
          const pick = (keys: string[]) => {
            for (const key of keys) {
              if (row[key] != null && String(row[key]).trim() !== "") return row[key]
            }
            return ""
          }

          return {
            артикул: String(pick(["Артикул", "артикул", "SKU", "sku"])).trim(),
            название: String(pick(["Название", "название", "Товар", "товар"])).trim(),
            категория: String(pick(["Категория", "категория"])).trim() || null,
            единица_измерения: String(
              pick(["Ед. измерения", "Ед измерения", "Единица", "единица_измерения", "единица"])
            ).trim(),
            минимальный_остаток: pick(["Мин. остаток", "Мин остаток", "минимальный_остаток"]),
            цена_закупки: pick(["Цена закупки", "цена_закупки"]),
            цена_продажи: pick(["Цена продажи", "цена_продажи"]),
            количество: pick(["Количество", "количество", "Остаток", "остаток"]),
          }
        })
        .filter((row) => row.артикул || row.название)

      if (normalizedRows.length === 0) {
        throw new Error("Не удалось найти строки для импорта")
      }

      const response = await fetch("/api/warehouse/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: normalizedRows }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result?.error || "Ошибка импорта")
      }

      await fetchData("refresh")
      alert("Импорт выполнен")
    } catch (importError) {
      alert(importError instanceof Error ? importError.message : "Ошибка импорта")
    } finally {
      setIsImportingExcel(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const getPlural = (value: number, one: string, few: string, many: string) => {
    const abs = Math.abs(value)
    const mod10 = abs % 10
    const mod100 = abs % 100
    if (mod100 >= 11 && mod100 <= 14) return many
    if (mod10 === 1) return one
    if (mod10 >= 2 && mod10 <= 4) return few
    return many
  }

  const formatDate = (value: string) => new Date(value).toLocaleDateString("ru-RU")
  const formatDateTime = (value: string) => new Date(value).toLocaleString("ru-RU")
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount)

  const filteredItems = useMemo(() => {
    const items = data?.warehouse || []
    const query = debouncedSearch.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        (item.товар_название || "").toLowerCase().includes(query) ||
        (item.товар_артикул || "").toLowerCase().includes(query)

      const matchesCategory = category === "all" || (item.товар_категория || "") === category

      if (!matchesSearch || !matchesCategory) return false

      if (filter === "critical") return item.stock_status === "critical"
      if (filter === "low") return item.stock_status === "low" || item.stock_status === "critical"
      if (filter === "normal") return item.stock_status === "normal"
      return true
    })
  }, [category, data?.warehouse, debouncedSearch, filter])

  const filteredLowStock = useMemo(() => {
    const items = data?.lowStock || []
    const query = debouncedSearch.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        (item.товар_название || "").toLowerCase().includes(query) ||
        (item.товар_артикул || "").toLowerCase().includes(query)

      const matchesCategory = category === "all" || (item.товар_категория || "") === category

      if (!matchesSearch || !matchesCategory) return false

      if (filter === "critical") return item.stock_status === "critical"
      if (filter === "low") return item.stock_status === "low" || item.stock_status === "critical"
      if (filter === "normal") return item.stock_status === "normal"
      return true
    })
  }, [category, data?.lowStock, debouncedSearch, filter])

  const filteredMovements = useMemo(() => {
    const items = data?.movements || []
    const query = debouncedSearch.trim().toLowerCase()

    return items.filter((movement) => {
      if (!query) return true

      return (
        (movement.товар_название || "").toLowerCase().includes(query) ||
        (movement.товар_артикул || "").toLowerCase().includes(query)
      )
    })
  }, [data?.movements, debouncedSearch])

  const categories = useMemo(() => {
    const values = new Set<string>()
    ;(data?.warehouse || []).forEach((item) => {
      if (item.товар_категория) values.add(item.товар_категория)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, "ru"))
  }, [data?.warehouse])

  const totalItems = data?.warehouse?.length || 0
  const criticalCount = data?.lowStock?.length || 0

  const totalValue = useMemo(() => {
    return (data?.warehouse || []).reduce((sum, item) => {
      return sum + (item?.количество || 0) * (item?.товар_цена_закупки || 0)
    }, 0)
  }, [data?.warehouse])

  const movementsLastMonth = useMemo(() => {
    const items = data?.movements || []
    if (!items.length) return 0

    const now = Date.now()
    const from = now - 30 * 24 * 60 * 60 * 1000

    return items.filter((item) => {
      const time = new Date(item.дата_операции).getTime()
      return Number.isFinite(time) && time >= from && time <= now
    }).length
  }, [data?.movements])

  const openEditModalFor = (item: WarehouseItem) => {
    if (!canEdit) return
    setSelectedWarehouseItem(item)
    setIsEditProductModalOpen(true)
  }

  const openDeleteModalFor = (item: WarehouseItem) => {
    if (!canDelete) return
    setSelectedWarehouseItem(item)
    setIsDeleteModalOpen(true)
  }

  const openStockAdjustmentFor = (item: WarehouseItem) => {
    if (!canStockAdjust) return
    setSelectedWarehouseItem(item)
    setIsAdjustStockModalOpen(true)
  }

  const openItem = (item: WarehouseItem) => {
    if (!canView) return
    void router.push(`/warehouse/${item.id}`)
  }

  const handleConfirmDelete = async () => {
    if (!selectedWarehouseItem || !canDelete) return

    try {
      setIsDeleting(true)

      const response = await fetch(`/api/warehouse?id=${selectedWarehouseItem.id}`, {
        method: "DELETE",
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result?.error || "Ошибка удаления товара")
      }

      setIsDeleteModalOpen(false)
      setSelectedWarehouseItem(null)
      await fetchData("refresh")
    } catch (deleteError) {
      console.error("Error deleting product:", deleteError)
      alert(
        "Ошибка удаления товара: " +
          (deleteError instanceof Error ? deleteError.message : "Неизвестная ошибка")
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportExcel = () => {
    if (!filteredItems.length) return

    void (async () => {
      const XLSX = await import("xlsx")

      const worksheet = XLSX.utils.json_to_sheet(
        filteredItems.map((item) => ({
          ID: item.id,
          Название: item.товар_название,
          Артикул: item.товар_артикул,
          Категория: item.товар_категория || "",
          Количество: item.количество,
          "Ед. измерения": item.товар_единица,
          "Мин. остаток": item.товар_мин_остаток,
          Статус: getWarehouseStockStatusLabel(item.stock_status),
          "Цена закупки": item.товар_цена_закупки || 0,
          "Цена продажи": item.товар_цена_продажи,
          "Дата последнего поступления": item.дата_последнего_поступления
            ? new Date(item.дата_последнего_поступления).toLocaleDateString("ru-RU")
            : "Нет данных",
          "Общая стоимость": (item.количество * (item.товар_цена_закупки || 0)).toFixed(2),
        }))
      )

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Склад")
      const date = new Date().toISOString().split("T")[0]
      XLSX.writeFile(workbook, `Склад_${date}.xlsx`)
    })()
  }

  const handleMovementSaved = () => {
    void fetchData("refresh")
    setActiveTab(canMovementsView ? "movements" : "stock")
  }

  const handleProductCreated = () => {
    void fetchData("refresh")
    setIsCreateModalOpen(false)
  }

  const currentItemsCount =
    activeTab === "movements"
      ? filteredMovements.length
      : activeTab === "critical"
        ? filteredLowStock.length
        : filteredItems.length

  const emptyStateText =
    activeTab === "movements"
      ? "Движения товаров не найдены"
      : activeTab === "critical"
        ? "Критические остатки не найдены"
        : "Товары на складе не найдены"

  if (!authLoading && !canList) {
    return <NoAccessPage />
  }

  return (
    <div className={styles.container}>
      <WarehousePageHeader
        canCreate={!authLoading && canCreate}
        canMovementCreate={!authLoading && canMovementCreate}
        onCreate={() => setIsCreateModalOpen(true)}
        onOpenIncome={() => {
          setMovementModalInitialType("приход")
          setIsMovementModalOpen(true)
        }}
        onOpenExpense={() => {
          setMovementModalInitialType("расход")
          setIsMovementModalOpen(true)
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          void handleImportExcelFile(file)
        }}
      />

      {authLoading || (loading && !data) ? (
        <WarehousePageSkeleton />
      ) : data ? (
        <>
          <WarehouseStats
            totalItems={totalItems}
            criticalCount={criticalCount}
            totalValue={totalValue}
            movementsLastMonth={movementsLastMonth}
            formatCurrency={formatCurrency}
          />

          {criticalCount > 0 && canCriticalView ? (
            <WarehouseAttentionBanner
              description={`${criticalCount} ${getPlural(
                criticalCount,
                "товар",
                "товара",
                "товаров"
              )} ${criticalCount === 1 ? "имеет" : "имеют"} критически низкий остаток. Рекомендуется срочное пополнение.`}
              onView={() => {
                setActiveTab("critical")
                setFilter("critical")
              }}
            />
          ) : null}

          <div className={styles.card}>
            <div className={styles.tabsSection}>
              <WarehouseViewTabs
                activeTab={activeTab}
                canMovementsView={canMovementsView}
                canCriticalView={canCriticalView}
                criticalCount={criticalCount}
                onChange={(nextTab) => {
                  if (nextTab === "movements" && !canMovementsView) return
                  if (nextTab === "critical" && !canCriticalView) return

                  setActiveTab(nextTab)

                  if (nextTab !== "stock") {
                    setFilter("all")
                  }
                }}
              />
            </div>

            <WarehouseFilters
              activeTab={activeTab}
              searchValue={search}
              onSearchChange={setSearch}
              category={category}
              categories={categories}
              onCategoryChange={setCategory}
              filter={filter}
              onFilterChange={setFilter}
              canExportExcel={canExportExcel}
              canImportExcel={canImportExcel}
              isImportingExcel={isImportingExcel}
              onExport={handleExportExcel}
              onImportClick={() => fileInputRef.current?.click()}
            />

            {loading ? (
              <EntityTableSurface
                variant="embedded"
                clip="bottom"
                className={styles.tableContainer}
                key={tableKey}
              >
                <EntityTableSkeleton
                  columns={activeTab === "movements" ? 6 : 8}
                  rows={7}
                  actionColumn={activeTab !== "movements"}
                />
              </EntityTableSurface>
            ) : currentItemsCount === 0 ? (
              <div className={styles.emptyState}>
                <p>{emptyStateText}</p>
                {activeTab === "stock" && canCreate ? (
                  <CreateEntityButton className={styles.button} onClick={() => setIsCreateModalOpen(true)}>
                    Добавить первый товар
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
                {activeTab === "movements" ? (
                  <WarehouseMovementsTable
                    movements={filteredMovements}
                    formatDateTime={formatDateTime}
                  />
                ) : (
                  <WarehouseStockTable
                    items={activeTab === "critical" ? filteredLowStock : filteredItems}
                    showAttachments={activeTab === "stock"}
                    canView={canView}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canStockAdjust={canStockAdjust}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    renderAttachmentBadges={(productId) =>
                      canWarehouseProductAttachmentsView ? (
                        <WarehouseAttachmentBadges types={attachmentsTypesByProductId[productId] || []} />
                      ) : null
                    }
                    onOpenItem={openItem}
                    onEditItem={openEditModalFor}
                    onAdjustStock={openStockAdjustmentFor}
                    onOpenHistory={openItem}
                    onDeleteItem={openDeleteModalFor}
                  />
                )}
              </EntityTableSurface>
            )}
          </div>
        </>
      ) : (
        <div className={styles.card}>
          <div className={styles.errorState}>
            <p className={styles.errorText}>{error || "Ошибка загрузки данных"}</p>
            <button className={styles.button} onClick={() => void fetchData("initial")}>
              Повторить попытку
            </button>
          </div>
        </div>
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
          setSelectedWarehouseItem(null)
        }}
        onProductUpdated={() => {
          setIsEditProductModalOpen(false)
          setSelectedWarehouseItem(null)
          void fetchData("refresh")
        }}
        product={
          selectedWarehouseItem
            ? {
                id: selectedWarehouseItem.товар_id,
                название: selectedWarehouseItem.товар_название,
                артикул: selectedWarehouseItem.товар_артикул,
                категория: selectedWarehouseItem.товар_категория,
                единица_измерения: selectedWarehouseItem.товар_единица,
                минимальный_остаток: selectedWarehouseItem.товар_мин_остаток,
                цена_закупки: selectedWarehouseItem.товар_цена_закупки || 0,
                цена_продажи: selectedWarehouseItem.товар_цена_продажи || 0,
              }
            : null
        }
      />

      <DeleteConfirmation
        isOpen={isDeleteModalOpen && !!selectedWarehouseItem}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedWarehouseItem(null)
        }}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этот товар со склада?"
        warning="Это действие нельзя отменить. Все данные товара и связанные складские записи будут удалены."
        details={selectedWarehouseItem ? (
          <div className={deleteConfirmationStyles.positionsSection}>
            <div className={deleteConfirmationStyles.orderTitle}>
              {selectedWarehouseItem.товар_название}
            </div>
            <div className={deleteConfirmationStyles.orderMeta}>
              Артикул: {selectedWarehouseItem.товар_артикул || "—"}
            </div>
            <div className={deleteConfirmationStyles.orderMeta}>
              Остаток: {selectedWarehouseItem.количество} {selectedWarehouseItem.товар_единица}
            </div>
          </div>
        ) : null}
      />

      <AdjustStockModal
        isOpen={isAdjustStockModalOpen}
        onClose={() => {
          setIsAdjustStockModalOpen(false)
          setSelectedWarehouseItem(null)
        }}
        warehouseItem={
          selectedWarehouseItem
            ? {
                id: selectedWarehouseItem.id,
                товар_id: selectedWarehouseItem.товар_id,
                товар_название: selectedWarehouseItem.товар_название,
                товар_артикул: selectedWarehouseItem.товар_артикул,
                товар_единица: selectedWarehouseItem.товар_единица,
                количество: selectedWarehouseItem.количество,
              }
            : null
        }
        onSaved={handleMovementSaved}
      />

      <WarehouseMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        initialType={movementModalInitialType}
        onSaved={handleMovementSaved}
      />
    </div>
  )
}

export default withLayout(WarehousePage)
