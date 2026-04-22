import styles from "./WarehouseViewTabs.module.css"

export type WarehouseViewTab = "stock" | "movements" | "critical"

type WarehouseViewTabsProps = {
  activeTab: WarehouseViewTab
  canMovementsView: boolean
  canCriticalView: boolean
  criticalCount: number
  onChange: (tab: WarehouseViewTab) => void
}

export function WarehouseViewTabs({
  activeTab,
  canMovementsView,
  canCriticalView,
  criticalCount,
  onChange,
}: WarehouseViewTabsProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Вид данных склада">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "stock"}
        className={styles.tab}
        data-active={activeTab === "stock" ? "true" : "false"}
        onClick={() => onChange("stock")}
      >
        Складские остатки
      </button>

      {canMovementsView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "movements"}
          className={styles.tab}
          data-active={activeTab === "movements" ? "true" : "false"}
          onClick={() => onChange("movements")}
        >
          Движения товаров
        </button>
      ) : null}

      {canCriticalView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "critical"}
          className={styles.tab}
          data-active={activeTab === "critical" ? "true" : "false"}
          onClick={() => onChange("critical")}
        >
          Критические остатки
          {criticalCount > 0 ? <span className={styles.badge}>{criticalCount}</span> : null}
        </button>
      ) : null}
    </div>
  )
}
