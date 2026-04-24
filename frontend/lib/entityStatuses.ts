export type EntityStatusTone = "neutral" | "success" | "warning" | "danger" | "muted"

type EntityStatusAppearance = {
  light: string
  dark: string
  tone: EntityStatusTone
}

const STATUS_APPEARANCE: Record<string, EntityStatusAppearance> = {
  "новая": {
    light: "oklch(0.62 0.12 245)",
    dark: "oklch(0.78 0.11 245)",
    tone: "neutral",
  },
  "подтверждена": {
    light: "oklch(0.58 0.14 276)",
    dark: "oklch(0.74 0.13 276)",
    tone: "neutral",
  },
  "подтверждено": {
    light: "oklch(0.58 0.14 276)",
    dark: "oklch(0.74 0.13 276)",
    tone: "neutral",
  },
  "в обработке": {
    light: "oklch(0.62 0.1 225)",
    dark: "oklch(0.77 0.09 225)",
    tone: "warning",
  },
  "в работе": {
    light: "oklch(0.61 0.12 230)",
    dark: "oklch(0.76 0.11 230)",
    tone: "warning",
  },
  "собрана": {
    light: "oklch(0.62 0.17 304)",
    dark: "oklch(0.79 0.14 304)",
    tone: "neutral",
  },
  "досборка": {
    light: "oklch(0.66 0.19 346)",
    dark: "oklch(0.81 0.15 346)",
    tone: "warning",
  },
  "заказано": {
    light: "oklch(0.69 0.17 82)",
    dark: "oklch(0.82 0.14 82)",
    tone: "warning",
  },
  "в пути": {
    light: "oklch(0.71 0.17 58)",
    dark: "oklch(0.84 0.14 58)",
    tone: "warning",
  },
  "отгружена": {
    light: "oklch(0.63 0.12 206)",
    dark: "oklch(0.78 0.1 206)",
    tone: "success",
  },
  "отгружено": {
    light: "oklch(0.63 0.12 206)",
    dark: "oklch(0.78 0.1 206)",
    tone: "success",
  },
  "доотгрузка": {
    light: "oklch(0.64 0.11 188)",
    dark: "oklch(0.79 0.1 188)",
    tone: "warning",
  },
  "доставлено": {
    light: "oklch(0.6 0.11 171)",
    dark: "oklch(0.76 0.1 171)",
    tone: "success",
  },
  "доставлена": {
    light: "oklch(0.6 0.11 171)",
    dark: "oklch(0.76 0.1 171)",
    tone: "success",
  },
  "получено": {
    light: "oklch(0.57 0.15 148)",
    dark: "oklch(0.74 0.13 148)",
    tone: "success",
  },
  "выполнена": {
    light: "oklch(0.56 0.16 158)",
    dark: "oklch(0.73 0.14 158)",
    tone: "success",
  },
  "выполнено": {
    light: "oklch(0.56 0.16 158)",
    dark: "oklch(0.73 0.14 158)",
    tone: "success",
  },
  "отменена": {
    light: "oklch(0.58 0.22 28)",
    dark: "oklch(0.72 0.18 28)",
    tone: "danger",
  },
  "отменено": {
    light: "oklch(0.58 0.22 28)",
    dark: "oklch(0.72 0.18 28)",
    tone: "danger",
  },
}

export function normalizeEntityStatus(status: string): string {
  return (status || "").trim().toLowerCase()
}

export function getEntityStatusAppearance(status: string): EntityStatusAppearance | null {
  return STATUS_APPEARANCE[normalizeEntityStatus(status)] ?? null
}

export function getEntityStatusTone(status: string): EntityStatusTone {
  return getEntityStatusAppearance(status)?.tone ?? "muted"
}

export function getOrderStatusTone(status: string): EntityStatusTone {
  return getEntityStatusTone(status)
}

export function getPurchaseStatusTone(status: string): EntityStatusTone {
  return getEntityStatusTone(status)
}

export function getShipmentStatusTone(status: string): EntityStatusTone {
  return getEntityStatusTone(status)
}
