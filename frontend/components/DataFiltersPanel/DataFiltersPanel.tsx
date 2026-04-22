import * as React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import styles from "./DataFiltersPanel.module.css"

type DataFilterTab<Value extends string> = {
  value: Value
  label: string
}

type DataFiltersPanelProps<Value extends string> = React.ComponentProps<"div"> & {
  tabs: Array<DataFilterTab<Value>>
  activeTab: Value
  onActiveTabChange: (value: Value) => void
  tabsLabel?: string
}

function DataFiltersPanel<Value extends string>({
  tabs,
  activeTab,
  onActiveTabChange,
  tabsLabel = "Фильтры",
  className,
  children,
  ...props
}: DataFiltersPanelProps<Value>) {
  return (
    <div className={cn(styles.panel, className)} {...props}>
      <div className={styles.tabs} role="tablist" aria-label={tabsLabel}>
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant="ghost"
            role="tab"
            aria-selected={activeTab === tab.value}
            className={cn(styles.tab, activeTab === tab.value && styles.tabActive)}
            onClick={() => onActiveTabChange(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className={styles.body}>{children}</div>
    </div>
  )
}

function DataFilterField({
  label,
  className,
  children,
}: React.ComponentProps<"div"> & {
  label: React.ReactNode
}) {
  return (
    <div className={cn(styles.field, className)}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  )
}

function DataFilterTextArea({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return <Textarea className={cn(styles.textArea, className)} {...props} />
}

function DataFilterSuggestList({
  isEmpty,
  emptyMessage = "Ничего не найдено",
  className,
  children,
}: React.ComponentProps<"div"> & {
  isEmpty?: boolean
  emptyMessage?: React.ReactNode
}) {
  return (
    <div className={cn(styles.suggestList, className)}>
      {isEmpty ? <div className={styles.suggestEmpty}>{emptyMessage}</div> : children}
    </div>
  )
}

function DataFilterSuggestItem({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(styles.suggestItem, className)}
      {...props}
    />
  )
}

function DataFiltersPanelActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn(styles.actions, className)} {...props} />
}

function DataFilterActionButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(styles.actionButton, className)}
      {...props}
    />
  )
}

export {
  DataFilterActionButton,
  DataFilterField,
  DataFiltersPanel,
  DataFiltersPanelActions,
  DataFilterSuggestItem,
  DataFilterSuggestList,
  DataFilterTextArea,
}
