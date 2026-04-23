import type { SuppliersFiltersState, SuppliersSortValue } from "@/types/pages/suppliers";

export const defaultSuppliersFilters: SuppliersFiltersState = {
    inTransit: "all",
    supplierName: "",
    type: "all",
    rating: "all",
    sortBy: "name-asc",
};

export const suppliersInTransitOptions = [
    { value: "all", label: "Все поставщики" },
    { value: "yes", label: "Есть закупки в работе" },
    { value: "no", label: "Без активных закупок" },
] as const;

export const suppliersRatingOptions = [
    { value: "all", label: "Любой рейтинг" },
    { value: "5", label: "5 ★★★★★" },
    { value: "4", label: "4 ★★★★☆" },
    { value: "3", label: "3 ★★★☆☆" },
    { value: "2", label: "2 ★★☆☆☆" },
    { value: "1", label: "1 ★☆☆☆☆" },
] as const;

export const suppliersSortOptions: Array<{
    value: SuppliersSortValue
    label: string
}> = [
    { value: "name-asc", label: "По названию (А-Я)" },
    { value: "name-desc", label: "По названию (Я-А)" },
    { value: "rating-desc", label: "По рейтингу" },
    { value: "sum-desc", label: "По сумме товаров" },
    { value: "products-desc", label: "По числу товаров" },
];
