import React, { useEffect, useMemo, useState } from "react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { MissingProductFormFields } from "@/components/missing-products/MissingProductFormFields/MissingProductFormFields"
import type {
  MissingProduct,
  MissingProductFormData,
  MissingProductsOrderOption,
  MissingProductsProductOption,
} from "@/types/pages/missing-products"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"

import shellStyles from "../WarehouseMovementModal/WarehouseMovementModal.module.css"

interface EditMissingProductModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => Promise<void> | void
  missingProduct: MissingProduct | null
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

export function EditMissingProductModal({
  isOpen,
  onClose,
  onUpdated,
  missingProduct,
  products,
  orders,
}: EditMissingProductModalProps): JSX.Element | null {
  const product = missingProduct
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    if (!isOpen || !product) return

    setError(null)
    setLoading(false)
    setFormData({
      заявка_id: String(product.заявка_id),
      товар_id: String(product.товар_id),
      необходимое_количество: String(product.необходимое_количество),
      недостающее_количество: String(product.недостающее_количество),
      статус: product.статус || "в обработке",
    })
  }, [isOpen, product])

  const canSubmit = useMemo(() => {
    if (loading) return false
    if (!formData.заявка_id || Number(formData.заявка_id) <= 0) return false
    if (!formData.товар_id || Number(formData.товар_id) <= 0) return false
    if (!formData.необходимое_количество || Number(formData.необходимое_количество) <= 0) return false
    if (!formData.недостающее_количество || Number(formData.недостающее_количество) <= 0) return false
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
    setError(null)
    setLoading(false)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product) return

    const normalizedStatus = formData.статус
    const normalizedMissingQuantity = normalizedStatus === "получено"
      ? 0
      : Number(formData.недостающее_количество)

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/missing-products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: product.id,
          заявка_id: Number(formData.заявка_id),
          товар_id: Number(formData.товар_id),
          необходимое_количество: Number(formData.необходимое_количество),
          недостающее_количество: normalizedMissingQuantity,
          статус: normalizedStatus,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка обновления недостающего товара")
      }

      await onUpdated()
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !product) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <EntityModalShell
        className={shellStyles.modalContent}
        onClose={handleClose}
        title="Редактировать недостающий товар"
        description="Обновите параметры позиции и её текущий статус."
        footerClassName={shellStyles.modalActions}
        footer={(
          <>
            <Button
              type="submit"
              form="edit-missing-product-form"
              variant="default"
              className={shellStyles.primaryButton}
              disabled={!canSubmit}
            >
              {loading ? "Сохранение..." : "Сохранить изменения"}
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
        <form id="edit-missing-product-form" onSubmit={handleSubmit}>
          <MissingProductFormFields
            disabled={loading}
            error={error}
            formData={formData}
            orderOptions={orderOptions}
            productOptions={productOptions}
            setFormData={setFormData}
            showStatusField
          />
        </form>
      </EntityModalShell>
    </Dialog>
  )
}
