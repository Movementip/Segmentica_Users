import * as React from "react"

import {
  getEntityStatusAppearance,
  getOrderStatusTone,
  type EntityStatusTone,
} from "@/lib/entityStatuses"
import { cn } from "@/lib/utils"

import styles from "./EntityStatusBadge.module.css"

type EntityStatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  value: string
  label?: string
  tone?: EntityStatusTone
  compact?: boolean
}

export function EntityStatusBadge({
  value,
  label,
  tone,
  compact = false,
  className,
  ...props
}: EntityStatusBadgeProps) {
  const appearance = getEntityStatusAppearance(value)
  const resolvedTone = tone ?? getOrderStatusTone(value)
  const content = label ?? value

  return (
    <span
      style={
        appearance
          ? ({
              "--status-accent-light": appearance.light,
              "--status-accent-dark": appearance.dark,
            } as React.CSSProperties)
          : undefined
      }
      className={cn(styles.root, styles[resolvedTone], compact && styles.compact, className)}
      {...props}
    >
      {content}
    </span>
  )
}

export { getOrderStatusTone }
