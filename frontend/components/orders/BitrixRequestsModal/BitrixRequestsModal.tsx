import React, { useState } from "react"
import { Check, Eye, PackagePlus, RefreshCw, UserPlus } from "lucide-react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRuDateTime } from "@/utils/formatters"

import styles from "./BitrixRequestsModal.module.css"

export type BitrixImportedRequest = {
  id: number
  source_form_name?: string | null
  source_entry_name?: string | null
  person_name?: string | null
  phone?: string | null
  email?: string | null
  product_name?: string | null
  message?: string | null
  source_url?: string | null
  imported_at?: string | null
  source_created_at?: string | null
  viewed_at?: string | null
  processed_at?: string | null
  notes?: string | null
}

type BitrixRequestsModalProps = {
  isOpen: boolean
  onClose: () => void
  requests: BitrixImportedRequest[]
  loading: boolean
  error: string | null
  canCreateClient: boolean
  canCreateOrder: boolean
  canCreateProduct: boolean
  canProcess: boolean
  onRefresh: () => void
  onCreateClient: (request: BitrixImportedRequest) => void
  onCreateOrder: (request: BitrixImportedRequest) => void
  onCreateProduct: (request: BitrixImportedRequest) => void
  onMarkProcessed: (request: BitrixImportedRequest) => void
  onViewRequest: (request: BitrixImportedRequest) => void
}

const contactText = (request: BitrixImportedRequest) => (
  [request.phone, request.email].map((item) => item?.trim()).filter(Boolean).join(" · ") || "-"
)

export function BitrixRequestsModal({
  isOpen,
  onClose,
  requests,
  loading,
  error,
  canCreateClient,
  canCreateOrder,
  canCreateProduct,
  canProcess,
  onRefresh,
  onCreateClient,
  onCreateOrder,
  onCreateProduct,
  onMarkProcessed,
  onViewRequest,
}: BitrixRequestsModalProps): JSX.Element | null {
  const [fullTextRequest, setFullTextRequest] = useState<BitrixImportedRequest | null>(null)
  const newRequestsCount = requests.filter((request) => !request.viewed_at && !request.processed_at).length

  const openFullText = (request: BitrixImportedRequest) => {
    setFullTextRequest(request)
    if (!request.viewed_at) onViewRequest(request)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <EntityModalShell
        className={styles.modalContent}
        onClose={onClose}
        title="Заявки с Битрикс24"
        description="Импортированные обращения, которые можно перенести в справочники и заявки."
      >
        <div className={styles.toolbar}>
          <div className={styles.summary}>
            {loading
              ? "Загрузка..."
              : `Новых: ${newRequestsCount.toLocaleString("ru-RU")} · Всего: ${requests.length.toLocaleString("ru-RU")}`}
          </div>
          <Button type="button" variant="outline" className={styles.iconButton} onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} />
            Обновить
          </Button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.tableWrap}>
          <Table className={styles.table}>
            <colgroup>
              <col className={styles.dateCol} />
              <col className={styles.clientCol} />
              <col className={styles.contactCol} />
              <col className={styles.productCol} />
              <col className={styles.messageCol} />
              <col className={styles.actionsCol} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Контакты</TableHead>
                <TableHead>Товар</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className={styles.actionsHead}>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className={styles.emptyCell}>Загрузка заявок...</TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className={styles.emptyCell}>Новых заявок из Битрикс24 нет</TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const isNew = !request.viewed_at && !request.processed_at

                  return (
                  <TableRow key={request.id} className={isNew ? styles.newRow : undefined}>
                    <TableCell className={styles.dateCell}>
                      {formatRuDateTime(request.source_created_at || request.imported_at || "")}
                    </TableCell>
                    <TableCell className={styles.clientCell}>
                      <div className={styles.clientHeader}>
                        <span className={styles.primaryText}>{request.person_name || request.source_entry_name || "-"}</span>
                        <span className={isNew ? styles.newBadge : styles.viewedBadge}>
                          {isNew ? "Новая" : "Просмотрена"}
                        </span>
                      </div>
                      <div className={styles.mutedText}>{request.source_form_name || "Bitrix24"}</div>
                    </TableCell>
                    <TableCell className={styles.contactCell}>
                      <span className={styles.singleLineText}>{contactText(request)}</span>
                    </TableCell>
                    <TableCell className={styles.productCell}>
                      <span className={styles.clampedText}>{request.product_name || "-"}</span>
                    </TableCell>
                    <TableCell className={styles.messageCell}>
                      <div className={styles.messagePreview}>
                        <span className={styles.clampedText}>{request.message || "-"}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={styles.viewTextButton}
                          onClick={() => openFullText(request)}
                        >
                          <Eye size={14} />
                          Посмотреть
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.actions}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={styles.actionButton}
                          onClick={() => onCreateClient(request)}
                          disabled={!canCreateClient}
                          title="Создать клиента из данных Битрикс24"
                        >
                          <UserPlus size={15} />
                          Клиент
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={styles.actionButton}
                          onClick={() => onCreateProduct(request)}
                          disabled={!canCreateProduct || !request.product_name}
                          title="Создать товар из импортированного названия"
                        >
                          <PackagePlus size={15} />
                          Товар
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className={styles.actionButton}
                          onClick={() => onCreateOrder(request)}
                          disabled={!canCreateOrder}
                        >
                          Заявка
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={styles.iconOnlyButton}
                          onClick={() => onMarkProcessed(request)}
                          disabled={!canProcess}
                          title="Перенести в архив импортированных"
                        >
                          <Check size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </EntityModalShell>
      </Dialog>

      <Dialog open={Boolean(fullTextRequest)} onOpenChange={(open) => (!open ? setFullTextRequest(null) : undefined)}>
        {fullTextRequest ? (
          <EntityModalShell
            className={styles.textModal}
            onClose={() => setFullTextRequest(null)}
            title={`Заявка Битрикс24 #${fullTextRequest.id}`}
            description={fullTextRequest.source_form_name || "Форма Битрикс24"}
          >
            <div className={styles.fullTextMeta}>
              <span>{fullTextRequest.person_name || fullTextRequest.source_entry_name || "Клиент не указан"}</span>
              <span>{contactText(fullTextRequest)}</span>
              <span>{formatRuDateTime(fullTextRequest.source_created_at || fullTextRequest.imported_at || "")}</span>
            </div>
            <div className={styles.fullTextBox}>
              {fullTextRequest.message || "Комментарий пустой"}
            </div>
          </EntityModalShell>
        ) : null}
      </Dialog>
    </>
  )
}
