import { FiPlus } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

import type { ManagerEmploymentEvent, ManagerHrProfile } from "@/lib/managerHr"

import { ManagerHrSelect, type ManagerHrSelectOption } from "./ManagerHrSelect"
import styles from "./ManagerHrSections.module.css"

type ManagerHrEmploymentSectionProps = {
  managerId: number
  employment: ManagerHrProfile["employment"]
  employmentEvents: ManagerEmploymentEvent[]
  readOnly: boolean
  emptySelectValue: string
  contractTypeOptions: ManagerHrSelectOption[]
  laborBookOptions: ManagerHrSelectOption[]
  onPatchEmployment: (patch: Partial<ManagerHrProfile["employment"]>) => void
  onAppendEmploymentEvent: () => void
  onUpdateEmploymentEvent: (id: number, patch: Partial<ManagerEmploymentEvent>) => void
  onRemoveEmploymentEvent: (id: number) => void
}

export function ManagerHrEmploymentSection({
  managerId,
  employment,
  employmentEvents,
  readOnly,
  emptySelectValue,
  contractTypeOptions,
  laborBookOptions,
  onPatchEmployment,
  onAppendEmploymentEvent,
  onUpdateEmploymentEvent,
  onRemoveEmploymentEvent,
}: ManagerHrEmploymentSectionProps) {
  return (
    <div className={styles.sectionStack}>
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Трудовая деятельность</CardTitle>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid3}>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-positionCategory`}>Категория должности</Label>
              <Input id={`manager-${managerId}-positionCategory`} className={styles.input} value={employment.positionCategory} onChange={(e) => onPatchEmployment({ positionCategory: e.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-departmentName`}>Подразделение</Label>
              <Input id={`manager-${managerId}-departmentName`} className={styles.input} value={employment.departmentName} onChange={(e) => onPatchEmployment({ departmentName: e.target.value })} disabled={readOnly} />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-subdivisionName`}>Отдел / группа</Label>
              <Input id={`manager-${managerId}-subdivisionName`} className={styles.input} value={employment.subdivisionName} onChange={(e) => onPatchEmployment({ subdivisionName: e.target.value })} disabled={readOnly} />
            </div>

            <div className={styles.checkboxRow}>
              <Label className={styles.checkboxLabel} htmlFor={`manager-${managerId}-isFlightCrew`}>
                <Checkbox
                  id={`manager-${managerId}-isFlightCrew`}
                  checked={employment.isFlightCrew}
                  onCheckedChange={(checked) => onPatchEmployment({ isFlightCrew: checked === true })}
                  disabled={readOnly}
                />
                <span>Летно-подъемный состав</span>
              </Label>
            </div>
            <div className={styles.checkboxRow}>
              <Label className={styles.checkboxLabel} htmlFor={`manager-${managerId}-isSeaCrew`}>
                <Checkbox
                  id={`manager-${managerId}-isSeaCrew`}
                  checked={employment.isSeaCrew}
                  onCheckedChange={(checked) => onPatchEmployment({ isSeaCrew: checked === true })}
                  disabled={readOnly}
                />
                <span>Плавающий состав</span>
              </Label>
            </div>

            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel}>Тип договора</Label>
              <RadioGroup
                value={employment.contractType}
                onValueChange={(value) => onPatchEmployment({ contractType: value })}
                className={styles.radioGroup}
                disabled={readOnly}
              >
                {contractTypeOptions.map((option) => (
                  <Label key={option.value} className={styles.radioOption} htmlFor={`manager-${managerId}-contract-${option.value}`}>
                    <RadioGroupItem id={`manager-${managerId}-contract-${option.value}`} value={option.value} />
                    <span>{option.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Трудовая книжка</Label>
              <ManagerHrSelect
                value={employment.laborBookStatus || emptySelectValue}
                options={laborBookOptions}
                disabled={readOnly}
                onValueChange={(value) => onPatchEmployment({ laborBookStatus: value === emptySelectValue ? "" : value })}
              />
            </div>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-laborBookNotes`}>Комментарий по трудовой книжке</Label>
              <Textarea id={`manager-${managerId}-laborBookNotes`} className={styles.textarea} value={employment.laborBookNotes} onChange={(e) => onPatchEmployment({ laborBookNotes: e.target.value })} disabled={readOnly} />
            </div>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-foreignWorkPermitNote`}>Основание для работы иностранца / примечание</Label>
              <Textarea id={`manager-${managerId}-foreignWorkPermitNote`} className={styles.textarea} value={employment.foreignWorkPermitNote} onChange={(e) => onPatchEmployment({ foreignWorkPermitNote: e.target.value })} disabled={readOnly} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Сведения о трудовой деятельности</CardTitle>
          {!readOnly ? (
            <Button type="button" variant="outline" className={styles.button} onClick={onAppendEmploymentEvent}>
              <FiPlus />
              Добавить событие
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {employmentEvents.length === 0 ? (
            <div className={styles.emptyState}>Пока нет кадровых событий.</div>
          ) : (
            <div className={styles.rowList}>
              {employmentEvents.map((event) => (
                <div key={event.id} className={styles.inlineRowCard}>
                  <div className={styles.rowGrid5}>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Дата мероприятия</span>
                      <Input type="date" className={styles.input} value={event.eventDate || ""} onChange={(e) => onUpdateEmploymentEvent(event.id, { eventDate: e.target.value || null })} disabled={readOnly} />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Вид мероприятия</span>
                      <Input className={styles.input} value={event.eventType} onChange={(e) => onUpdateEmploymentEvent(event.id, { eventType: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className={`${styles.field} ${styles.span2}`}>
                      <span className={styles.fieldMeta}>Информация</span>
                      <Input className={styles.input} value={event.details} onChange={(e) => onUpdateEmploymentEvent(event.id, { details: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Статус</span>
                      <Input className={styles.input} value={event.status} onChange={(e) => onUpdateEmploymentEvent(event.id, { status: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Дата отправки</span>
                      <Input type="date" className={styles.input} value={event.sentDate || ""} onChange={(e) => onUpdateEmploymentEvent(event.id, { sentDate: e.target.value || null })} disabled={readOnly} />
                    </div>
                  </div>
                  {!readOnly ? (
                    <div className={styles.inlineRowFooter}>
                      <button type="button" className={styles.rowDeleteButton} onClick={() => onRemoveEmploymentEvent(event.id)}>
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
