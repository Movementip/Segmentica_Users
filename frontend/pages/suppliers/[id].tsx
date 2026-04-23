import Image from "next/image"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiFile,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTruck,
  FiUploadCloud,
} from "react-icons/fi"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { EntityActionButton } from "@/components/EntityActionButton/EntityActionButton"
import {
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { AddProductToSupplierModal } from "@/components/modals/AddProductToSupplierModal/AddProductToSupplierModal"
import { CreatePurchaseModal } from "@/components/modals/CreatePurchaseModal/CreatePurchaseModal"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import deleteConfirmationStyles from "@/components/modals/DeleteConfirmation/DeleteConfirmation.module.css"
import {
  EditSupplierModal,
  type EditSupplierModalSupplier,
} from "@/components/modals/EditSupplierModal/EditSupplierModal"
import {
  RecordDocumentCenter,
  RecordPrintSheet,
  type RecordPrintDocument,
} from "@/components/print/RecordDocumentCenter"
import { Badge } from "@/components/ui/badge"
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
import {
  getSupplierContragentTypeLabel,
  getSupplierContragentTypeTheme,
  normalizeSupplierContragentType,
  type SupplierBankAccount,
  type SupplierContragent,
} from "@/lib/supplierContragents"
import { cn } from "@/lib/utils"
import type { AttachmentItem } from "@/types/attachments"

import styles from "./SupplierDetail.module.css"

interface SupplierProduct {
  id: number
  товар_id: number
  цена: number
  срок_поставки: number
  товар_название: string
  товар_артикул: string
  товар_категория?: string
  товар_единица_измерения: string
}

interface SupplierPurchase {
  id: number
  дата_заказа: string
  дата_поступления?: string
  статус: string
  общая_сумма: number
  заявка_id?: number
}

interface SupplierDetail extends SupplierContragent {
  рейтинг: number
  bankAccounts?: SupplierBankAccount[]
  ассортимент: SupplierProduct[]
  закупки: SupplierPurchase[]
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  )
}

function formatTextValue(value?: string | null) {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized || "Не указан"
}

function getSupplierPurchaseStatusTone(status: string) {
  switch ((status || "").trim().toLowerCase()) {
    case "получено":
      return "success" as const
    case "заказано":
    case "в пути":
      return "warning" as const
    case "отменено":
      return "danger" as const
    default:
      return "muted" as const
  }
}

