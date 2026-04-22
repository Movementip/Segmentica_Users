import { FiDownload, FiUpload } from "react-icons/fi"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

import type { WarehouseViewTab } from "../WarehouseViewTabs/WarehouseViewTabs"

import styles from "./WarehouseFilters.module.css"

const categoryFallbackOption = { value: "all", label: "Все категории" }

const statusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "critical", label: "Критический" },
  { value: "low", label: "Низкий" },
  { value: "normal", label: "Нормальный" },
] as const

type WarehouseFiltersProps = {
  activeTab: WarehouseViewTab
  searchValue: string
  onSearchChange: (value: string) => void
  category: string
  categories: string[]
  onCategoryChange: (value: string) => void
  filter: "all" | "critical" | "low" | "normal"
  onFilterChange: (value: "all" | "critical" | "low" | "normal") => void
  canExportExcel: boolean
  canImportExcel: boolean
  isImportingExcel: boolean
  onExport: () => void
  onImportClick: () => void
}

export function WarehouseFilters({
  activeTab,
  searchValue,
  onSearchChange,
  category,
  categories,
  onCategoryChange,
  filter,
  onFilterChange,
  canExportExcel,
  canImportExcel,
  isImportingExcel,
  onExport,
  onImportClick,
}: WarehouseFiltersProps) {
  const categoryOptions = [
    categoryFallbackOption,
    ...categories.map((categoryOption) => ({ value: categoryOption, label: categoryOption })),
  ]

  return (
    <section className={styles.controls}>
      <DataSearchField
        value={searchValue}
        onValueChange={onSearchChange}
        placeholder="Поиск по названию или коду..."
        wrapperClassName={styles.search}
      />

      <div className={styles.actions}>
        {activeTab !== "movements" ? (
          <div className={styles.selectWrap}>
            <Select
              value={category}
              items={categoryOptions}
              onValueChange={(value) => onCategoryChange(String(value))}
            >
              <SelectTrigger className={styles.selectTrigger} />
            <SelectContent align="end">
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
            </Select>
          </div>
        ) : null}

        {activeTab === "stock" ? (
          <div className={styles.selectWrap}>
            <Select
              value={filter}
              items={statusOptions}
              onValueChange={(value) => onFilterChange(String(value) as typeof filter)}
            >
              <SelectTrigger className={styles.selectTrigger} />
              <SelectContent align="end">
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {activeTab === "stock" && canExportExcel ? (
          <Button type="button" variant="outline" className={styles.actionButton} onClick={onExport}>
            <FiDownload data-icon="inline-start" className="size-4" />
            Excel
          </Button>
        ) : null}

        {activeTab === "stock" && canImportExcel ? (
          <Button
            type="button"
            variant="outline"
            className={styles.actionButton}
            disabled={isImportingExcel}
            onClick={onImportClick}
          >
            <FiUpload data-icon="inline-start" className="size-4" />
            {isImportingExcel ? "Загрузка..." : "Загрузить из Excel"}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
