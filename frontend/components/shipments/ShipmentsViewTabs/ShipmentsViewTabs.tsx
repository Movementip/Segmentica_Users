import type { ShipmentsTab } from "@/types/pages/shipments"

import styles from "./ShipmentsViewTabs.module.css"

type ShipmentsViewTabsProps = {
  activeTab: ShipmentsTab
  allCount: number
  canceledCount: number
  deliveredCount: number
  inTransitCount: number
  onChange: (tab: ShipmentsTab) => void
}

export function ShipmentsViewTabs({
  activeTab,
  allCount,
  canceledCount,
  deliveredCount,
  inTransitCount,
  onChange,
}: ShipmentsViewTabsProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Вид списка отгрузок">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "all"}
        className={styles.tab}
        data-active={activeTab === "all" ? "true" : "false"}
        onClick={() => onChange("all")}
      >
        Все отгрузки
        {allCount > 0 ? <span className={styles.badge}>{allCount}</span> : null}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "in_transit"}
        className={styles.tab}
        data-active={activeTab === "in_transit" ? "true" : "false"}
        onClick={() => onChange("in_transit")}
      >
        В пути
        {inTransitCount > 0 ? <span className={styles.badge}>{inTransitCount}</span> : null}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "delivered"}
        className={styles.tab}
        data-active={activeTab === "delivered" ? "true" : "false"}
        onClick={() => onChange("delivered")}
      >
        Доставлено
        {deliveredCount > 0 ? <span className={styles.badge}>{deliveredCount}</span> : null}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "canceled"}
        className={styles.tab}
        data-active={activeTab === "canceled" ? "true" : "false"}
        onClick={() => onChange("canceled")}
      >
        Отменено
        {canceledCount > 0 ? <span className={styles.badge}>{canceledCount}</span> : null}
      </button>
    </div>
  )
}
