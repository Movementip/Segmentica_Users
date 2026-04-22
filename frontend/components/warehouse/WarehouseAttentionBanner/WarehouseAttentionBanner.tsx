import { FiAlertTriangle } from "react-icons/fi"

import { Button } from "@/components/ui/button"

import styles from "./WarehouseAttentionBanner.module.css"

type WarehouseAttentionBannerProps = {
  description: string
  onView: () => void
}

export function WarehouseAttentionBanner({
  description,
  onView,
}: WarehouseAttentionBannerProps) {
  return (
    <section className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.iconWrap} aria-hidden="true">
          <FiAlertTriangle className={styles.icon} />
        </div>

        <div className={styles.copy}>
          <h2 className={styles.title}>Требует внимания</h2>
          <p className={styles.text}>{description}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className={styles.actionButton}
        onClick={onView}
      >
        Просмотреть
      </Button>
    </section>
  )
}
