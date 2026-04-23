import Image from "next/image"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiFile,
  FiPaperclip,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi"

import { EntityActionButton } from "@/components/EntityActionButton/EntityActionButton"
import {
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import { EditProductModal } from "@/components/modals/EditProductModal/EditProductModal"
import type { NomenclatureTypeValue } from "@/components/modals/ProductFormFields/ProductFormFields"
import {
  RecordDocumentCenter,
  RecordPrintSheet,
  type RecordPrintDocument,
} from "@/components/print/RecordDocumentCenter"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { usePageTitle } from "@/hooks/use-page-title"
import { withLayout } from "@/layout"
import type { AttachmentItem } from "@/types/attachments"

import styles from "./ProductDetail.module.css"

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  товар: "Товар",
  материал: "Материал",
  продукция: "Продукция",
  входящая_услуга: "Входящая услуга",
  исходящая_услуга: "Исходящая услуга",
  внеоборотный_актив: "Внеоборотный актив",
}

const PRODUCT_VAT_LABELS: Record<number, string> = {
  1: "Без НДС",
  4: "10%",
  5: "22%",
}

const ACCOUNT_LABELS: Record<string, string> = {
  "10.мат": "10.мат Материалы и сырье",
  "10.дет": "10.дет Детали, комплектующие и полуфабрикаты",
  "10.см": "10.см Топливо",
  "10.зап": "10.зап Запасные части",
  "10.стр": "10.стр Строительные материалы",
  "10.хоз": "10.хоз Хозяйственные принадлежности и инвентарь",
  "10.спец": "10.спец Специальная одежда",
  "10.тара": "10.тара Тара",
  "10.пр": "10.пр Прочие материалы",
  "20": "20 Основное производство",
  "23": "23 Вспомогательные производства",
  "25": "25 Общепроизводственные расходы",
  "26": "26 Общехозяйственные (управленческие) расходы",
  "29": "29 Обслуживающие производства и хозяйства",
  "44": "44 Расходы на продажу (коммерческие расходы)",
  "91.02": "91.02 Прочие расходы",
  "97": "97 Расходы будущих периодов",
}

interface ProductPriceHistory {
  id: number
  товар_id: number
  цена_закупки?: number
  цена_продажи?: number
  изменено_в: string
  источник?: string
  комментарий?: string
}

interface ProductDetail {
  id: number
  название: string
  артикул: string
  категория?: string
  тип_номенклатуры?: NomenclatureTypeValue
  счет_учета?: string
  счет_затрат?: string
  ндс_id?: number
  комментарий?: string
  цена_закупки?: number
  цена_продажи: number
  единица_измерения: string
  минимальный_остаток: number
  created_at: string
  категория_id?: number
  история_цен?: ProductPriceHistory[]
}

const EMPTY_HISTORY: ProductPriceHistory[] = []

function InfoItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  )
}

const resolveNomenclatureType = (value?: string | null): NomenclatureTypeValue => {
  switch (value) {
    case "материал":
    case "продукция":
    case "входящая_услуга":
    case "исходящая_услуга":
    case "внеоборотный_актив":
      return value
    case "товар":
    default:
      return "товар"
  }
}

