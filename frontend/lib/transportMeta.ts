import type { TransportFiltersState } from "@/types/pages/transport";

export const defaultTransportFilters: TransportFiltersState = {
    companyName: "",
    rate: "all",
    totalShipments: "all",
    activeShipments: "all",
    sortBy: "shipments-desc",
};

export const transportRateOptions = [
    { value: "all", label: "Все тарифы" },
    { value: "lt-1000", label: "Меньше 1 000 ₽" },
    { value: "1000-5000", label: "1 000–5 000 ₽" },
    { value: "gt-5000", label: "Больше 5 000 ₽" },
] as const;

export const transportTotalShipmentOptions = [
    { value: "all", label: "Любое количество" },
    { value: "0", label: "0" },
    { value: "1-9", label: "1–9" },
    { value: "10+", label: "10+" },
] as const;

export const transportActiveShipmentOptions = [
    { value: "all", label: "Любое количество" },
    { value: "0", label: "0" },
    { value: "1-4", label: "1–4" },
    { value: "5+", label: "5+" },
] as const;

export const transportSortOptions = [
    { value: "shipments-desc", label: "По отгрузкам (сначала больше)" },
    { value: "shipments-asc", label: "По отгрузкам (сначала меньше)" },
    { value: "revenue-desc", label: "По выручке (сначала больше)" },
    { value: "revenue-asc", label: "По выручке (сначала меньше)" },
    { value: "created-desc", label: "По дате (сначала новые)" },
    { value: "created-asc", label: "По дате (сначала старые)" },
] as const;
