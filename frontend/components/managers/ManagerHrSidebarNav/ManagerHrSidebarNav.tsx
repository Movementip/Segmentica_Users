import type { ReactNode } from "react"
import { FiArrowLeft } from "react-icons/fi"

import styles from "./ManagerHrSidebarNav.module.css"

type ManagerHrSidebarItem<T extends string = string> = {
  key: T
  label: string
  icon: ReactNode
}

type ManagerHrSidebarNavProps<T extends string = string> = {
  activeSection: T
  backLabel: string
  items: Array<ManagerHrSidebarItem<T>>
  onBack: () => void
  onSelect: (section: T) => void
}

export function ManagerHrSidebarNav<T extends string = string>({
  activeSection,
  backLabel,
  items,
  onBack,
  onSelect,
}: ManagerHrSidebarNavProps<T>) {
  return (
    <aside className={styles.sidebar}>
      <button type="button" className={styles.backLink} onClick={onBack}>
        <FiArrowLeft />
        <span>{backLabel}</span>
      </button>

      <div className={styles.sectionNav}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeSection === item.key ? styles.sectionButtonActive : styles.sectionButton}
            onClick={() => onSelect(item.key)}
          >
            <span className={styles.sectionIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
