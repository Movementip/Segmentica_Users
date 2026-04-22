import React, { useMemo, useState } from "react"
import { FiMapPin, FiPlus, FiTrash2 } from "react-icons/fi"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  SUPPLIER_CONTRAGENT_TYPES,
  isSupplierOrganizationContragentType,
  normalizeSupplierContragentType,
  type SupplierBankAccount,
  type SupplierContragent,
  type SupplierContragentPayload,
} from "@/lib/supplierContragents"

import styles from "../ClientContragentModal/ClientContragentModal.module.css"

type SupplierContragentModalProps = {
  error?: string | null
  isOpen: boolean
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: SupplierContragentPayload) => Promise<void> | void
  submitLabel: string
  title: string
  value?: Partial<SupplierContragent> | null
}

type SupplierFormState = Omit<SupplierContragentPayload, "bankAccounts"> & {
  bankAccounts: SupplierBankAccount[]
}

const createEmptyBankAccount = (index = 0): SupplierBankAccount => ({
  name: index === 0 ? "Основной расчетный счет" : `Расчетный счет ${index + 1}`,
  bik: "",
  bankName: "",
  correspondentAccount: "",
  settlementAccount: "",
  isPrimary: index === 0,
  sortOrder: index,
})

const createInitialState = (
  value?: Partial<SupplierContragent> | null
): SupplierFormState => ({
  название: value?.название || "",
  телефон: value?.телефон || "",
  email: value?.email || "",
  адрес: value?.адрес || "",
  тип: normalizeSupplierContragentType(value?.тип),
  рейтинг: value?.рейтинг ?? 5,
  краткоеНазвание: value?.краткоеНазвание || "",
  полноеНазвание: value?.полноеНазвание || "",
  фамилия: value?.фамилия || "",
  имя: value?.имя || "",
  отчество: value?.отчество || "",
  инн: value?.инн || "",
  кпп: value?.кпп || "",
  огрн: value?.огрн || "",
  огрнип: value?.огрнип || "",
  окпо: value?.окпо || "",
  адресРегистрации: value?.адресРегистрации || "",
  адресПечати: value?.адресПечати || "",
  паспортСерия: value?.паспортСерия || "",
  паспортНомер: value?.паспортНомер || "",
  паспортКемВыдан: value?.паспортКемВыдан || "",
  паспортДатаВыдачи: value?.паспортДатаВыдачи || "",
  паспортКодПодразделения: value?.паспортКодПодразделения || "",
  комментарий: value?.комментарий || "",
  bankAccounts:
    Array.isArray(value?.bankAccounts) && value?.bankAccounts.length
      ? value.bankAccounts.map((account, index) => ({
          id: account.id,
          name:
            account.name ||
            (index === 0
              ? "Основной расчетный счет"
              : `Расчетный счет ${index + 1}`),
          bik: account.bik || "",
          bankName: account.bankName || "",
          correspondentAccount: account.correspondentAccount || "",
          settlementAccount: account.settlementAccount || "",
          isPrimary: Boolean(account.isPrimary),
          sortOrder:
            typeof account.sortOrder === "number" ? account.sortOrder : index,
        }))
      : [createEmptyBankAccount(0)],
})

const ratingOptions = ["5", "4", "3", "2", "1", "0"]

const Row = ({
  label,
  children,
  mutedLabel,
}: {
  label: string
  children: React.ReactNode
  mutedLabel?: string
}) => (
  <div className={styles.row}>
    <div className={styles.labelCol}>
      <div className={styles.label}>{label}</div>
      {mutedLabel ? <div className={styles.labelMuted}>{mutedLabel}</div> : null}
    </div>
    <div className={styles.fieldCol}>{children}</div>
  </div>
)

