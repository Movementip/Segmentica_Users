import React, { useEffect, useMemo, useState } from "react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import styles from "./CreateTransportModal.module.css"

type FormState = {
  email: string
  название: string
  тариф: string
  телефон: string
}

interface CreateTransportModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

const initialFormState: FormState = {
  название: "",
  телефон: "",
  email: "",
  тариф: "",
}

export function CreateTransportModal({
  isOpen,
  onClose,
  onCreated,
}: CreateTransportModalProps): JSX.Element | null {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setLoading(false)
    setFormData(initialFormState)
  }, [isOpen])

  const canSubmit = useMemo(
    () => formData.название.trim().length > 0 && !loading,
    [formData.название, loading]
  )

  const handleClose = () => {
    setError(null)
    setLoading(false)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formData.название.trim()) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/transport", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          название: formData.название.trim(),
          телефон: formData.телефон.trim() ? formData.телефон.trim() : null,
          email: formData.email.trim() ? formData.email.trim() : null,
          тариф: formData.тариф.trim() ? Number(formData.тариф) : null,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || "Ошибка создания транспортной компании")
      }

      onCreated()
      handleClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Неизвестная ошибка при создании"
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <EntityModalShell
        className={styles.modalContent}
        title="Добавить транспортную компанию"
        description="Заполните данные компании и контакты."
        onClose={handleClose}
        footer={(
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" form="create-transport-company-form" disabled={!canSubmit}>
              {loading ? "Создание..." : "Создать"}
            </Button>
          </div>
        )}
      >
        <form id="create-transport-company-form" onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <Label htmlFor="transport-create-name">Название компании</Label>
              <Input
                id="transport-create-name"
                value={formData.название}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, название: event.target.value }))
                }
                placeholder='ООО "Компания"'
              />
            </div>

            <div className={styles.formGroup}>
              <Label htmlFor="transport-create-rate">Тариф</Label>
              <Input
                id="transport-create-rate"
                value={formData.тариф}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, тариф: event.target.value }))
                }
                placeholder="50"
                inputMode="decimal"
              />
            </div>

            <div className={styles.formGroup}>
              <Label htmlFor="transport-create-phone">Телефон</Label>
              <Input
                id="transport-create-phone"
                value={formData.телефон}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, телефон: event.target.value }))
                }
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className={styles.formGroup}>
              <Label htmlFor="transport-create-email">Email</Label>
              <Input
                id="transport-create-email"
                value={formData.email}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="info@company.com"
                type="email"
              />
            </div>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
        </form>
      </EntityModalShell>
    </Dialog>
  )
}
