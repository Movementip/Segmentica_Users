import * as React from "react"
import { FiFilter } from "react-icons/fi"

import {
  DataFilterActionButton,
  DataFilterField,
  DataFiltersPanel,
  DataFiltersPanelActions,
} from "@/components/DataFiltersPanel/DataFiltersPanel"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import type {
  MissingProductsFiltersState,
  MissingProductsOrderOption,
  MissingProductsProductOption,
} from "@/types/pages/missing-products"
import {
  defaultMissingProductsFilters,
  missingProductSortOptions,
  missingProductStatusOptions,
} from "@/lib/missingProductsMeta"
import { Button } from "@/components/ui/button"
import OrderSearchSelect from "@/components/ui/OrderSearchSelect/OrderSearchSelect"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./MissingProductsFilters.module.css"

type FilterTab = "status" | "order" | "product"

type MissingProductsFiltersProps = {
  filters: MissingProductsFiltersState
  isFiltersOpen: boolean
  orderOptions: MissingProductsOrderOption[]
  productOptions: MissingProductsProductOption[]
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  onFiltersChange: React.Dispatch<React.SetStateAction<MissingProductsFiltersState>>
  onSearchTermChange: (value: string) => void
  searchTerm: string
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "status", label: "Статус" },
  { value: "order", label: "Заявка" },
  { value: "product", label: "Товар" },
]

export function MissingProductsFilters({
  filters,
  isFiltersOpen,
  orderOptions,
  productOptions,
  filtersDropdownRef,
  filterTriggerRef,
  onFiltersChange,
  onSearchTermChange,
  searchTerm,
  setIsFiltersOpen,
}: MissingProductsFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("status")

  const normalizedOrderOptions = React.useMemo(
    () =>
      orderOptions.map((order) => ({
        value: String(order.id),
        label: `Заявка #${order.id}`,
      })),
    [orderOptions]
  )

  const normalizedProductOptions = React.useMemo(
    () =>
      productOptions.map((product) => ({
        value: String(product.id),
        label: `${product.артикул} - ${product.название}`,
      })),
    [productOptions]
  )

  return (
    <section className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по товару, артикулу или заявке..."
        value={searchTerm}
        onValueChange={onSearchTermChange}
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
              tabsLabel="Фильтры недостающих товаров"
            >
              {activeTab === "status" ? (
                <DataFilterField label="Статус">
                  <Select
                    value={filters.status}
                    items={missingProductStatusOptions}
                    onValueChange={(value) =>
                      onFiltersChange((previous) => ({
                        ...previous,
                        status: String(value),
                      }))
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {missingProductStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataFilterField>
              ) : null}

              {activeTab === "order" ? (
                <DataFilterField label="Заявка">
                  <OrderSearchSelect
                    compact
                    value={filters.orderId === "all" ? "" : filters.orderId}
                    options={normalizedOrderOptions}
                    onValueChange={(value) =>
                      onFiltersChange((previous) => ({
                        ...previous,
                        orderId: value || "all",
                      }))
                    }
                    placeholder="Выберите заявку"
                    emptyText="Ничего не найдено"
                    inputClassName={styles.inlineSelectInput}
                  />
                </DataFilterField>
              ) : null}

              {activeTab === "product" ? (
                <DataFilterField label="Товар">
                  <OrderSearchSelect
                    compact
                    value={filters.productId === "all" ? "" : filters.productId}
                    options={normalizedProductOptions}
                    onValueChange={(value) =>
                      onFiltersChange((previous) => ({
                        ...previous,
                        productId: value || "all",
                      }))
                    }
                    placeholder="Выберите товар"
                    emptyText="Ничего не найдено"
                    inputClassName={styles.inlineSelectInput}
                  />
                </DataFilterField>
              ) : null}

              <DataFiltersPanelActions>
                <DataFilterActionButton
                  onClick={() =>
                    onFiltersChange((previous) => ({
                      ...previous,
                      status: defaultMissingProductsFilters.status,
                      orderId: defaultMissingProductsFilters.orderId,
                      productId: defaultMissingProductsFilters.productId,
                    }))
                  }
                >
                  Сбросить
                </DataFilterActionButton>
                <Button type="button" onClick={() => setIsFiltersOpen(false)}>
                  Применить
                </Button>
              </DataFiltersPanelActions>
            </DataFiltersPanel>
          ) : null}
        </div>

        <div className={styles.sortDropdown}>
          <span>Сортировка:</span>
          <Select
            value={filters.sortBy}
            items={missingProductSortOptions}
            onValueChange={(value) =>
              onFiltersChange((previous) => ({
                ...previous,
                sortBy: String(value) as MissingProductsFiltersState["sortBy"],
              }))
            }
          >
            <SelectTrigger className={styles.sortSelectTrigger} />
            <SelectContent align="end">
              {missingProductSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
