import type { ReactNode } from "react"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FiArrowLeft, FiEdit3, FiExternalLink, FiSlash, FiTrash2 } from "react-icons/fi"

import { EntityActionButton } from "@/components/EntityActionButton/EntityActionButton"
import {
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import { EditCategoryModal } from "@/components/modals/EditCategoryModal/EditCategoryModal"
import {
  RecordDocumentCenter,
  RecordPrintSheet,
  type RecordPrintDocument,
} from "@/components/print/RecordDocumentCenter"
import { Badge } from "@/components/ui/badge"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/context/AuthContext"
import { usePageTitle } from "@/context/PageTitleContext"
import { withLayout } from "@/layout"

import styles from "./CategoryDetail.module.css"

interface CategoryDetail {
  id: number
  название: string
  описание?: string
  родительская_категория_id?: number
  родительская_категория_название?: string
  активна: boolean
  created_at: string
  подкатегории: CategoryDetail[]
  товары: number
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  )
}

function CategoryDetailPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { setPageTitle } = usePageTitle()
  const { id } = router.query
  const categoryId = Array.isArray(id) ? id[0] : id

  const [category, setCategory] = useState<CategoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const canView = Boolean(user?.permissions?.includes("categories.view"))
  const canEdit = Boolean(user?.permissions?.includes("categories.edit"))
  const canDelete = Boolean(user?.permissions?.includes("categories.delete"))
  const canDisable = Boolean(user?.permissions?.includes("categories.disable"))

  const fetchCategoryDetail = useCallback(async () => {
    if (!categoryId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/categories?id=${categoryId}`)

      if (!response.ok) {
        throw new Error("Ошибка загрузки категории")
      }

      const data = (await response.json()) as CategoryDetail
      setCategory(data)
    } catch (fetchError) {
      console.error(fetchError)
      setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
      setCategory(null)
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    if (authLoading || !canView || !categoryId) return
    void fetchCategoryDetail()
  }, [authLoading, canView, categoryId, fetchCategoryDetail])

  useEffect(() => {
    if (!category?.название) return
    setPageTitle(category.название)
  }, [category?.название, setPageTitle])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }, [])

  const categoryPrintDocuments = useMemo<RecordPrintDocument[]>(() => {
    if (!category) return []

    const documents: RecordPrintDocument[] = [
      {
        key: "category-card",
        title: "Карточка категории",
        fileName: `Карточка категории № ${category.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Карточка категории #${category.id}`}
            subtitle={category.название}
            meta={(
              <>
                <div>Статус: {category.активна ? "Активна" : "Неактивна"}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Основные сведения",
                fields: [
                  { label: "ID", value: `#${category.id}` },
                  { label: "Название", value: category.название || "—" },
                  { label: "Описание", value: category.описание || "Описание отсутствует" },
                  { label: "Статус", value: category.активна ? "Активна" : "Неактивна" },
                  { label: "Дата создания", value: formatDate(category.created_at) },
                  {
                    label: "Родительская категория",
                    value: category.родительская_категория_название || "Корневая категория",
                  },
                ],
              },
              {
                title: "Структура",
                fields: [
                  { label: "Подкатегорий", value: category.подкатегории?.length || 0 },
                  { label: "Товаров в категории", value: category.товары || 0 },
                ],
                columns: 1,
              },
            ]}
          />
        ),
      },
    ]

    if (category.подкатегории?.length) {
      documents.push({
        key: "category-children",
        title: "Подкатегории",
        fileName: `Подкатегории категории № ${category.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Подкатегории категории #${category.id}`}
            subtitle={category.название}
            meta={(
              <>
                <div>Подкатегорий: {category.подкатегории.length}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Список подкатегорий",
                table: {
                  columns: ["ID", "Название", "Статус", "Товаров"],
                  rows: category.подкатегории.map((item) => [
                    `#${item.id}`,
                    item.название || "—",
                    item.активна ? "Активна" : "Неактивна",
                    item.товары || 0,
                  ]),
                },
              },
            ]}
          />
        ),
      })
    }

    return documents
  }, [category, formatDate])

  const handleToggleCategoryActive = async () => {
    if (!category || !canDisable) return

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

      await fetchCategoryDetail()
    } catch (toggleError) {
      console.error("Error toggling category active state:", toggleError)
      alert(
        "Ошибка изменения статуса категории: " +
          (toggleError instanceof Error ? toggleError.message : "Unknown error")
      )
    }
  }

  const handleDelete = async () => {
    if (!category || !canDelete) return

    try {
      const response = await fetch(`/api/categories?id=${category.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка удаления категории")
      }

      setIsDeleteDialogOpen(false)
      void router.push("/categories")
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

  if (!canView) {
    return <NoAccessPage />
  }

  if (loading) {
    return <PageLoader label="Загрузка категории..." fullPage />
  }

  if (error || !category) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Категория не найдена</h1>
          <p className={styles.errorText}>{error || "Не удалось загрузить карточку категории"}</p>
          <EntityActionButton type="button" onClick={() => void router.push("/categories")}>
            Вернуться к категориям
          </EntityActionButton>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{category.название}</h1>
          <p className={styles.subtitle}>Детальная карточка категории и структура подкатегорий</p>
        </div>

        <div className={styles.headerActions}>
          <EntityActionButton type="button" className={styles.actionButton} onClick={() => void router.push("/categories")}>
            <FiArrowLeft />
            Назад
          </EntityActionButton>

          <RecordDocumentCenter
            documents={categoryPrintDocuments}
            buttonClassName={styles.actionButton}
          />

          {canEdit ? (
            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => setIsEditModalOpen(true)}
            >
              <FiEdit3 />
              Редактировать
            </EntityActionButton>
          ) : null}

          {canDisable ? (
            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => void handleToggleCategoryActive()}
            >
              <FiSlash />
              {category.активна ? "Отключить категорию" : "Включить категорию"}
            </EntityActionButton>
          ) : null}

          {canDelete ? (
            <EntityActionButton
              type="button"
              tone="danger"
              className={styles.actionButton}
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <FiTrash2 />
              Удалить
            </EntityActionButton>
          ) : null}
        </div>
      </header>

      <section className={`${styles.card} ${styles.detailsCard}`}>
        <div className={`${styles.sectionHeader} ${styles.detailsHeader}`}>
          <h2 className={styles.sectionTitle}>Детали категории</h2>
          <p className={styles.sectionMeta}>Категория создана {formatDate(category.created_at)}</p>
        </div>

        <div className={styles.detailsGrid}>
          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Основная информация</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.detailRows}>
              <InfoItem label="Название" value={category.название} />
              <InfoItem label="Описание" value={category.описание || "Описание отсутствует"} />
              <InfoItem label="Дата создания" value={formatDate(category.created_at)} />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Информация о категории</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.detailRows}>
              <InfoItem
                label="Статус"
                value={(
                  <Badge
                    variant="outline"
                    className={category.активна ? styles.activeBadge : styles.inactiveBadge}
                  >
                    {category.активна ? "АКТИВНА" : "НЕАКТИВНА"}
                  </Badge>
                )}
              />
              <InfoItem
                label="Родительская категория"
                value={category.родительская_категория_название || "Корневая категория"}
              />
              <InfoItem label="Подкатегорий" value={category.подкатегории?.length || 0} />
              <InfoItem label="Товаров в категории" value={category.товары || 0} />
            </div>
          </section>
        </div>

        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <div className={styles.sectionSubTitle}>Подкатегории</div>
              <div className={styles.sectionDescription}>Дочерние элементы текущей категории.</div>
            </div>
          </div>

          {category.подкатегории?.length ? (
            <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
              <Table className={entityTableClassName}>
                <TableHeader>
                  <TableRow>
                    <TableHead className={styles.idColumn}>ID</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className={styles.numberColumn}>Товаров</TableHead>
                    <TableHead className={styles.actionsColumn}>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {category.подкатегории.map((subcategory) => (
                    <TableRow key={subcategory.id}>
                      <TableCell className={styles.tableCell}>#{subcategory.id}</TableCell>
                      <TableCell className={styles.tableCell}>
                        <div className={styles.subcategoryName}>{subcategory.название}</div>
                      </TableCell>
                      <TableCell className={styles.tableCell}>
                        <div className={styles.subcategoryMeta}>
                          {subcategory.описание || "Описание не указано"}
                        </div>
                      </TableCell>
                      <TableCell className={styles.tableCell}>
                        <Badge
                          variant="outline"
                          className={subcategory.активна ? styles.activeBadge : styles.inactiveBadge}
                        >
                          {subcategory.активна ? "Активна" : "Неактивна"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        {subcategory.товары || 0}
                      </TableCell>
                      <TableCell className={styles.tableCell}>
                        <div className={styles.rowActions}>
                          <EntityActionButton
                            type="button"
                            className={styles.inlineAction}
                            onClick={() => void router.push(`/categories/${subcategory.id}`)}
                          >
                            <FiExternalLink />
                            Открыть
                          </EntityActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EntityTableSurface>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>Подкатегорий пока нет</div>
              <div className={styles.emptyText}>
                Можно создать новую категорию и привязать её к этой ветке.
              </div>
            </div>
          )}
        </div>
      </section>

      <EditCategoryModal
        category={category}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onCategoryUpdated={() => void fetchCategoryDetail()}
      />

      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Удалить категорию"
        message="Это действие нельзя отменить. Категория будет полностью удалена из базы и структуры."
        warning="Перед удалением убедитесь, что связанные подкатегории и товары обработаны. Восстановить удаление будет нельзя."
        details={(
          <div className={styles.deletePreview}>
            <div className={styles.deletePreviewTitle}>{category.название}</div>
            <div className={styles.deletePreviewText}>
              {category.описание || "Описание отсутствует"}
            </div>
          </div>
        )}
      />
    </div>
  )
}

export default withLayout(CategoryDetailPage)
