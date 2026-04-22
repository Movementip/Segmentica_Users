import type { ReactNode, RefObject } from "react"
import { FiFilter } from "react-icons/fi"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./DataToolbar.module.css"

export type SortOption = {
  value: string
  label: string
}

type DataToolbarProps = {
  searchValue: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  filterOpen: boolean
  onFilterOpenChange: (open: boolean) => void
  filterPanel?: ReactNode
  filterPanelRef?: RefObject<HTMLDivElement | null>
  filterTriggerRef?: RefObject<HTMLButtonElement | null>
  sortLabel?: string
  sortValue: string
  sortOptions: SortOption[]
  onSortChange: (value: string) => void
  sortRef?: RefObject<HTMLButtonElement | null>
}

export function DataToolbar({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filterOpen,
  onFilterOpenChange,
  filterPanel,
  filterPanelRef,
  filterTriggerRef,
  sortLabel = "Сортировка:",
  sortValue,
  sortOptions,
  onSortChange,
  sortRef,
}: DataToolbarProps) {
  const sortSelectItems = sortOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }))

  return (
    <div className={styles.toolbar}>
      <DataSearchField
        wrapperClassName={styles.search}
        placeholder={searchPlaceholder}
        value={searchValue}
        onValueChange={onSearchChange}
      />

      <div className={styles.controls}>
        {filterPanel ? (
          <div className={styles.filter} ref={filterPanelRef}>
            <Button
              type="button"
              variant="outline"
              className={styles.filterButton}
              ref={filterTriggerRef}
              onClick={() => onFilterOpenChange(!filterOpen)}
              aria-expanded={filterOpen}
            >
              <FiFilter className={styles.icon} />
              Фильтры
            </Button>

            {filterOpen ? (
              <div className={styles.filterPanel} data-filters-panel>
                {filterPanel}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.sort}>
          <span>{sortLabel}</span>
          <Select
            value={sortValue}
            items={sortSelectItems}
            onValueChange={(value) => onSortChange(String(value))}
          >
            <SelectTrigger ref={sortRef} className={styles.sortSelect} />
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
