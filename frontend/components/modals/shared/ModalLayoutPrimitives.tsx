import * as React from "react"

import { Button as UiButton } from "@/components/ui/button"
import { Badge as UiBadge } from "@/components/ui/badge"
import {
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  DialogTitle as UiDialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select as UiSelect,
  SelectContent as UiSelectContent,
  SelectItem as UiSelectItem,
  SelectTrigger as UiSelectTrigger,
} from "@/components/ui/select"
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
  justify?: React.CSSProperties["justifyContent"]
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
        justifyContent: justifyValue(justify as React.CSSProperties["justifyContent"] | "between" | undefined),
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

function Text({
  as,
  weight,
  color,
  mt,
  mb,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  as?: keyof JSX.IntrinsicElements
  size?: string
  weight?: "regular" | "medium" | "bold" | string
  color?: string
  mt?: SpacingValue
  mb?: SpacingValue
}) {
  const Component = (as || "span") as React.ElementType
  const textClassName = cn(
    "font-sans text-sm",
    as === "label" && "block text-foreground",
    weight === "medium" && "font-medium",
    weight === "bold" && "font-bold",
    color === "gray" && "text-muted-foreground",
    color === "red" && "text-destructive",
    className
  )

  if (Component === "label") {
    return (
      <Label
        className={textClassName}
        style={{ marginTop: spacing(mt), marginBottom: spacing(mb), ...style }}
        {...(props as React.ComponentProps<"label">)}
      />
    )
  }

  return React.createElement(Component, {
    className: textClassName,
    style: { marginTop: spacing(mt), marginBottom: spacing(mb), ...style },
    ...props,
  })
}

function Button({
  variant,
  color,
  highContrast,
  loading,
  disabled,
  ...props
}: any) {
  const nextVariant =
    variant === "surface" ? "outline" : variant === "solid" ? "default" : variant

  return (
    <UiButton
      variant={nextVariant}
      disabled={disabled || loading}
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
  className,
  ...props
}: any) {
  const nextVariant =
    variant === "soft" || variant === "surface" ? "secondary" : variant || "secondary"

  return (
    <UiBadge
      variant={nextVariant}
      data-color={color}
      data-high-contrast={highContrast ? "" : undefined}
      className={className}
      {...props}
    />
  )
}

const Dialog = {
  Root: UiDialog,
  Content: UiDialogContent,
  Title: UiDialogTitle,
}

function SelectItemCompat({
  children,
  ...props
}: any) {
  return <UiSelectItem {...props}>{children}</UiSelectItem>
}

function collectSelectItems(children: React.ReactNode) {
  const items: Array<{ value: string; label: string }> = []

  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return
      const props = child.props as { value?: unknown; children?: React.ReactNode }

      if (child.type === SelectItemCompat && props.value != null) {
        items.push({
          value: String(props.value),
          label: React.Children.toArray(props.children).join(""),
        })
      }

      if (props.children) walk(props.children)
    })
  }

  walk(children)
  return items
}

function SelectRootCompat({
  children,
  ...props
}: any) {
  return (
    <UiSelect items={collectSelectItems(children)} {...props}>
      {children}
    </UiSelect>
  )
}

function SelectTriggerCompat({
  variant,
  color,
  ...props
}: any) {
  return <UiSelectTrigger {...props} />
}

function SelectContentCompat({
  position,
  variant,
  color,
  highContrast,
  ...props
}: any) {
  return <UiSelectContent {...props} />
}

const Select = {
  Root: SelectRootCompat,
  Trigger: SelectTriggerCompat,
  Content: SelectContentCompat,
  Item: SelectItemCompat,
}

function TextFieldRootCompat({
  size,
  ...props
}: any) {
  return <Input {...props} />
}

const TextField = {
  Root: TextFieldRootCompat,
}

export { Badge, Box, Button, Dialog, Flex, Select, Text, TextField }
