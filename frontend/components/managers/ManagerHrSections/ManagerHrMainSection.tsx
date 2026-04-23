import * as React from "react"
import { FiPlus, FiUploadCloud } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

import type { ManagerIdentityDocument, ManagerHrProfile } from "@/lib/managerHr"
import type { AttachmentItem } from "@/types/attachments"

import { ManagerHrSelect, type ManagerHrSelectOption } from "./ManagerHrSelect"
import styles from "./ManagerHrSections.module.css"

type ManagerHrMainSectionProps = {
  managerId: number
  personal: ManagerHrProfile["personal"]
  identityDocuments: ManagerIdentityDocument[]
  readOnly: boolean
  emptySelectValue: string
  maritalStatusOptions: ManagerHrSelectOption[]
  taxpayerStatusOptions: ManagerHrSelectOption[]
  educationLevelOptions: ManagerHrSelectOption[]
  canAttachmentsView: boolean
  canAttachmentsUpload: boolean
  canAttachmentsDelete: boolean
  attachments: AttachmentItem[]
  attachmentsLoading: boolean
  attachmentsError: string | null
  attachmentsUploading: boolean
  formatBytes: (bytes: number) => string
  onPatchPersonal: (patch: Partial<ManagerHrProfile["personal"]>) => void
  onAppendIdentityDocument: () => void
  onUpdateIdentityDocument: (id: number, patch: Partial<ManagerIdentityDocument>) => void
  onRemoveIdentityDocument: (id: number) => void
  onUploadAttachment: (file: File) => Promise<void> | void
  onDeleteAttachment: (attachmentId: string) => Promise<void> | void
  onOpenAttachment: (attachment: AttachmentItem) => void
}

