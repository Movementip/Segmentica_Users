import type { Dispatch, SetStateAction } from "react"

import type { MissingProductFormData } from "@/components/missing-products/types"
import { missingProductEditStatusOptions } from "@/components/missing-products/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import OrderSearchSelect from "@/components/ui/OrderSearchSelect/OrderSearchSelect"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

import styles from "./MissingProductFormFields.module.css"

type SearchOption = {
  value: string
  label: string
}

type MissingProductFormFieldsProps = {
  disabled?: boolean
  error?: string | null
  formData: MissingProductFormData
  orderOptions: SearchOption[]
  productOptions: SearchOption[]
  setFormData: Dispatch<SetStateAction<MissingProductFormData>>
  showStatusField?: boolean
}

export function MissingProductFormFields({
  disabled = false,
  error,
  formData,
  orderOptions,
  productOptions,
  setFormData,
  showStatusField = false,
}: MissingProductFormFieldsProps) {
  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <Label className={styles.label}>Заявка</Label>
        <OrderSearchSelect
          compact
          value={formData.заявка_id === "0" ? "" : formData.заявка_id}
          options={orderOptions}
          onValueChange={(value) =>
            setFormData((previous) => ({
              ...previous,
              заявка_id: value || "0",
            }))
          }
          placeholder="Выберите заявку"
          emptyText="Ничего не найдено"
          disabled={disabled}
          inputClassName={styles.searchInput}
        />
      </div>

      <div className={styles.field}>
        <Label className={styles.label}>Товар</Label>
        <OrderSearchSelect
          compact
          value={formData.товар_id === "0" ? "" : formData.товар_id}
          options={productOptions}
          onValueChange={(value) =>
            setFormData((previous) => ({
              ...previous,
              товар_id: value || "0",
            }))
          }
          placeholder="Выберите товар"
          emptyText="Ничего не найдено"
          disabled={disabled}
          inputClassName={styles.searchInput}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <Label className={styles.label}>Необходимое количество</Label>
          <Input
            type="number"
            min={1}
            value={formData.необходимое_количество}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                необходимое_количество: event.target.value,
              }))
            }
            placeholder="Введите количество"
            className={styles.input}
            disabled={disabled}
          />
        </div>

        <div className={styles.field}>
          <Label className={styles.label}>Недостающее количество</Label>
          <Input
            type="number"
            min={1}
            value={formData.недостающее_количество}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                недостающее_количество: event.target.value,
              }))
            }
            placeholder="Введите количество"
            className={styles.input}
            disabled={disabled}
          />
        </div>
      </div>

      {showStatusField ? (
        <div className={styles.field}>
          <Label className={styles.label}>Статус</Label>
          <Select
            value={formData.статус}
            onValueChange={(value) =>
              setFormData((previous) => ({
                ...previous,
                статус: String(value),
              }))
            }
          >
            <SelectTrigger className={styles.selectTrigger} />
            <SelectContent>
              {missingProductEditStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  )
}
