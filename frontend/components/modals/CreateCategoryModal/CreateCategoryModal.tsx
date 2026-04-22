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
}

interface CategoryOption extends Category {
  depth: number;
}

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: () => void;
}

export function CreateCategoryModal({ isOpen, onClose, onCategoryCreated }: CreateCategoryModalProps): JSX.Element | null {
    const [название, setНазвание] = useState("")
    const [описание, setОписание] = useState("")
    const [родительская_категория_id, setРодительскаяКатегорияId] = useState("root")
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canSubmit = useMemo(() => {
        if (loading) return false
        return Boolean(название.trim())
    }, [loading, название])

    useLayoutEffect(() => {
        if (!isOpen) return
        setНазвание("")
        setОписание("")
        setРодительскаяКатегорияId("root")
        setError(null)
        setLoading(false)
    }, [isOpen])

    useEffect(() => {
        if (isOpen) {
            void fetchCategories()
        }
    }, [isOpen])

    const categoryOptions = useMemo(() => {
        const byParent = new Map<number | null, Category[]>()

        categories.forEach((category) => {
            const parentId = category.родительская_категория_id ?? null
            const siblings = byParent.get(parentId) || []
            siblings.push(category)
            byParent.set(parentId, siblings)
        })

        const result: CategoryOption[] = []

        const walk = (parentId: number | null, depth: number) => {
            const nodes = byParent.get(parentId) || []
            nodes
                .sort((left, right) => left.название.localeCompare(right.название, "ru-RU"))
                .forEach((category) => {
                    result.push({ ...category, depth })
                    walk(category.id, depth + 1)
                })
        }

        walk(null, 0)
        return [
            { value: "root", label: "Корневая категория" },
            ...result.map((category) => ({
                value: String(category.id),
                label: `${'— '.repeat(category.depth)}${category.название}`,
            })),
        ] as CategoryFieldOption[]
    }, [categories])

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/categories")
            if (response.ok) {
                const data = await response.json()
                setCategories(data)
            }
        } catch (err) {
            console.error("Error fetching categories:", err)
        }
    }

    const resetForm = () => {
        setНазвание("")
        setОписание("")
        setРодительскаяКатегорияId("root")
        setError(null)
    }

    const handleClose = () => {
        resetForm()
        setLoading(false)
        onClose()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!название.trim()) {
            setError("Название категории обязательно")
            return
        }

        try {
            setLoading(true)
            setError(null)

            const response = await fetch("/api/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    название: название.trim(),
                    описание: описание.trim() || undefined,
                    родительская_категория_id:
                        родительская_категория_id === "root" ? undefined : parseInt(родительская_категория_id, 10),
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Ошибка создания категории")
            }

            resetForm()
            onCategoryCreated()
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Неизвестная ошибка")
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
                title="Добавить новую категорию"
                description="Создайте корневую категорию или продолжите любую существующую ветку дерева."
                footerClassName={shellStyles.modalActions}
                footer={(
                    <>
                        <Button
                            type="submit"
                            form="create-category-form"
                            variant="default"
                            className={shellStyles.primaryButton}
                            disabled={!canSubmit}
                        >
                            {loading ? "Создание..." : "Добавить категорию"}
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
                <form id="create-category-form" onSubmit={handleSubmit}>
                    <CategoryFormFields
                        name={название}
                        description={описание}
                        parentCategoryId={родительская_категория_id}
                        categoryOptions={categoryOptions}
                        helperText="Можно выбрать любую категорию, чтобы продолжить ветку глубже."
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
