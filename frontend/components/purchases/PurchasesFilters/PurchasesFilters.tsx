import * as React from "react"
import { FiFilter } from "react-icons/fi"

import {
  DataFilterActionButton,
  DataFilterField,
  DataFiltersPanel,
  DataFiltersPanelActions,
  DataFilterSuggestItem,
  DataFilterSuggestList,
  DataFilterTextArea,
} from "@/components/DataFiltersPanel/DataFiltersPanel"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import type {
  PurchasesFiltersState,
  SupplierOption,
} from "@/types/pages/purchases"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./PurchasesFilters.module.css"

type FilterTab = "status" | "supplier" | "order"

type SyncPurchasesUrlArgs = {
  status: string
  supplierId: string
  supplierName: string
  orderId: string
  sortBy: string
}

type PurchasesFiltersProps = {
  searchInputValue: string
  onSearchInputChange: (value: string) => void
  isFiltersOpen: boolean
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  filters: PurchasesFiltersState
  setFilters: React.Dispatch<React.SetStateAction<PurchasesFiltersState>>
  syncPurchasesUrl: (next: SyncPurchasesUrlArgs) => void
  supplierQuery: string
  setSupplierQuery: React.Dispatch<React.SetStateAction<string>>
  filteredSupplierOptions: SupplierOption[]
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  sortTriggerRef: React.RefObject<HTMLButtonElement | null>
}

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "status", label: "Статус" },
  { value: "supplier", label: "Поставщик" },
  { value: "order", label: "Заявка" },
]

const statusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "заказано", label: "Заказано" },
  { value: "в пути", label: "В пути" },
  { value: "получено", label: "Получено" },
  { value: "отменено", label: "Отменено" },
]

const purchaseSortOptions = [
  { value: "date-desc", label: "По дате (новые сначала)" },
  { value: "date-asc", label: "По дате (старые сначала)" },
  { value: "sum-asc", label: "По сумме (по возрастанию)" },
  { value: "sum-desc", label: "По сумме (по убыванию)" },
]

export function PurchasesFilters({
  searchInputValue,
  onSearchInputChange,
  isFiltersOpen,
  setIsFiltersOpen,
  filters,
  setFilters,
  syncPurchasesUrl,
  supplierQuery,
  setSupplierQuery,
  filteredSupplierOptions,
  filtersDropdownRef,
  filterTriggerRef,
  sortTriggerRef,
}: PurchasesFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("status")

  const sync = (next: PurchasesFiltersState) => {
    syncPurchasesUrl({
      status: next.status,
      supplierId: next.supplierId,
      supplierName: next.supplierName,
      orderId: next.orderId,
      sortBy: next.sortBy,
    })
  }

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по закупкам..."
        value={searchInputValue}
        onValueChange={onSearchInputChange}
      />

      <div className={styles.filterGroup}>
        <div className={styles.filterDropdown} ref={filtersDropdownRef}>
          <Button
            type="button"
            variant="outline"
            className={styles.filterSelectTrigger}
            ref={filterTriggerRef}
            onClick={() => setIsFiltersOpen((value) => !value)}
            aria-expanded={isFiltersOpen}
          >
            <span className={styles.triggerLabel}>
              <FiFilter className={styles.icon} />
              Фильтры
            </span>
          </Button>

          {isFiltersOpen ? (
            <DataFiltersPanel
              tabs={filterTabs}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              tabsLabel="Фильтры закупок"
              data-purchases-filters-dropdown
            >
              {activeTab === "status" ? (
                <DataFilterField label="Статус">
                  <Select
                    value={filters.status}
                    items={statusOptions}
                    onValueChange={(nextValue) => {
                      const value = String(nextValue)
                      setFilters((previous) => {
                        const next = { ...previous, status: value }
                        sync(next)
                        return next
                      })
                    }}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataFilterField>
              ) : null}

              {activeTab === "supplier" ? (
                <DataFilterField label="Поставщик">
                  <DataFilterTextArea
                    rows={2}
                    placeholder="Начни вводить название поставщика..."
                    value={supplierQuery}
                    onChange={(event) => {
                      const value = event.target.value
                      setSupplierQuery(value)
                      setFilters((previous) => ({
                        ...previous,
                        supplierName: value,
                        supplierId: value.trim() ? previous.supplierId : "all",
                      }))

                      if (!value.trim()) {
                        syncPurchasesUrl({
                          status: filters.status,
                          supplierId: "all",
                          supplierName: "",
                          orderId: filters.orderId,
                          sortBy: filters.sortBy,
                        })
                      }
                    }}
                  />

                  {supplierQuery.trim() ? (
                    <DataFilterSuggestList isEmpty={filteredSupplierOptions.length === 0}>
                      {filteredSupplierOptions.length > 0
                        ? filteredSupplierOptions.slice(0, 10).map((supplier) => (
                          <DataFilterSuggestItem
                            key={supplier.id}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSupplierQuery(supplier.name)
                              setFilters((previous) => ({
                                ...previous,
                                supplierId: String(supplier.id),
                                supplierName: supplier.name,
                              }))
                              syncPurchasesUrl({
                                status: filters.status,
                                supplierId: String(supplier.id),
                                supplierName: supplier.name,
                                orderId: filters.orderId,
                                sortBy: filters.sortBy,
                              })
                            }}
                          >
                            {supplier.name}
                          </DataFilterSuggestItem>
                        ))
                        : null}
                    </DataFilterSuggestList>
                  ) : null}
                </DataFilterField>
              ) : null}

              {activeTab === "order" ? (
                <DataFilterField label="Заявка (ID)">
                  <DataFilterTextArea
                    rows={2}
                    placeholder="Например: 23"
                    value={filters.orderId}
                    onChange={(event) => {
                      const value = event.target.value
                      setFilters((previous) => {
                        const next = { ...previous, orderId: value }
                        sync(next)
                        return next
                      })
                    }}
                  />
                </DataFilterField>
              ) : null}

              <DataFiltersPanelActions>
                <DataFilterActionButton
                  onClick={() => {
                    setSupplierQuery("")
                    const next = {
                      status: "all",
                      supplierId: "all",
                      supplierName: "",
                      orderId: "",
                      sortBy: filters.sortBy,
                    }
                    setFilters(next)
                    sync(next)
                  }}
                >
                  Сбросить
                </DataFilterActionButton>
                <DataFilterActionButton onClick={() => setIsFiltersOpen(false)}>
                  Закрыть
                </DataFilterActionButton>
              </DataFiltersPanelActions>
            </DataFiltersPanel>
          ) : null}
        </div>

        <div className={styles.sortDropdown}>
          <span>Сортировка:</span>
          <Select
            value={filters.sortBy}
            items={purchaseSortOptions}
            onValueChange={(nextValue) => {
              const value = String(nextValue)
              setFilters((previous) => ({ ...previous, sortBy: value }))
              syncPurchasesUrl({
                status: filters.status,
                supplierId: filters.supplierId,
                supplierName: filters.supplierName,
                orderId: filters.orderId,
                sortBy: value,
              })
              sortTriggerRef.current?.blur()
            }}
          >
            <SelectTrigger ref={sortTriggerRef} className={styles.sortSelectTrigger} />
            <SelectContent>
              {purchaseSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
