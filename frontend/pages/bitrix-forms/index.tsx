import React, { useEffect, useMemo, useState } from "react"
import { Check, Eye, PackagePlus, RefreshCw, UserPlus } from "lucide-react"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import {
  EntityTableSkeleton,
  EntityTableSurface,
  entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { CreateClientModal } from "@/components/modals/CreateClientModal/CreateClientModal"
import CreateOrderModal from "@/components/modals/CreateOrderModal/CreateOrderModal"
import { CreateProductModal } from "@/components/modals/CreateProductModal/CreateProductModal"
import type { ProductFormState } from "@/components/modals/ProductFormFields/ProductFormFields"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
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
import { useAuth } from "@/hooks/use-auth"
import { withLayout } from "@/layout"
import type { ClientContragent } from "@/lib/clientContragents"
import { cn } from "@/lib/utils"
import { formatRuDateTime } from "@/utils/formatters"

import styles from "./BitrixForms.module.css"

type BitrixFormSummary = {
  source_form_id: number | null
  source_form_name: string
  total_count: number
  open_count: number
  processed_count: number
  last_imported_at?: string | null
  last_seen_at?: string | null
  last_processed_at?: string | null
  known?: boolean
}

type BitrixImportedRequest = {
  id: number
  source_form_id?: number | null
  source_form_name?: string | null
  source_entry_id?: number | null
  source_entry_name?: string | null
  person_name?: string | null
  phone?: string | null
  email?: string | null
  product_name?: string | null
  message?: string | null
  source_url?: string | null
  imported_at?: string | null
  source_created_at?: string | null
  processed_at?: string | null
  notes?: string | null
}

type BitrixFormsResponse = {
  forms: BitrixFormSummary[]
  requests: BitrixImportedRequest[]
  statistics: {
    forms_count: number
    total_requests: number
    open_requests: number
    processed_requests: number
    empty_forms: number
  }
}

const ALL_FORMS_KEY = "all"

const normalizeText = (value?: string | null) => String(value || "").trim().toLowerCase()

const formKey = (form: Pick<BitrixFormSummary, "source_form_id" | "source_form_name">) => (
  form.source_form_id ? `id:${form.source_form_id}` : `name:${normalizeText(form.source_form_name)}`
)

const requestFormKey = (request: BitrixImportedRequest) => (
  request.source_form_id ? `id:${request.source_form_id}` : `name:${normalizeText(request.source_form_name)}`
)

const requestContact = (request: BitrixImportedRequest) => (
  [request.phone, request.email].map((item) => item?.trim()).filter(Boolean).join(" · ") || "—"
)

function BitrixFormsPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<BitrixFormsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedFormKey, setSelectedFormKey] = useState(ALL_FORMS_KEY)

  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false)
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false)
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<BitrixImportedRequest | null>(null)
  const [fullTextRequest, setFullTextRequest] = useState<BitrixImportedRequest | null>(null)
  const [initialClient, setInitialClient] = useState<Partial<ClientContragent> | null>(null)
  const [initialProduct, setInitialProduct] = useState<Partial<ProductFormState> | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canList = Boolean(user?.permissions?.includes("orders.bitrix_requests.list"))
  const canProcess = Boolean(user?.permissions?.includes("orders.bitrix_requests.process"))
  const canCreateOrder = Boolean(user?.permissions?.includes("orders.create"))
  const canCreateClient = Boolean(user?.permissions?.includes("clients.create"))
  const canCreateProduct = Boolean(
    user?.permissions?.includes("products.create") && user?.permissions?.includes("warehouse.create")
  )

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/bitrix/forms")
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error((result as any)?.error || "Ошибка загрузки форм Битрикс24")
      }

      setData(result as BitrixFormsResponse)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки форм Битрикс24")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!canList) {
      setLoading(false)
      return
    }

    void fetchData()
  }, [authLoading, canList])

  const selectedFormName = useMemo(() => {
    if (selectedFormKey === ALL_FORMS_KEY) return "Все формы"
    return data?.forms.find((form) => formKey(form) === selectedFormKey)?.source_form_name || "Форма"
  }, [data?.forms, selectedFormKey])

  const normalizedSearch = normalizeText(search)
  const filteredRequests = useMemo(() => {
    const requests = data?.requests || []
    return requests.filter((request) => {
      if (selectedFormKey !== ALL_FORMS_KEY && requestFormKey(request) !== selectedFormKey) return false
      if (!normalizedSearch) return true

      return (
        String(request.id).includes(normalizedSearch) ||
        normalizeText(request.source_form_name).includes(normalizedSearch) ||
        normalizeText(request.person_name || request.source_entry_name).includes(normalizedSearch) ||
        normalizeText(requestContact(request)).includes(normalizedSearch) ||
        normalizeText(request.product_name).includes(normalizedSearch) ||
        normalizeText(request.message).includes(normalizedSearch)
      )
    })
  }, [data?.requests, normalizedSearch, selectedFormKey])

  const statsItems = useMemo(() => {
    const stats = data?.statistics
    return [
      { label: "Форм", value: stats?.forms_count ?? 0 },
      { label: "Заявок всего", value: stats?.total_requests ?? 0 },
      { label: "Новых", value: stats?.open_requests ?? 0, tone: "warning" as const },
      { label: "Пустых форм", value: stats?.empty_forms ?? 0 },
    ]
  }, [data?.statistics])

  const buildImportComment = (request: BitrixImportedRequest) => (
    [
      `Битрикс24 #${request.id}`,
      request.source_form_name ? `Форма: ${request.source_form_name}` : null,
      request.product_name ? `Товар: ${request.product_name}` : null,
      request.message || null,
    ].filter(Boolean).join("\n")
  )

  const markProcessed = async (request: BitrixImportedRequest, notes?: string) => {
    if (!canProcess) return

    const response = await fetch("/api/imported-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: request.id,
        processed: true,
        notes: notes || "Обработано со страницы форм Битрикс24",
      }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((result as any)?.error || "Не удалось обновить заявку Битрикс24")
    }

    await fetchData()
  }

  const openCreateClient = (request: BitrixImportedRequest) => {
    const name = request.person_name || request.source_entry_name || ""
    setSelectedRequest(request)
    setInitialClient({
      тип: "Организация",
      название: name,
      краткоеНазвание: name,
      полноеНазвание: name,
      телефон: request.phone || "",
      email: request.email || "",
      комментарий: buildImportComment(request),
    })
    setIsCreateClientOpen(true)
  }

  const openCreateProduct = (request: BitrixImportedRequest) => {
    setSelectedRequest(request)
    setInitialProduct({
      название: request.product_name || "",
      артикул: `BX-${request.id}`,
      комментарий: buildImportComment(request),
    })
    setIsCreateProductOpen(true)
  }

  const openCreateOrder = (request: BitrixImportedRequest) => {
    setSelectedRequest(request)
    setIsCreateOrderOpen(true)
  }

  const handleCreateOrder = async (orderData: any) => {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((result as any)?.error || "Ошибка создания заявки")
    }

    if (selectedRequest && canProcess) {
      await markProcessed(selectedRequest, `Создана заявка #${Number((result as any)?.id) || ""}`.trim())
    } else {
      await fetchData()
    }

    setSelectedRequest(null)
    setIsCreateOrderOpen(false)
  }

  if (authLoading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!canList) {
    return <NoAccessPage />
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Формы Битрикс24"
        subtitle="Все формы сайта и импортированные обращения"
      />

      {loading && !data ? (
        <div className={styles.contentCard}>
          <EntityStatsPanel
            title="Статистика форм"
            items={statsItems}
            variant="embedded"
            className={styles.statsPanel}
            loading
          />
          <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
            <EntityTableSkeleton columns={7} rows={8} actionColumn />
          </EntityTableSurface>
        </div>
      ) : error || !data ? (
        <section className={styles.feedbackSurface}>
          <h2 className={styles.feedbackTitle}>Ошибка</h2>
          <p className={styles.feedbackText}>{error || "Ошибка загрузки данных"}</p>
          <Button type="button" variant="outline" onClick={() => void fetchData()}>
            Повторить
          </Button>
        </section>
      ) : (
        <section className={styles.contentCard}>
          <EntityStatsPanel title="Статистика форм" items={statsItems} variant="embedded" className={styles.statsPanel} />

          <div className={styles.toolbar}>
            <DataSearchField
              value={search}
              onValueChange={setSearch}
              placeholder="Поиск по форме, клиенту, товару или контакту..."
              wrapperClassName={styles.searchField}
            />
            <div className={styles.toolbarActions}>
              <Button
                type="button"
                variant={selectedFormKey === ALL_FORMS_KEY ? "default" : "outline"}
                onClick={() => setSelectedFormKey(ALL_FORMS_KEY)}
              >
                Все формы
              </Button>
              <Button type="button" variant="outline" className={styles.refreshButton} onClick={() => void fetchData()} disabled={loading}>
                <RefreshCw size={16} />
                Обновить
              </Button>
            </div>
          </div>

          <div className={styles.formsGrid}>
            {data.forms.map((form) => {
              const key = formKey(form)
              return (
                <button
                  key={key}
                  type="button"
                  className={styles.formButton}
                  data-active={selectedFormKey === key ? "true" : "false"}
                  onClick={() => setSelectedFormKey(key)}
                >
                  <span className={styles.formName}>{form.source_form_name}</span>
                  <span className={styles.formMeta}>
                    {form.last_seen_at ? `Последний скан: ${formatRuDateTime(form.last_seen_at)}` : "Пока без заявок"}
                  </span>
                  <span className={styles.formCounts}>
                    <span className={styles.countPill}>{form.total_count} всего</span>
                    <span className={styles.countPill} data-tone="open">{form.open_count} новых</span>
                    <span className={styles.countPill} data-tone="processed">{form.processed_count} обработано</span>
                  </span>
                </button>
              )
            })}
          </div>

          {actionError ? <div className={styles.feedbackText}>{actionError}</div> : null}

          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.tableTitle}>Обращения</h2>
              <div className={styles.tableSubtitle}>
                {selectedFormName}: {filteredRequests.length.toLocaleString("ru-RU")} строк
              </div>
            </div>
          </div>

          <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableSurface}>
            <Table className={cn(entityTableClassName, styles.table)}>
              <colgroup>
                <col className={styles.idCol} />
                <col className={styles.formCol} />
                <col className={styles.dateCol} />
                <col className={styles.clientCol} />
                <col className={styles.contactCol} />
                <col className={styles.productCol} />
                <col className={styles.messageCol} />
                <col className={styles.statusCol} />
                <col className={styles.actionsCol} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>Форма</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Контакты</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length ? (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id} className={styles.tableRow}>
                      <TableCell>#{request.id}</TableCell>
                      <TableCell className={styles.formCell}>
                        <span className={styles.singleLineText}>{request.source_form_name || "Bitrix24"}</span>
                      </TableCell>
                      <TableCell>{formatRuDateTime(request.source_created_at || request.imported_at)}</TableCell>
                      <TableCell className={styles.clientCell}>
                        <span className={styles.singleLineText}>{request.person_name || request.source_entry_name || "—"}</span>
                      </TableCell>
                      <TableCell className={styles.contactCell}>
                        <span className={styles.singleLineText}>{requestContact(request)}</span>
                      </TableCell>
                      <TableCell className={styles.productCell}>
                        <span className={styles.clampedText}>{request.product_name || "—"}</span>
                      </TableCell>
                      <TableCell className={styles.messageCell}>
                        <div className={styles.messagePreview}>
                          <span className={styles.clampedText}>{request.message || "—"}</span>
                          {request.message ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={styles.viewTextButton}
                              onClick={() => setFullTextRequest(request)}
                            >
                              <Eye size={14} />
                              Полностью
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <EntityStatusBadge
                          value={request.processed_at ? "processed" : "new"}
                          label={request.processed_at ? "обработано" : "новая"}
                          tone={request.processed_at ? "success" : "warning"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className={styles.actions}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={styles.actionButton}
                            onClick={() => openCreateClient(request)}
                            disabled={!canCreateClient}
                          >
                            <UserPlus size={15} />
                            Клиент
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={styles.actionButton}
                            onClick={() => openCreateProduct(request)}
                            disabled={!canCreateProduct || !request.product_name}
                          >
                            <PackagePlus size={15} />
                            Товар
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className={styles.actionButton}
                            onClick={() => openCreateOrder(request)}
                            disabled={!canCreateOrder}
                          >
                            Заявка
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={styles.iconOnlyButton}
                            onClick={() => {
                              void markProcessed(request).catch((markError) => {
                                setActionError(markError instanceof Error ? markError.message : "Не удалось обновить заявку Битрикс24")
                              })
                            }}
                            disabled={!canProcess || Boolean(request.processed_at)}
                            title="Пометить обработанной"
                          >
                            <Check size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className={styles.emptyCell}>По выбранной форме обращений нет</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </EntityTableSurface>
        </section>
      )}

      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => {
          setIsCreateOrderOpen(false)
          setSelectedRequest(null)
        }}
        onSubmit={handleCreateOrder}
        canCreate={canCreateOrder}
        initialImportedRequest={selectedRequest}
      />

      <CreateClientModal
        isOpen={isCreateClientOpen}
        onClose={() => {
          setIsCreateClientOpen(false)
          setInitialClient(null)
        }}
        onClientCreated={() => {
          setIsCreateClientOpen(false)
          setInitialClient(null)
          void fetchData()
        }}
        initialClient={initialClient}
      />

      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => {
          setIsCreateProductOpen(false)
          setInitialProduct(null)
        }}
        onProductCreated={() => {
          setIsCreateProductOpen(false)
          setInitialProduct(null)
          void fetchData()
        }}
        initialProduct={initialProduct}
      />

      <Dialog open={Boolean(fullTextRequest)} onOpenChange={(open) => (!open ? setFullTextRequest(null) : undefined)}>
        {fullTextRequest ? (
          <EntityModalShell
            className={styles.textModal}
            onClose={() => setFullTextRequest(null)}
            title={`Комментарий Битрикс24 #${fullTextRequest.id}`}
            description={fullTextRequest.source_form_name || "Форма Битрикс24"}
          >
            <div className={styles.fullTextMeta}>
              <span>{fullTextRequest.person_name || fullTextRequest.source_entry_name || "Клиент не указан"}</span>
              <span>{requestContact(fullTextRequest)}</span>
              <span>{formatRuDateTime(fullTextRequest.source_created_at || fullTextRequest.imported_at)}</span>
            </div>
            <div className={styles.fullTextBox}>
              {fullTextRequest.message || "Комментарий пустой"}
            </div>
          </EntityModalShell>
        ) : null}
      </Dialog>
    </div>
  )
}

export default withLayout(BitrixFormsPage)
