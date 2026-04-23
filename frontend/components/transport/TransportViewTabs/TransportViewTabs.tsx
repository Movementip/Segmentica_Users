import type { TransportViewTab } from "@/types/pages/transport"

import styles from "./TransportViewTabs.module.css"

type TransportViewTabsProps = {
  activeTab: TransportViewTab
  activeShipmentsCount: number
  canActiveShipmentsView: boolean
  canRecentShipmentsView: boolean
  recentShipmentsCount: number
  onChange: (tab: TransportViewTab) => void
}

export function TransportViewTabs({
  activeTab,
  activeShipmentsCount,
  canActiveShipmentsView,
  canRecentShipmentsView,
  recentShipmentsCount,
  onChange,
}: TransportViewTabsProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Вид данных транспорта">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "companies"}
        className={styles.tab}
        data-active={activeTab === "companies" ? "true" : "false"}
        onClick={() => onChange("companies")}
      >
        Транспортные компании
      </button>

      {canActiveShipmentsView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "activeShipments"}
          className={styles.tab}
          data-active={activeTab === "activeShipments" ? "true" : "false"}
          onClick={() => onChange("activeShipments")}
        >
          Активные отгрузки
          {activeShipmentsCount > 0 ? (
            <span className={styles.badge}>{activeShipmentsCount}</span>
          ) : null}
        </button>
      ) : null}

      {canRecentShipmentsView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "recentShipments"}
          className={styles.tab}
          data-active={activeTab === "recentShipments" ? "true" : "false"}
          onClick={() => onChange("recentShipments")}
        >
          Последние отгрузки
          {recentShipmentsCount > 0 ? (
            <span className={styles.badge}>{recentShipmentsCount}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  )
}