export function SupplierContragentModal({
  error,
  isOpen,
  loading = false,
  onClose,
  onSubmit,
  submitLabel,
  title,
  value,
}: SupplierContragentModalProps): JSX.Element | null {
  const [form, setForm] = useState<SupplierFormState>(() =>
    createInitialState(value)
  )
  const [localError, setLocalError] = useState<string | null>(null)

  const type = normalizeSupplierContragentType(form.тип)
  const isOrganization = isSupplierOrganizationContragentType(type)
  const isEntrepreneur = type === "Индивидуальный предприниматель"
  const isPerson = type === "Физическое лицо"
  const showBankAccounts = isOrganization || isEntrepreneur
  const registrationAddressLabel = isOrganization
    ? "Адрес по ЕГРЮЛ"
    : isEntrepreneur
      ? "Адрес по ЕГРИП"
      : "Адрес по ФИАС"
  const printAddressLabel = isOrganization ? "Юридический адрес" : "Адрес"
  const printAddressMuted = "для печати документов"

  const canSubmit = useMemo(() => {
    if (loading) return false
    if (isOrganization) {
      return Boolean(form.краткоеНазвание?.trim() || form.полноеНазвание?.trim())
    }
    return Boolean(form.фамилия?.trim() && form.имя?.trim())
  }, [form, isOrganization, loading])

  const setField = <K extends keyof SupplierFormState>(
    key: K,
    nextValue: SupplierFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: nextValue }))
  }

  const updateBankAccount = (index: number, patch: Partial<SupplierBankAccount>) => {
    setForm((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((account, accountIndex) => {
        if (accountIndex !== index) {
          if (
            Object.prototype.hasOwnProperty.call(patch, "isPrimary") &&
            patch.isPrimary
          ) {
            return { ...account, isPrimary: false }
          }
          return account
        }

        return { ...account, ...patch, sortOrder: index }
      }),
    }))
  }

  const addBankAccount = () => {
    setForm((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.concat(
        createEmptyBankAccount(prev.bankAccounts.length)
      ),
    }))
  }

  const removeBankAccount = (index: number) => {
    setForm((prev) => {
      const nextAccounts = prev.bankAccounts.filter(
        (_, accountIndex) => accountIndex !== index
      )

      if (nextAccounts.length === 0) {
        return { ...prev, bankAccounts: [createEmptyBankAccount(0)] }
      }

      return {
        ...prev,
        bankAccounts: nextAccounts.map((account, accountIndex) => ({
          ...account,
          isPrimary:
            accountIndex === 0
              ? account.isPrimary || !nextAccounts.some((item) => item.isPrimary)
              : account.isPrimary,
          sortOrder: accountIndex,
        })),
      }
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLocalError(null)

    if (!canSubmit) {
      setLocalError("Заполните обязательные поля")
      return
    }

    await onSubmit({
      ...form,
      тип: type,
      bankAccounts: showBankAccounts ? form.bankAccounts : [],
    })
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <EntityModalShell className={styles.modalContent} onClose={onClose} title={title}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.rows}>
            <Row label="Тип контрагента">
              <Select
                value={type}
                onValueChange={(nextValue) =>
                  setField("тип", normalizeSupplierContragentType(nextValue))
                }
              >
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_CONTRAGENT_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            {isOrganization ? (
              <>
                <Row label="Краткое название">
                  <Input
                    value={form.краткоеНазвание || ""}
                    onChange={(event) =>
                      setField("краткоеНазвание", event.target.value)
                    }
                    className={styles.textField}
                  />
                </Row>
                <Row label="Полное название">
                  <Textarea
                    value={form.полноеНазвание || ""}
                    onChange={(event) =>
                      setField("полноеНазвание", event.target.value)
                    }
                    className={styles.textArea}
                  />
                </Row>
              </>
            ) : (
              <>
                <Row label="Фамилия">
                  <Input
                    value={form.фамилия || ""}
                    onChange={(event) => setField("фамилия", event.target.value)}
                    className={styles.textField}
                  />
                </Row>
                <Row label="Имя">
                  <Input
                    value={form.имя || ""}
                    onChange={(event) => setField("имя", event.target.value)}
                    className={styles.textField}
                  />
                </Row>
                <Row label="Отчество">
                  <Input
                    value={form.отчество || ""}
                    onChange={(event) => setField("отчество", event.target.value)}
                    className={styles.textField}
                  />
                </Row>
              </>
            )}

            <Row label="ИНН">
              <Input
                value={form.инн || ""}
                onChange={(event) => setField("инн", event.target.value)}
                className={cn(styles.textField, styles.shortField)}
              />
            </Row>

            {isOrganization ? (
              <Row label="КПП">
                <Input
                  value={form.кпп || ""}
                  onChange={(event) => setField("кпп", event.target.value)}
                  className={cn(styles.textField, styles.shortField)}
                />
              </Row>
            ) : null}

            {isOrganization ? (
              <Row label="ОГРН">
                <Input
                  value={form.огрн || ""}
                  onChange={(event) => setField("огрн", event.target.value)}
                  className={cn(styles.textField, styles.shortField)}
                />
              </Row>
            ) : null}

            {isEntrepreneur ? (
              <Row label="ОГРНИП">
                <Input
                  value={form.огрнип || ""}
                  onChange={(event) => setField("огрнип", event.target.value)}
                  className={cn(styles.textField, styles.shortField)}
                />
              </Row>
            ) : null}

            <Row label="ОКПО">
              <Input
                value={form.окпо || ""}
                onChange={(event) => setField("окпо", event.target.value)}
                className={cn(styles.textField, styles.shortField)}
              />
            </Row>

            {isPerson ? (
              <Row label="Паспорт">
                <div className={styles.passportGrid}>
                  <div>
                    <Label className={styles.subLabel}>Серия</Label>
                    <Input
                      value={form.паспортСерия || ""}
                      onChange={(event) =>
                        setField("паспортСерия", event.target.value)
                      }
                      className={styles.textField}
                    />
                  </div>
                  <div>
                    <Label className={styles.subLabel}>Номер</Label>
                    <Input
                      value={form.паспортНомер || ""}
                      onChange={(event) =>
                        setField("паспортНомер", event.target.value)
                      }
                      className={styles.textField}
                    />
                  </div>
                  <div className={styles.passportWide}>
                    <Label className={styles.subLabel}>Кем выдан</Label>
                    <Input
                      value={form.паспортКемВыдан || ""}
                      onChange={(event) =>
                        setField("паспортКемВыдан", event.target.value)
                      }
                      className={styles.textField}
                    />
                  </div>
                  <div>
                    <Label className={styles.subLabel}>Дата выдачи</Label>
                    <Input
                      type="date"
                      value={form.паспортДатаВыдачи || ""}
                      onChange={(event) =>
                        setField("паспортДатаВыдачи", event.target.value)
                      }
                      className={styles.textField}
                    />
                  </div>
                  <div>
                    <Label className={styles.subLabel}>Код подразделения</Label>
                    <Input
                      value={form.паспортКодПодразделения || ""}
                      onChange={(event) =>
                        setField("паспортКодПодразделения", event.target.value)
                      }
                      className={styles.textField}
                    />
                  </div>
                </div>
              </Row>
            ) : null}

            <Row label={registrationAddressLabel}>
              <div className={styles.addressField}>
                <div className={styles.addressHint}>
                  <FiMapPin />
                  <span>Указать</span>
                </div>
                <Textarea
                  value={form.адресРегистрации || ""}
                  onChange={(event) =>
                    setField("адресРегистрации", event.target.value)
                  }
                  className={styles.textArea}
                />
              </div>
            </Row>

            <Row label={printAddressLabel} mutedLabel={printAddressMuted}>
              <Textarea
                value={form.адресПечати || ""}
                onChange={(event) => setField("адресПечати", event.target.value)}
                className={styles.textArea}
              />
            </Row>
          </div>

          {showBankAccounts ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Расчетные счета</div>

              <div className={styles.bankAccountsList}>
                {form.bankAccounts.map((account, index) => (
                  <div
                    key={`${account.id || "new"}-${index}`}
                    className={styles.bankCard}
                  >
                    <div className={styles.bankCardHeader}>
                      <div className={styles.bankCardTitle}>
                        {account.name || `Расчетный счет ${index + 1}`}
                      </div>

                      {form.bankAccounts.length > 1 ? (
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => removeBankAccount(index)}
                          aria-label="Удалить счет"
                        >
                          <FiTrash2 />
                        </button>
                      ) : null}
                    </div>

                    <div className={styles.bankGrid}>
                      <div className={styles.bankGridWide}>
                        <Label className={styles.subLabel}>Название</Label>
                        <Input
                          value={account.name}
                          onChange={(event) =>
                            updateBankAccount(index, { name: event.target.value })
                          }
                          className={styles.textField}
                        />
                      </div>

                      <div>
                        <Label className={styles.subLabel}>БИК</Label>
                        <Input
                          value={account.bik || ""}
                          onChange={(event) =>
                            updateBankAccount(index, { bik: event.target.value })
                          }
                          className={styles.textField}
                        />
                      </div>

                      <div className={styles.bankGridWide}>
                        <Label className={styles.subLabel}>Банк</Label>
                        <Input
                          value={account.bankName || ""}
                          onChange={(event) =>
                            updateBankAccount(index, {
                              bankName: event.target.value,
                            })
                          }
                          className={styles.textField}
                        />
                      </div>

                      <div>
                        <Label className={styles.subLabel}>К/с</Label>
                        <Input
                          value={account.correspondentAccount || ""}
                          onChange={(event) =>
                            updateBankAccount(index, {
                              correspondentAccount: event.target.value,
                            })
                          }
                          className={styles.textField}
                        />
                      </div>

                      <div>
                        <Label className={styles.subLabel}>Р/с</Label>
                        <Input
                          value={account.settlementAccount || ""}
                          onChange={(event) =>
                            updateBankAccount(index, {
                              settlementAccount: event.target.value,
                            })
                          }
                          className={styles.textField}
                        />
                      </div>
                    </div>

                    <label className={styles.checkboxRow}>
                      <Checkbox
                        checked={Boolean(account.isPrimary)}
                        onCheckedChange={(checked) =>
                          updateBankAccount(index, { isPrimary: checked === true })
                        }
                      />
                      <span className={styles.checkboxText}>Основной</span>
                    </label>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className={styles.secondaryButton}
                onClick={addBankAccount}
              >
                <FiPlus />
                Добавить расчетный счет
              </Button>
            </div>
          ) : null}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Контакты</div>
            <div className={styles.rows}>
              <Row label="Телефон">
                <Input
                  value={form.телефон || ""}
                  onChange={(event) => setField("телефон", event.target.value)}
                  className={styles.textField}
                />
              </Row>

              <Row label="Email">
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(event) => setField("email", event.target.value)}
                  className={styles.textField}
                />
              </Row>

              <Row label="Рейтинг">
                <Select
                  value={String(form.рейтинг ?? 5)}
                  onValueChange={(nextValue) =>
                    setField("рейтинг", Number(nextValue) || 5)
                  }
                >
                  <SelectTrigger className={styles.selectTrigger}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ratingOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row label="Комментарий">
                <Textarea
                  value={form.комментарий || ""}
                  onChange={(event) => setField("комментарий", event.target.value)}
                  className={styles.textArea}
                />
              </Row>
            </div>
          </div>

          {error || localError ? (
            <div className={styles.errorBox}>{error || localError}</div>
          ) : null}

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="default"
              className={styles.primaryButton}
              disabled={!canSubmit || loading}
            >
              {loading ? "Сохранение..." : submitLabel}
            </Button>

            <Button
              type="button"
              variant="outline"
              className={styles.secondaryButton}
              onClick={onClose}
              disabled={loading}
            >
              Отменить
            </Button>
          </div>
        </form>
      </EntityModalShell>
    </Dialog>
  )
}
