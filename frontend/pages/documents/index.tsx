import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiDownload,
  FiExternalLink,
  FiFilter,
  FiLink2,
  FiMoreHorizontal,
  FiPaperclip,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi"

import {
  DataFilterActionButton,
  DataFilterField,
  DataFiltersPanel,
  DataFiltersPanelActions,
} from "@/components/DataFiltersPanel/DataFiltersPanel"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import {
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import { EntityIndexPageSkeleton } from "@/components/EntityIndexPageSkeleton/EntityIndexPageSkeleton"
import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"
import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/context/AuthContext"
import { Layout } from "@/layout/Layout"
import { cn } from "@/lib/utils"

import headerStyles from "@/components/orders/OrdersPageHeader/OrdersPageHeader.module.css"

import styles from "./DocumentsPage.module.css"

const MotionTableRow = motion(TableRow)

type AttachmentRegistryLink = {
  entity_type: string
  entity_id: number
  entity_label: string
  title: string
  subtitle: string | null
  href: string | null
}

type AttachmentRegistryItem = {
  id: string
  filename: string
  mime_type: string
  size_bytes: number | string | null
  created_at: string
  links: AttachmentRegistryLink[]
  is_unattached: boolean
}

type TargetOption = {
  id: number
  title: string
  subtitle: string | null
}

type EntityTypeValue =
  | "order"
  | "client"
  | "purchase"
  | "shipment"
  | "supplier"
  | "transport"
  | "manager"
  | "product"

type RelationFilterValue = "all" | "unattached" | EntityTypeValue
type FileTypeFilterValue = "all" | "pdf" | "word" | "excel" | "image" | "file"
type SortValue =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc"

type FilterTab = "relation" | "type"

const ENTITY_OPTIONS: Array<{ value: EntityTypeValue; label: string }> = [
  { value: "order", label: "Заявка" },
  { value: "client", label: "Контрагент" },
  { value: "purchase", label: "Закупка" },
  { value: "shipment", label: "Отгрузка" },
  { value: "supplier", label: "Поставщик" },
  { value: "transport", label: "ТК" },
  { value: "manager", label: "Сотрудник" },
  { value: "product", label: "Товар" },
]

const RELATION_OPTIONS: Array<{ value: RelationFilterValue; label: string }> = [
  { value: "all", label: "Все документы" },
  { value: "unattached", label: "Не прикреплены" },
  ...ENTITY_OPTIONS,
]

const FILE_TYPE_OPTIONS: Array<{ value: FileTypeFilterValue; label: string }> = [
  { value: "all", label: "Все типы" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "image", label: "Изображения" },
  { value: "file", label: "Другие файлы" },
]

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "date-desc", label: "По дате (новые сначала)" },
  { value: "date-asc", label: "По дате (старые сначала)" },
  { value: "name-asc", label: "По имени (А-Я)" },
  { value: "name-desc", label: "По имени (Я-А)" },
  { value: "size-desc", label: "По размеру (больше сначала)" },
  { value: "size-asc", label: "По размеру (меньше сначала)" },
]

const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: "relation", label: "Связь" },
  { value: "type", label: "Тип файла" },
]

const normalizeSearchValue = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

const filterTargetOptions = (options: TargetOption[], query: string) => {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) return options

  return options.filter((option) => {
    const haystack = normalizeSearchValue(`${option.title} ${option.subtitle || ""}`)
    return haystack.includes(normalizedQuery)
  })
}

const normalizeBytes = (value: number | string | null | undefined) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б"
  const units = ["Б", "КБ", "МБ", "ГБ"]
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** power
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Неизвестно"
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const formatMimeType = (value: string) => {
  if (!value) return "Не указан"
  if (value.length <= 40) return value
  const slashIndex = value.indexOf("/")
  if (slashIndex > -1 && slashIndex < value.length - 1) {
    return value.slice(slashIndex + 1)
  }
  return value
}

