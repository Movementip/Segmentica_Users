import styles from "./ArchiveViewTabs.module.css"

export type ArchiveViewTab = "orders" | "purchases" | "shipments" | "payments" | "finance"

type ArchiveViewTabsProps = {
  activeTab: ArchiveViewTab
  tabs: Array<{
    value: ArchiveViewTab
    label: string
  }>
  onChange: (tab: ArchiveViewTab) => void
}

export function ArchiveViewTabs({
  activeTab,
  tabs,
  onChange,
}: ArchiveViewTabsProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Разделы архива">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.value}
          className={styles.tab}
          data-active={activeTab === tab.value ? "true" : "false"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
