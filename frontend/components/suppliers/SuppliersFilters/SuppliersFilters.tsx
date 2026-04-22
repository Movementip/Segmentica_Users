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
  SupplierOption,
  SuppliersFiltersState,
} from "@/components/suppliers/types"
import {
  defaultSuppliersFilters,
  suppliersInTransitOptions,
  suppliersRatingOptions,
  suppliersSortOptions,
} from "@/components/suppliers/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  SUPPLIER_CONTRAGENT_TYPES,
  getSupplierContragentTypeLabel,
} from "@/lib/supplierContragents"

import styles from "./SuppliersFilters.module.css"

type FilterTab = "inTransit" | "supplier" | "type" | "rating"

type SyncSuppliersUrlArgs = {
  q: string
  inTransit: string
  rating: string
  supplierName: string
  type: string
  sort: string
}

type SuppliersFiltersProps = {
  searchInputValue: string
  onSearchInputChange: (value: string) => void
  isFiltersOpen: boolean
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  filters: SuppliersFiltersState
  setFilters: React.Dispatch<React.SetStateAction<SuppliersFiltersState>>
  syncSuppliersUrl: (next: SyncSuppliersUrlArgs) => void
  supplierQuery: string
  setSupplierQuery: React.Dispatch<React.SetStateAction<string>>
  filteredSupplierOptions: SupplierOption[]
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  sortTriggerRef: React.RefObject<HTMLButtonElement | null>
}

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "inTransit", label: "В работе" },
  { value: "supplier", label: "Поставщик" },
  { value: "type", label: "Тип" },
  { value: "rating", label: "Рейтинг" },
]

const supplierTypeOptions = [
  { value: "all", label: "Все типы" },
  ...SUPPLIER_CONTRAGENT_TYPES.map((value) => ({
    value,
    label: getSupplierContragentTypeLabel(value),
  })),
]

export function SuppliersFilters({
  searchInputValue,
  onSearchInputChange,
  isFiltersOpen,
  setIsFiltersOpen,
  filters,
  setFilters,
  syncSuppliersUrl,
  supplierQuery,
  setSupplierQuery,
  filteredSupplierOptions,
  filtersDropdownRef,
  filterTriggerRef,
  sortTriggerRef,
}: SuppliersFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("inTransit")

  const sync = (next: SuppliersFiltersState) => {
    syncSuppliersUrl({
      q: searchInputValue,
      inTransit: next.inTransit,
      rating: next.rating,
      supplierName: next.supplierName,
      type: next.type,
      sort: next.sortBy,
    })
  }

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по поставщикам..."
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
              tabsLabel="Фильтры поставщиков"
              data-suppliers-filters-dropdown
            >
              {activeTab === "inTransit" ? (
                <DataFilterField label="Активные закупки">
                  <Select
                    value={filters.inTransit}
                    items={suppliersInTransitOptions}
                    onValueChange={(nextValue) => {
                      const value = String(nextValue)
                      setFilters((previous) => {
                        const next = { ...previous, inTransit: value }
                        sync(next)
                        return next
                      })
                    }}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {suppliersInTransitOptions.map((option) => (
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
                      }))

                      if (!value.trim()) {
                        syncSuppliersUrl({
                          q: searchInputValue,
                          inTransit: filters.inTransit,
                          rating: filters.rating,
                          supplierName: "",
                          type: filters.type,
                          sort: filters.sortBy,
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
                              const next = {
                                ...filters,
                                supplierName: supplier.name,
                              }
                              setFilters(next)
                              sync(next)
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

              {activeTab === "type" ? (
                <DataFilterField label="Тип поставщика">
                  <Select
                    value={filters.type}
                    items={supplierTypeOptions}
                    onValueChange={(nextValue) => {
                      const value = String(nextValue)
                      setFilters((previous) => {
                        const next = { ...previous, type: value }
                        sync(next)
                        return next
                      })
                    }}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {supplierTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataFilterField>
              ) : null}

              {activeTab === "rating" ? (
                <DataFilterField label="Рейтинг">
                  <Select
                    value={filters.rating}
                    items={suppliersRatingOptions}
                    onValueChange={(nextValue) => {
                      const value = String(nextValue)
                      setFilters((previous) => {
                        const next = { ...previous, rating: value }
                        sync(next)
                        return next
                      })
                    }}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {suppliersRatingOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataFilterField>
              ) : null}

              <DataFiltersPanelActions>
                <DataFilterActionButton
                  onClick={() => {
                    setSupplierQuery("")
                    const next = {
                      ...defaultSuppliersFilters,
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
            items={suppliersSortOptions}
            onValueChange={(nextValue) => {
              const value = String(nextValue) as SuppliersFiltersState["sortBy"]
              setFilters((previous) => {
                const next = { ...previous, sortBy: value }
                sync(next)
                return next
              })
            }}
          >
            <SelectTrigger className={styles.sortSelectTrigger} ref={sortTriggerRef} />
            <SelectContent align="end">
              {suppliersSortOptions.map((option) => (
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
