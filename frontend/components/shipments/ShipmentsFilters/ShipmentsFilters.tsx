import * as React from "react"
import { FiDownload, FiFilter, FiUpload } from "react-icons/fi"

import {
  DataFilterActionButton,
  DataFilterField,
  DataFiltersPanel,
  DataFiltersPanelActions,
} from "@/components/DataFiltersPanel/DataFiltersPanel"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import type { StatusFilter } from "@/components/shipments/types"
import { shipmentStatusOptions } from "@/components/shipments/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./ShipmentsFilters.module.css"

type TransportOption = {
  id: number
  название: string
}

type FilterTab = "transport" | "status"

type ShipmentsFiltersProps = {
  canExport: boolean
  canImport: boolean
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  importDisabled?: boolean
  isFiltersOpen: boolean
  searchInputValue: string
  statusFilter: StatusFilter
  transportFilter: string
  transports: TransportOption[]
  onExport: () => void
  onImport: () => void
  onSearchInputChange: (value: string) => void
  onStatusFilterChange: (value: StatusFilter) => void
  onTransportFilterChange: (value: string) => void
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const EMPTY_SELECT_VALUE = "__empty__"

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "transport", label: "Транспорт" },
  { value: "status", label: "Статус" },
]

export function ShipmentsFilters({
  canExport,
  canImport,
  filtersDropdownRef,
  filterTriggerRef,
  importDisabled = false,
  isFiltersOpen,
  searchInputValue,
  statusFilter,
  transportFilter,
  transports,
  onExport,
  onImport,
  onSearchInputChange,
  onStatusFilterChange,
  onTransportFilterChange,
  setIsFiltersOpen,
}: ShipmentsFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("transport")

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по номеру, заявке, ТК, треку..."
        value={searchInputValue}
        onValueChange={onSearchInputChange}
      />

      <div className={styles.actionsGroup}>
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
              tabsLabel="Фильтры отгрузок"
              data-shipments-filters-dropdown
            >
              {activeTab === "transport" ? (
                <DataFilterField label="Транспортная компания">
                  <Select
                    value={transportFilter}
                    items={[
                      { value: EMPTY_SELECT_VALUE, label: "Все ТК" },
                      ...transports.map((transport) => ({
                        value: String(transport.id),
                        label: transport.название,
                      })),
                    ]}
                    onValueChange={(nextValue) => onTransportFilterChange(String(nextValue))}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Все ТК</SelectItem>
                      {transports.map((transport) => (
                        <SelectItem key={transport.id} value={String(transport.id)}>
                          {transport.название}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataFilterField>
              ) : null}

              {activeTab === "status" ? (
                <DataFilterField label="Статус отгрузки">
                  <Select
                    value={statusFilter}
                    items={shipmentStatusOptions}
                    onValueChange={(nextValue) => onStatusFilterChange(String(nextValue) as StatusFilter)}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {shipmentStatusOptions.map((option) => (
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
                    onTransportFilterChange(EMPTY_SELECT_VALUE)
                    onStatusFilterChange("all")
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

        {canExport ? (
          <Button type="button" variant="outline" className={styles.actionButton} onClick={onExport}>
            <FiDownload className={styles.icon} />
            Экспорт
          </Button>
        ) : null}

        {canImport ? (
          <Button
            type="button"
            variant="outline"
            className={styles.actionButton}
            disabled={importDisabled}
            onClick={onImport}
          >
            <FiUpload className={styles.icon} />
            Импорт
          </Button>
        ) : null}
      </div>
    </div>
  )
}
