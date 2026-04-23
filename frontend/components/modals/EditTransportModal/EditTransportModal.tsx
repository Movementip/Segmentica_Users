import React, { useEffect, useMemo, useState } from "react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import styles from "./EditTransportModal.module.css"

export type EditTransportModalTransportCompany = {
  created_at?: string
  email: string | null
  id: number
  название: string
  тариф: number | null
  телефон: string | null
}

type FormState = {
  email: string
  название: string
  тариф: string
  телефон: string
}

interface EditTransportModalProps {
  company: EditTransportModalTransportCompany | null
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export function EditTransportModal({
  company,
  isOpen,
  onClose,
  onUpdated,
}: EditTransportModalProps): JSX.Element | null {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>({
    название: "",
    телефон: "",
    email: "",
    тариф: "",
  })

  useEffect(() => {
    if (!isOpen) return

    setError(null)
    setLoading(false)
    setFormData({
      название: company?.название || "",
      телефон: company?.телефон || "",
      email: company?.email || "",
      тариф: company?.тариф != null ? String(company.тариф) : "",
    })
  }, [company, isOpen])

  const canSubmit = useMemo(
    () => Boolean(company) && formData.название.trim().length > 0 && !loading,
    [company, formData.название, loading]
  )

  const handleClose = () => {
    setError(null)
    setLoading(false)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!company || !formData.название.trim()) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/transport/${company.id}`, {
        method: "PUT",
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
        throw new Error(result?.error || "Ошибка обновления транспортной компании")
      }

      onUpdated()
      handleClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Неизвестная ошибка при обновлении"
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
        title="Редактировать транспортную компанию"
        description="Обновите данные компании и контакты."
        onClose={handleClose}
        footer={(
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" form="edit-transport-company-form" disabled={!canSubmit}>
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        )}
      >
        <form id="edit-transport-company-form" onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <Label htmlFor="transport-edit-name">Название компании</Label>
              <Input
                id="transport-edit-name"
                value={formData.название}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, название: event.target.value }))
                }
                placeholder='ООО "Компания"'
              />
            </div>

            <div className={styles.formGroup}>
              <Label htmlFor="transport-edit-rate">Тариф</Label>
              <Input
                id="transport-edit-rate"
                value={formData.тариф}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, тариф: event.target.value }))
                }
                placeholder="50"
                inputMode="decimal"
              />
            </div>

            <div className={styles.formGroup}>
              <Label htmlFor="transport-edit-phone">Телефон</Label>
              <Input
                id="transport-edit-phone"
                value={formData.телефон}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, телефон: event.target.value }))
                }
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className={styles.formGroup}>
              <Label htmlFor="transport-edit-email">Email</Label>
              <Input
                id="transport-edit-email"
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
