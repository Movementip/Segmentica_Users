import * as React from "react"

import { Badge as UiBadge } from "@/components/ui/badge"
import { Button as UiButton } from "@/components/ui/button"
import { Card as UiCard } from "@/components/ui/card"
import {
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  DialogDescription as UiDialogDescription,
  DialogTitle as UiDialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu as UiDropdownMenu,
  DropdownMenuContent as UiDropdownMenuContent,
  DropdownMenuItem as UiDropdownMenuItem,
  DropdownMenuTrigger as UiDropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table as UiTable,
  TableBody as UiTableBody,
  TableCell as UiTableCell,
  TableHead as UiTableHead,
  TableHeader as UiTableHeader,
  TableRow as UiTableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type SpacingValue = string | number | undefined

function spacing(value: SpacingValue) {
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed * 0.25}rem` : String(value)
}

function justifyValue(value: React.CSSProperties["justifyContent"] | "between" | undefined) {
  if (value === "between") return "space-between"
  return value
}

function Box({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={className} {...props} />
}

function Flex({
  direction,
  align,
  justify,
  gap,
  mt,
  mb,
  wrap,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  direction?: React.CSSProperties["flexDirection"]
  align?: React.CSSProperties["alignItems"]
  justify?: React.CSSProperties["justifyContent"] | "between"
  gap?: SpacingValue
  mt?: SpacingValue
  mb?: SpacingValue
  wrap?: React.CSSProperties["flexWrap"] | boolean
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems: align,
        justifyContent: justifyValue(justify),
        gap: spacing(gap),
        marginTop: spacing(mt),
        marginBottom: spacing(mb),
        flexWrap: wrap === true ? "wrap" : wrap || undefined,
        ...style,
      }}
      {...props}
    />
  )
}

function Grid({
  columns,
  gap,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  columns?: string | { initial?: string; md?: string }
  gap?: SpacingValue
}) {
  const initialColumns = typeof columns === "object" ? columns.initial : columns
  const mdColumns = typeof columns === "object" ? columns.md : undefined

  return (
    <div
      className={cn(
        "grid",
        initialColumns === "1" && "grid-cols-1",
        mdColumns === "2" && "md:grid-cols-2",
        className
      )}
      style={{
        gap: spacing(gap),
        ...style,
      }}
      {...props}
    />
  )
}

function Text({
  as,
  weight,
  color,
  size,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  as?: keyof JSX.IntrinsicElements
  size?: string
  weight?: "regular" | "medium" | "bold" | string
  color?: string
}) {
  const Component = (as || "span") as React.ElementType

  return React.createElement(Component, {
    className: cn(
      "font-sans",
      size === "1" ? "text-xs" : size === "3" ? "text-base" : "text-sm",
      weight === "medium" && "font-medium",
      weight === "bold" && "font-bold",
      color === "gray" && "text-muted-foreground",
      color === "red" && "text-destructive",
      className
    ),
    style,
    ...props,
  })
}

function Button({
  variant,
  color,
  highContrast,
  ...props
}: any) {
  const mappedVariant =
    variant === "surface" || variant === "soft"
      ? "outline"
      : variant === "solid"
        ? "default"
        : variant

  return (
    <UiButton
      variant={mappedVariant}
      data-color={color}
      data-high-contrast={highContrast ? "" : undefined}
      {...props}
    />
  )
}

function Badge({
  variant,
  color,
  highContrast,
  ...props
}: any) {
  const mappedVariant =
    variant === "soft" || variant === "surface" ? "secondary" : variant || "secondary"

  return (
    <UiBadge
      variant={mappedVariant}
      data-color={color}
      data-high-contrast={highContrast ? "" : undefined}
      {...props}
    />
  )
}

function Card({ variant, size, className, ...props }: any) {
  return <UiCard className={cn("p-4", className)} {...props} />
}

function Separator({ className, ...props }: React.ComponentProps<"div"> & { size?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} {...props} />
}

function DropdownMenuTriggerCompat({ children, ...props }: any) {
  if (React.isValidElement(children)) {
    return <UiDropdownMenuTrigger render={children} {...props} />
  }

  return <UiDropdownMenuTrigger {...props}>{children}</UiDropdownMenuTrigger>
}

function DropdownMenuItemCompat({ onSelect, onClick, ...props }: any) {
  return (
    <UiDropdownMenuItem
      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(event)
        if (!event.defaultPrevented) onSelect?.(event)
      }}
      {...props}
    />
  )
}

const DropdownMenu = {
  Root: UiDropdownMenu,
  Trigger: DropdownMenuTriggerCompat,
  Content: UiDropdownMenuContent,
  Item: DropdownMenuItemCompat,
}

function TableRoot({ variant, ...props }: any) {
  return <UiTable {...props} />
}

const Table = {
  Root: TableRoot,
  Header: UiTableHeader,
  Body: UiTableBody,
  Row: UiTableRow,
  Cell: UiTableCell,
  ColumnHeaderCell: UiTableHead,
}

const Dialog = {
  Root: UiDialog,
  Content: UiDialogContent,
  Title: UiDialogTitle,
  Description: UiDialogDescription,
}

export {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  DropdownMenu,
  Flex,
  Grid,
  Separator,
  Table,
  Text,
}
