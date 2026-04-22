import { FiPlus } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { ManagerHrProfile, ManagerMilitaryDocument } from "@/lib/managerHr"

import { ManagerHrSelect, type ManagerHrSelectOption } from "./ManagerHrSelect"
import styles from "./ManagerHrSections.module.css"

type ManagerHrMilitarySectionProps = {
  military: ManagerHrProfile["military"]
  militaryDocuments: ManagerMilitaryDocument[]
  readOnly: boolean
  emptySelectValue: string
  militaryRegistrationOptions: ManagerHrSelectOption[]
  onPatchMilitary: (patch: Partial<ManagerHrProfile["military"]>) => void
  onAppendMilitaryDocument: () => void
  onUpdateMilitaryDocument: (id: number, patch: Partial<ManagerMilitaryDocument>) => void
  onRemoveMilitaryDocument: (id: number) => void
}

export function ManagerHrMilitarySection({
  military,
  militaryDocuments,
  readOnly,
  emptySelectValue,
  militaryRegistrationOptions,
  onPatchMilitary,
  onAppendMilitaryDocument,
  onUpdateMilitaryDocument,
  onRemoveMilitaryDocument,
}: ManagerHrMilitarySectionProps) {
  return (
    <div className={styles.sectionStack}>
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Сведения о воинском учете</CardTitle>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid2}>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Отношение к военной службе</Label>
              <Input className={styles.input} value={military.relationToService} onChange={(event) => onPatchMilitary({ relationToService: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Категория запаса</Label>
              <Input className={styles.input} value={military.reserveCategory} onChange={(event) => onPatchMilitary({ reserveCategory: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Воинское звание</Label>
              <Input className={styles.input} value={military.militaryRank} onChange={(event) => onPatchMilitary({ militaryRank: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Состав</Label>
              <Input className={styles.input} value={military.unitComposition} onChange={(event) => onPatchMilitary({ unitComposition: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Код ВУС</Label>
              <Input className={styles.input} value={military.specialtyCode} onChange={(event) => onPatchMilitary({ specialtyCode: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Категория годности</Label>
              <Input className={styles.input} value={military.fitnessCategory} onChange={(event) => onPatchMilitary({ fitnessCategory: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Дата проверки</Label>
              <Input type="date" className={styles.input} value={military.fitnessCheckedAt || ""} onChange={(event) => onPatchMilitary({ fitnessCheckedAt: event.target.value || null })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Военкомат</Label>
              <Input className={styles.input} value={military.commissariatName} onChange={(event) => onPatchMilitary({ commissariatName: event.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Указать вручную</Label>
              <Input className={styles.input} value={military.commissariatManual} onChange={(event) => onPatchMilitary({ commissariatManual: event.target.value })} disabled={readOnly} />
            </div>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel}>Вид воинского учета</Label>
              <ManagerHrSelect
                value={military.militaryRegistrationType || emptySelectValue}
                options={militaryRegistrationOptions}
                disabled={readOnly}
                onValueChange={(value) => onPatchMilitary({ militaryRegistrationType: value === emptySelectValue ? "" : value })}
              />
            </div>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel}>Дополнительные сведения</Label>
              <Textarea className={styles.textarea} value={military.additionalInfo} onChange={(event) => onPatchMilitary({ additionalInfo: event.target.value })} disabled={readOnly} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Документы воинского учета</CardTitle>
          {!readOnly ? (
            <Button type="button" variant="outline" className={styles.button} onClick={onAppendMilitaryDocument}>
              <FiPlus />
              Добавить документ
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {militaryDocuments.length === 0 ? (
            <div className={styles.emptyState}>У сотрудника пока нет документов воинского учета.</div>
          ) : (
            <div className={styles.rowList}>
              {militaryDocuments.map((doc) => (
                <div key={doc.id} className={styles.inlineRowCard}>
                  <div className={styles.rowGrid5}>
                    <div className={styles.field}>
                      <Label className={styles.fieldLabel}>Тип документа</Label>
                      <Input className={styles.input} value={doc.documentType} onChange={(event) => onUpdateMilitaryDocument(doc.id, { documentType: event.target.value })} disabled={readOnly} />
                    </div>
                    <div className={styles.field}>
                      <Label className={styles.fieldLabel}>Серия и номер</Label>
                      <Input className={styles.input} value={doc.seriesNumber} onChange={(event) => onUpdateMilitaryDocument(doc.id, { seriesNumber: event.target.value })} disabled={readOnly} />
                    </div>
                    <div className={`${styles.field} ${styles.span2}`}>
                      <Label className={styles.fieldLabel}>Кем выдан</Label>
                      <Input className={styles.input} value={doc.issuedBy} onChange={(event) => onUpdateMilitaryDocument(doc.id, { issuedBy: event.target.value })} disabled={readOnly} />
                    </div>
                    <div className={styles.field}>
                      <Label className={styles.fieldLabel}>Дата выдачи</Label>
                      <Input type="date" className={styles.input} value={doc.issueDate || ""} onChange={(event) => onUpdateMilitaryDocument(doc.id, { issueDate: event.target.value || null })} disabled={readOnly} />
                    </div>
                    <div className={styles.field}>
                      <Label className={styles.fieldLabel}>Действует до</Label>
                      <Input type="date" className={styles.input} value={doc.validUntil || ""} onChange={(event) => onUpdateMilitaryDocument(doc.id, { validUntil: event.target.value || null })} disabled={readOnly} />
                    </div>
                  </div>
                  {!readOnly ? (
                    <div className={styles.inlineRowFooter}>
                      <button type="button" className={styles.rowDeleteButton} onClick={() => onRemoveMilitaryDocument(doc.id)}>
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
    </div>
  )
}