export function ManagerHrMainSection({
  managerId,
  personal,
  identityDocuments,
  readOnly,
  emptySelectValue,
  maritalStatusOptions,
  taxpayerStatusOptions,
  educationLevelOptions,
  canAttachmentsView,
  canAttachmentsUpload,
  canAttachmentsDelete,
  attachments,
  attachmentsLoading,
  attachmentsError,
  attachmentsUploading,
  formatBytes,
  onPatchPersonal,
  onAppendIdentityDocument,
  onUpdateIdentityDocument,
  onRemoveIdentityDocument,
  onUploadAttachment,
  onDeleteAttachment,
  onOpenAttachment,
}: ManagerHrMainSectionProps) {
  const [fileInputKey, setFileInputKey] = React.useState(0)

  return (
    <div className={styles.sectionStack}>
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Основная информация</CardTitle>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid4}>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-lastName`}>Фамилия</Label>
              <Input
                id={`manager-${managerId}-lastName`}
                className={styles.input}
                value={personal.lastName}
                onChange={(event) => onPatchPersonal({ lastName: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-firstName`}>Имя</Label>
              <Input
                id={`manager-${managerId}-firstName`}
                className={styles.input}
                value={personal.firstName}
                onChange={(event) => onPatchPersonal({ firstName: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-middleName`}>Отчество</Label>
              <Input
                id={`manager-${managerId}-middleName`}
                className={styles.input}
                value={personal.middleName}
                onChange={(event) => onPatchPersonal({ middleName: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Пол</Label>
              <RadioGroup
                value={personal.gender || ""}
                onValueChange={(value) => onPatchPersonal({ gender: value })}
                className={styles.radioGroup}
                disabled={readOnly}
              >
                <Label className={styles.radioOption} htmlFor={`manager-${managerId}-gender-male`}>
                  <RadioGroupItem id={`manager-${managerId}-gender-male`} value="male" />
                  <span>Мужской</span>
                </Label>
                <Label className={styles.radioOption} htmlFor={`manager-${managerId}-gender-female`}>
                  <RadioGroupItem id={`manager-${managerId}-gender-female`} value="female" />
                  <span>Женский</span>
                </Label>
              </RadioGroup>
            </div>

            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-birthDate`}>Дата рождения</Label>
              <Input
                id={`manager-${managerId}-birthDate`}
                type="date"
                className={styles.input}
                value={personal.birthDate || ""}
                onChange={(event) => onPatchPersonal({ birthDate: event.target.value || null })}
                disabled={readOnly}
              />
            </div>
            <div className={`${styles.field} ${styles.span2}`}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-birthPlace`}>Место рождения</Label>
              <Input
                id={`manager-${managerId}-birthPlace`}
                className={styles.input}
                value={personal.birthPlace}
                onChange={(event) => onPatchPersonal({ birthPlace: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Семейное положение</Label>
              <ManagerHrSelect
                value={personal.maritalStatus || emptySelectValue}
                options={maritalStatusOptions}
                disabled={readOnly}
                onValueChange={(value) => onPatchPersonal({ maritalStatus: value === emptySelectValue ? "" : value })}
              />
            </div>

            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-maritalSince`}>Состоит с</Label>
              <Input
                id={`manager-${managerId}-maritalSince`}
                type="date"
                className={styles.input}
                value={personal.maritalStatusSince || ""}
                onChange={(event) => onPatchPersonal({ maritalStatusSince: event.target.value || null })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-snils`}>СНИЛС</Label>
              <Input
                id={`manager-${managerId}-snils`}
                className={styles.input}
                value={personal.snils}
                onChange={(event) => onPatchPersonal({ snils: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-inn`}>ИНН</Label>
              <Input
                id={`manager-${managerId}-inn`}
                className={styles.input}
                value={personal.inn}
                onChange={(event) => onPatchPersonal({ inn: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={`${styles.field} ${styles.span2}`}>
              <Label className={styles.fieldLabel}>Статус налогоплательщика</Label>
              <ManagerHrSelect
                value={personal.taxpayerStatus || emptySelectValue}
                options={taxpayerStatusOptions}
                disabled={readOnly}
                onValueChange={(value) => onPatchPersonal({ taxpayerStatus: value === emptySelectValue ? "" : value })}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-citizenshipCode`}>Код гражданства</Label>
              <Input
                id={`manager-${managerId}-citizenshipCode`}
                className={styles.input}
                value={personal.citizenshipCode}
                onChange={(event) => onPatchPersonal({ citizenshipCode: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-citizenshipLabel`}>Гражданство</Label>
              <Input
                id={`manager-${managerId}-citizenshipLabel`}
                className={styles.input}
                value={personal.citizenshipLabel}
                onChange={(event) => onPatchPersonal({ citizenshipLabel: event.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Адреса и контакты</CardTitle>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid2}>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-registrationAddress`}>Адрес регистрации</Label>
              <Textarea
                id={`manager-${managerId}-registrationAddress`}
                className={styles.textarea}
                value={personal.registrationAddress}
                onChange={(event) => onPatchPersonal({ registrationAddress: event.target.value })}
                disabled={readOnly}
              />
            </div>

            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-registrationDate`}>Дата регистрации</Label>
              <Input
                id={`manager-${managerId}-registrationDate`}
                type="date"
                className={styles.input}
                value={personal.registrationDate || ""}
                onChange={(event) => onPatchPersonal({ registrationDate: event.target.value || null })}
                disabled={readOnly}
              />
            </div>

            <div className={styles.checkboxRow}>
              <Label className={styles.checkboxLabel} htmlFor={`manager-${managerId}-sameAddress`}>
                <Checkbox
                  id={`manager-${managerId}-sameAddress`}
                  checked={personal.actualAddressSameAsRegistration}
                  onCheckedChange={(checked) => onPatchPersonal({ actualAddressSameAsRegistration: checked === true })}
                  disabled={readOnly}
                />
                <span>Фактический адрес совпадает с регистрацией</span>
              </Label>
            </div>

            {!personal.actualAddressSameAsRegistration ? (
              <>
                <div className={`${styles.field} ${styles.spanAll}`}>
                  <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-actualAddress`}>Фактический адрес</Label>
                  <Textarea
                    id={`manager-${managerId}-actualAddress`}
                    className={styles.textarea}
                    value={personal.actualAddress}
                    onChange={(event) => onPatchPersonal({ actualAddress: event.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-actualAddressSince`}>Дата начала проживания</Label>
                  <Input
                    id={`manager-${managerId}-actualAddressSince`}
                    type="date"
                    className={styles.input}
                    value={personal.actualAddressSince || ""}
                    onChange={(event) => onPatchPersonal({ actualAddressSince: event.target.value || null })}
                    disabled={readOnly}
                  />
                </div>
              </>
            ) : null}

            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-personalEmail`}>Личный email</Label>
              <Input
                id={`manager-${managerId}-personalEmail`}
                className={styles.input}
                value={personal.personalEmail}
                onChange={(event) => onPatchPersonal({ personalEmail: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-workEmail`}>Рабочий email</Label>
              <Input
                id={`manager-${managerId}-workEmail`}
                className={styles.input}
                value={personal.workEmail}
                onChange={(event) => onPatchPersonal({ workEmail: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-primaryPhone`}>Основной телефон</Label>
              <Input
                id={`manager-${managerId}-primaryPhone`}
                className={styles.input}
                value={personal.primaryPhone}
                onChange={(event) => onPatchPersonal({ primaryPhone: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-workPhone`}>Рабочий телефон</Label>
              <Input
                id={`manager-${managerId}-workPhone`}
                className={styles.input}
                value={personal.workPhone}
                onChange={(event) => onPatchPersonal({ workPhone: event.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Документы, удостоверяющие личность</CardTitle>
          {!readOnly ? (
            <Button type="button" variant="outline" className={styles.button} onClick={onAppendIdentityDocument}>
              <FiPlus />
              Добавить документ
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {identityDocuments.length === 0 ? (
            <div className={styles.emptyState}>Документы пока не добавлены.</div>
          ) : (
            <div className={styles.rowList}>
              {identityDocuments.map((doc) => (
                <div key={doc.id} className={styles.inlineRowCard}>
                  <div className={styles.rowGrid6}>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Вид документа</span>
                      <Input
                        className={styles.input}
                        value={doc.documentType}
                        onChange={(event) => onUpdateIdentityDocument(doc.id, { documentType: event.target.value })}
                        disabled={readOnly}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Серия и номер</span>
                      <Input
                        className={styles.input}
                        value={doc.seriesNumber}
                        onChange={(event) => onUpdateIdentityDocument(doc.id, { seriesNumber: event.target.value })}
                        disabled={readOnly}
                      />
                    </div>
                    <div className={`${styles.field} ${styles.span2}`}>
                      <span className={styles.fieldMeta}>Кем выдан</span>
                      <Input
                        className={styles.input}
                        value={doc.issuedBy}
                        onChange={(event) => onUpdateIdentityDocument(doc.id, { issuedBy: event.target.value })}
                        disabled={readOnly}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Код подразделения</span>
                      <Input
                        className={styles.input}
                        value={doc.departmentCode}
                        onChange={(event) => onUpdateIdentityDocument(doc.id, { departmentCode: event.target.value })}
                        disabled={readOnly}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Выдан</span>
                      <Input
                        type="date"
                        className={styles.input}
                        value={doc.issueDate || ""}
                        onChange={(event) => onUpdateIdentityDocument(doc.id, { issueDate: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldMeta}>Действует до</span>
                      <Input
                        type="date"
                        className={styles.input}
                        value={doc.validUntil || ""}
                        onChange={(event) => onUpdateIdentityDocument(doc.id, { validUntil: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  <div className={styles.inlineRowFooter}>
                    <Label className={styles.checkboxLabel} htmlFor={`manager-${managerId}-doc-primary-${doc.id}`}>
                      <Checkbox
                        id={`manager-${managerId}-doc-primary-${doc.id}`}
                        checked={doc.isPrimary}
                        onCheckedChange={(checked) => onUpdateIdentityDocument(doc.id, { isPrimary: checked === true })}
                        disabled={readOnly}
                      />
                      <span>Основной документ</span>
                    </Label>
                    {!readOnly ? (
                      <button type="button" className={styles.rowDeleteButton} onClick={() => onRemoveIdentityDocument(doc.id)}>
                        Удалить
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>Образование и навыки</CardTitle>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid2}>
            <div className={styles.field}>
              <Label className={styles.fieldLabel}>Уровень образования</Label>
              <ManagerHrSelect
                value={personal.educationLevel || emptySelectValue}
                options={educationLevelOptions}
                disabled={readOnly}
                onValueChange={(value) => onPatchPersonal({ educationLevel: value === emptySelectValue ? "" : value })}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-primaryProfession`}>Основная профессия</Label>
              <Input
                id={`manager-${managerId}-primaryProfession`}
                className={styles.input}
                value={personal.primaryProfession}
                onChange={(event) => onPatchPersonal({ primaryProfession: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-secondaryProfession`}>Дополнительная профессия</Label>
              <Input
                id={`manager-${managerId}-secondaryProfession`}
                className={styles.input}
                value={personal.secondaryProfession}
                onChange={(event) => onPatchPersonal({ secondaryProfession: event.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-languages`}>Иностранные языки</Label>
              <Input
                id={`manager-${managerId}-languages`}
                className={styles.input}
                value={personal.languages.join(", ")}
                onChange={(event) => onPatchPersonal({
                  languages: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })}
                placeholder="Например: Английский, Немецкий"
                disabled={readOnly}
              />
            </div>
            <div className={`${styles.field} ${styles.spanAll}`}>
              <Label className={styles.fieldLabel} htmlFor={`manager-${managerId}-notes`}>Примечания</Label>
              <Textarea
                id={`manager-${managerId}-notes`}
                className={styles.textarea}
                value={personal.notes}
                onChange={(event) => onPatchPersonal({ notes: event.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {canAttachmentsView ? (
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle className={styles.cardTitle}>Файлы сотрудника</CardTitle>
            {canAttachmentsUpload ? (
              <label className={styles.uploadLabel}>
                <input
                  key={fileInputKey}
                  type="file"
                  className={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void Promise.resolve(onUploadAttachment(file)).finally(() => {
                        setFileInputKey((previous) => previous + 1)
                      })
                    }
                  }}
                />
                <span className={styles.uploadButton}>
                  <FiUploadCloud size={16} />
                  {attachmentsUploading ? "Загрузка…" : "Добавить файл"}
                </span>
              </label>
            ) : null}
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {attachmentsError ? <div className={styles.inlineError}>{attachmentsError}</div> : null}

            {attachmentsLoading ? (
              <div className={styles.emptyState}>Загрузка документов…</div>
            ) : attachments.length === 0 ? (
              <div className={styles.emptyState}>Нет прикрепленных документов.</div>
            ) : (
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Файл</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Размер</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attachments.map((attachment) => (
                    <TableRow key={attachment.id}>
                      <TableCell className={styles.tableCellWrap}>{attachment.filename}</TableCell>
                      <TableCell className={styles.tableCellWrap}>{attachment.mime_type}</TableCell>
                      <TableCell>{formatBytes(attachment.size_bytes)}</TableCell>
                      <TableCell>
                        <div className={styles.tableActions}>
                          <Button type="button" variant="outline" className={styles.button} onClick={() => onOpenAttachment(attachment)}>
                            Открыть
                          </Button>
                          {canAttachmentsDelete ? (
                            <Button
                              type="button"
                              variant="destructive"
                              className={styles.button}
                              onClick={() => { void onDeleteAttachment(attachment.id) }}
                            >
                              Удалить
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