function SupplierDetailPage(): JSX.Element {
  const router = useRouter()
  const { id } = router.query
  const supplierId = Array.isArray(id) ? id[0] : id
  const { user, loading: authLoading } = useAuth()
  const { setPageTitle } = usePageTitle()

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"products" | "purchases">("products")
  const [searchQuery, setSearchQuery] = useState("")

  const [isCreatePurchaseModalOpen, setIsCreatePurchaseModalOpen] = useState(false)
  const [createPurchaseModalKey, setCreatePurchaseModalKey] = useState(0)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)
  const [editingAssortmentProduct, setEditingAssortmentProduct] =
    useState<SupplierProduct | null>(null)
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false)

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false)
  const [pendingAssortmentDelete, setPendingAssortmentDelete] =
    useState<SupplierProduct | null>(null)
  const [isDeletingAssortmentProduct, setIsDeletingAssortmentProduct] = useState(false)
  const [assortmentBusyProductId, setAssortmentBusyProductId] = useState<number | null>(null)

  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null)

  const canView = Boolean(user?.permissions?.includes("suppliers.view"))
  const canEdit = Boolean(user?.permissions?.includes("suppliers.edit"))
  const canDelete = Boolean(user?.permissions?.includes("suppliers.delete"))
  const canAssortmentManage =
    canEdit || Boolean(user?.permissions?.includes("suppliers.assortment.manage"))
  const canAddProduct =
    canAssortmentManage ||
    Boolean(user?.permissions?.includes("suppliers.assortment.add_product"))
  const canCreatePurchase = Boolean(user?.permissions?.includes("purchases.create"))
  const canCreatePurchaseFromSupplier = Boolean(
    user?.permissions?.includes("suppliers.purchases.create")
  )
  const canShowCreatePurchase = canCreatePurchase && canCreatePurchaseFromSupplier
  const canAssortmentView = Boolean(user?.permissions?.includes("suppliers.assortment.view"))
  const canManageAssortment = canAssortmentManage
  const canPurchasesHistoryView = Boolean(
    user?.permissions?.includes("suppliers.purchases_history.view")
  )
  const canOrdersView = Boolean(user?.permissions?.includes("orders.view"))
  const canPurchasesView = Boolean(user?.permissions?.includes("purchases.view"))
  const canAttachmentsView = Boolean(
    user?.permissions?.includes("suppliers.attachments.view")
  )
  const canAttachmentsUpload = Boolean(
    user?.permissions?.includes("suppliers.attachments.upload")
  )
  const canAttachmentsDelete = Boolean(
    user?.permissions?.includes("suppliers.attachments.delete")
  )

  const canShowTables = canAssortmentView || canPurchasesHistoryView

  useEffect(() => {
    if (!canAssortmentView && canPurchasesHistoryView) {
      setActiveTab("purchases")
      return
    }

    if (canAssortmentView) {
      setActiveTab("products")
    }
  }, [canAssortmentView, canPurchasesHistoryView])

  const formatDate = useCallback((dateString?: string | null) => {
    if (!dateString) return "Не указана"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "Не указана"

    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }, [])

  const formatDateTime = useCallback((dateString?: string | null) => {
    if (!dateString) return "Не указана"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "Не указана"

    return date.toLocaleString("ru-RU", {
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

  const fetchAttachments = useCallback(async (entityId: number) => {
    if (!canAttachmentsView) {
      setAttachments([])
      setAttachmentsError(null)
      setAttachmentsLoading(false)
      return
    }

    if (!Number.isInteger(entityId) || entityId <= 0) {
      setAttachments([])
      return
    }

    try {
      setAttachmentsLoading(true)
      setAttachmentsError(null)

      const response = await fetch(
        `/api/attachments?entity_type=supplier&entity_id=${encodeURIComponent(String(entityId))}`
      )

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData?.error || "Ошибка загрузки вложений")
      }

      const result = (await response.json()) as AttachmentItem[]
      setAttachments(Array.isArray(result) ? result : [])
    } catch (fetchError) {
      console.error(fetchError)
      setAttachmentsError(
        fetchError instanceof Error ? fetchError.message : "Ошибка загрузки вложений"
      )
    } finally {
      setAttachmentsLoading(false)
    }
  }, [canAttachmentsView])

  const fetchSupplierDetail = useCallback(async () => {
    if (!supplierId || !canView) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/suppliers/${supplierId}`)

      if (!response.ok) {
        throw new Error("Ошибка загрузки поставщика")
      }

      const result = (await response.json()) as SupplierDetail
      const nextSupplier: SupplierDetail = {
        ...result,
        ассортимент: Array.isArray(result?.ассортимент) ? result.ассортимент : [],
        закупки: Array.isArray(result?.закупки) ? result.закупки : [],
        bankAccounts: Array.isArray(result?.bankAccounts) ? result.bankAccounts : [],
      }

      setSupplier(nextSupplier)

      if (nextSupplier.id) {
        await fetchAttachments(Number(nextSupplier.id))
      }
    } catch (fetchError) {
      console.error(fetchError)
      setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
      setSupplier(null)
    } finally {
      setLoading(false)
    }
  }, [canView, fetchAttachments, supplierId])

  useEffect(() => {
    if (authLoading || !canView || !supplierId) return
    void fetchSupplierDetail()
  }, [authLoading, canView, fetchSupplierDetail, supplierId])

  useEffect(() => {
    if (!supplier?.название) return
    setPageTitle(supplier.название)
  }, [setPageTitle, supplier?.название])

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

  const handleUploadAttachment = async (file: File) => {
    if (!supplier || !canAttachmentsUpload) return

    try {
      setAttachmentsUploading(true)
      setAttachmentsError(null)

      const form = new FormData()
      form.append("entity_type", "supplier")
      form.append("entity_id", String(supplier.id))
      form.append("file", file)

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: form,
      })

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData?.error || "Ошибка загрузки файла")
      }

      await fetchAttachments(supplier.id)
    } catch (uploadError) {
      console.error(uploadError)
      setAttachmentsError(
        uploadError instanceof Error ? uploadError.message : "Ошибка загрузки файла"
      )
    } finally {
      setAttachmentsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!supplier || !canAttachmentsDelete) return

    try {
      setAttachmentsError(null)

      const response = await fetch(
        `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=supplier&entity_id=${encodeURIComponent(String(supplier.id))}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData?.error || "Ошибка удаления вложения")
      }

      await fetchAttachments(supplier.id)
    } catch (deleteError) {
      console.error(deleteError)
      setAttachmentsError(
        deleteError instanceof Error ? deleteError.message : "Ошибка удаления вложения"
      )
    }
  }

  const productsFiltered = useMemo(() => {
    if (!supplier) return []
    const query = searchQuery.trim().toLowerCase()
    if (!query) return supplier.ассортимент

    return supplier.ассортимент.filter((product) => (
      String(product.товар_id).includes(query) ||
      (product.товар_название || "").toLowerCase().includes(query) ||
      (product.товар_артикул || "").toLowerCase().includes(query) ||
      (product.товар_категория || "").toLowerCase().includes(query)
    ))
  }, [searchQuery, supplier])

  const purchasesFiltered = useMemo(() => {
    if (!supplier) return []
    const query = searchQuery.trim().toLowerCase()
    if (!query) return supplier.закупки

    return supplier.закупки.filter((purchase) => (
      String(purchase.id).includes(query) ||
      String(purchase.заявка_id ?? "").includes(query) ||
      (purchase.статус || "").toLowerCase().includes(query)
    ))
  }, [searchQuery, supplier])

  const handleCreatePurchase = () => {
    if (!canShowCreatePurchase) return
    setCreatePurchaseModalKey((value) => value + 1)
    setIsCreatePurchaseModalOpen(true)
  }

  const handleAddProduct = () => {
    if (!canAddProduct) return
    setEditingAssortmentProduct(null)
    setIsAddProductModalOpen(true)
  }

  const handleEditAssortmentProduct = (product: SupplierProduct) => {
    if (!canManageAssortment) return
    setEditingAssortmentProduct(product)
    setIsAddProductModalOpen(true)
  }

  const handleConfirmAssortmentDelete = async () => {
    if (!supplier || !pendingAssortmentDelete || !canManageAssortment) return

    try {
      setIsDeletingAssortmentProduct(true)
      setAssortmentBusyProductId(pendingAssortmentDelete.товар_id)
      setError(null)

      const response = await fetch(
        `/api/suppliers/${supplier.id}/actions?товар_id=${encodeURIComponent(String(pendingAssortmentDelete.товар_id))}`,
        { method: "DELETE" }
      )
      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseData?.error || "Ошибка удаления товара из ассортимента")
      }

      await fetchSupplierDetail()
      setPendingAssortmentDelete(null)
    } catch (deleteError) {
      console.error(deleteError)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Ошибка удаления товара из ассортимента"
      )
    } finally {
      setIsDeletingAssortmentProduct(false)
      setAssortmentBusyProductId(null)
    }
  }

  const handleDeleteSupplier = async () => {
    if (!supplier || !canDelete) return

    try {
      setIsDeletingSupplier(true)

      const response = await fetch(`/api/suppliers?id=${supplier.id}`, {
        method: "DELETE",
      })
      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseData?.error || "Ошибка удаления поставщика")
      }

      setIsDeleteConfirmOpen(false)
      void router.push("/suppliers")
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError instanceof Error ? deleteError.message : "Ошибка удаления поставщика")
    } finally {
      setIsDeletingSupplier(false)
    }
  }

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canView) {
    return <NoAccessPage />
  }

  if (loading) {
    return <PageLoader label="Загрузка поставщика..." fullPage />
  }

  if (error || !supplier) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Поставщик не найден</h1>
          <p className={styles.errorText}>{error || "Не удалось загрузить карточку поставщика"}</p>
          <EntityActionButton type="button" onClick={() => void router.push("/suppliers")}>
            Вернуться к поставщикам
          </EntityActionButton>
        </div>
      </div>
    )
  }

  const productsCount = supplier.ассортимент.length
  const purchasesCount = supplier.закупки.length
  const purchasesInTransit = supplier.закупки.filter(
    (purchase) => (purchase.статус || "").toLowerCase() === "в пути"
  ).length
  const purchasesSum = supplier.закупки.reduce(
    (sum, purchase) => sum + (Number(purchase.общая_сумма) || 0),
    0
  )

  const normalizedSupplierType = normalizeSupplierContragentType(supplier.тип)
  const supplierTypeLabel = getSupplierContragentTypeLabel(supplier.тип)
  const supplierTypeTheme = getSupplierContragentTypeTheme(supplier.тип)
  const supplierIdentity = (() => {
    if (normalizedSupplierType === "Организация") {
      return formatTextValue(
        supplier.полноеНазвание || supplier.краткоеНазвание || supplier.название
      )
    }

    const fullName = [supplier.фамилия, supplier.имя, supplier.отчество]
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(" ")

    return fullName || formatTextValue(supplier.название)
  })()
  const registrationLabel = (() => {
    if (normalizedSupplierType === "Организация") return "Адрес по ЕГРЮЛ"
    if (normalizedSupplierType === "Индивидуальный предприниматель") return "Адрес по ЕГРИП"
    return "Адрес по ФИАС"
  })()
  const searchPlaceholder =
    activeTab === "products"
      ? "Поиск по ассортименту..."
      : "Поиск по закупкам и заявкам..."

  const supplierPrintDocuments: RecordPrintDocument[] = (() => {
    const bankAccounts = supplier.bankAccounts || []
    const documents: RecordPrintDocument[] = [
      {
        key: "supplier-card",
        title: "Карточка поставщика",
        fileName: `Карточка поставщика № ${supplier.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Карточка поставщика #${supplier.id}`}
            subtitle={supplier.название}
            meta={(
              <>
                <div>Тип: {supplierTypeLabel}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Основные реквизиты",
                fields: [
                  { label: "ID", value: `#${supplier.id}` },
                  { label: "Тип", value: supplierTypeLabel },
                  { label: "Полное имя / название", value: supplierIdentity },
                  {
                    label: "Краткое название",
                    value: formatTextValue(supplier.краткоеНазвание || supplier.название),
                  },
                  { label: "ИНН", value: formatTextValue(supplier.инн) },
                  { label: "КПП", value: formatTextValue(supplier.кпп) },
                  {
                    label: normalizedSupplierType === "Организация" ? "ОГРН" : "ОГРНИП",
                    value: formatTextValue(supplier.огрн || supplier.огрнип),
                  },
                  { label: "ОКПО", value: formatTextValue(supplier.окпо) },
                ],
              },
              {
                title: "Контакты и условия",
                fields: [
                  { label: "Телефон", value: formatTextValue(supplier.телефон) },
                  { label: "Email", value: formatTextValue(supplier.email) },
                  {
                    label: registrationLabel,
                    value: formatTextValue(supplier.адресРегистрации || supplier.адрес),
                  },
                  {
                    label: "Адрес для документов",
                    value: formatTextValue(supplier.адресПечати || supplier.адрес),
                  },
                  { label: "Рейтинг", value: supplier.рейтинг ?? "—" },
                  { label: "Комментарий", value: formatTextValue(supplier.комментарий) },
                ],
              },
              bankAccounts.length > 0
                ? {
                    title: "Банковские реквизиты",
                    table: {
                      columns: ["Счет", "Банк", "БИК", "Расчетный счет", "Корр. счет"],
                      rows: bankAccounts.map((account) => [
                        `${account.name}${account.isPrimary ? " (основной)" : ""}`,
                        account.bankName || "—",
                        account.bik || "—",
                        account.settlementAccount || "—",
                        account.correspondentAccount || "—",
                      ]),
                    },
                  }
                : {
                    title: "Банковские реквизиты",
                    note: "Банковские реквизиты поставщика не заполнены.",
                  },
            ]}
          />
        ),
      },
    ]

    if (supplier.ассортимент.length > 0) {
      documents.push({
        key: "supplier-assortment",
        title: "Ассортимент поставщика",
        fileName: `Ассортимент поставщика № ${supplier.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Ассортимент поставщика #${supplier.id}`}
            subtitle={supplier.название}
            meta={(
              <>
                <div>Позиций: {supplier.ассортимент.length}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Ассортимент",
                table: {
                  columns: ["Название", "Артикул", "Категория", "Ед.", "Цена", "Срок поставки"],
                  rows: supplier.ассортимент.map((product) => [
                    product.товар_название || "—",
                    product.товар_артикул || "—",
                    product.товар_категория || "—",
                    product.товар_единица_измерения || "—",
                    formatCurrency(product.цена || 0),
                    product.срок_поставки ? `${product.срок_поставки} дн.` : "—",
                  ]),
                },
              },
            ]}
          />
        ),
      })
    }

    if (supplier.закупки.length > 0) {
      documents.push({
        key: "supplier-purchases",
        title: "История закупок",
        fileName: `История закупок поставщика № ${supplier.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`История закупок поставщика #${supplier.id}`}
            subtitle={supplier.название}
            meta={(
              <>
                <div>Закупок: {supplier.закупки.length}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            )}
            sections={[
              {
                title: "Сводка",
                fields: [
                  { label: "Всего закупок", value: purchasesCount },
                  { label: "Закупок в пути", value: purchasesInTransit },
                  { label: "Общая сумма", value: formatCurrency(purchasesSum) },
                ],
                columns: 1,
              },
              {
                title: "Закупки",
                table: {
                  columns: ["№ закупки", "Дата заказа", "Статус", "Сумма", "Связанная заявка"],
                  rows: supplier.закупки.map((purchase) => [
                    `#${purchase.id}`,
                    formatDateTime(purchase.дата_заказа),
                    purchase.статус || "—",
                    formatCurrency(purchase.общая_сумма || 0),
                    purchase.заявка_id ? `#${purchase.заявка_id}` : "—",
                  ]),
                },
              },
            ]}
          />
        ),
      })
    }

    return documents
  })()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{supplier.название}</h1>
              <Badge
                variant="secondary"
                className={styles.typeBadge}
                data-theme={supplierTypeTheme}
              >
                {supplierTypeLabel}
              </Badge>
            </div>
            <p className={styles.subtitle}>Карточка поставщика, ассортимент и история закупок</p>
          </div>

          <div className={styles.headerActions}>
            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => void router.push("/suppliers")}
            >
              <FiArrowLeft />
              Назад
            </EntityActionButton>

            <RecordDocumentCenter
              documents={supplierPrintDocuments}
              buttonClassName={styles.actionButton}
              saveTarget={
                canAttachmentsUpload ? { entityType: "supplier", entityId: supplier.id } : undefined
              }
              onSaved={() => void fetchAttachments(Number(supplier.id))}
            />

            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => void fetchSupplierDetail()}
            >
              <FiRefreshCw />
              Обновить
            </EntityActionButton>

            {canEdit ? (
              <EntityActionButton
                type="button"
                className={styles.actionButton}
                onClick={() => setIsEditSupplierOpen(true)}
              >
                <FiEdit2 />
                Редактировать
              </EntityActionButton>
            ) : null}

            {canAddProduct ? (
              <EntityActionButton
                type="button"
                className={styles.actionButton}
                onClick={handleAddProduct}
              >
                <FiPlus />
                Добавить товар
              </EntityActionButton>
            ) : null}

            {canShowCreatePurchase ? (
              <EntityActionButton
                type="button"
                className={styles.actionButton}
                onClick={handleCreatePurchase}
              >
                <FiTruck />
                Создать закупку
              </EntityActionButton>
            ) : null}

            {canDelete ? (
              <EntityActionButton
                type="button"
                tone="danger"
                className={styles.actionButton}
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                <FiTrash2 />
                Удалить
              </EntityActionButton>
            ) : null}
          </div>
        </div>
      </header>

      <EntityStatsPanel
        title="Статистика поставщика"
        className={styles.statsPanel}
        items={[
          {
            label: "Позиций в ассортименте",
            value: productsCount.toLocaleString("ru-RU"),
          },
          {
            label: "Закупок",
            value: purchasesCount.toLocaleString("ru-RU"),
          },
          {
            label: "Закупок в пути",
            value: purchasesInTransit.toLocaleString("ru-RU"),
            tone: purchasesInTransit > 0 ? "warning" : "default",
          },
          {
            label: "Сумма закупок",
            value: formatCurrency(purchasesSum),
          },
        ]}
      />

      <section className={styles.detailsCard}>
        <div className={`${styles.sectionHeader} ${styles.detailsHeader}`}>
          <h2 className={styles.sectionTitle}>Детали поставщика</h2>
          <p className={styles.sectionMeta}>
            Поставщик зарегистрирован {formatDateTime(supplier.created_at)}
          </p>
        </div>

        <div className={styles.detailsGrid}>
          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Основная информация</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="ID" value={`#${supplier.id}`} />
              <InfoItem label="Тип" value={normalizedSupplierType} />
              <InfoItem label="Полное имя / название" value={supplierIdentity} />
              <InfoItem
                label="Краткое название"
                value={formatTextValue(supplier.краткоеНазвание || supplier.название)}
              />
              <InfoItem label="Дата регистрации" value={formatDateTime(supplier.created_at)} />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Реквизиты</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="ИНН" value={formatTextValue(supplier.инн)} />
              <InfoItem label="КПП" value={formatTextValue(supplier.кпп)} />
              <InfoItem
                label={normalizedSupplierType === "Организация" ? "ОГРН" : "ОГРНИП"}
                value={formatTextValue(supplier.огрн || supplier.огрнип)}
              />
              <InfoItem label="ОКПО" value={formatTextValue(supplier.окпо)} />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Контакты и адреса</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="Телефон" value={formatTextValue(supplier.телефон)} />
              <InfoItem label="Email" value={formatTextValue(supplier.email)} />
              <InfoItem
                label={registrationLabel}
                value={formatTextValue(supplier.адресРегистрации || supplier.адрес)}
              />
              <InfoItem
                label="Адрес для документов"
                value={formatTextValue(supplier.адресПечати || supplier.адрес)}
              />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Дополнительно</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Рейтинг</div>
                <div className={styles.infoValue}>
                  <span
                    className={styles.ratingBadge}
                    data-tone={supplier.рейтинг >= 4 ? "success" : "warning"}
                  >
                    {supplier.рейтинг} / 5
                  </span>
                </div>
              </div>

              <InfoItem label="Комментарий" value={formatTextValue(supplier.комментарий)} />

              {normalizedSupplierType === "Физическое лицо" ? (
                <InfoItem
                  label="Паспорт"
                  value={
                    [
                      supplier.паспортСерия && `серия ${supplier.паспортСерия}`,
                      supplier.паспортНомер && `номер ${supplier.паспортНомер}`,
                      supplier.паспортДатаВыдачи &&
                        `от ${formatDate(supplier.паспортДатаВыдачи)}`,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Не указан"
                  }
                />
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {supplier.bankAccounts && supplier.bankAccounts.length > 0 ? (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Расчетные счета</h2>
          </div>

          <div className={styles.accountGrid}>
            {supplier.bankAccounts.map((account, index) => (
              <section
                key={`${account.id || "bank"}-${index}`}
                className={styles.accountPanel}
              >
                <div className={styles.accountHeader}>
                  <h3 className={styles.detailPanelTitle}>{account.name || `Счет #${index + 1}`}</h3>
                  <Badge variant="outline" className={styles.accountBadge}>
                    {account.isPrimary ? "Основной" : "Дополнительный"}
                  </Badge>
                </div>
                <div className={styles.detailSeparator} />
                <div className={styles.panelRows}>
                  <InfoItem label="Банк" value={formatTextValue(account.bankName)} />
                  <InfoItem label="БИК" value={formatTextValue(account.bik)} />
                  <InfoItem
                    label="Корреспондентский счет"
                    value={formatTextValue(account.correspondentAccount)}
                  />
                  <InfoItem
                    label="Расчетный счет"
                    value={formatTextValue(account.settlementAccount)}
                  />
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

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
                    if (file) void handleUploadAttachment(file)
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

      {canShowTables ? (
        <section className={styles.card}>
          <div className={styles.tabsToolbar}>
            <div className={styles.tabsList} role="tablist" aria-label="Разделы карточки поставщика">
              {canAssortmentView ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "products"}
                  className={cn(styles.tabButton, activeTab === "products" && styles.tabButtonActive)}
                  onClick={() => setActiveTab("products")}
                >
                  Ассортимент
                  <span className={styles.tabBadge}>{productsCount}</span>
                </button>
              ) : null}

              {canPurchasesHistoryView ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "purchases"}
                  className={cn(styles.tabButton, activeTab === "purchases" && styles.tabButtonActive)}
                  onClick={() => setActiveTab("purchases")}
                >
                  История закупок
                  <span className={styles.tabBadge}>{purchasesCount}</span>
                </button>
              ) : null}
            </div>

            <DataSearchField
              wrapperClassName={styles.searchField}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>

          {activeTab === "products" && canAssortmentView ? (
            productsFiltered.length === 0 ? (
              <div className={styles.emptyState}>
                {searchQuery.trim()
                  ? "По этому запросу товаров не найдено."
                  : "В ассортименте поставщика пока нет товаров."}
              </div>
            ) : (
              <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                  <colgroup>
                    <col className={styles.colSupplierSku} />
                    <col className={styles.colSupplierName} />
                    <col className={styles.colSupplierCategory} />
                    <col className={styles.colSupplierPrice} />
                    <col className={styles.colSupplierLeadTime} />
                    {canManageAssortment ? <col className={styles.colSupplierActions} /> : null}
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Артикул</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead className={styles.textRight}>Цена</TableHead>
                      <TableHead>Срок поставки</TableHead>
                      {canManageAssortment ? <TableHead className={styles.textRight}>Действия</TableHead> : null}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productsFiltered.map((product) => (
                      <TableRow key={product.id} className={styles.tableRowStatic}>
                        <TableCell className={styles.tableCell}>
                          <span className={styles.itemTitle}>{product.товар_артикул || "—"}</span>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>{product.товар_название}</div>
                          <div className={styles.mutedText}>ID: {product.товар_id}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          {product.товар_категория || "—"}
                        </TableCell>

                        <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                          <span className={styles.itemTitle}>{formatCurrency(product.цена)}</span>
                          <span className={styles.mutedText}>
                            {" "}
                            / {product.товар_единица_измерения}
                          </span>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <EntityStatusBadge
                            value={`${product.срок_поставки} дн.`}
                            label={`${product.срок_поставки} дн.`}
                            tone={product.срок_поставки <= 3 ? "success" : "warning"}
                            compact
                          />
                        </TableCell>

                        {canManageAssortment ? (
                          <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                            <div className={styles.rowActions}>
                              <EntityActionButton
                                type="button"
                                className={styles.inlineAction}
                                onClick={() => handleEditAssortmentProduct(product)}
                                disabled={assortmentBusyProductId === product.товар_id}
                              >
                                <FiEdit2 />
                                Изменить
                              </EntityActionButton>

                              <EntityActionButton
                                type="button"
                                tone="danger"
                                className={styles.inlineAction}
                                onClick={() => setPendingAssortmentDelete(product)}
                                disabled={assortmentBusyProductId === product.товар_id}
                              >
                                <FiTrash2 />
                                Удалить
                              </EntityActionButton>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </EntityTableSurface>
            )
          ) : null}

          {activeTab === "purchases" && canPurchasesHistoryView ? (
            purchasesFiltered.length === 0 ? (
              <div className={styles.emptyState}>
                {searchQuery.trim()
                  ? "По этому запросу закупок не найдено."
                  : "История закупок пока отсутствует."}
              </div>
            ) : (
              <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
                <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                  <colgroup>
                    <col className={styles.colPurchaseId} />
                    <col className={styles.colPurchaseDate} />
                    <col className={styles.colPurchaseDate} />
                    <col className={styles.colPurchaseStatus} />
                    <col className={styles.colPurchaseSum} />
                    <col className={styles.colPurchaseOrder} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Дата заказа</TableHead>
                      <TableHead>Дата поступления</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className={styles.textRight}>Сумма</TableHead>
                      <TableHead>Заявка</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {purchasesFiltered.map((purchase) => (
                      <TableRow
                        key={purchase.id}
                        className={cn(
                          styles.tableRow,
                          canPurchasesView && styles.tableRowClickable
                        )}
                        onClick={
                          canPurchasesView
                            ? () => void router.push(`/purchases/${purchase.id}`)
                            : undefined
                        }
                      >
                        <TableCell className={styles.tableCell}>
                          <span className={styles.itemTitle}>#{purchase.id}</span>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          {formatDateTime(purchase.дата_заказа)}
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          {purchase.дата_поступления
                            ? formatDate(purchase.дата_поступления)
                            : "—"}
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <EntityStatusBadge
                            value={purchase.статус}
                            tone={getSupplierPurchaseStatusTone(purchase.статус)}
                            compact
                          />
                        </TableCell>

                        <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                          <span className={styles.itemTitle}>
                            {formatCurrency(purchase.общая_сумма)}
                          </span>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          {purchase.заявка_id ? (
                            canOrdersView ? (
                              <EntityActionButton
                                type="button"
                                className={styles.inlineAction}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void router.push(`/orders/${purchase.заявка_id}`)
                                }}
                              >
                                #{purchase.заявка_id}
                              </EntityActionButton>
                            ) : (
                              <span className={styles.mutedText}>#{purchase.заявка_id}</span>
                            )
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </EntityTableSurface>
            )
          ) : null}
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

      {canEdit ? (
        <EditSupplierModal
          isOpen={isEditSupplierOpen}
          onClose={() => setIsEditSupplierOpen(false)}
          onUpdated={async () => {
            await fetchSupplierDetail()
            setIsEditSupplierOpen(false)
          }}
          supplier={supplier as EditSupplierModalSupplier}
        />
      ) : null}

      {canShowCreatePurchase ? (
        <CreatePurchaseModal
          key={`supplier-detail-purchase-${createPurchaseModalKey}`}
          isOpen={isCreatePurchaseModalOpen}
          onClose={() => setIsCreatePurchaseModalOpen(false)}
          onPurchaseCreated={() => {
            void fetchSupplierDetail()
            setIsCreatePurchaseModalOpen(false)
          }}
          поставщик_id={supplier.id}
          поставщик_название={supplier.название}
        />
      ) : null}

      {canAddProduct || canManageAssortment ? (
        <AddProductToSupplierModal
          isOpen={isAddProductModalOpen}
          onClose={() => {
            setIsAddProductModalOpen(false)
            setEditingAssortmentProduct(null)
          }}
          onProductAdded={() => {
            void fetchSupplierDetail()
            setIsAddProductModalOpen(false)
            setEditingAssortmentProduct(null)
          }}
          поставщик_id={supplier.id}
          поставщик_название={supplier.название}
          initialProduct={editingAssortmentProduct}
        />
      ) : null}

      <DeleteConfirmation
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteSupplier}
        loading={isDeletingSupplier}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этого поставщика?"
        warning="Это действие нельзя отменить. Карточка поставщика и связанные данные будут удалены."
        details={(
          <div className={deleteConfirmationStyles.positionsSection}>
            <div className={deleteConfirmationStyles.orderTitle}>{supplier.название}</div>
            {supplier.телефон ? (
              <div className={deleteConfirmationStyles.orderMeta}>
                Телефон: {supplier.телефон}
              </div>
            ) : null}
            {supplier.email ? (
              <div className={deleteConfirmationStyles.orderMeta}>
                Email: {supplier.email}
              </div>
            ) : null}
          </div>
        )}
      />

      <DeleteConfirmation
        isOpen={Boolean(pendingAssortmentDelete)}
        onClose={() => {
          if (isDeletingAssortmentProduct) return
          setPendingAssortmentDelete(null)
        }}
        onConfirm={handleConfirmAssortmentDelete}
        loading={isDeletingAssortmentProduct}
        title="Удалить товар из ассортимента?"
        message="Позиция будет исключена из ассортимента текущего поставщика."
        warning="Удаление повлияет на доступность товара в карточке поставщика."
        details={
          pendingAssortmentDelete ? (
            <div className={deleteConfirmationStyles.positionsSection}>
              <div className={deleteConfirmationStyles.orderTitle}>
                {pendingAssortmentDelete.товар_название}
              </div>
              <div className={deleteConfirmationStyles.orderMeta}>
                Артикул: {pendingAssortmentDelete.товар_артикул || "—"}
              </div>
              <div className={deleteConfirmationStyles.orderMeta}>
                Цена: {formatCurrency(pendingAssortmentDelete.цена)}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  )
}

export default withLayout(SupplierDetailPage)
