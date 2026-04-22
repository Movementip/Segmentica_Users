import * as React from "react"

import { cn } from "@/lib/utils"

import styles from "./EntityStatusBadge.module.css"

type EntityStatusTone = "neutral" | "success" | "warning" | "danger" | "muted"

type EntityStatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  value: string
  label?: string
  tone?: EntityStatusTone
  compact?: boolean
}

export function getOrderStatusTone(status: string): EntityStatusTone {
  switch ((status || "").trim().toLowerCase()) {
    case "выполнена":
    case "отгружена":
    case "получено":
      return "success"
    case "в обработке":
    case "досборка":
    case "заказано":
    case "доотгрузка":
      return "warning"
    case "отменена":
      return "danger"
    case "новая":
    case "подтверждена":
    case "в работе":
    case "собрана":
      return "neutral"
    default:
      return "muted"
  }
}

export function EntityStatusBadge({
  value,
  label,
  tone,
  compact = false,
  className,
  ...props
}: EntityStatusBadgeProps) {
  const resolvedTone = tone ?? getOrderStatusTone(value)
  const content = label ?? value

  return (
    <span
      className={cn(styles.root, styles[resolvedTone], compact && styles.compact, className)}
      {...props}
    >
      {content}
    </span>
  )
}
