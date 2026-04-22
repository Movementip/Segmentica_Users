import * as React from "react"
import { FiFilter } from "react-icons/fi"

import {
  DataFilterActionButton,
  DataFilterField,
  DataFiltersPanel,
  DataFiltersPanelActions,
  DataFilterTextArea,
} from "@/components/DataFiltersPanel/DataFiltersPanel"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import {
  defaultTransportFilters,
  transportActiveShipmentOptions,
  transportRateOptions,
  transportSortOptions,
  transportTotalShipmentOptions,
  type TransportFiltersState,
} from "@/components/transport/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./TransportFilters.module.css"

type FilterTab = "company" | "rate" | "total" | "active"

type TransportFiltersProps = {
  filters: TransportFiltersState
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  isFiltersOpen: boolean
  searchInputValue: string
  searchPlaceholder: string
  setFilters: React.Dispatch<React.SetStateAction<TransportFiltersState>>
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  sortTriggerRef: React.RefObject<HTMLButtonElement | null>
  showCompanyControls: boolean
  onSearchInputChange: (value: string) => void
}

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "company", label: "Компания" },
  { value: "rate", label: "Тариф" },
  { value: "total", label: "Всего" },
  { value: "active", label: "Активные" },
]

export function TransportFilters({
  filters,
  filterTriggerRef,
  filtersDropdownRef,
  isFiltersOpen,
  searchInputValue,
  searchPlaceholder,
  setFilters,
  setIsFiltersOpen,
  sortTriggerRef,
  showCompanyControls,
  onSearchInputChange,
}: TransportFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("company")

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder={searchPlaceholder}
        value={searchInputValue}
        onValueChange={onSearchInputChange}
      />

      {showCompanyControls ? (
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
                tabsLabel="Фильтры транспортных компаний"
                data-transport-filters-dropdown
              >
                {activeTab === "company" ? (
                  <DataFilterField label="Компания">
                    <DataFilterTextArea
                      rows={2}
                      placeholder="Начни вводить название компании..."
                      value={filters.companyName}
                      onChange={(event) => {
                        const value = event.target.value
                        setFilters((previous) => ({ ...previous, companyName: value }))
                      }}
                    />
                  </DataFilterField>
                ) : null}

                {activeTab === "rate" ? (
                  <DataFilterField label="Тариф">
                    <Select
                      value={filters.rate}
                      items={transportRateOptions}
                      onValueChange={(nextValue) => {
                        const value = String(nextValue) as TransportFiltersState["rate"]
                        setFilters((previous) => ({ ...previous, rate: value }))
                      }}
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {transportRateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DataFilterField>
                ) : null}

                {activeTab === "total" ? (
                  <DataFilterField label="Всего отгрузок">
                    <Select
                      value={filters.totalShipments}
                      items={transportTotalShipmentOptions}
                      onValueChange={(nextValue) => {
                        const value = String(nextValue) as TransportFiltersState["totalShipments"]
                        setFilters((previous) => ({ ...previous, totalShipments: value }))
                      }}
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {transportTotalShipmentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DataFilterField>
                ) : null}

                {activeTab === "active" ? (
                  <DataFilterField label="Активные отгрузки">
                    <Select
                      value={filters.activeShipments}
                      items={transportActiveShipmentOptions}
                      onValueChange={(nextValue) => {
                        const value = String(nextValue) as TransportFiltersState["activeShipments"]
                        setFilters((previous) => ({ ...previous, activeShipments: value }))
                      }}
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {transportActiveShipmentOptions.map((option) => (
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
                    onClick={() => setFilters(defaultTransportFilters)}
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
              items={transportSortOptions}
              onValueChange={(nextValue) => {
                const value = String(nextValue) as TransportFiltersState["sortBy"]
                setFilters((previous) => ({ ...previous, sortBy: value }))
              }}
            >
              <SelectTrigger ref={sortTriggerRef} className={styles.sortSelectTrigger} />
              <SelectContent>
                {transportSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  )
}
