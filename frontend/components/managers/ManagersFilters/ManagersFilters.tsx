import { ChevronDown } from "lucide-react"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { ActivityFilter, SortOption } from "@/types/pages/managers"
import styles from "./ManagersFilters.module.css"

const positionFilterOptions = [
  { value: "all", label: "Все должности" },
]

const activityFilterOptions: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "Все статусы" },
  { value: "active", label: "Активен" },
  { value: "inactive", label: "Неактивен" },
]

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "id-desc", label: "ID (сначала больше)" },
  { value: "id-asc", label: "ID (сначала меньше)" },
  { value: "name-asc", label: "ФИО (А-Я)" },
  { value: "name-desc", label: "ФИО (Я-А)" },
  { value: "hire-desc", label: "Дата приёма (сначала новые)" },
  { value: "hire-asc", label: "Дата приёма (сначала старые)" },
]

type ManagersFiltersProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  positionFilter: string
  onPositionFilterChange: (value: string) => void
  activityFilter: ActivityFilter
  onActivityFilterChange: (value: ActivityFilter) => void
  sortBy: SortOption
  onSortByChange: (value: SortOption) => void
  positions: string[]
}

export function ManagersFilters({
  searchTerm,
  onSearchTermChange,
  positionFilter,
  onPositionFilterChange,
  activityFilter,
  onActivityFilterChange,
  sortBy,
  onSortByChange,
  positions,
}: ManagersFiltersProps) {
  const positionOptions = [
    ...positionFilterOptions,
    ...positions.map((position) => ({ value: position, label: position })),
  ]

  return (
    <div className={styles.searchSection}>
      <DataSearchField
        wrapperClassName={styles.searchInputWrapper}
        placeholder="Поиск по ФИО, должности, телефону, email..."
        value={searchTerm}
        onValueChange={onSearchTermChange}
      />

      <div className={styles.filterGroup}>
        <Select value={positionFilter} onValueChange={(value) => onPositionFilterChange(String(value))}>
          <SelectTrigger className={styles.selectTrigger}>
            <SelectValue>{positionOptions.find((option) => option.value === positionFilter)?.label}</SelectValue>
            <ChevronDown className={styles.triggerIcon} />
          </SelectTrigger>
          <SelectContent>
            {positionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activityFilter}
          onValueChange={(value) => onActivityFilterChange(String(value) as ActivityFilter)}
        >
          <SelectTrigger className={styles.selectTrigger}>
            <SelectValue>{activityFilterOptions.find((option) => option.value === activityFilter)?.label}</SelectValue>
            <ChevronDown className={styles.triggerIcon} />
          </SelectTrigger>
          <SelectContent>
            {activityFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className={styles.sortDropdown}>
          <span>Сортировка:</span>
          <Select
            value={sortBy}
            onValueChange={(value) => onSortByChange(String(value) as SortOption)}
          >
            <SelectTrigger className={styles.sortSelectTrigger}>
              <SelectValue>{sortOptions.find((option) => option.value === sortBy)?.label}</SelectValue>
              <ChevronDown className={styles.triggerIcon} />
            </SelectTrigger>
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
