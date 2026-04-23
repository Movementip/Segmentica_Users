import type { ShipmentStatusTone } from "@/types/pages/shipments";

export const shipmentStatusOptions = [
    { value: "all", label: "Все статусы" },
    { value: "в пути", label: "В пути" },
    { value: "доставлено", label: "Доставлено" },
    { value: "получено", label: "Получено" },
    { value: "отменено", label: "Отменено" },
] as const;

export function getShipmentStatusLabel(status: string) {
    const normalized = (status || "").trim().toLowerCase();

    switch (normalized) {
        case "в пути":
            return "В пути";
        case "доставлено":
            return "Доставлено";
        case "получено":
            return "Получено";
        case "отменено":
            return "Отменено";
        default:
            return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "Не определено";
    }
}

export function getShipmentStatusTone(status: string): ShipmentStatusTone {
    switch ((status || "").trim().toLowerCase()) {
        case "получено":
        case "доставлено":
            return "success";
        case "в пути":
            return "warning";
        case "отменено":
            return "danger";
        default:
            return "muted";
    }
}