function ProductDetailPage(): JSX.Element {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { id } = router.query
  const productId = Array.isArray(id) ? id[0] : id
  const { setPageTitle } = usePageTitle()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null)

  const canView = Boolean(user?.permissions?.includes("products.view"))
  const canEdit = Boolean(user?.permissions?.includes("products.edit"))
  const canDelete = Boolean(user?.permissions?.includes("products.delete"))
  const canPriceHistoryView = Boolean(user?.permissions?.includes("products.price_history.view"))
  const canAttachmentsView = Boolean(user?.permissions?.includes("products.attachments.view"))
  const canAttachmentsUpload = Boolean(user?.permissions?.includes("products.attachments.upload"))
  const canAttachmentsDelete = Boolean(user?.permissions?.includes("products.attachments.delete"))

  const fetchAttachments = useCallback(async (entityId: number) => {
    if (!canAttachmentsView) {
      setAttachments([])
      setAttachmentsError(null)
      setAttachmentsLoading(false)
      return
    }

    try {
      setAttachmentsLoading(true)
      setAttachmentsError(null)

      const response = await fetch(
        `/api/attachments?entity_type=product&entity_id=${encodeURIComponent(String(entityId))}`
      )

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData?.error || "Ошибка загрузки вложений")
      }

      const result = (await response.json()) as AttachmentItem[]
      setAttachments(Array.isArray(result) ? result : [])
    } catch (fetchError) {
      console.error(fetchError)
      setAttachmentsError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки вложений")
    } finally {
      setAttachmentsLoading(false)
    }
  }, [canAttachmentsView])

  const fetchProductDetail = useCallback(async () => {
    if (!productId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/products?id=${productId}${canPriceHistoryView ? "&include_price_history=1" : ""}`
      )

      if (!response.ok) {
        throw new Error("Ошибка загрузки товара")
      }

      const result = (await response.json()) as ProductDetail
      setProduct(result)

      if (result?.id) {
        await fetchAttachments(Number(result.id))
      }
    } catch (fetchError) {
      console.error(fetchError)
      setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
      setProduct(null)
    } finally {
      setLoading(false)
    }
  }, [canPriceHistoryView, fetchAttachments, productId])

  useEffect(() => {
    if (authLoading || !canView || !productId) return
    void fetchProductDetail()
  }, [authLoading, canView, fetchProductDetail, productId])

  useEffect(() => {
    if (!product?.название) return
    setPageTitle(product.название)
  }, [product?.название, setPageTitle])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }, [])

  const formatDateTime = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount)
  }, [])

  const formatBytes = (bytes: number) => {
    const value = Number(bytes) || 0
    if (value < 1024) return `${value} B`
    const kilobytes = value / 1024
    if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
    const megabytes = kilobytes / 1024
    if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`
    const gigabytes = megabytes / 1024
    return `${gigabytes.toFixed(1)} GB`
  }

  const canPreviewInline = (attachment: AttachmentItem) => {
    const mime = (attachment.mime_type || "").toLowerCase()
    const name = (attachment.filename || "").toLowerCase()
    if (mime.includes("pdf") || name.endsWith(".pdf")) return true
    if (mime.startsWith("image/")) return true
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return true
    return false
  }

  const openPreview = (attachment: AttachmentItem) => {
    if (!canPreviewInline(attachment)) {
      window.open(
        `/api/attachments/${encodeURIComponent(attachment.id)}/download`,
        "_blank",
        "noopener,noreferrer"
      )
      return
    }

    setPreviewAttachment(attachment)
    setIsPreviewOpen(true)
  }

  const handleUploadFile = async (file: File) => {
    if (!product || !canAttachmentsUpload) return

    try {
      setAttachmentsUploading(true)
      setAttachmentsError(null)

      const form = new FormData()
      form.append("entity_type", "product")
      form.append("entity_id", String(product.id))
      form.append("file", file)

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: form,
      })

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData?.error || "Ошибка загрузки файла")
      }

      await fetchAttachments(product.id)
    } catch (uploadError) {
      console.error(uploadError)
      setAttachmentsError(uploadError instanceof Error ? uploadError.message : "Ошибка загрузки файла")
    } finally {
      setAttachmentsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!product || !canAttachmentsDelete) return

    try {
      setAttachmentsError(null)

      const response = await fetch(
        `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=product&entity_id=${encodeURIComponent(String(product.id))}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData?.error || "Ошибка удаления вложения")
      }

      await fetchAttachments(product.id)
    } catch (deleteError) {
      console.error(deleteError)
      setAttachmentsError(deleteError instanceof Error ? deleteError.message : "Ошибка удаления вложения")
    }
  }

  const handleDelete = async () => {
    if (!product) return

    try {
      setIsDeleting(true)

      const response = await fetch(`/api/products?id=${product.id}`, {
        method: "DELETE",
      })

      const responseData = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responseData?.error || "Ошибка удаления товара")
      }

      setIsDeleteDialogOpen(false)
      void router.push("/products")
    } catch (deleteError) {
      console.error("Error deleting product:", deleteError)
      alert(
        `Ошибка удаления товара: ${
          deleteError instanceof Error ? deleteError.message : "Unknown error"
        }`
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const history = product?.история_цен ?? EMPTY_HISTORY
  const productTypeLabel = product
    ? PRODUCT_TYPE_LABELS[product.тип_номенклатуры || "товар"] || product.тип_номенклатуры || "Товар"
    : "Товар"
  const vatLabel = product ? PRODUCT_VAT_LABELS[product.ндс_id || 5] || "22%" : "22%"
  const accountingAccountLabel = product?.счет_учета
    ? ACCOUNT_LABELS[product.счет_учета] || product.счет_учета
    : null
  const expenseAccountLabel = product?.счет_затрат
    ? ACCOUNT_LABELS[product.счет_затрат] || product.счет_затрат
    : null

  const productPrintDocuments = useMemo<RecordPrintDocument[]>(() => {
    if (!product) return []

    const documents: RecordPrintDocument[] = [
      {
        key: "product-card",
        title: "Карточка товара",
        fileName: `Карточка товара № ${product.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Карточка товара #${product.id}`}
            subtitle={product.название}
            meta={(
              <>
                <div>Артикул: {product.артикул || "—"}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Основная информация",
                fields: [
                  { label: "ID", value: `#${product.id}` },
                  { label: "Название", value: product.название || "—" },
                  { label: "Артикул", value: product.артикул || "—" },
                  { label: "Категория", value: product.категория || "Не указана" },
                  { label: "Тип номенклатуры", value: productTypeLabel },
                  { label: "Ставка НДС", value: vatLabel },
                  { label: "Счет учета", value: accountingAccountLabel || "—" },
                  { label: "Счет затрат", value: expenseAccountLabel || "—" },
                ],
              },
              {
                title: "Цены и параметры",
                fields: [
                  { label: "Цена продажи", value: formatCurrency(product.цена_продажи) },
                  {
                    label: "Цена закупки",
                    value: product.цена_закупки != null ? formatCurrency(product.цена_закупки) : "Не указана",
                  },
                  { label: "Единица измерения", value: product.единица_измерения || "—" },
                  {
                    label: "Минимальный остаток",
                    value: `${product.минимальный_остаток} ${product.единица_измерения}`,
                  },
                  { label: "Дата регистрации", value: formatDate(product.created_at) },
                  { label: "Комментарий", value: product.комментарий || "Не указан" },
                ],
              },
            ]}
          />
        ),
      },
    ]

    if (history.length) {
      documents.push({
        key: "product-price-history",
        title: "История цен",
        fileName: `История цен товара № ${product.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`История цен товара #${product.id}`}
            subtitle={product.название}
            meta={(
              <>
                <div>Записей: {history.length}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Изменения цен",
                table: {
                  columns: ["Дата", "Цена закупки", "Цена продажи", "Источник", "Комментарий"],
                  rows: history.map((entry) => [
                    formatDateTime(entry.изменено_в),
                    entry.цена_закупки != null ? formatCurrency(entry.цена_закупки) : "—",
                    entry.цена_продажи != null ? formatCurrency(entry.цена_продажи) : "—",
                    entry.источник || "—",
                    entry.комментарий || "—",
                  ]),
                },
              },
            ]}
          />
        ),
      })
    }

    return documents
  }, [
    accountingAccountLabel,
    expenseAccountLabel,
    formatCurrency,
    formatDate,
    formatDateTime,
    history,
    product,
    productTypeLabel,
    vatLabel,
  ])

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canView) {
    return <NoAccessPage />
  }

  if (loading) {
    return <PageLoader label="Загрузка товара..." fullPage />
  }

  if (error || !product) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Товар не найден</h1>
          <p className={styles.errorText}>{error || "Не удалось загрузить карточку товара"}</p>
          <EntityActionButton type="button" onClick={() => void router.push("/products")}>
            Вернуться к товарам
          </EntityActionButton>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{product.название}</h1>
          <p className={styles.subtitle}>Карточка товара и история цен</p>
        </div>

        <div className={styles.headerActions}>
          <EntityActionButton type="button" className={styles.actionButton} onClick={() => void router.push("/products")}>
            <FiArrowLeft />
            Назад
          </EntityActionButton>

          <RecordDocumentCenter
            documents={productPrintDocuments}
            buttonClassName={styles.actionButton}
            saveTarget={canAttachmentsUpload ? { entityType: "product", entityId: product.id } : undefined}
            onSaved={() => void fetchAttachments(Number(product.id))}
          />

          {canEdit ? (
            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => setIsEditModalOpen(true)}
            >
              <FiEdit2 />
              Редактировать
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
          <h2 className={styles.sectionTitle}>Детали товара</h2>
          <p className={styles.sectionMeta}>Товар зарегистрирован {formatDate(product.created_at)}</p>
        </div>

        <div className={styles.detailsGrid}>
          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Основная информация</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="Название" value={product.название} />
              <InfoItem label="Артикул" value={product.артикул || "—"} />
              <InfoItem label="Дата регистрации" value={formatDate(product.created_at)} />
              <InfoItem label="Категория" value={product.категория || "Не указана"} />
              <InfoItem label="Тип номенклатуры" value={productTypeLabel} />
              <InfoItem label="Ставка НДС" value={vatLabel} />
              {accountingAccountLabel ? (
                <InfoItem label="Счет учета" value={accountingAccountLabel} />
              ) : null}
              {expenseAccountLabel ? (
                <InfoItem label="Счет затрат" value={expenseAccountLabel} />
              ) : null}
              <InfoItem label="Комментарий" value={product.комментарий || "Не указан"} />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Параметры и цены</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="Цена продажи" value={formatCurrency(product.цена_продажи)} />
              <InfoItem
                label="Цена закупки"
                value={product.цена_закупки != null ? formatCurrency(product.цена_закупки) : "Не указана"}
              />
              <InfoItem label="Единица измерения" value={product.единица_измерения} />
              <InfoItem
                label="Минимальный остаток"
                value={`${product.минимальный_остаток} ${product.единица_измерения}`}
              />
            </div>
          </section>
        </div>
      </section>

      {canAttachmentsView ? (
        <section className={styles.card}>
          <div className={styles.sectionHeaderWithActions}>
            <h2 className={styles.sectionTitle}>Документы</h2>

            {canAttachmentsUpload ? (
              <div className={styles.sectionActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleUploadFile(file)
                  }}
                />

                <EntityActionButton
                  type="button"
                  className={styles.actionButton}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachmentsUploading}
                >
                  <FiUploadCloud />
                  {attachmentsUploading ? "Загрузка..." : "Загрузить файл"}
                </EntityActionButton>
              </div>
            ) : null}
          </div>

          {attachmentsError ? <div className={styles.inlineError}>{attachmentsError}</div> : null}

          {attachmentsLoading ? (
            <div className={styles.emptyState}>Загрузка документов...</div>
          ) : attachments.length === 0 ? (
            <div className={styles.emptyState}>Нет прикрепленных документов</div>
          ) : (
            <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
              <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                <colgroup>
                  <col className={styles.colDocFile} />
                  <col className={styles.colDocSize} />
                  <col className={styles.colDocActions} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>Файл</TableHead>
                    <TableHead className={styles.textRight}>Размер</TableHead>
                    <TableHead className={styles.textRight}>Действия</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {attachments.map((attachment) => (
                    <TableRow key={attachment.id}>
                      <TableCell className={styles.tableCell}>
                        <div className={styles.fileCell}>
                          <div className={styles.fileTitleRow}>
                            <FiPaperclip className={styles.fileIcon} />
                            <span className={styles.fileName}>{attachment.filename}</span>
                          </div>
                          <span className={styles.fileMeta}>{attachment.mime_type}</span>
                        </div>
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        {formatBytes(attachment.size_bytes)}
                      </TableCell>

                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        <div className={styles.rowActions}>
                          <EntityActionButton
                            type="button"
                            className={styles.inlineAction}
                            onClick={() => openPreview(attachment)}
                          >
                            <FiFile />
                            Открыть
                          </EntityActionButton>

                          <EntityActionButton
                            type="button"
                            className={styles.inlineAction}
                            onClick={() => {
                              window.open(
                                `/api/attachments/${encodeURIComponent(attachment.id)}/download`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }}
                          >
                            <FiDownload />
                            Скачать
                          </EntityActionButton>

                          {canAttachmentsDelete ? (
                            <EntityActionButton
                              type="button"
                              tone="danger"
                              className={styles.inlineAction}
                              onClick={() => void handleDeleteAttachment(attachment.id)}
                            >
                              <FiTrash2 />
                              Удалить
                            </EntityActionButton>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EntityTableSurface>
          )}
        </section>
      ) : null}

      {canPriceHistoryView ? (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>История цен</h2>
          </div>

          {history.length === 0 ? (
            <div className={styles.emptyState}>История цен пока отсутствует.</div>
          ) : (
            <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
              <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                <colgroup>
                  <col className={styles.colHistoryDate} />
                  <col className={styles.colHistoryPrice} />
                  <col className={styles.colHistoryPrice} />
                  <col className={styles.colHistorySource} />
                  <col className={styles.colHistoryComment} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead className={styles.textRight}>Цена закупки</TableHead>
                    <TableHead className={styles.textRight}>Цена продажи</TableHead>
                    <TableHead>Источник</TableHead>
                    <TableHead>Комментарий</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className={styles.tableCell}>{formatDateTime(entry.изменено_в)}</TableCell>
                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        {entry.цена_закупки != null ? formatCurrency(entry.цена_закупки) : "—"}
                      </TableCell>
                      <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                        {entry.цена_продажи != null ? formatCurrency(entry.цена_продажи) : "—"}
                      </TableCell>
                      <TableCell className={styles.tableCell}>{entry.источник || "—"}</TableCell>
                      <TableCell className={styles.tableCell}>{entry.комментарий || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EntityTableSurface>
          )}
        </section>
      ) : null}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className={styles.previewDialog}>
          <div className={styles.previewHeader}>
            <div>
              <DialogTitle className={styles.previewTitle}>
                {previewAttachment?.filename || "Документ"}
              </DialogTitle>
              <DialogDescription className={styles.previewDescription}>
                {previewAttachment?.mime_type || ""}
              </DialogDescription>
            </div>
          </div>

          <div className={styles.previewBody}>
            {previewAttachment && canPreviewInline(previewAttachment) ? (
              previewAttachment.mime_type.toLowerCase().startsWith("image/") ||
              /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                <div className={styles.previewImageWrap}>
                  <Image
                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                    alt={previewAttachment.filename}
                    fill
                    unoptimized
                    sizes="100vw"
                    className={styles.previewImage}
                  />
                </div>
              ) : (
                <iframe
                  src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                  className={styles.previewFrame}
                  title={previewAttachment.filename}
                />
              )
            ) : (
              <div className={styles.emptyState}>
                Предпросмотр недоступен для этого формата. Используй «Скачать».
              </div>
            )}
          </div>

          <div className={styles.previewActions}>
            {previewAttachment ? (
              <EntityActionButton
                type="button"
                className={styles.actionButton}
                onClick={() => {
                  window.open(
                    `/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }}
              >
                <FiDownload />
                Скачать
              </EntityActionButton>
            ) : null}

            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => setIsPreviewOpen(false)}
            >
              Закрыть
            </EntityActionButton>
          </div>
        </DialogContent>
      </Dialog>

      <EditProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProductUpdated={async () => {
          await fetchProductDetail()
          setIsEditModalOpen(false)
        }}
        product={{
          ...product,
          тип_номенклатуры: resolveNomenclatureType(product.тип_номенклатуры),
        }}
      />

      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить товар?"
        warning="Это действие нельзя отменить. Карточка товара и связанные с ней данные будут удалены."
        details={(
          <div className={deleteConfirmationStyles.positionsSection}>
            <div className={deleteConfirmationStyles.orderTitle}>Товар #{product.id}</div>
            <div className={deleteConfirmationStyles.orderMeta}>Название: {product.название}</div>
            <div className={deleteConfirmationStyles.orderMeta}>Артикул: {product.артикул || "—"}</div>
          </div>
        )}
      />
    </div>
  )
}

export default withLayout(ProductDetailPage)
