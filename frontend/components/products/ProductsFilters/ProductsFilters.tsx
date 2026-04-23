import * as React from "react";

import { DataSearchField } from "@/components/DataSearchField/DataSearchField";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import type { ProductFilters } from "@/types/pages/products";

import styles from "../Products.module.css";

type ProductsFiltersProps = {
    categoryOptions: string[]
    filters: ProductFilters
    search: string
    sortOptions: Array<{ value: ProductFilters["sortBy"]; label: string }>
    unitOptions: string[]
    onFiltersChange: React.Dispatch<React.SetStateAction<ProductFilters>>
    onSearchChange: (value: string) => void
}

export function ProductsFilters({
    categoryOptions,
    filters,
    search,
    sortOptions,
    unitOptions,
    onFiltersChange,
    onSearchChange,
}: ProductsFiltersProps) {
    return (
        <section className={styles.controlsSection}>
            <DataSearchField
                value={search}
                onValueChange={onSearchChange}
                placeholder="Поиск по названию или артикулу..."
                wrapperClassName={styles.search}
            />

            <div className={styles.controlsGroup}>
                <div className={styles.selectWrap}>
                    <Select
                        value={filters.category}
                        items={[
                            { value: "all", label: "Все категории" },
                            ...categoryOptions.map((category) => ({ value: category, label: category })),
                        ]}
                        onValueChange={(value) =>
                            onFiltersChange((previous) => ({ ...previous, category: String(value) }))
                        }
                    >
                        <SelectTrigger className={styles.selectTrigger} />
                        <SelectContent align="end">
                            <SelectItem value="all">Все категории</SelectItem>
                            {categoryOptions.map((category) => (
                                <SelectItem key={category} value={category}>
                                    {category}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className={styles.selectWrap}>
                    <Select
                        value={filters.unit}
                        items={[
                            { value: "all", label: "Все единицы" },
                            ...unitOptions.map((unit) => ({ value: unit, label: unit })),
                        ]}
                        onValueChange={(value) =>
                            onFiltersChange((previous) => ({ ...previous, unit: String(value) }))
                        }
                    >
                        <SelectTrigger className={styles.selectTrigger} />
                        <SelectContent align="end">
                            <SelectItem value="all">Все единицы</SelectItem>
                            {unitOptions.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                    {unit}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className={styles.sortGroup}>
                    <span className={styles.sortLabel}>Сортировка:</span>
                    <div className={styles.sortWrap}>
                        <Select
                            value={filters.sortBy}
                            items={sortOptions}
                            onValueChange={(value) =>
                                onFiltersChange((previous) => ({
                                    ...previous,
                                    sortBy: String(value) as ProductFilters["sortBy"],
                                }))
                            }
                        >
                            <SelectTrigger className={styles.sortTrigger} />
                            <SelectContent align="end">
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
        </section>
    );
}
