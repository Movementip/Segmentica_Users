import { FiPlus } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { ManagerRelative } from "@/lib/managerHr"

import styles from "./ManagerHrSections.module.css"

type ManagerHrRelativesSectionProps = {
  relatives: ManagerRelative[]
  readOnly: boolean
  onAppendRelative: () => void
  onUpdateRelative: (id: number, patch: Partial<ManagerRelative>) => void
  onRemoveRelative: (id: number) => void
}

export function ManagerHrRelativesSection({
  relatives,
  readOnly,
  onAppendRelative,
  onUpdateRelative,
  onRemoveRelative,
}: ManagerHrRelativesSectionProps) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>Родственники</CardTitle>
        {!readOnly ? (
          <Button type="button" variant="outline" className={styles.button} onClick={onAppendRelative}>
            <FiPlus />
            Добавить
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className={styles.cardContent}>
        {relatives.length === 0 ? (
          <div className={styles.emptyState}>У сотрудника пока нет родственников.</div>
        ) : (
          <div className={styles.rowList}>
            {relatives.map((relative) => (
              <div key={relative.id} className={styles.inlineRowCard}>
                <div className={styles.rowGrid5}>
                  <div className={styles.field}>
                    <Label className={styles.fieldLabel}>ФИО</Label>
                    <Input
                      className={styles.input}
                      value={relative.fullName}
                      onChange={(event) => onUpdateRelative(relative.id, { fullName: event.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Степень родства</Label>
                    <Input
                      className={styles.input}
                      value={relative.relationType}
                      onChange={(event) => onUpdateRelative(relative.id, { relationType: event.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Дата рождения</Label>
                    <Input
                      type="date"
                      className={styles.input}
                      value={relative.birthDate || ""}
                      onChange={(event) => onUpdateRelative(relative.id, { birthDate: event.target.value || null })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Документ</Label>
                    <Input
                      className={styles.input}
                      value={relative.documentInfo}
                      onChange={(event) => onUpdateRelative(relative.id, { documentInfo: event.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.fieldLabel}>СНИЛС</Label>
                    <Input
                      className={styles.input}
                      value={relative.snils}
                      onChange={(event) => onUpdateRelative(relative.id, { snils: event.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.fieldLabel}>Телефон</Label>
                    <Input
                      className={styles.input}
                      value={relative.phone}
                      onChange={(event) => onUpdateRelative(relative.id, { phone: event.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className={`${styles.field} ${styles.spanAll}`}>
                    <Label className={styles.fieldLabel}>Комментарий</Label>
                    <Textarea
                      className={styles.textarea}
                      value={relative.notes}
                      onChange={(event) => onUpdateRelative(relative.id, { notes: event.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                </div>
                {!readOnly ? (
                  <div className={styles.inlineRowFooter}>
                    <button type="button" className={styles.rowDeleteButton} onClick={() => onRemoveRelative(relative.id)}>
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
