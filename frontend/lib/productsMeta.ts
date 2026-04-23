import type { ProductFilters, ProductSortValue } from "@/types/pages/products";

export const defaultProductFilters: ProductFilters = {
    category: "all",
    unit: "all",
    sortBy: "date-desc",
};

export const productSortOptions: Array<{ value: ProductSortValue; label: string }> = [
    { value: "date-desc", label: "По дате (новые сначала)" },
    { value: "date-asc", label: "По дате (старые сначала)" },
    { value: "name-asc", label: "По названию (А-Я)" },
    { value: "name-desc", label: "По названию (Я-А)" },
    { value: "price-purchase-asc", label: "По закупке (по возрастанию)" },
    { value: "price-purchase-desc", label: "По закупке (по убыванию)" },
    { value: "price-sale-asc", label: "По продаже (по возрастанию)" },
    { value: "price-sale-desc", label: "По продаже (по убыванию)" },
];
