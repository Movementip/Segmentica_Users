import styles from "./SegmentedTabs.module.css"

export type SegmentedTabItem<Value extends string> = {
  value: Value
  label: string
  badge?: number | string | null
  disabled?: boolean
}

type SegmentedTabsProps<Value extends string> = {
  value: Value
  items: Array<SegmentedTabItem<Value>>
  ariaLabel: string
  onChange: (value: Value) => void
}

export function SegmentedTabs<Value extends string>({
  value,
  items,
  ariaLabel,
  onChange,
}: SegmentedTabsProps<Value>) {
  return (
    <div className={styles.root} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.value === value

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={styles.tab}
            data-active={isActive ? "true" : "false"}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) onChange(item.value)
            }}
          >
            <span>{item.label}</span>
            {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
