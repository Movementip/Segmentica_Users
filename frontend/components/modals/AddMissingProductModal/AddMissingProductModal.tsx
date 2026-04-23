import React, { useEffect, useMemo, useState } from "react"
import { FiPlus } from "react-icons/fi"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { MissingProductFormFields } from "@/components/missing-products/MissingProductFormFields/MissingProductFormFields"
import type {
  MissingProductFormData,
  MissingProductsOrderOption,
  MissingProductsProductOption,
} from "@/types/pages/missing-products"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"

import shellStyles from "../WarehouseMovementModal/WarehouseMovementModal.module.css"

interface AddMissingProductModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => Promise<void> | void
  products: MissingProductsProductOption[]
  orders: MissingProductsOrderOption[]
}

const initialFormData: MissingProductFormData = {
  заявка_id: "0",
  товар_id: "0",
  необходимое_количество: "1",
  недостающее_количество: "1",
  статус: "в обработке",
}

export function AddMissingProductModal({
  isOpen,
  onClose,
  onCreated,
  products,
  orders,
}: AddMissingProductModalProps): JSX.Element | null {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    if (!isOpen) return
    setLoading(false)
    setError(null)
    setFormData(initialFormData)
  }, [isOpen])

  const canSubmit = useMemo(() => {
    if (loading) return false
    if (Number(formData.заявка_id) <= 0) return false
    if (Number(formData.товар_id) <= 0) return false
    if (Number(formData.необходимое_количество) <= 0) return false
    if (Number(formData.недостающее_количество) <= 0) return false
    return true
  }, [formData, loading])

  const orderOptions = useMemo(
    () => orders.map((order) => ({ value: String(order.id), label: `Заявка #${order.id}` })),
    [orders]
  )

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        value: String(item.id),
        label: `${item.артикул} - ${item.название}`,
      })),
    [products]
  )

  const handleClose = () => {
    setLoading(false)
    setError(null)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!canSubmit) {
      setError("Пожалуйста, заполните все поля корректно.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/missing-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          заявка_id: Number(formData.заявка_id),
          товар_id: Number(formData.товар_id),
          необходимое_количество: Number(formData.необходимое_количество),
          недостающее_количество: Number(formData.недостающее_количество),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка добавления недостающего товара")
      }

      await onCreated()
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <EntityModalShell
        className={shellStyles.modalContent}
        onClose={handleClose}
        title="Добавить недостающий товар"
        description="Создайте новую позицию для контроля нехватки товара по заявке."
        footerClassName={shellStyles.modalActions}
        footer={(
          <>
            <Button
              type="submit"
              form="add-missing-product-form"
              variant="default"
              className={shellStyles.primaryButton}
              disabled={!canSubmit}
            >
              {loading ? (
                "Добавление..."
              ) : (
                <>
                  <FiPlus size={16} />
                  Добавить
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={shellStyles.secondaryButton}
              onClick={handleClose}
              disabled={loading}
            >
              Отмена
            </Button>
          </>
        )}
      >
        <form id="add-missing-product-form" onSubmit={handleSubmit}>
          <MissingProductFormFields
            disabled={loading}
            error={error}
            formData={formData}
            orderOptions={orderOptions}
            productOptions={productOptions}
            setFormData={setFormData}
          />
        </form>
      </EntityModalShell>
    </Dialog>
  )
}
