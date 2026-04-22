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
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./ClientsFilters.module.css"

type ClientsFiltersState = {
  type: string
  name: string
}

type FilterTab = "type" | "name"

type ClientsFiltersProps = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  isFiltersOpen: boolean
  setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  filters: ClientsFiltersState
  setFilters: React.Dispatch<React.SetStateAction<ClientsFiltersState>>
  syncClientsUrl: (next: ClientsFiltersState) => void
  sortBy: string
  setSortBy: (value: "id-asc" | "id-desc" | "name-asc" | "name-desc") => void
  syncClientsSortUrl: (sort: string) => void
  clientNameQuery: string
  setClientNameQuery: React.Dispatch<React.SetStateAction<string>>
  filteredClientNameOptions: string[]
  filtersDropdownRef: React.RefObject<HTMLDivElement | null>
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>
  sortTriggerRef: React.RefObject<HTMLButtonElement | null>
}

const filterTabs: Array<{ value: FilterTab; label: string }> = [
  { value: "type", label: "Тип" },
  { value: "name", label: "Название" },
]

const typeOptions = [
  { value: "all", label: "Все типы" },
  { value: "Организация", label: "Организация" },
  { value: "Индивидуальный предприниматель", label: "Индивидуальный предприниматель" },
  { value: "Физическое лицо", label: "Физическое лицо" },
  { value: "Адвокат", label: "Адвокат" },
  { value: "Нотариус", label: "Нотариус" },
  { value: "Глава КФХ", label: "Глава КФХ" },
  { value: "Иностранный контрагент", label: "Иностранный контрагент" },
]

const sortOptions = [
  { value: "id-desc", label: "По ID (по убыванию)" },
  { value: "id-asc", label: "По ID (по возрастанию)" },
  { value: "name-asc", label: "По алфавиту (А-Я)" },
  { value: "name-desc", label: "По алфавиту (Я-А)" },
]

export function ClientsFilters({
  searchQuery,
  onSearchQueryChange,
  isFiltersOpen,
  setIsFiltersOpen,
  filters,
  setFilters,
  syncClientsUrl,
  sortBy,
  setSortBy,
  syncClientsSortUrl,
  clientNameQuery,
  setClientNameQuery,
  filteredClientNameOptions,
  filtersDropdownRef,
  filterTriggerRef,
  sortTriggerRef,
}: ClientsFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("type")

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по названию или контакту..."
        value={searchQuery}
        onValueChange={onSearchQueryChange}
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
              tabsLabel="Фильтры контрагентов"
              data-clients-filters-dropdown
            >
              {activeTab === "type" ? (
                <DataFilterField label="Тип">
                  <Select
                    value={filters.type}
                    items={typeOptions}
                    onValueChange={(nextValue) => {
                      const value = String(nextValue)
                      setFilters((previous) => {
                        const next = { ...previous, type: value }
                        syncClientsUrl(next)
                        return next
                      })
                    }}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {typeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataFilterField>
              ) : null}

              {activeTab === "name" ? (
                <DataFilterField label="Название">
                  <DataFilterTextArea
                    rows={2}
                    placeholder="Начни вводить название..."
                    value={clientNameQuery}
                    onChange={(event) => {
                      const value = event.target.value
                      setClientNameQuery(value)
                      setFilters((previous) => {
                        const next = { ...previous, name: value }
                        syncClientsUrl(next)
                        return next
                      })
                    }}
                  />
                  {clientNameQuery.trim() ? (
                    <DataFilterSuggestList isEmpty={filteredClientNameOptions.length === 0}>
                      {filteredClientNameOptions.length > 0
                        ? filteredClientNameOptions.slice(0, 10).map((name) => (
                          <DataFilterSuggestItem
                            key={name}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setClientNameQuery(name)
                              setFilters((previous) => {
                                const next = { ...previous, name }
                                syncClientsUrl(next)
                                return next
                              })
                            }}
                          >
                            {name}
                          </DataFilterSuggestItem>
                        ))
                        : null}
                    </DataFilterSuggestList>
                  ) : null}
                </DataFilterField>
              ) : null}

              <DataFiltersPanelActions>
                <DataFilterActionButton
                  onClick={() => {
                    setClientNameQuery("")
                    const next = { type: "all", name: "" }
                    setFilters(next)
                    syncClientsUrl(next)
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
            value={sortBy}
            items={sortOptions}
            onValueChange={(nextValue) => {
              const value = String(nextValue) as "id-asc" | "id-desc" | "name-asc" | "name-desc"
              setSortBy(value)
              syncClientsSortUrl(value)
              sortTriggerRef.current?.blur()
            }}
          >
            <SelectTrigger ref={sortTriggerRef} className={styles.sortSelectTrigger} />
            <SelectContent>
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
  )
}

export type { ClientsFiltersState }
