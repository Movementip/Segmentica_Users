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
import type { ClientOption, OrdersFiltersState } from "@/components/orders/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { getOrderExecutionModeLabel } from "@/lib/orderModes"

import styles from "./OrdersFilters.module.css"

type FilterTab = "status" | "mode" | "client" | "manager"

type SyncOrdersUrlArgs = {
  clientId: string
  status: string
  executionMode: string
  managerName: string
  sortBy: string
}

type OrdersFiltersProps = {
  searchInputValue: string
  onSearchInputChange: (value: string) => void
  isFiltersOpen: boolean
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  filters: OrdersFiltersState
  setFilters: React.Dispatch<React.SetStateAction<OrdersFiltersState>>
  syncOrdersUrl: (next: SyncOrdersUrlArgs) => void
  clientQuery: string
  setClientQuery: React.Dispatch<React.SetStateAction<string>>
  managerQuery: string
  setManagerQuery: React.Dispatch<React.SetStateAction<string>>
  filteredClientOptions: ClientOption[]
  filteredManagerOptions: string[]
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  sortTriggerRef: React.RefObject<HTMLButtonElement | null>
}

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "status", label: "Статус" },
  { value: "mode", label: "Режим" },
  { value: "client", label: "Контрагент" },
  { value: "manager", label: "Менеджер" },
]

const statusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "новая", label: "Новая" },
  { value: "в обработке", label: "В обработке" },
  { value: "подтверждена", label: "Подтверждена" },
  { value: "в работе", label: "В работе" },
  { value: "собрана", label: "Собрана" },
  { value: "выполнена", label: "Выполнена" },
  { value: "отгружена", label: "Отгружена" },
  { value: "отменена", label: "Отменена" },
]

const executionModeOptions = [
  { value: "all", label: "Все режимы" },
  { value: "warehouse", label: getOrderExecutionModeLabel("warehouse") },
  { value: "direct", label: getOrderExecutionModeLabel("direct") },
]

const orderSortOptions = [
  { value: "date-desc", label: "По дате (новые сначала)" },
  { value: "date-asc", label: "По дате (старые сначала)" },
  { value: "sum-asc", label: "По сумме (по возрастанию)" },
  { value: "sum-desc", label: "По сумме (по убыванию)" },
]

export function OrdersFilters({
  searchInputValue,
  onSearchInputChange,
  isFiltersOpen,
  setIsFiltersOpen,
  filters,
  setFilters,
  syncOrdersUrl,
  clientQuery,
  setClientQuery,
  managerQuery,
  setManagerQuery,
  filteredClientOptions,
  filteredManagerOptions,
  filtersDropdownRef,
  filterTriggerRef,
  sortTriggerRef,
}: OrdersFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("status")

  const sync = (next: OrdersFiltersState) => {
    syncOrdersUrl({
      clientId: next.clientId,
      status: next.status,
      executionMode: next.executionMode,
      managerName: next.managerName,
      sortBy: next.sortBy,
    })
  }

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по заявкам..."
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
              tabsLabel="Фильтры заявок"
              data-orders-filters-dropdown
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

                {activeTab === "mode" ? (
                  <DataFilterField label="Режим заявки">
                    <Select
                      value={filters.executionMode}
                      items={executionModeOptions}
                      onValueChange={(nextValue) => {
                        const value = String(nextValue)
                        setFilters((previous) => {
                          const next = { ...previous, executionMode: value }
                          sync(next)
                          return next
                        })
                      }}
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {executionModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DataFilterField>
                ) : null}

                {activeTab === "client" ? (
                  <DataFilterField label="Контрагент">
                    <DataFilterTextArea
                      rows={2}
                      placeholder="Начни вводить имя контрагента..."
                      value={clientQuery}
                      onChange={(event) => {
                        const value = event.target.value
                        setClientQuery(value)
                        setFilters((previous) => ({
                          ...previous,
                          clientName: value,
                          clientId: value.trim() ? previous.clientId : "all",
                        }))
                        if (!value.trim()) {
                          syncOrdersUrl({
                            clientId: "all",
                            status: filters.status,
                            executionMode: filters.executionMode,
                            managerName: filters.managerName,
                            sortBy: filters.sortBy,
                          })
                        }
                      }}
                    />
                    {clientQuery.trim() ? (
                      <DataFilterSuggestList isEmpty={filteredClientOptions.length === 0}>
                        {filteredClientOptions.length > 0
                          ? (
                          filteredClientOptions.slice(0, 10).map((client) => (
                            <DataFilterSuggestItem
                              key={client.id}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setClientQuery(client.name)
                                setFilters((previous) => ({
                                  ...previous,
                                  clientId: String(client.id),
                                  clientName: client.name,
                                }))
                                syncOrdersUrl({
                                  clientId: String(client.id),
                                  status: filters.status,
                                  executionMode: filters.executionMode,
                                  managerName: filters.managerName,
                                  sortBy: filters.sortBy,
                                })
                              }}
                            >
                              {client.name}
                            </DataFilterSuggestItem>
                          ))
                            )
                          : null}
                      </DataFilterSuggestList>
                    ) : null}
                  </DataFilterField>
                ) : null}

                {activeTab === "manager" ? (
                  <DataFilterField label="Менеджер">
                    <DataFilterTextArea
                      rows={2}
                      placeholder="Начни вводить ФИО менеджера..."
                      value={managerQuery}
                      onChange={(event) => {
                        const value = event.target.value
                        setManagerQuery(value)
                        setFilters((previous) => {
                          const next = { ...previous, managerName: value }
                          sync(next)
                          return next
                        })
                      }}
                    />
                    {managerQuery.trim() ? (
                      <DataFilterSuggestList isEmpty={filteredManagerOptions.length === 0}>
                        {filteredManagerOptions.length > 0
                          ? (
                          filteredManagerOptions.slice(0, 10).map((name) => (
                            <DataFilterSuggestItem
                              key={name}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setFilters((previous) => {
                                  const next = { ...previous, managerName: name }
                                  sync(next)
                                  return next
                                })
                                setManagerQuery(name)
                              }}
                            >
                              {name}
                            </DataFilterSuggestItem>
                          ))
                            )
                          : null}
                      </DataFilterSuggestList>
                    ) : null}
                  </DataFilterField>
                ) : null}

              <DataFiltersPanelActions>
                <DataFilterActionButton
                  onClick={() => {
                    setClientQuery("")
                    setManagerQuery("")
                    const next = {
                      status: "all",
                      executionMode: "all",
                      sortBy: filters.sortBy,
                      clientId: "all",
                      managerName: "",
                      clientName: "",
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
            items={orderSortOptions}
            onValueChange={(nextValue) => {
              const value = String(nextValue)
              setFilters((previous) => ({ ...previous, sortBy: value }))
              syncOrdersUrl({
                clientId: filters.clientId,
                status: filters.status,
                executionMode: filters.executionMode,
                managerName: filters.managerName,
                sortBy: value,
              })
              sortTriggerRef.current?.blur()
            }}
          >
            <SelectTrigger ref={sortTriggerRef} className={styles.sortSelectTrigger} />
            <SelectContent>
              {orderSortOptions.map((option) => (
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
