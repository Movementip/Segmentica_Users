import React from "react"

import OrderSearchSelect from "@/components/ui/OrderSearchSelect/OrderSearchSelect"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import styles from "./CategoryFormFields.module.css"

export type CategoryFieldOption = {
  value: string
  label: string
}

type CategoryFormFieldsProps = {
  name: string
  description: string
  parentCategoryId: string
  categoryOptions: CategoryFieldOption[]
  error?: string | null
  helperText: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onParentCategoryChange: (value: string) => void
}

export function CategoryFormFields({
  name,
  description,
  parentCategoryId,
  categoryOptions,
  error = null,
  helperText,
  onNameChange,
  onDescriptionChange,
  onParentCategoryChange,
}: CategoryFormFieldsProps): JSX.Element {
  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <Label htmlFor="category-name" className={styles.label}>
          Название *
        </Label>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Введите название категории"
          className={styles.textField}
        />
      </div>

      <div className={styles.field}>
        <Label htmlFor="category-description" className={styles.label}>
          Описание
        </Label>
        <Textarea
          id="category-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Введите описание категории"
          className={styles.textarea}
        />
      </div>

      <div className={styles.field}>
        <Label className={styles.label}>Родительская категория</Label>
        <OrderSearchSelect
          value={parentCategoryId}
          options={categoryOptions}
          onValueChange={onParentCategoryChange}
          placeholder="Выберите родительскую категорию"
          emptyText="Ничего не найдено"
        />
        <div className={styles.helper}>{helperText}</div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  )
}
