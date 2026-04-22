import styles from "./NoAccessPage.module.css"

export function NoAccessPage({ title }: { title?: string }): JSX.Element {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <p className={styles.title}>{title || "Нет доступа"}</p>
      </div>
    </div>
  )
}
