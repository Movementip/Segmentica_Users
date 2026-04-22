import * as React from "react"
import { FiMinus, FiPlus, FiX } from "react-icons/fi"

import { cn } from "@/lib/utils"

import styles from "./DocumentPreviewControls.module.css"

type DocumentPreviewZoomControlsProps = {
  value: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
  className?: string
}

export function DocumentPreviewZoomControls({
  value,
  min = 0.6,
  max = 2,
  step = 0.2,
  disabled = false,
  onChange,
  className,
}: DocumentPreviewZoomControlsProps) {
  const roundedValue = Number(value.toFixed(2))

  return (
    <div className={cn(styles.zoomControls, className)} aria-label="Масштаб предпросмотра">
      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => onChange(roundedValue - step)}
        disabled={disabled || roundedValue <= min}
        aria-label="Уменьшить масштаб"
      >
        <FiMinus />
      </button>
      <button
        type="button"
        className={styles.zoomValue}
        onClick={() => onChange(1)}
        disabled={disabled || roundedValue === 1}
        aria-label="Сбросить масштаб"
      >
        {Math.round(roundedValue * 100)}%
      </button>
      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => onChange(roundedValue + step)}
        disabled={disabled || roundedValue >= max}
        aria-label="Увеличить масштаб"
      >
        <FiPlus />
      </button>
    </div>
  )
}

type DocumentPreviewCloseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function DocumentPreviewCloseButton({
  className,
  children,
  ...props
}: DocumentPreviewCloseButtonProps) {
  return (
    <button
      type="button"
      className={cn(styles.closeButton, className)}
      aria-label="Закрыть предпросмотр"
      {...props}
    >
      {children ?? <FiX />}
    </button>
  )
}
