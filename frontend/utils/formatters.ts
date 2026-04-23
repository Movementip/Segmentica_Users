type CurrencyFormatOptions = {
    fallback?: string
    maximumFractionDigits?: number
}

export function formatRuDate(value?: string | null, fallback = "—") {
    if (!value) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleDateString("ru-RU");
}

export function formatRuDateTime(value?: string | null, fallback = "—") {
    if (!value) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;

    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(parsed);
}

export function formatRuCurrency(value?: number | null, options: CurrencyFormatOptions = {}) {
    const { fallback = "—", maximumFractionDigits = 0 } = options;
    if (value == null || !Number.isFinite(Number(value))) return fallback;

    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits,
    }).format(Number(value));
}

export function formatFileSize(bytes: number, locale: "ru" | "en" = "ru") {
    const normalized = Number(bytes) || 0;
    if (!Number.isFinite(normalized) || normalized <= 0) {
        return locale === "ru" ? "0 Б" : "0 B";
    }

    const units = locale === "ru" ? ["Б", "КБ", "МБ", "ГБ"] : ["B", "KB", "MB", "GB"];
    const power = Math.min(Math.floor(Math.log(normalized) / Math.log(1024)), units.length - 1);
    const value = normalized / 1024 ** power;
    return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}
