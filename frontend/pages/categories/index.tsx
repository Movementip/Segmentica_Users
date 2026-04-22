import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { FiFolderPlus } from "react-icons/fi"

import { CategoriesPageSkeleton } from "@/components/categories/CategoriesPageSkeleton/CategoriesPageSkeleton"
import { CategoryDetailsPanel } from "@/components/categories/CategoryDetailsPanel/CategoryDetailsPanel"
import { CategoriesStats } from "@/components/categories/CategoriesStats/CategoriesStats"
import { CategoryTreeMap } from "@/components/categories/CategoryTreeMap/CategoryTreeMap"
import {
  buildActivePath,
  buildCategoryTree,
  buildSelectedPath,
  buildTreeColumns,
  filterCategories,
} from "@/components/categories/tree"
import type { Category } from "@/components/categories/types"
import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import { ReferenceDataActions } from "@/components/pages/ReferenceDataActions/ReferenceDataActions"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"

import { CreateCategoryModal } from "../../components/modals/CreateCategoryModal/CreateCategoryModal"
import { EditCategoryModal } from "../../components/modals/EditCategoryModal/EditCategoryModal"
import styles from "./Categories.module.css"

function CategoriesPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [refreshClickKey, setRefreshClickKey] = useState(0)
  const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const canList = Boolean(user?.permissions?.includes("categories.list"))
  const canView = Boolean(user?.permissions?.includes("categories.view"))
  const canCreate = Boolean(user?.permissions?.includes("categories.create"))
  const canEdit = Boolean(user?.permissions?.includes("categories.edit"))
  const canDelete = Boolean(user?.permissions?.includes("categories.delete"))
  const canDisable = Boolean(user?.permissions?.includes("categories.disable"))

  const fetchCategories = useCallback(async () => {
    try {
      setError(null)

      if (!canList) {
        setCategories([])
        return
      }

      if (categories.length === 0) {
        setLoading(true)
      } else {
        setIsFetching(true)
      }

      const response = await fetch("/api/categories")

      if (!response.ok) {
        throw new Error("Ошибка загрузки категорий")
      }

      const data = await response.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [canList, categories.length])

  useEffect(() => {
    if (authLoading || !canList) return
    void fetchCategories()
  }, [authLoading, canList, fetchCategories])

  useEffect(() => {
    if (!minRefreshSpinActive) return
    const timeoutId = window.setTimeout(() => setMinRefreshSpinActive(false), 525)
    return () => window.clearTimeout(timeoutId)
  }, [minRefreshSpinActive])

  const filteredCategories = useMemo(
    () => filterCategories(categories, searchTerm),
    [categories, searchTerm]
  )

  const { roots: treeRoots, nodeMap } = useMemo(
    () => buildCategoryTree(filteredCategories),
    [filteredCategories]
  )

  const resolvedSelectedCategory = useMemo(() => {
    if (filteredCategories.length === 0) {
      return null
    }

    if (selectedCategory) {
      const nextSelectedCategory = filteredCategories.find((category) => category.id === selectedCategory.id)
      if (nextSelectedCategory) {
        return nextSelectedCategory
      }
    }

    return treeRoots[0] || filteredCategories[0] || null
  }, [filteredCategories, selectedCategory, treeRoots])

  const selectedPathIds = useMemo(
    () => buildSelectedPath(filteredCategories, resolvedSelectedCategory?.id ?? null),
    [filteredCategories, resolvedSelectedCategory?.id]
  )

  const activePath = useMemo(
    () => buildActivePath(selectedPathIds, nodeMap),
    [nodeMap, selectedPathIds]
  )

  const treeColumns = useMemo(
    () => buildTreeColumns(treeRoots, activePath),
    [activePath, treeRoots]
  )

  const totalRootCategories = categories.filter((category) => !category.родительская_категория_id).length
  const totalSubcategories = categories.filter((category) => category.родительская_категория_id).length

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })

  const openDeleteDialog = (category: Category) => {
    if (!canDelete) return
    setSelectedCategory(category)
    setIsDeleteModalOpen(true)
  }

  const openEditDialog = (category: Category) => {
    if (!canEdit) return
    setSelectedCategory(category)
    setIsEditModalOpen(true)
  }

  const handleToggleCategoryActive = async (category: Category) => {
    if (!canDisable) return

    try {
      const response = await fetch("/api/categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: category.id,
          активна: !category.активна,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка изменения статуса категории")
      }

      await fetchCategories()
    } catch (toggleError) {
      console.error("Error toggling category active state:", toggleError)
      alert(
        "Ошибка изменения статуса категории: " +
          (toggleError instanceof Error ? toggleError.message : "Unknown error")
      )
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedCategory || !canDelete) return

    try {
      const response = await fetch(`/api/categories?id=${selectedCategory.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка удаления категории")
      }

      await fetchCategories()
      setIsDeleteModalOpen(false)
      setSelectedCategory(null)
    } catch (deleteError) {
      console.error("Error deleting category:", deleteError)
      alert(
        "Ошибка удаления категории: " +
          (deleteError instanceof Error ? deleteError.message : "Unknown error")
      )
    }
  }

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canList) {
    return <NoAccessPage />
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="Категории товаров"
          subtitle="Древовидная карта категорий слева направо с обзором всей структуры."
        />
        <CategoriesPageSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="Категории товаров"
          subtitle="Не удалось загрузить структуру категорий"
        />
        <div className={styles.errorState}>
          <span>{error}</span>
          <RefreshButton type="button" onClick={() => void fetchCategories()}>
            Повторить попытку
          </RefreshButton>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Категории товаров"
        subtitle="Древовидная карта категорий слева направо с обзором всей структуры."
        actions={(
          <>
            <RefreshButton
              className={styles.surfaceButton}
              type="button"
              isRefreshing={isFetching || minRefreshSpinActive}
              refreshKey={refreshClickKey}
              iconClassName={styles.spin}
              onClick={() => {
                if (isFetching) return
                setRefreshClickKey((current) => current + 1)
                setMinRefreshSpinActive(true)
                void fetchCategories()
              }}
            />
            <ReferenceDataActions
              catalogKey="categories"
              permissions={user?.permissions}
              onImported={fetchCategories}
            />
            {canCreate ? (
              <CreateEntityButton
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                icon={<FiFolderPlus className="size-4" />}
              >
                Добавить категорию
              </CreateEntityButton>
            ) : null}
          </>
        )}
      />

      <section className={styles.card}>
        <CategoriesStats
          totalCategories={categories.length}
          totalRootCategories={totalRootCategories}
          totalSubcategories={totalSubcategories}
          totalColumns={treeColumns.length}
        />

        <div className={styles.workspaceSection}>
          <CategoryTreeMap
            treeColumns={treeColumns}
            nodeMap={nodeMap}
            selectedCategoryId={resolvedSelectedCategory?.id ?? null}
            activePathIds={selectedPathIds}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onSelectCategory={setSelectedCategory}
            onOpenCategory={
              canView
                ? (category) => {
                    void router.push(`/categories/${category.id}`)
                  }
                : undefined
            }
          />

          <CategoryDetailsPanel
            category={resolvedSelectedCategory}
            canView={canView}
            canEdit={canEdit}
            canDelete={canDelete}
            canDisable={canDisable}
            formatDate={formatDate}
            onOpenCategory={(category) => {
              void router.push(`/categories/${category.id}`)
            }}
            onEditCategory={openEditDialog}
            onToggleCategoryActive={(category) => void handleToggleCategoryActive(category)}
            onDeleteCategory={openDeleteDialog}
          />
        </div>
      </section>

      <CreateCategoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCategoryCreated={() => {
          void fetchCategories()
          setIsCreateModalOpen(false)
        }}
      />

      <EditCategoryModal
        category={selectedCategory}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onCategoryUpdated={fetchCategories}
      />

      <DeleteConfirmation
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
        title="Удалить категорию"
        message="Это действие нельзя отменить. Категория будет полностью удалена из базы и структуры."
        warning="Перед удалением убедитесь, что связанные подкатегории и товары обработаны. Восстановить удаление будет нельзя."
        details={
          selectedCategory ? (
            <div className={styles.deletePreview}>
              <div className={styles.deletePreviewTitle}>{selectedCategory.название}</div>
              <div className={styles.deletePreviewText}>
                {selectedCategory.описание || "Описание отсутствует"}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  )
}

export default withLayout(CategoriesPage)
