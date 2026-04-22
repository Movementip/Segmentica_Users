import Image from "next/image"
import { useRouter } from "next/router"
import { Fragment, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiFile,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
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
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import { ShipmentEditorModal } from "@/components/modals/ShipmentEditorModal/ShipmentEditorModal"
import {
  EditTransportModalNew,
  type EditTransportModalTransportCompany,
} from "@/components/modals/EditTransportModalNew/EditTransportModalNew"
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
import { useAuth } from "@/context/AuthContext"
import { usePageTitle } from "@/context/PageTitleContext"
import { withLayout } from "@/layout"
import {
  getTransportShipmentStatusLabel,
  getTransportShipmentStatusTone,
} from "@/components/transport/utils"
import {
  calculateVatAmountsFromLine,
  DEFAULT_VAT_RATE_ID,
  getVatRateOption,
} from "@/lib/vat"
import { cn } from "@/lib/utils"

import styles from "./TransportDetail.module.css"

interface TransportCompany {
  id: number
  название: string
  телефон: string | null
  email: string | null
  тариф: number | null
  created_at: string
  общее_количество_отгрузок: number
  активные_отгрузки: number
  завершенные_отгрузки: number
  средняя_стоимость: number | null
  общая_выручка: number | null
}

interface Order {
  id: number
  клиент_название?: string
}

interface Shipment {
  id: number
  заявка_id: number
  транспорт_id: number
  статус: string
  номер_отслеживания: string | null
  дата_отгрузки: string
  стоимость_доставки: number | null
  заявка_номер: number
  клиент_название: string
  адрес_доставки: string | null
  сумма_заявки: number | null
  заявка_статус?: string
}

interface Performance {
  месяц: string
  количество_отгрузок: number
  средняя_стоимость: number
  общая_выручка: number
  успешные_доставки: number
}

interface MonthShipmentRow {
  id: number
  статус: string
  номер_отслеживания: string | null
  дата_отгрузки: string
  стоимость_доставки: number | null
  заявка_номер: number
  клиент_название: string
}

interface Product {
  id: number
  название: string
  артикул: string
  единица_измерения: string
  цена_продажи: number
}

interface WarehouseStockItem {
  товар_id: number
  количество: number
}

interface OrderPositionPreview {
  id: number
  товар_id: number
  количество: number
  цена: number
  сумма?: number
  ндс_id?: number
  ндс_название?: string
  ндс_ставка?: number
  сумма_без_ндс?: number
  сумма_ндс?: number
  сумма_всего?: number
  товар_название?: string
  товар_артикул?: string
  товар_единица_измерения?: string
}

interface ManualShipmentPosition {
  id?: number
  товар_id: number
  количество: number
  цена: number
  ндс_id: number
}

interface TransportDetailData {
  transport: TransportCompany
  shipments: Shipment[]
  performance: Performance[]
  activeShipments: Shipment[]
}

interface AttachmentItem {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

type TransportDetailTab = "active" | "history" | "months"

const createEmptyManualShipmentPosition = (): ManualShipmentPosition => ({
  товар_id: 0,
  количество: 1,
  цена: 0,
  ндс_id: DEFAULT_VAT_RATE_ID,
})

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

function TransportDetailPage(): JSX.Element {
  const router = useRouter()
  const { id } = router.query
  const transportId = Array.isArray(id) ? id[0] : id
  const { user, loading: authLoading } = useAuth()
  const { setPageTitle } = usePageTitle()

  const [data, setData] = useState<TransportDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isShipmentSubmitting, setIsShipmentSubmitting] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[]>([])
  const [selectedOrderPositions, setSelectedOrderPositions] = useState<OrderPositionPreview[]>([])
  const [selectedOrderPositionsLoading, setSelectedOrderPositionsLoading] = useState(false)
  const [manualPositions, setManualPositions] = useState<ManualShipmentPosition[]>([
    createEmptyManualShipmentPosition(),
  ])
  const [manualPositionsLoading, setManualPositionsLoading] = useState(false)
  const [shipmentFormData, setShipmentFormData] = useState({
    заявка_id: 0,
    использовать_доставку: true,
    без_учета_склада: false,
    транспорт_id: 0,
    статус: "в пути",
    номер_отслеживания: "",
    стоимость_доставки: 0,
  })

  const [activeTab, setActiveTab] = useState<TransportDetailTab>("active")
  const [search, setSearch] = useState("")
  const [expandedMonth, setExpandedMonth] = useState("")
  const [monthShipmentsLoading, setMonthShipmentsLoading] = useState(false)
  const [monthShipmentsError, setMonthShipmentsError] = useState("")
  const [monthShipments, setMonthShipments] = useState<MonthShipmentRow[]>([])

  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null)

  const canView = Boolean(user?.permissions?.includes("transport.view"))
  const canEdit = Boolean(user?.permissions?.includes("transport.edit"))
  const canDelete = Boolean(user?.permissions?.includes("transport.delete"))
  const canShipmentsCreate = Boolean(user?.permissions?.includes("shipments.create"))
  const canShipmentsEdit = Boolean(user?.permissions?.includes("shipments.edit"))
  const canOrdersView = Boolean(user?.permissions?.includes("orders.view"))
  const canOrdersList = Boolean(user?.permissions?.includes("orders.list"))
  const canShipmentOrderView = Boolean(user?.permissions?.includes("shipments.order.view"))
  const canTransportAttachmentsView = Boolean(
    user?.permissions?.includes("transport.attachments.view")
  )
  const canTransportAttachmentsUpload = Boolean(
    user?.permissions?.includes("transport.attachments.upload")
  )
  const canTransportAttachmentsDelete = Boolean(
    user?.permissions?.includes("transport.attachments.delete")
  )
  const canTransportActiveShipmentsView = Boolean(
    user?.permissions?.includes("transport.active_shipments.view")
  )
  const canTransportShipmentsHistoryView = Boolean(
    user?.permissions?.includes("transport.shipments.history.view")
  )
  const canTransportShipmentsMonthsView = Boolean(
    user?.permissions?.includes("transport.shipments.months.view")
  )

  const canCreateShipment = canShipmentsCreate && canShipmentsEdit
  const canGoToOrder = canOrdersView && canShipmentOrderView
  const canShowShipmentsTabs =
    canTransportActiveShipmentsView ||
    canTransportShipmentsHistoryView ||
    canTransportShipmentsMonthsView
  const transport = data?.transport ?? null

  const productsById = useMemo(() => {
    const map = new Map<number, Product>()
    for (const product of products) {
      map.set(product.id, product)
    }
    return map
  }, [products])

  const warehouseStockByProductId = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of warehouseStock) {
      map.set(Number(item.товар_id), Number(item.количество) || 0)
    }
    return map
  }, [warehouseStock])

  const selectedManualProductIds = useMemo(
    () =>
      new Set(
        manualPositions
          .map((position) => Number(position.товар_id) || 0)
          .filter((productId) => productId > 0)
      ),
    [manualPositions]
  )

  const availableManualProducts = useMemo(() => {
    if (shipmentFormData.без_учета_склада) return products
    return products.filter(
      (product) =>
        (warehouseStockByProductId.get(product.id) || 0) > 0 ||
        selectedManualProductIds.has(product.id)
    )
  }, [
    products,
    selectedManualProductIds,
    shipmentFormData.без_учета_склада,
    warehouseStockByProductId,
  ])

  const orderSelectOptions = useMemo(
    () => [
      { value: "", label: "Без заявки" },
      ...orders.map((order) => ({
        value: String(order.id),
        label: order.клиент_название
          ? `Заявка #${order.id} — ${order.клиент_название}`
          : `Заявка #${order.id}`,
      })),
    ],
    [orders]
  )

  const transportSelectOptions = useMemo(() => {
    if (!data?.transport) return []
    return [
      {
        value: String(data.transport.id),
        label: data.transport.название,
      },
    ]
  }, [data?.transport])

  const normalizedManualPositions = useMemo(
    () =>
      manualPositions.filter(
        (position) =>
          Number(position.товар_id) > 0 &&
          Number(position.количество) > 0 &&
          Number(position.цена) > 0
      ),
    [manualPositions]
  )

  const manualPositionsTotal = useMemo(
    () =>
      normalizedManualPositions.reduce(
        (sum, position) =>
          sum +
          calculateVatAmountsFromLine(
            position.количество,
            position.цена,
            getVatRateOption(position.ндс_id).rate
          ).total,
        0
      ),
    [normalizedManualPositions]
  )

  const shipmentDeliveryAmount = useMemo(
    () =>
      shipmentFormData.использовать_доставку
        ? Number(shipmentFormData.стоимость_доставки || 0)
        : 0,
    [shipmentFormData.использовать_доставку, shipmentFormData.стоимость_доставки]
  )

  const positionsPreviewTotal = useMemo(
    () =>
      selectedOrderPositions.reduce((sum, position) => {
        if (typeof position.сумма_всего === "number") return sum + position.сумма_всего
        return (
          sum +
          calculateVatAmountsFromLine(
            position.количество,
            position.цена,
            getVatRateOption(position.ндс_id).rate
          ).total
        )
      }, 0),
    [selectedOrderPositions]
  )

  const canSubmitShipment = useMemo(() => {
    if (isShipmentSubmitting || manualPositionsLoading) return false
    if (shipmentFormData.использовать_доставку && shipmentFormData.транспорт_id <= 0) {
      return false
    }
    if (shipmentFormData.заявка_id > 0) return true
    return normalizedManualPositions.length > 0
  }, [
    isShipmentSubmitting,
    manualPositionsLoading,
    normalizedManualPositions.length,
    shipmentFormData.использовать_доставку,
    shipmentFormData.заявка_id,
    shipmentFormData.транспорт_id,
  ])

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

  const formatMonthLabel = useCallback((dateString?: string | null) => {
    if (!dateString) return "Не указан"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "Не указан"

    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
    })
  }, [])

  const formatCurrency = useCallback((amount: number | null | undefined) => {
    if (amount == null) return "Не указано"

    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount)
  }, [])

  const formatBytes = useCallback((bytes: number) => {
    const value = Number(bytes) || 0
    if (value < 1024) return `${value} B`
    const kilobytes = value / 1024
    if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
    const megabytes = kilobytes / 1024
    if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`
    const gigabytes = megabytes / 1024
    return `${gigabytes.toFixed(1)} GB`
  }, [])

  const fetchAttachments = useCallback(
    async (entityId: number) => {
      if (!canTransportAttachmentsView) return

      try {
        setAttachmentsLoading(true)
        setAttachmentsError(null)

        const response = await fetch(
          `/api/attachments?entity_type=transport&entity_id=${encodeURIComponent(String(entityId))}`
        )

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result?.error || "Ошибка загрузки вложений")
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
    },
    [canTransportAttachmentsView]
  )

  const fetchData = useCallback(async () => {
    if (!transportId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/transport/${transportId}`)
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result?.error || "Не удалось загрузить карточку транспортной компании")
      }

      const result = (await response.json()) as TransportDetailData
      setData(result)

      if (canTransportAttachmentsView && result?.transport?.id) {
        await fetchAttachments(Number(result.transport.id))
      } else {
        setAttachments([])
      }
    } catch (fetchError) {
      console.error(fetchError)
      setData(null)
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить карточку транспортной компании"
      )
    } finally {
      setLoading(false)
    }
  }, [canTransportAttachmentsView, fetchAttachments, transportId])

  const canPreviewInline = useCallback((attachment: AttachmentItem) => {
    const mime = (attachment.mime_type || "").toLowerCase()
    const name = (attachment.filename || "").toLowerCase()

    if (mime.includes("pdf") || name.endsWith(".pdf")) return true
    if (mime.startsWith("image/")) return true
    return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name)
  }, [])

  const openPreview = useCallback(
    (attachment: AttachmentItem) => {
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
    },
    [canPreviewInline]
  )

  const handleUploadAttachment = useCallback(
    async (file: File) => {
      if (!canTransportAttachmentsUpload) return

      const entityId = Number(data?.transport?.id)
      if (!Number.isInteger(entityId) || entityId <= 0) return

      try {
        setAttachmentsUploading(true)
        setAttachmentsError(null)

        const form = new FormData()
        form.append("file", file)
        form.append("entity_type", "transport")
        form.append("entity_id", String(entityId))

        const response = await fetch("/api/attachments", {
          method: "POST",
          body: form,
        })

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result?.error || "Ошибка загрузки файла")
        }

        await fetchAttachments(entityId)
      } catch (uploadError) {
        console.error(uploadError)
        setAttachmentsError(
          uploadError instanceof Error ? uploadError.message : "Ошибка загрузки файла"
        )
      } finally {
        setAttachmentsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [canTransportAttachmentsUpload, data?.transport?.id, fetchAttachments]
  )

  const handleDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (!canTransportAttachmentsDelete) return

      const entityId = Number(data?.transport?.id)
      if (!Number.isInteger(entityId) || entityId <= 0) return

      try {
        setAttachmentsError(null)

        const response = await fetch(
          `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=transport&entity_id=${encodeURIComponent(String(entityId))}`,
          {
            method: "DELETE",
          }
        )

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result?.error || "Ошибка удаления вложения")
        }

        await fetchAttachments(entityId)
      } catch (deleteError) {
        console.error(deleteError)
        setAttachmentsError(
          deleteError instanceof Error ? deleteError.message : "Ошибка удаления вложения"
        )
      }
    },
    [canTransportAttachmentsDelete, data?.transport?.id, fetchAttachments]
  )

  const loadMonthShipments = useCallback(
    async (companyId: number, month: string) => {
      if (!canTransportShipmentsMonthsView) return

      try {
        setMonthShipmentsLoading(true)
        setMonthShipmentsError("")

        const response = await fetch(
          `/api/transport/stats-month?companyId=${encodeURIComponent(String(companyId))}&month=${encodeURIComponent(month)}`
        )

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result?.error || "Не удалось загрузить отгрузки за месяц")
        }

        const result = (await response.json()) as { shipments: MonthShipmentRow[] }
        setMonthShipments(Array.isArray(result.shipments) ? result.shipments : [])
      } catch (fetchError) {
        setMonthShipments([])
        setMonthShipmentsError(
          fetchError instanceof Error
            ? fetchError.message
            : "Не удалось загрузить отгрузки за месяц"
        )
      } finally {
        setMonthShipmentsLoading(false)
      }
    },
    [canTransportShipmentsMonthsView]
  )

  const handleDeleteTransport = useCallback(async () => {
    if (!transportId || !canDelete) return

    try {
      setDeleteLoading(true)

      const response = await fetch(`/api/transport?id=${encodeURIComponent(String(transportId))}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result?.error || "Ошибка удаления транспортной компании")
      }

      setIsDeleteConfirmOpen(false)
      await router.push("/transport")
    } catch (deleteError) {
      console.error(deleteError)
      window.alert(
        `Ошибка удаления компании: ${
          deleteError instanceof Error ? deleteError.message : "Неизвестная ошибка"
        }`
      )
    } finally {
      setDeleteLoading(false)
    }
  }, [canDelete, router, transportId])

  const resetShipmentEditor = useCallback(() => {
    setShipmentFormData({
      заявка_id: 0,
      использовать_доставку: true,
      без_учета_склада: false,
      транспорт_id: Number(data?.transport?.id) || 0,
      статус: "в пути",
      номер_отслеживания: "",
      стоимость_доставки: 0,
    })
    setSelectedOrderPositions([])
    setSelectedOrderPositionsLoading(false)
    setManualPositions([createEmptyManualShipmentPosition()])
    setManualPositionsLoading(false)
  }, [data?.transport?.id])

  const handleManualPositionChange = useCallback(
    (index: number, field: keyof ManualShipmentPosition, value: string | number) => {
      setManualPositions((previous) => {
        const next = [...previous]
        const parsedValue = typeof value === "string" ? Number(value) || 0 : value
        next[index] = {
          ...next[index],
          [field]: parsedValue,
        }

        if (field === "товар_id") {
          const product = productsById.get(Number(parsedValue))
          const price = Number(product?.цена_продажи ?? 0)
          if (price > 0) {
            next[index].цена = price
          }
          if (!next[index].ндс_id) {
            next[index].ндс_id = DEFAULT_VAT_RATE_ID
          }
        }

        return next
      })
    },
    [productsById]
  )

  const addManualPosition = useCallback(() => {
    setManualPositions((previous) => [...previous, createEmptyManualShipmentPosition()])
  }, [])

  const removeManualPosition = useCallback((index: number) => {
    setManualPositions((previous) =>
      previous.length > 1
        ? previous.filter((_, currentIndex) => currentIndex !== index)
        : previous
    )
  }, [])

  const fetchShipmentDraftPreview = useCallback(
    async (orderId: number) => {
      if (!orderId || !canOrdersView) {
        setSelectedOrderPositions([])
        return
      }

      try {
        setSelectedOrderPositionsLoading(true)
        const response = await fetch(
          `/api/orders/${encodeURIComponent(String(orderId))}/shipment-draft`
        )
        if (!response.ok) {
          setSelectedOrderPositions([])
          return
        }

        const result = await response.json()
        setSelectedOrderPositions(Array.isArray(result) ? result : [])
      } catch (previewError) {
        console.error("Error loading transport shipment draft preview:", previewError)
        setSelectedOrderPositions([])
      } finally {
        setSelectedOrderPositionsLoading(false)
      }
    },
    [canOrdersView]
  )

  const fetchOrdersForShipment = useCallback(async () => {
    if (!canOrdersList) return

    try {
      const response = await fetch("/api/orders")
      if (!response.ok) {
        throw new Error("Ошибка загрузки заявок")
      }

      const result = await response.json()
      setOrders(Array.isArray(result) ? result : [])
    } catch (ordersError) {
      console.error("Error fetching orders for transport shipment modal:", ordersError)
      setOrders([])
    }
  }, [canOrdersList])

  const fetchProductsForShipment = useCallback(async () => {
    try {
      const response = await fetch("/api/products")
      if (!response.ok) {
        throw new Error("Ошибка загрузки товаров")
      }

      const result = await response.json()
      setProducts(Array.isArray(result) ? result : [])
    } catch (productsError) {
      console.error("Error fetching products for transport shipment modal:", productsError)
      setProducts([])
    }
  }, [])

  const fetchWarehouseStockForShipment = useCallback(async () => {
    try {
      const response = await fetch("/api/warehouse")
      if (!response.ok) {
        throw new Error("Ошибка загрузки остатков склада")
      }

      const result = await response.json()
      setWarehouseStock(Array.isArray(result?.warehouse) ? result.warehouse : [])
    } catch (warehouseError) {
      console.error(
        "Error fetching warehouse stock for transport shipment modal:",
        warehouseError
      )
      setWarehouseStock([])
    }
  }, [])

  const handleSubmitShipment = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!canCreateShipment || !transport) return

      if (shipmentFormData.использовать_доставку && shipmentFormData.транспорт_id <= 0) {
        window.alert("Пожалуйста, выберите транспортную компанию")
        return
      }

      if (!shipmentFormData.заявка_id && normalizedManualPositions.length === 0) {
        window.alert("Для самостоятельной отгрузки добавьте хотя бы одну позицию")
        return
      }

      try {
        setIsShipmentSubmitting(true)

        if (!shipmentFormData.заявка_id && !shipmentFormData.без_учета_склада) {
          const hasUnavailableProduct = normalizedManualPositions.some(
            (position) =>
              (warehouseStockByProductId.get(Number(position.товар_id)) || 0) <= 0
          )
          if (hasUnavailableProduct) {
            throw new Error(
              "Для отгрузки со склада выберите только товары, которые есть в наличии"
            )
          }
        }

        const payload = {
          заявка_id: shipmentFormData.заявка_id > 0 ? Number(shipmentFormData.заявка_id) : null,
          использовать_доставку: shipmentFormData.использовать_доставку,
          без_учета_склада:
            shipmentFormData.заявка_id > 0 ? false : shipmentFormData.без_учета_склада,
          транспорт_id: shipmentFormData.использовать_доставку ? transport.id : null,
          статус: shipmentFormData.статус,
          номер_отслеживания:
            shipmentFormData.использовать_доставку &&
            shipmentFormData.номер_отслеживания.trim()
              ? shipmentFormData.номер_отслеживания.trim()
              : null,
          стоимость_доставки:
            shipmentFormData.использовать_доставку && shipmentFormData.стоимость_доставки
              ? Number(shipmentFormData.стоимость_доставки)
              : null,
          позиции: shipmentFormData.заявка_id > 0 ? undefined : normalizedManualPositions,
        }

        const response = await fetch("/api/shipments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.error || "Ошибка создания отгрузки")
        }

        setIsCreateShipmentModalOpen(false)
        resetShipmentEditor()
        await fetchData()
      } catch (shipmentError) {
        window.alert(
          shipmentError instanceof Error
            ? shipmentError.message
            : "Не удалось создать отгрузку"
        )
      } finally {
        setIsShipmentSubmitting(false)
      }
    },
    [
      canCreateShipment,
      fetchData,
      normalizedManualPositions,
      resetShipmentEditor,
      shipmentFormData,
      transport,
      warehouseStockByProductId,
    ]
  )

  const handleOpenCreateShipmentModal = useCallback(() => {
    if (!transport) return
    resetShipmentEditor()
    setShipmentFormData((previous) => ({
      ...previous,
      транспорт_id: Number(transport.id) || 0,
    }))
    setIsCreateShipmentModalOpen(true)
  }, [resetShipmentEditor, transport])

  const handleOpenShipmentOrder = useCallback(() => {
    if (!shipmentFormData.заявка_id) return
    void router.push(`/orders/${encodeURIComponent(String(shipmentFormData.заявка_id))}`)
  }, [router, shipmentFormData.заявка_id])

  useEffect(() => {
    if (authLoading) return
    if (!canView) return
    if (!transportId) return

    void fetchData()
  }, [authLoading, canView, fetchData, transportId])

  useEffect(() => {
    if (!canTransportActiveShipmentsView && canTransportShipmentsHistoryView) {
      setActiveTab("history")
      return
    }

    if (!canTransportActiveShipmentsView && !canTransportShipmentsHistoryView && canTransportShipmentsMonthsView) {
      setActiveTab("months")
      return
    }

    if (canTransportActiveShipmentsView) {
      setActiveTab("active")
    }
  }, [
    canTransportActiveShipmentsView,
    canTransportShipmentsHistoryView,
    canTransportShipmentsMonthsView,
  ])

  useEffect(() => {
    const title = data?.transport?.название
      ? `${data.transport.название} — Транспортные компании`
      : "Транспортные компании"

    setPageTitle(title)
    return () => setPageTitle("Транспортные компании")
  }, [data?.transport?.название, setPageTitle])

  useEffect(() => {
    if (!isCreateShipmentModalOpen) {
      setSelectedOrderPositions([])
      setSelectedOrderPositionsLoading(false)
      return
    }

    void fetchProductsForShipment()
    void fetchWarehouseStockForShipment()
    void fetchOrdersForShipment()
  }, [
    fetchOrdersForShipment,
    fetchProductsForShipment,
    fetchWarehouseStockForShipment,
    isCreateShipmentModalOpen,
  ])

  useEffect(() => {
    if (!isCreateShipmentModalOpen) return
    if (!shipmentFormData.заявка_id) {
      setSelectedOrderPositions([])
      return
    }

    void fetchShipmentDraftPreview(shipmentFormData.заявка_id)
  }, [fetchShipmentDraftPreview, isCreateShipmentModalOpen, shipmentFormData.заявка_id])

  const summary = useMemo(() => {
    const totalShipments = Number(transport?.общее_количество_отгрузок) || 0
    const completedShipments = Number(transport?.завершенные_отгрузки) || 0
    const successRate = totalShipments
      ? Math.round((completedShipments / totalShipments) * 100)
      : 0

    return {
      completedShipments,
      successRate,
      totalShipments,
    }
  }, [transport?.завершенные_отгрузки, transport?.общее_количество_отгрузок])

  const shipments = useMemo(() => data?.shipments ?? [], [data])
  const performance = useMemo(() => data?.performance ?? [], [data])
  const activeShipments = useMemo(() => data?.activeShipments ?? [], [data])

  const filteredActiveShipments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return activeShipments

    return activeShipments.filter((shipment) => {
      return (
        String(shipment.id).includes(query) ||
        String(shipment.номер_отслеживания || "").toLowerCase().includes(query) ||
        String(shipment.заявка_номер || "").includes(query) ||
        String(shipment.клиент_название || "").toLowerCase().includes(query) ||
        String(shipment.адрес_доставки || "").toLowerCase().includes(query) ||
        String(shipment.статус || "").toLowerCase().includes(query) ||
        String(shipment.заявка_статус || "").toLowerCase().includes(query)
      )
    })
  }, [activeShipments, search])

  const filteredShipments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return shipments

    return shipments.filter((shipment) => {
      return (
        String(shipment.id).includes(query) ||
        String(shipment.номер_отслеживания || "").toLowerCase().includes(query) ||
        String(shipment.заявка_номер || "").includes(query) ||
        String(shipment.клиент_название || "").toLowerCase().includes(query) ||
        String(shipment.адрес_доставки || "").toLowerCase().includes(query) ||
        String(shipment.статус || "").toLowerCase().includes(query) ||
        String(shipment.заявка_статус || "").toLowerCase().includes(query)
      )
    })
  }, [search, shipments])

  const filteredPerformance = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return performance

    return performance.filter((row) =>
      formatMonthLabel(row.месяц).toLowerCase().includes(query)
    )
  }, [formatMonthLabel, performance, search])

  const transportPrintDocuments = useMemo<RecordPrintDocument[]>(() => {
    if (!transport) return []

    const documents: RecordPrintDocument[] = [
      {
        key: "transport-card",
        title: "Карточка транспортной компании",
        fileName: `Карточка транспортной компании № ${transport.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Карточка ТК #${transport.id}`}
            subtitle={transport.название}
            meta={
              <>
                <div>Активных отгрузок: {transport.активные_отгрузки || 0}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            }
            sections={[
              {
                title: "Основная информация",
                fields: [
                  { label: "ID", value: `#${transport.id}` },
                  { label: "Название", value: transport.название || "—" },
                  { label: "Телефон", value: transport.телефон || "—" },
                  { label: "Email", value: transport.email || "—" },
                  { label: "Тариф", value: formatCurrency(transport.тариф) },
                  { label: "Дата регистрации", value: formatDate(transport.created_at) },
                ],
              },
              {
                title: "Показатели",
                fields: [
                  {
                    label: "Всего отгрузок",
                    value: transport.общее_количество_отгрузок || 0,
                  },
                  { label: "Активные отгрузки", value: transport.активные_отгрузки || 0 },
                  { label: "Завершенные отгрузки", value: transport.завершенные_отгрузки || 0 },
                  { label: "Выручка", value: formatCurrency(transport.общая_выручка) },
                  {
                    label: "Средняя стоимость",
                    value: formatCurrency(transport.средняя_стоимость),
                  },
                  { label: "Успешность", value: `${summary.successRate}%` },
                ],
              },
            ]}
          />
        ),
      },
    ]

    if (filteredShipments.length) {
      documents.push({
        key: "transport-shipments",
        title: "История отгрузок",
        fileName: `История отгрузок транспортной компании № ${transport.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`История отгрузок ТК #${transport.id}`}
            subtitle={transport.название}
            meta={
              <>
                <div>Отгрузок: {filteredShipments.length}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            }
            sections={[
              {
                title: "Отгрузки",
                table: {
                  columns: ["№ отгрузки", "Дата", "Клиент", "Статус", "Трекинг", "Стоимость"],
                  rows: filteredShipments.map((shipment) => [
                    `#${shipment.id}`,
                    formatDateTime(shipment.дата_отгрузки),
                    shipment.клиент_название || "—",
                    getTransportShipmentStatusLabel(shipment.статус),
                    shipment.номер_отслеживания || "—",
                    formatCurrency(shipment.стоимость_доставки),
                  ]),
                },
              },
            ]}
          />
        ),
      })
    }

    if (performance.length) {
      documents.push({
        key: "transport-performance",
        title: "Помесячная эффективность",
        fileName: `Помесячная эффективность транспортной компании № ${transport.id} от ${new Date().toLocaleDateString("ru-RU")}`,
        content: (
          <RecordPrintSheet
            title={`Помесячная эффективность ТК #${transport.id}`}
            subtitle={transport.название}
            meta={
              <>
                <div>Месяцев: {performance.length}</div>
                <div>Печать: {new Date().toLocaleString("ru-RU")}</div>
              </>
            }
            sections={[
              {
                title: "Показатели по месяцам",
                table: {
                  columns: [
                    "Месяц",
                    "Отгрузок",
                    "Средняя стоимость",
                    "Выручка",
                    "Успешные доставки",
                  ],
                  rows: performance.map((row) => [
                    formatMonthLabel(row.месяц),
                    row.количество_отгрузок || 0,
                    formatCurrency(row.средняя_стоимость),
                    formatCurrency(row.общая_выручка),
                    row.успешные_доставки || 0,
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
    filteredShipments,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatMonthLabel,
    performance,
    summary.successRate,
    transport,
  ])

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canView) {
    return <NoAccessPage />
  }

  if (loading) {
    return <PageLoader label="Загрузка транспортной компании..." fullPage />
  }

  if (!transport) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Транспортная компания не найдена</h1>
          <p className={styles.errorText}>
            {error || "Не удалось загрузить карточку транспортной компании"}
          </p>
          <EntityActionButton type="button" onClick={() => void router.push("/transport")}>
            Вернуться к списку ТК
          </EntityActionButton>
        </div>
      </div>
    )
  }

  const renderShipmentRows = (rows: Shipment[] | MonthShipmentRow[]) =>
    rows.length ? (
      rows.map((shipment) => (
        <TableRow
          key={shipment.id}
          className={styles.clickableRow}
          onClick={() => void router.push(`/shipments/${encodeURIComponent(String(shipment.id))}`)}
        >
          <TableCell className={styles.tableCell}>
            <div className={styles.itemTitle}>#{shipment.id}</div>
          </TableCell>

          <TableCell className={styles.tableCell}>
            <div className={styles.itemTitle}>#{shipment.номер_отслеживания || shipment.id}</div>
            {"заявка_номер" in shipment && shipment.заявка_номер ? (
              <div className={styles.itemSub}>Заявка #{shipment.заявка_номер}</div>
            ) : null}
          </TableCell>

          <TableCell className={styles.tableCell}>
            <div className={styles.itemTitle}>{shipment.клиент_название || "Не указан"}</div>
          </TableCell>

          <TableCell className={styles.tableCell}>
            <EntityStatusBadge
              value={shipment.статус}
              label={getTransportShipmentStatusLabel(shipment.статус)}
              tone={getTransportShipmentStatusTone(shipment.статус)}
              compact
            />
          </TableCell>

          <TableCell className={styles.tableCell}>
            <div className={styles.itemTitle}>{formatDateTime(shipment.дата_отгрузки)}</div>
          </TableCell>

          <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
            <span className={styles.moneyValue}>
              {formatCurrency(shipment.стоимость_доставки)}
            </span>
          </TableCell>
        </TableRow>
      ))
    ) : (
      <TableRow>
        <TableCell className={styles.tableCell} colSpan={6}>
          <span className={styles.mutedText}>Нет отгрузок</span>
        </TableCell>
      </TableRow>
    )

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{transport.название}</h1>
            <p className={styles.subtitle}>
              Карточка транспортной компании, документы и история отгрузок
            </p>
          </div>

          <div className={styles.headerActions}>
            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => void router.push("/transport")}
            >
              <FiArrowLeft />
              Назад
            </EntityActionButton>

            <RecordDocumentCenter
              documents={transportPrintDocuments}
              buttonClassName={styles.actionButton}
              saveTarget={
                canTransportAttachmentsUpload
                  ? { entityType: "transport", entityId: transport.id }
                  : undefined
              }
              onSaved={() => void fetchAttachments(Number(transport.id))}
            />

            <EntityActionButton
              type="button"
              className={styles.actionButton}
              onClick={() => void fetchData()}
            >
              <FiRefreshCw />
              Обновить
            </EntityActionButton>

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

            {canCreateShipment ? (
              <EntityActionButton
                type="button"
                className={styles.actionButton}
                onClick={handleOpenCreateShipmentModal}
              >
                <FiPlus />
                Создать отгрузку
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
        title="Статистика транспортной компании"
        className={styles.statsPanel}
        items={[
          {
            label: "Всего отгрузок",
            value: summary.totalShipments.toLocaleString("ru-RU"),
          },
          {
            label: "Активные",
            value: Number(transport.активные_отгрузки || 0).toLocaleString("ru-RU"),
            tone: Number(transport.активные_отгрузки || 0) > 0 ? "warning" : "default",
          },
          {
            label: "Успешность",
            value: `${summary.successRate}%`,
          },
          {
            label: "Выручка",
            value: formatCurrency(transport.общая_выручка),
          },
        ]}
      />

      <section className={styles.detailsCard}>
        <div className={`${styles.sectionHeader} ${styles.detailsHeader}`}>
          <h2 className={styles.sectionTitle}>Детали транспортной компании</h2>
          <p className={styles.sectionMeta}>
            Компания зарегистрирована {formatDateTime(transport.created_at)}
          </p>
        </div>

        <div className={styles.detailsGrid}>
          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Основная информация</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="ID" value={`#${transport.id}`} />
              <InfoItem label="Название" value={formatTextValue(transport.название)} />
              <InfoItem
                label="Дата регистрации"
                value={formatDateTime(transport.created_at)}
              />
              <InfoItem label="Тариф" value={formatCurrency(transport.тариф)} />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h3 className={styles.detailPanelTitle}>Контакты и показатели</h3>
            <div className={styles.detailSeparator} />
            <div className={styles.panelRows}>
              <InfoItem label="Телефон" value={formatTextValue(transport.телефон)} />
              <InfoItem label="Email" value={formatTextValue(transport.email)} />
              <InfoItem
                label="Завершенные отгрузки"
                value={summary.completedShipments.toLocaleString("ru-RU")}
              />
              <InfoItem
                label="Средняя стоимость"
                value={formatCurrency(transport.средняя_стоимость)}
              />
            </div>
          </section>
        </div>
      </section>

      {canTransportAttachmentsView ? (
        <section className={styles.card}>
          <div className={styles.sectionHeaderWithActions}>
            <h2 className={styles.sectionTitle}>Документы</h2>

            {canTransportAttachmentsUpload ? (
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

                          {canTransportAttachmentsDelete ? (
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

      {canShowShipmentsTabs ? (
        <section className={styles.card}>
          <div className={styles.tabsToolbar}>
            <div className={styles.tabsList} role="tablist" aria-label="Разделы транспортной компании">
              {canTransportActiveShipmentsView ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "active"}
                  className={cn(styles.tabButton, activeTab === "active" && styles.tabButtonActive)}
                  onClick={() => setActiveTab("active")}
                >
                  Активные
                  {activeShipments.length > 0 ? (
                    <span className={styles.tabBadge}>{activeShipments.length}</span>
                  ) : null}
                </button>
              ) : null}

              {canTransportShipmentsHistoryView ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "history"}
                  className={cn(styles.tabButton, activeTab === "history" && styles.tabButtonActive)}
                  onClick={() => setActiveTab("history")}
                >
                  История
                  {shipments.length > 0 ? (
                    <span className={styles.tabBadge}>{shipments.length}</span>
                  ) : null}
                </button>
              ) : null}

              {canTransportShipmentsMonthsView ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "months"}
                  className={cn(styles.tabButton, activeTab === "months" && styles.tabButtonActive)}
                  onClick={() => setActiveTab("months")}
                >
                  По месяцам
                  {performance.length > 0 ? (
                    <span className={styles.tabBadge}>{performance.length}</span>
                  ) : null}
                </button>
              ) : null}
            </div>

            <DataSearchField
              value={search}
              onValueChange={setSearch}
              placeholder="Поиск по ID, клиенту, трекингу..."
              wrapperClassName={styles.searchField}
            />
          </div>

          {activeTab === "active" && canTransportActiveShipmentsView ? (
            <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
              <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                <colgroup>
                  <col className={styles.colTransportId} />
                  <col className={styles.colTransportShipment} />
                  <col className={styles.colTransportClient} />
                  <col className={styles.colTransportAddress} />
                  <col className={styles.colTransportStatus} />
                  <col className={styles.colTransportDate} />
                  <col className={styles.colTransportCost} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Отгрузка</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className={styles.textRight}>Стоимость</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredActiveShipments.length ? (
                    filteredActiveShipments.map((shipment) => (
                      <TableRow
                        key={shipment.id}
                        className={styles.clickableRow}
                        onClick={() =>
                          void router.push(`/shipments/${encodeURIComponent(String(shipment.id))}`)
                        }
                      >
                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>#{shipment.id}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>
                            #{shipment.номер_отслеживания || shipment.id}
                          </div>
                          <div className={styles.itemSub}>Заявка #{shipment.заявка_номер}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>{shipment.клиент_название}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>
                            {shipment.адрес_доставки || "Не указан"}
                          </div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <EntityStatusBadge
                            value={shipment.статус}
                            label={getTransportShipmentStatusLabel(shipment.статус)}
                            tone={getTransportShipmentStatusTone(shipment.статус)}
                            compact
                          />
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>
                            {formatDateTime(shipment.дата_отгрузки)}
                          </div>
                        </TableCell>

                        <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                          <span className={styles.moneyValue}>
                            {formatCurrency(shipment.стоимость_доставки)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className={styles.tableCell} colSpan={7}>
                        <span className={styles.mutedText}>Нет активных отгрузок</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </EntityTableSurface>
          ) : null}

          {activeTab === "history" && canTransportShipmentsHistoryView ? (
            <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
              <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                <colgroup>
                  <col className={styles.colTransportId} />
                  <col className={styles.colTransportShipment} />
                  <col className={styles.colTransportClient} />
                  <col className={styles.colTransportAddress} />
                  <col className={styles.colTransportStatus} />
                  <col className={styles.colTransportDate} />
                  <col className={styles.colTransportCost} />
                  <col className={styles.colTransportOrderSum} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Отгрузка</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className={styles.textRight}>Стоимость</TableHead>
                    <TableHead className={styles.textRight}>Сумма заявки</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredShipments.length ? (
                    filteredShipments.map((shipment) => (
                      <TableRow
                        key={shipment.id}
                        className={styles.clickableRow}
                        onClick={() =>
                          void router.push(`/shipments/${encodeURIComponent(String(shipment.id))}`)
                        }
                      >
                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>#{shipment.id}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>
                            #{shipment.номер_отслеживания || shipment.id}
                          </div>
                          <div className={styles.itemSub}>Заявка #{shipment.заявка_номер}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>{shipment.клиент_название}</div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>
                            {shipment.адрес_доставки || "Не указан"}
                          </div>
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <EntityStatusBadge
                            value={shipment.статус}
                            label={getTransportShipmentStatusLabel(shipment.статус)}
                            tone={getTransportShipmentStatusTone(shipment.статус)}
                            compact
                          />
                        </TableCell>

                        <TableCell className={styles.tableCell}>
                          <div className={styles.itemTitle}>
                            {formatDateTime(shipment.дата_отгрузки)}
                          </div>
                        </TableCell>

                        <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                          <span className={styles.moneyValue}>
                            {formatCurrency(shipment.стоимость_доставки)}
                          </span>
                        </TableCell>

                        <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                          <span className={styles.moneyValue}>
                            {formatCurrency(shipment.сумма_заявки)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className={styles.tableCell} colSpan={8}>
                        <span className={styles.mutedText}>Нет отгрузок</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </EntityTableSurface>
          ) : null}

          {activeTab === "months" && canTransportShipmentsMonthsView ? (
            <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
              <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                <colgroup>
                  <col className={styles.colTransportMonth} />
                  <col className={styles.colTransportMetricSm} />
                  <col className={styles.colTransportMetricSm} />
                  <col className={styles.colTransportMetricMd} />
                  <col className={styles.colTransportMetricLg} />
                  <col className={styles.colTransportMetricLg} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead className={styles.textRight}>Отгрузок</TableHead>
                    <TableHead className={styles.textRight}>Успешные</TableHead>
                    <TableHead className={styles.textRight}>Успешность</TableHead>
                    <TableHead className={styles.textRight}>Средняя</TableHead>
                    <TableHead className={styles.textRight}>Выручка</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredPerformance.length ? (
                    filteredPerformance.map((row) => {
                      const successRate = row.количество_отгрузок
                        ? Math.round((row.успешные_доставки / row.количество_отгрузок) * 100)
                        : 0
                      const isExpanded = expandedMonth === row.месяц

                      return (
                        <Fragment key={row.месяц}>
                          <TableRow
                            className={styles.clickableRow}
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedMonth("")
                                setMonthShipments([])
                                setMonthShipmentsError("")
                                return
                              }

                              setExpandedMonth(row.месяц)
                              setMonthShipments([])
                              setMonthShipmentsError("")
                              void loadMonthShipments(transport.id, row.месяц)
                            }}
                          >
                            <TableCell className={styles.tableCell}>
                              <div className={styles.itemTitle}>{formatMonthLabel(row.месяц)}</div>
                              <div className={styles.itemSub}>
                                {isExpanded ? "Нажмите, чтобы свернуть" : "Нажмите, чтобы раскрыть"}
                              </div>
                            </TableCell>

                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                              <span className={styles.metricValue}>
                                {row.количество_отгрузок.toLocaleString("ru-RU")}
                              </span>
                            </TableCell>

                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                              <span className={styles.metricValue}>
                                {row.успешные_доставки.toLocaleString("ru-RU")}
                              </span>
                            </TableCell>

                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                              <span className={styles.metricValue}>{successRate}%</span>
                            </TableCell>

                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                              <span className={styles.moneyValue}>
                                {formatCurrency(row.средняя_стоимость)}
                              </span>
                            </TableCell>

                            <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                              <span className={styles.moneyValue}>
                                {formatCurrency(row.общая_выручка)}
                              </span>
                            </TableCell>
                          </TableRow>

                          {isExpanded ? (
                            <TableRow>
                              <TableCell className={styles.monthDetailsCell} colSpan={6}>
                                <div className={styles.monthDetailsInner}>
                                  {monthShipmentsLoading ? (
                                    <div className={styles.emptyState}>Загрузка отгрузок...</div>
                                  ) : monthShipmentsError ? (
                                    <div className={styles.inlineError}>{monthShipmentsError}</div>
                                  ) : monthShipments.length === 0 ? (
                                    <div className={styles.emptyState}>Нет отгрузок за этот месяц</div>
                                  ) : (
                                    <EntityTableSurface
                                      variant="embedded"
                                      clip="bottom"
                                      className={styles.nestedTableSurface}
                                    >
                                      <Table className={`${entityTableClassName} ${styles.tableFixed}`}>
                                        <colgroup>
                                          <col className={styles.colTransportId} />
                                          <col className={styles.colTransportShipment} />
                                          <col className={styles.colTransportClient} />
                                          <col className={styles.colTransportStatus} />
                                          <col className={styles.colTransportDate} />
                                          <col className={styles.colTransportCost} />
                                        </colgroup>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Отгрузка</TableHead>
                                            <TableHead>Клиент</TableHead>
                                            <TableHead>Статус</TableHead>
                                            <TableHead>Дата</TableHead>
                                            <TableHead className={styles.textRight}>
                                              Стоимость
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>

                                        <TableBody>{renderShipmentRows(monthShipments)}</TableBody>
                                      </Table>
                                    </EntityTableSurface>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell className={styles.tableCell} colSpan={6}>
                        <span className={styles.mutedText}>Нет данных по месяцам</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </EntityTableSurface>
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

      <DeleteConfirmation
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteTransport()}
        loading={deleteLoading}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить транспортную компанию?"
        warning="Это действие нельзя отменить. Все данные транспортной компании и связанные отгрузки будут удалены."
        details={(
          <div className={styles.deleteDetails}>
            <div className={styles.deleteDetailsTitle}>{transport.название}</div>
            <div className={styles.deleteDetailsMeta}>
              Отгрузок: {summary.totalShipments.toLocaleString("ru-RU")}
            </div>
          </div>
        )}
      />

      {canEdit ? (
        <EditTransportModalNew
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={() => {
            void fetchData()
            setIsEditModalOpen(false)
          }}
          company={transport as EditTransportModalTransportCompany}
        />
      ) : null}

      {canCreateShipment ? (
        <ShipmentEditorModal
          isOpen={isCreateShipmentModalOpen}
          onClose={() => {
            setIsCreateShipmentModalOpen(false)
            resetShipmentEditor()
          }}
          availableManualProducts={availableManualProducts}
          canGoToOrder={canGoToOrder}
          canSubmit={canSubmitShipment}
          editingId={null}
          formData={shipmentFormData}
          isSubmitting={isShipmentSubmitting}
          manualPositions={manualPositions}
          manualPositionsLoading={manualPositionsLoading}
          manualPositionsTotal={manualPositionsTotal}
          onAddManualPosition={addManualPosition}
          onManualPositionChange={handleManualPositionChange}
          onOpenOrder={handleOpenShipmentOrder}
          onRemoveManualPosition={removeManualPosition}
          onSubmit={handleSubmitShipment}
          orderSelectOptions={orderSelectOptions}
          positionsPreviewTotal={positionsPreviewTotal}
          productsById={productsById}
          selectedOrderPositions={selectedOrderPositions}
          selectedOrderPositionsLoading={selectedOrderPositionsLoading}
          setFormData={setShipmentFormData}
          shipmentDeliveryAmount={shipmentDeliveryAmount}
          transportSelectOptions={transportSelectOptions}
          warehouseStockByProductId={warehouseStockByProductId}
        />
      ) : null}
    </div>
  )
}

export default withLayout(TransportDetailPage)
