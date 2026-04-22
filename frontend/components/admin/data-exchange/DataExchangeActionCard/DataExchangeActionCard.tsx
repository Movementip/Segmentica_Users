import React from "react"

import { Button } from "../../../ui/button"
import { Card } from "../../../ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import type { DataExchangeFormat } from "../../../../lib/dataExchangeConfig"
import styles from "./DataExchangeActionCard.module.css"

type FormatOption = {
  value: DataExchangeFormat
  label: string
}

type DataExchangeActionCardProps = {
  title: string
  description: string
  value: DataExchangeFormat
  options: FormatOption[]
  primaryLabel: string
  primaryVariant?: "default" | "outline"
  primaryDisabled?: boolean
  onValueChange: (value: DataExchangeFormat) => void
  onPrimaryAction: () => void
  secondaryLabel?: string
  secondaryDisabled?: boolean
  onSecondaryAction?: () => void
}

export function DataExchangeActionCard({
  title,
  description,
  value,
  options,
  primaryLabel,
  primaryVariant = "default",
  primaryDisabled = false,
  onValueChange,
  onPrimaryAction,
  secondaryLabel,
  secondaryDisabled = false,
  onSecondaryAction,
}: DataExchangeActionCardProps) {
  const fallbackValue = options[0]?.value ?? "json"
  const safeValue = value ?? fallbackValue
  const selectedLabel =
    options.find((option) => option.value === safeValue)?.label ??
    (typeof safeValue === "string" ? safeValue.toUpperCase() : "JSON")

  return (
    <Card className={styles.card}>
      <div className={styles.content}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionText}>{description}</p>
        </div>

        <Select
          value={safeValue}
          onValueChange={(nextValue) => {
            if (typeof nextValue === "string" && nextValue.length > 0) {
              onValueChange(nextValue as DataExchangeFormat)
            }
          }}
        >
          <SelectTrigger className={styles.selectTrigger}>
            <SelectValue>{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={primaryVariant}
          className={primaryVariant === "default" ? styles.primaryButton : styles.secondaryButton}
          disabled={primaryDisabled}
          onClick={onPrimaryAction}
        >
          {primaryLabel}
        </Button>

        {secondaryLabel && onSecondaryAction ? (
          <Button
            type="button"
            variant="outline"
            className={styles.secondaryButton}
            disabled={secondaryDisabled}
            onClick={onSecondaryAction}
          >
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
