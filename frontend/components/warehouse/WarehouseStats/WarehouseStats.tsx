import styles from "./WarehouseStats.module.css"

type WarehouseStatsProps = {
  totalItems: number
  criticalCount: number
  totalValue: number
  movementsLastMonth: number
  formatCurrency: (amount: number) => string
}

export function WarehouseStats({
  totalItems,
  criticalCount,
  totalValue,
  movementsLastMonth,
  formatCurrency,
}: WarehouseStatsProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Статистика склада</h2>

      <div className={styles.grid}>
        <div className={styles.item}>
          <div className={styles.value}>{totalItems.toLocaleString("ru-RU")}</div>
          <div className={styles.label}>Всего позиций</div>
        </div>

        <div className={styles.item}>
          <div className={styles.value} data-tone={criticalCount > 0 ? "warning" : "default"}>
            {criticalCount.toLocaleString("ru-RU")}
          </div>
          <div className={styles.label}>Критический остаток</div>
        </div>

        <div className={styles.item}>
          <div className={styles.value}>{formatCurrency(totalValue)}</div>
          <div className={styles.label}>Стоимость остатков</div>
        </div>

        <div className={styles.item}>
          <div className={styles.value}>{movementsLastMonth.toLocaleString("ru-RU")}</div>
          <div className={styles.label}>Движений за месяц</div>
        </div>
      </div>
    </section>
  )
}