const getDocumentVisualType = (
  mimeType: string | null | undefined,
  filename: string | null | undefined
): FileTypeFilterValue => {
  const normalizedMime = String(mimeType || "").toLowerCase()
  const normalizedName = String(filename || "").toLowerCase()

  if (normalizedMime.includes("pdf") || normalizedName.endsWith(".pdf")) return "pdf"
  if (
    normalizedMime.includes("word") ||
    normalizedMime.includes("officedocument.wordprocessingml") ||
    normalizedName.endsWith(".doc") ||
    normalizedName.endsWith(".docx")
  ) {
    return "word"
  }

  if (
    normalizedMime.includes("excel") ||
    normalizedMime.includes("spreadsheetml") ||
    normalizedMime.includes("csv") ||
    normalizedName.endsWith(".xls") ||
    normalizedName.endsWith(".xlsx") ||
    normalizedName.endsWith(".csv")
  ) {
    return "excel"
  }

  if (normalizedMime.startsWith("image/")) return "image"

  return "file"
}

function DocumentsRowActionsMenu({
  canAttach,
  canDelete,
  item,
  onAttach,
  onDelete,
}: {
  canAttach: boolean
  canDelete: boolean
  item: AttachmentRegistryItem
  onAttach: (item: AttachmentRegistryItem) => void
  onDelete: (item: AttachmentRegistryItem) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={styles.menuButton}
            aria-label="Действия"
            title="Действия"
          />
        )}
      >
        <FiMoreHorizontal size={18} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem onClick={() => window.open(`/api/attachments/${encodeURIComponent(item.id)}/download`, "_blank", "noopener,noreferrer")}>
          <FiDownload className={styles.rowMenuIcon} />
          Скачать
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => window.open(`/api/attachments/${encodeURIComponent(item.id)}/inline`, "_blank", "noopener,noreferrer")}>
          <FiExternalLink className={styles.rowMenuIcon} />
          Открыть
        </DropdownMenuItem>

        {canAttach ? (
          <DropdownMenuItem onClick={() => onAttach(item)}>
            <FiLink2 className={styles.rowMenuIcon} />
            Привязать
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.rowMenuItemDanger}
              onClick={() => onDelete(item)}
            >
              <FiTrash2 className={styles.rowMenuIconDel} />
              Удалить
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function DocumentsPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const filtersDropdownRef = useRef<HTMLDivElement | null>(null)
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null)

  const [items, setItems] = useState<AttachmentRegistryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInputValue, setSearchInputValue] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("relation")
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [relationFilter, setRelationFilter] = useState<RelationFilterValue>("all")
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilterValue>("all")
  const [sortBy, setSortBy] = useState<SortValue>("date-desc")

  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachDocument, setAttachDocument] = useState<AttachmentRegistryItem | null>(null)
  const [entityType, setEntityType] = useState<EntityTypeValue>("order")
  const [targetQuery, setTargetQuery] = useState("")
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([])
  const [targetFallbackOptions, setTargetFallbackOptions] = useState<TargetOption[]>([])
  const [targetLoading, setTargetLoading] = useState(false)
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null)
  const [attachSaving, setAttachSaving] = useState(false)
  const [tableKey, setTableKey] = useState(0)

  const canViewDocuments = Boolean(user?.permissions?.includes("documents.view"))
  const canUploadDocuments = Boolean(user?.permissions?.includes("documents.upload"))
  const canAttachDocuments = Boolean(user?.permissions?.includes("documents.attach"))
  const canDeleteDocuments = Boolean(user?.permissions?.includes("documents.delete"))

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchQuery(searchInputValue.trim()), 250)
    return () => window.clearTimeout(timeoutId)
  }, [searchInputValue])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!isFiltersOpen) return
      const target = event.target as Node
      if (filtersDropdownRef.current?.contains(target)) return
      if (filterTriggerRef.current?.contains(target)) return
      setIsFiltersOpen(false)
    }

    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [isFiltersOpen])

  const loadDocuments = useCallback(async (showSpinner = true) => {
    try {
      setError(null)
      if (showSpinner) setRefreshing(true)

      const response = await fetch("/api/attachments?registry=1")
      const data = await response.json().catch(() => [])

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Не удалось загрузить документы")
      }

      setItems(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить документы")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !canViewDocuments) return
    void loadDocuments()
  }, [authLoading, canViewDocuments, loadDocuments])

  useEffect(() => {
    setTableKey((current) => current + 1)
  }, [relationFilter, fileTypeFilter, sortBy, searchQuery])

  useEffect(() => {
    if (!attachDialogOpen || !attachDocument || !canAttachDocuments) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      let fallbackOptions = targetFallbackOptions

      try {
        setTargetLoading(true)

        if (fallbackOptions.length === 0) {
          const fallbackParams = new URLSearchParams({
            entity_type: entityType,
            q: "",
            limit: "200",
          })

          const fallbackResponse = await fetch(
            `/api/attachments/targets?${fallbackParams.toString()}`,
            { signal: controller.signal }
          )
          const fallbackData = await fallbackResponse.json().catch(() => [])

          if (!fallbackResponse.ok) {
            throw new Error(
              (fallbackData as { error?: string }).error ||
                "Не удалось загрузить варианты привязки"
            )
          }

          fallbackOptions = Array.isArray(fallbackData) ? (fallbackData as TargetOption[]) : []
          setTargetFallbackOptions(fallbackOptions)
        }

        const localMatches = filterTargetOptions(fallbackOptions, targetQuery)

        if (!targetQuery.trim()) {
          setTargetOptions(fallbackOptions)
          setSelectedTargetId((previous) =>
            previous && fallbackOptions.some((option) => Number(option.id) === previous)
              ? previous
              : null
          )
          return
        }

        const params = new URLSearchParams({
          entity_type: entityType,
          q: targetQuery,
        })

        const response = await fetch(`/api/attachments/targets?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = await response.json().catch(() => [])

        let resolvedOptions = localMatches

        if (response.ok) {
          const options = Array.isArray(data) ? (data as TargetOption[]) : []
          const merged = new Map<number, TargetOption>()

          for (const option of localMatches) {
            merged.set(Number(option.id), option)
          }

          for (const option of options) {
            merged.set(Number(option.id), option)
          }

          resolvedOptions = Array.from(merged.values())
        }

        setTargetOptions(resolvedOptions)
        setSelectedTargetId((previous) =>
          previous && resolvedOptions.some((option) => Number(option.id) === previous)
            ? previous
            : null
        )
      } catch (loadError) {
        if ((loadError as { name?: string })?.name === "AbortError") return
        setTargetOptions(filterTargetOptions(fallbackOptions, targetQuery))
      } finally {
        setTargetLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    attachDialogOpen,
    attachDocument,
    canAttachDocuments,
    entityType,
    targetFallbackOptions,
    targetQuery,
  ])

  const currentTarget = useMemo(
    () => targetOptions.find((option) => Number(option.id) === selectedTargetId) || null,
    [selectedTargetId, targetOptions]
  )

  const statsItems = useMemo(() => {
    const totalSize = items.reduce((sum, item) => sum + normalizeBytes(item.size_bytes), 0)
    const unattachedCount = items.filter((item) => item.is_unattached).length
    const totalLinks = items.reduce((sum, item) => sum + item.links.length, 0)

    return [
      { label: "Всего файлов", value: items.length.toLocaleString("ru-RU") },
      { label: "Не прикреплены", value: unattachedCount.toLocaleString("ru-RU") },
      { label: "Общий размер", value: formatBytes(totalSize) },
      { label: "Привязок", value: totalLinks.toLocaleString("ru-RU") },
    ]
  }, [items])

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery)

    const next = items.filter((item) => {
      const fileType = getDocumentVisualType(item.mime_type, item.filename)

      if (fileTypeFilter !== "all" && fileType !== fileTypeFilter) return false

      if (relationFilter === "unattached" && !item.is_unattached) return false
      if (
        relationFilter !== "all" &&
        relationFilter !== "unattached" &&
        !item.links.some((link) => link.entity_type === relationFilter)
      ) {
        return false
      }

      if (!normalizedQuery) return true

      const haystack = normalizeSearchValue(
        [
          item.filename,
          item.id,
          item.mime_type,
          ...item.links.flatMap((link) => [
            link.entity_label,
            link.title,
            link.subtitle || "",
            String(link.entity_id),
          ]),
        ].join(" ")
      )

      return haystack.includes(normalizedQuery)
    })

    next.sort((left, right) => {
      switch (sortBy) {
        case "date-asc":
          return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        case "name-asc":
          return left.filename.localeCompare(right.filename, "ru")
        case "name-desc":
          return right.filename.localeCompare(left.filename, "ru")
        case "size-desc":
          return normalizeBytes(right.size_bytes) - normalizeBytes(left.size_bytes)
        case "size-asc":
          return normalizeBytes(left.size_bytes) - normalizeBytes(right.size_bytes)
        case "date-desc":
        default:
          return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      }
    })

    return next
  }, [fileTypeFilter, items, relationFilter, searchQuery, sortBy])

  const resetFilters = () => {
    setRelationFilter("all")
    setFileTypeFilter("all")
    setSearchInputValue("")
    setSearchQuery("")
    setSortBy("date-desc")
    setIsFiltersOpen(false)
  }

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setError(null)

      const form = new FormData()
      form.append("file", file)

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: form,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Не удалось загрузить документ")
      }

      await loadDocuments(false)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить документ")
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDelete = async (item: AttachmentRegistryItem) => {
    if (!window.confirm(`Удалить документ «${item.filename}»?`)) return

    try {
      setError(null)

      const response = await fetch(`/api/attachments/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Не удалось удалить документ")
      }

      await loadDocuments(false)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить документ")
    }
  }

  const openAttachDialog = (item: AttachmentRegistryItem) => {
    setAttachDocument(item)
    setEntityType("order")
    setTargetQuery("")
    setSelectedTargetId(null)
    setTargetOptions([])
    setTargetFallbackOptions([])
    setAttachDialogOpen(true)
  }

  const handleAttach = async () => {
    if (!attachDocument || !selectedTargetId) return

    try {
      setAttachSaving(true)
      setError(null)

      const response = await fetch(`/api/attachments/${encodeURIComponent(attachDocument.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: selectedTargetId,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Не удалось привязать документ")
      }

      setAttachDialogOpen(false)
      setAttachDocument(null)
      await loadDocuments(false)
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "Не удалось привязать документ")
    } finally {
      setAttachSaving(false)
    }
  }

  const renderEmptyRow = (colSpan: number) => (
    <TableRow>
      <TableCell colSpan={colSpan} className={styles.emptyCell}>
        <div className={styles.emptyState}>
          <FiPaperclip className={styles.emptyIcon} />
          <span>Документов пока нет</span>
        </div>
      </TableCell>
    </TableRow>
  )

  if (authLoading) {
    return (
      <Layout>
        <div className={styles.container}>
          <EntityIndexPageSkeleton
            ariaLabel="Загрузка документов"
            title="Статистика документов"
            columns={6}
            rows={8}
            actionColumn={false}
          />
        </div>
      </Layout>
    )
  }

  if (!canViewDocuments) {
    return (
      <Layout>
        <NoAccessPage />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={styles.container}>
        <PageHeader
          title="Документы"
          subtitle="Общий реестр файлов по системе: видно, к чему документ привязан, и можно хранить свободные документы."
          actions={(
            <>
              <RefreshButton
                className={cn(headerStyles.surfaceButton)}
                isRefreshing={refreshing}
                refreshKey={Number(refreshing)}
                iconClassName={headerStyles.spin}
                onClick={() => {
                  void loadDocuments()
                }}
              />

              {canUploadDocuments ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className={styles.hiddenInput}
                    onChange={handleFileChange}
                  />

                  <CreateEntityButton
                    className={cn(headerStyles.headerActionButtonDel)}
                    icon={<FiUploadCloud data-icon="inline-start" className="size-4" />}
                    onClick={handleUploadClick}
                    disabled={uploading}
                  >
                    {uploading ? "Загрузка..." : "Загрузить документ"}
                  </CreateEntityButton>
                </>
              ) : null}
            </>
          )}
        />

        {error ? <div className={styles.errorState}>{error}</div> : null}

        {loading ? (
          <EntityIndexPageSkeleton
            ariaLabel="Загрузка документов"
            title="Статистика документов"
            columns={6}
            rows={8}
            actionColumn={false}
          />
        ) : (
          <div className={styles.card}>
            <EntityStatsPanel
              title="Статистика документов"
              items={statsItems}
              variant="embedded"
            />

            <div className={styles.controlsSection}>
              <DataSearchField
                wrapperClassName={styles.searchInputWrapper}
                placeholder="Поиск по документам..."
                value={searchInputValue}
                onValueChange={setSearchInputValue}
              />

              <div className={styles.filterGroup}>
                <div className={styles.filterDropdown} ref={filtersDropdownRef}>
                  <Button
                    type="button"
                    variant="outline"
                    className={styles.filterSelectTrigger}
                    ref={filterTriggerRef}
                    onClick={() => setIsFiltersOpen((value) => !value)}
                    aria-expanded={isFiltersOpen}
                  >
                    <span className={styles.triggerLabel}>
                      <FiFilter className={styles.icon} />
                      Фильтры
                    </span>
                  </Button>

                  {isFiltersOpen ? (
                    <DataFiltersPanel
                      tabs={FILTER_TABS}
                      activeTab={activeFilterTab}
                      onActiveTabChange={setActiveFilterTab}
                      tabsLabel="Фильтры документов"
                      data-documents-filters-dropdown
                    >
                      {activeFilterTab === "relation" ? (
                        <DataFilterField label="Применение">
                          <Select
                            value={relationFilter}
                            items={RELATION_OPTIONS}
                            onValueChange={(value) => setRelationFilter(value as RelationFilterValue)}
                          >
                            <SelectTrigger placeholder="Все документы" />
                            <SelectContent>
                              {RELATION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DataFilterField>
                      ) : null}

                      {activeFilterTab === "type" ? (
                        <DataFilterField label="Тип файла">
                          <Select
                            value={fileTypeFilter}
                            items={FILE_TYPE_OPTIONS}
                            onValueChange={(value) => setFileTypeFilter(value as FileTypeFilterValue)}
                          >
                            <SelectTrigger placeholder="Все типы" />
                            <SelectContent>
                              {FILE_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DataFilterField>
                      ) : null}

                      <DataFiltersPanelActions>
                        <DataFilterActionButton onClick={resetFilters}>
                          Сбросить
                        </DataFilterActionButton>
                        <DataFilterActionButton onClick={() => setIsFiltersOpen(false)}>
                          Закрыть
                        </DataFilterActionButton>
                      </DataFiltersPanelActions>
                    </DataFiltersPanel>
                  ) : null}
                </div>

                <div className={styles.sortGroup}>
                  <span className={styles.sortLabel}>Сортировка:</span>
                  <Select
                    value={sortBy}
                    items={SORT_OPTIONS}
                    onValueChange={(value) => setSortBy(value as SortValue)}
                  >
                    <SelectTrigger className={styles.sortSelect} placeholder="По дате (новые сначала)" />
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <EntityTableSurface
              key={tableKey}
              variant="embedded"
              clip="bottom"
              className={styles.tableSurface}
            >
              <Table className={cn(entityTableClassName, styles.table)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Документ</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Размер</TableHead>
                    <TableHead>Загружен</TableHead>
                    <TableHead>Применение</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredItems.length ? (
                    <AnimatePresence>
                      {filteredItems.map((item) => (
                        <MotionTableRow
                          key={item.id}
                          className={styles.tableRow}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <TableCell className={styles.documentCell}>
                            <div className={styles.tableMetaCell}>
                              <div className={styles.fileName}>{item.filename}</div>
                              <div className={styles.fileMeta}>ID: {item.id}</div>
                              <OrderAttachmentBadges
                                types={[getDocumentVisualType(item.mime_type, item.filename)]}
                                reserveSpace
                              />
                            </div>
                          </TableCell>

                          <TableCell className={styles.typeCell} title={item.mime_type || "application/octet-stream"}>
                            {formatMimeType(item.mime_type || "application/octet-stream")}
                          </TableCell>

                          <TableCell className={styles.numericCell}>
                            {formatBytes(normalizeBytes(item.size_bytes))}
                          </TableCell>

                          <TableCell>{formatDateTime(item.created_at)}</TableCell>

                          <TableCell>
                            {item.is_unattached ? (
                              <span className={styles.unattachedBadge}>Не прикреплён</span>
                            ) : (
                              <div className={styles.linksList}>
                                {item.links.map((link) => (
                                  <div
                                    key={`${item.id}-${link.entity_type}-${link.entity_id}`}
                                    className={styles.linkTarget}
                                  >
                                    <div className={styles.linkTargetType}>{link.entity_label}</div>
                                    {link.href ? (
                                      <Link href={link.href} className={styles.linkTargetTitle}>
                                        {link.title}
                                      </Link>
                                    ) : (
                                      <span className={styles.linkTargetTitle}>{link.title}</span>
                                    )}
                                    {link.subtitle ? (
                                      <div className={styles.linkTargetSubtitle}>{link.subtitle}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className={styles.actionsCell}>
                              <DocumentsRowActionsMenu
                                canAttach={canAttachDocuments}
                                canDelete={canDeleteDocuments}
                                item={item}
                                onAttach={openAttachDialog}
                                onDelete={(nextItem) => {
                                  void handleDelete(nextItem)
                                }}
                              />
                            </div>
                          </TableCell>
                        </MotionTableRow>
                      ))}
                    </AnimatePresence>
                  ) : (
                    renderEmptyRow(6)
                  )}
                </TableBody>
              </Table>
            </EntityTableSurface>
          </div>
        )}

        <Dialog
          open={attachDialogOpen}
          onOpenChange={(open) => {
            setAttachDialogOpen(open)
            if (!open) {
              setAttachDocument(null)
            }
          }}
        >
          <EntityModalShell
            title="Привязать документ"
            description={attachDocument ? `Документ: ${attachDocument.filename}` : "Выберите, к чему прикрепить файл."}
            onClose={() => {
              setAttachDialogOpen(false)
              setAttachDocument(null)
            }}
            className={styles.dialogContent}
            footer={(
              <div className={styles.modalActions}>
                <Button
                  type="button"
                  variant="outline"
                  className={styles.modalSecondaryButton}
                  onClick={() => {
                    setAttachDialogOpen(false)
                    setAttachDocument(null)
                  }}
                >
                  Отмена
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={styles.modalPrimaryButton}
                  onClick={() => void handleAttach()}
                  disabled={!selectedTargetId || attachSaving}
                >
                  <FiLink2 className="size-4" />
                  {attachSaving ? "Привязка..." : "Привязать"}
                </Button>
              </div>
            )}
          >
            <div className={styles.dialogForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Тип сущности</label>
                <Select
                  value={entityType}
                  items={ENTITY_OPTIONS}
                  onValueChange={(value) => {
                    setEntityType(value as EntityTypeValue)
                    setSelectedTargetId(null)
                    setTargetQuery("")
                    setTargetOptions([])
                    setTargetFallbackOptions([])
                  }}
                >
                  <SelectTrigger className={styles.fullWidthSelect} placeholder="Выберите тип" />
                  <SelectContent>
                    {ENTITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Найти объект</label>
                <Input
                  value={targetQuery}
                  onChange={(event) => setTargetQuery(event.target.value)}
                  placeholder="Например: #15, Ромашка, Иванов..."
                  className={styles.fullWidthInput}
                />
              </div>

              <div className={styles.resultsSection}>
                <div className={styles.targetsBox}>
                  {targetLoading ? (
                    <div className={styles.targetsState}>Загрузка вариантов...</div>
                  ) : targetOptions.length === 0 ? (
                    <div className={styles.targetsState}>Подходящих объектов не найдено</div>
                  ) : (
                    targetOptions.map((option) => (
                      <button
                        key={`${entityType}-${option.id}`}
                        type="button"
                        className={cn(
                          styles.targetOption,
                          selectedTargetId === option.id && styles.targetOptionActive
                        )}
                        onClick={() => setSelectedTargetId(option.id)}
                      >
                        <div className={styles.targetTitle}>{option.title}</div>
                        {option.subtitle ? (
                          <div className={styles.targetSubtitle}>{option.subtitle}</div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>

                {currentTarget ? (
                  <div className={styles.selectionCard}>
                    <div className={styles.selectionLabel}>Будет привязан к:</div>
                    <div className={styles.targetTitle}>{currentTarget.title}</div>
                    {currentTarget.subtitle ? (
                      <div className={styles.targetSubtitle}>{currentTarget.subtitle}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </EntityModalShell>
        </Dialog>
      </div>
    </Layout>
  )
}
