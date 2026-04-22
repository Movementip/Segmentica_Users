import React, { useEffect, useLayoutEffect, useMemo, useState } from "react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"

import {
  CategoryFieldOption,
  CategoryFormFields,
} from "../CategoryFormFields/CategoryFormFields"
import shellStyles from "../WarehouseMovementModal/WarehouseMovementModal.module.css"

interface Category {
    id: number;
    название: string;
    описание?: string;
    родительская_категория_id?: number;
    активна: boolean;
}

interface CategoryOption extends Category {
  depth: number;
}

interface EditCategoryModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onCategoryUpdated: () => void;
}

export function EditCategoryModal({ category, isOpen, onClose, onCategoryUpdated }: EditCategoryModalProps): JSX.Element | null {
    const [название, setНазвание] = useState("")
    const [описание, setОписание] = useState("")
    const [родительскаяКатегорияId, setРодительскаяКатегорияId] = useState("root")
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useLayoutEffect(() => {
        if (!isOpen || !category) return

        setНазвание(category.название || "")
        setОписание(category.описание || "")
        setРодительскаяКатегорияId(
            category.родительская_категория_id ? String(category.родительская_категория_id) : "root"
        )
        setError(null)
        setLoading(false)
    }, [isOpen, category])

    useEffect(() => {
        if (!isOpen) {
            return
        }

        void fetchCategories()
    }, [isOpen])

    const categoryOptions = useMemo(() => {
        const byParent = new Map<number | null, Category[]>()

        categories
            .filter((item) => item.id !== category?.id)
            .forEach((item) => {
                const parentId = item.родительская_категория_id ?? null
                const siblings = byParent.get(parentId) || []
                siblings.push(item)
                byParent.set(parentId, siblings)
            })

        const result: CategoryOption[] = []
        const walk = (parentId: number | null, depth: number) => {
            const nodes = byParent.get(parentId) || []
            nodes
                .sort((left, right) => left.название.localeCompare(right.название, "ru-RU"))
                .forEach((item) => {
                    result.push({ ...item, depth })
                    walk(item.id, depth + 1)
                })
        }

        walk(null, 0)
        return [
            { value: "root", label: "Корневая категория" },
            ...result.map((item) => ({
                value: String(item.id),
                label: `${'— '.repeat(item.depth)}${item.название}`,
            })),
        ] as CategoryFieldOption[]
    }, [categories, category?.id])

    const canSubmit = useMemo(() => {
        if (loading) return false
        return Boolean(название.trim())
    }, [loading, название])

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/categories")
            if (!response.ok) {
                throw new Error("Ошибка загрузки категорий")
            }

            const data = await response.json()
            setCategories(data)
        } catch (err) {
            console.error("Error fetching categories:", err)
        }
    }

    const handleClose = () => {
        setError(null)
        setLoading(false)
        onClose()
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        if (!category) {
            return
        }

        if (!название.trim()) {
            setError("Название категории обязательно")
            return
        }

        try {
            setLoading(true)
            setError(null)

            const response = await fetch("/api/categories", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: category.id,
                    название: название.trim(),
                    описание: описание.trim() || null,
                    родительская_категория_id:
                        родительскаяКатегорияId === "root" ? null : parseInt(родительскаяКатегорияId, 10),
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Ошибка обновления категории")
            }

            onCategoryUpdated()
            handleClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Неизвестная ошибка")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen || !category) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={shellStyles.modalContent}
                onClose={handleClose}
                title="Редактировать категорию"
                description="Обновите название, описание и положение категории в дереве."
                footerClassName={shellStyles.modalActions}
                footer={(
                    <>
                        <Button
                            type="submit"
                            form="edit-category-form"
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
                            Отменить
                        </Button>
                    </>
                )}
            >
                <form id="edit-category-form" onSubmit={handleSubmit}>
                    <CategoryFormFields
                        name={название}
                        description={описание}
                        parentCategoryId={родительскаяКатегорияId}
                        categoryOptions={categoryOptions}
                        helperText="Текущую категорию нельзя сделать родителем самой себя."
                        error={error}
                        onNameChange={setНазвание}
                        onDescriptionChange={setОписание}
                        onParentCategoryChange={setРодительскаяКатегорияId}
                    />
                </form>
            </EntityModalShell>
        </Dialog>
    )
}
