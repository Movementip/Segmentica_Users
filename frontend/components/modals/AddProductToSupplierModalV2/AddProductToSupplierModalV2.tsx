import React, { useEffect, useMemo, useState } from "react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import OrderSearchSelect from "@/components/ui/OrderSearchSelect/OrderSearchSelect"

import styles from "./AddProductToSupplierModalV2.module.css"

interface Product {
    id: number;
    название: string;
    артикул: string;
    единица_измерения: string;
    категория?: string;
}

interface InitialSupplierProduct {
    товар_id: number;
    цена: number;
    срок_поставки: number;
}

interface AddProductToSupplierModalV2Props {
    isOpen: boolean;
    onClose: () => void;
    onProductAdded: () => void;
    поставщик_id: number;
    поставщик_название: string;
    initialProduct?: InitialSupplierProduct | null;
}

export function AddProductToSupplierModalV2({
  isOpen,
  onClose,
  onProductAdded,
  поставщик_id,
  поставщик_название,
  initialProduct = null,
}: AddProductToSupplierModalV2Props): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const isEditMode = Boolean(initialProduct?.товар_id)

  const [formData, setFormData] = useState({
    товар_id: "",
    цена: "",
    срок_поставки: "",
  })

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    void fetchProducts()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setFormData({
      товар_id: initialProduct?.товар_id ? String(initialProduct.товар_id) : "",
      цена: initialProduct?.цена != null ? String(initialProduct.цена) : "",
      срок_поставки:
        initialProduct?.срок_поставки != null
          ? String(initialProduct.срок_поставки)
          : "",
    })
  }, [initialProduct, isOpen])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products")
      if (!response.ok) throw new Error("Ошибка загрузки товаров")
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setProducts([])
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    }
  }

  const selectedProduct = useMemo(() => {
    const idNum = Number(formData.товар_id)
    if (!idNum) return null
    return products.find((product) => product.id === idNum) || null
  }, [formData.товар_id, products])

  const canSubmit = useMemo(() => {
    const productId = Number(formData.товар_id) || 0
    const price = Number(formData.цена)
    const leadTime = Number(formData.срок_поставки)
    return (
      productId > 0 &&
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(leadTime) &&
      leadTime >= 0 &&
      !loading
    )
  }, [formData.товар_id, formData.цена, formData.срок_поставки, loading])

  const productSelectOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product.id),
        label: `${product.артикул} - ${product.название}${
          product.категория ? ` (${product.категория})` : ""
        }`,
      })),
    [products]
  )

  const handleClose = () => {
    setError(null)
    setLoading(false)
    setFormData({ товар_id: "", цена: "", срок_поставки: "" })
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/suppliers/${поставщик_id}/actions`, {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          товар_id: Number(formData.товар_id),
          цена: Number(formData.цена),
          срок_поставки: Number(formData.срок_поставки),
        }),
      })

      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseData.error || "Ошибка добавления товара")
      }

      onProductAdded()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return <></>

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <EntityModalShell
        className={styles.modalContent}
        onClose={handleClose}
        title={isEditMode ? "Изменить позицию ассортимента" : "Добавить товар"}
        description={
          <>
            Поставщик: <span className={styles.descriptionAccent}>{поставщик_название}</span>
          </>
        }
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Товар</Label>
              <OrderSearchSelect
                value={formData.товар_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, товар_id: value }))
                }
                options={productSelectOptions}
                placeholder={isEditMode ? "Товар выбран" : "Выберите товар"}
                emptyText="Нет товаров"
                disabled={isEditMode}
              />
            </div>

            <div className={styles.formGroup}>
              <Label className={styles.label}>Цена за единицу (₽)</Label>
              <Input
                type="number"
                value={formData.цена}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, цена: event.target.value }))
                }
                placeholder="Например: 1500"
                className={styles.textField}
              />
            </div>

            <div className={styles.formGroup}>
              <Label className={styles.label}>Срок поставки (дни)</Label>
              <Input
                type="number"
                value={formData.срок_поставки}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    срок_поставки: event.target.value,
                  }))
                }
                placeholder="Например: 7"
                className={styles.textField}
              />
            </div>

            {selectedProduct ? (
              <div className={styles.selectedCard}>
                <div className={styles.selectedTitle}>Выбранный товар</div>
                <div className={styles.selectedName}>{selectedProduct.название}</div>
                <div className={styles.selectedMeta}>
                  Артикул: {selectedProduct.артикул || "—"}
                </div>
                <div className={styles.selectedMeta}>
                  Ед.: {selectedProduct.единица_измерения || "—"}
                </div>
              </div>
            ) : null}
          </div>

          {error ? <div className={styles.errorBox}>{error}</div> : null}

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="default"
              className={styles.primaryButton}
              disabled={!canSubmit}
            >
              {loading
                ? isEditMode
                  ? "Сохранение..."
                  : "Добавление..."
                : isEditMode
                  ? "Сохранить"
                  : "Добавить"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className={styles.secondaryButton}
              onClick={handleClose}
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
