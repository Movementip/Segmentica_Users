import React, { useCallback, useEffect, useMemo, useState } from "react"
import { FiEdit2, FiTrash2 } from "react-icons/fi"

import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import DeleteConfirmation from "@/components/modals/DeleteConfirmation/DeleteConfirmation"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { lockBodyScroll, scheduleForceUnlockBodyScroll } from "@/utils/bodyScrollLock"

import dialogStyles from "../RbacDialog.module.css"
import sharedStyles from "../RbacShared.module.css"
import styles from "./RbacDictionaryAdmin.module.css"

type DictionaryItem = {
  id: number
  key: string
  name?: string | null
  description?: string | null
}

type RbacDictionaryAdminProps = {
  endpoint: string
  title: string
  subtitle: string
  createButtonLabel: string
  createDialogTitle: string
  editDialogTitle: string
  deleteMessageBuilder: (item: DictionaryItem) => string
  deleteWarning: string
  searchPlaceholder: string
  keyPlaceholder: string
  namePlaceholder: string
  descriptionPlaceholder: string
  emptyLabel: string
  loadingLabel?: string
  embedded?: boolean
}

export function RbacDictionaryAdmin({
  endpoint,
  title,
  subtitle,
  createButtonLabel,
  createDialogTitle,
  editDialogTitle,
  deleteMessageBuilder,
  deleteWarning,
  searchPlaceholder,
  keyPlaceholder,
  namePlaceholder,
  descriptionPlaceholder,
  emptyLabel,
  loadingLabel = "Загрузка…",
  embedded,
}: RbacDictionaryAdminProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<DictionaryItem[]>([])
  const [query, setQuery] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editing, setEditing] = useState<DictionaryItem | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<DictionaryItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [formKey, setFormKey] = useState("")
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")

  const isAnyDialogOpen = isCreateOpen || isEditOpen || isDeleteOpen

  useEffect(() => {
    if (!isAnyDialogOpen) {
      scheduleForceUnlockBodyScroll()
      return
    }

    const unlockBodyScroll = lockBodyScroll()
    return () => {
      unlockBodyScroll()
      scheduleForceUnlockBodyScroll()
    }
  }, [isAnyDialogOpen])

  const fetchItems = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      const response = await fetch(endpoint)
      const json = (await response.json().catch(() => ({}))) as any
      if (!response.ok) throw new Error(json?.error || "Ошибка")

      setItems(Array.isArray(json?.items) ? json.items : [])
    } catch (errorResponse) {
      setError((errorResponse as any)?.message || "Ошибка")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [endpoint])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (!isRefreshing) return

    const timeoutId = window.setTimeout(() => setIsRefreshing(false), 525)
    return () => window.clearTimeout(timeoutId)
  }, [isRefreshing])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return items

    return items.filter((item) => {
      return (
        String(item.id).includes(normalizedQuery) ||
        String(item.key || "").toLowerCase().includes(normalizedQuery) ||
        String(item.name || "").toLowerCase().includes(normalizedQuery) ||
        String(item.description || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [items, query])

  const resetForm = () => {
    setEditing(null)
    setFormKey("")
    setFormName("")
    setFormDescription("")
  }

  const openCreate = () => {
    resetForm()
    setIsCreateOpen(true)
  }

  const openEdit = (item: DictionaryItem) => {
    setEditing(item)
    setFormKey(String(item.key || ""))
    setFormName(String(item.name || ""))
    setFormDescription(String(item.description || ""))
    setIsEditOpen(true)
  }

  const saveCreate = async () => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: formKey,
          name: formName,
          description: formDescription,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as any
      if (!response.ok) throw new Error(json?.error || "Ошибка")

      setIsCreateOpen(false)
      resetForm()
      await fetchItems()
    } catch (errorResponse) {
      setError((errorResponse as any)?.message || "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!editing) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          key: formKey,
          name: formName,
          description: formDescription,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as any
      if (!response.ok) throw new Error(json?.error || "Ошибка")

      setIsEditOpen(false)
      resetForm()
      await fetchItems()
    } catch (errorResponse) {
      setError((errorResponse as any)?.message || "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id: number) => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch(
        `${endpoint}?id=${encodeURIComponent(String(id))}`,
        { method: "DELETE" }
      )
      const json = (await response.json().catch(() => ({}))) as any
      if (!response.ok) throw new Error(json?.error || "Ошибка")

      await fetchItems()
    } catch (errorResponse) {
      setError((errorResponse as any)?.message || "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const renderDialog = (
    open: boolean,
    onOpenChange: (open: boolean) => void,
    titleText: string,
    onSubmit: () => void
  ) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogStyles.dialogContent} ${dialogStyles.dialogContentNarrow}`}>
        <DialogHeader className={dialogStyles.dialogHeader}>
          <DialogTitle className={dialogStyles.dialogTitle}>{titleText}</DialogTitle>
          <DialogDescription className={dialogStyles.dialogDescription}>
            Заполните параметры записи и сохраните изменения.
          </DialogDescription>
        </DialogHeader>

        <form
          className={dialogStyles.dialogBody}
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label className={dialogStyles.field}>
            <span className={dialogStyles.fieldLabel}>Key</span>
            <Input
              className={dialogStyles.input}
              value={formKey}
              onChange={(event) => setFormKey(event.target.value)}
              placeholder={keyPlaceholder}
            />
          </label>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.fieldLabel}>Название</span>
            <Input
              className={dialogStyles.input}
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder={namePlaceholder}
            />
          </label>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.fieldLabel}>Описание</span>
            <Input
              className={dialogStyles.input}
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
              placeholder={descriptionPlaceholder}
            />
          </label>

          <div className={dialogStyles.actions}>
            <Button
              type="button"
              variant="outline"
              className={dialogStyles.secondaryButton}
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className={dialogStyles.primaryButton}
              disabled={saving || !formKey.trim()}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  const content = (
    <div className={styles.root}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={(
          <div className={sharedStyles.sectionActions}>
            <RefreshButton
              className={sharedStyles.surfaceButton}
              isRefreshing={loading || isRefreshing}
              refreshKey={refreshKey}
              iconClassName={sharedStyles.spin}
              onClick={() => {
                setIsRefreshing(true)
                setRefreshKey((value) => value + 1)
                void fetchItems()
              }}
            />

            <CreateEntityButton
              className={sharedStyles.primaryButton}
              onClick={openCreate}
            >
              {createButtonLabel}
            </CreateEntityButton>
          </div>
        )}
      />

      <div className={sharedStyles.searchRow}>
        <DataSearchField
          wrapperClassName={sharedStyles.searchField}
          value={query}
          onValueChange={setQuery}
          placeholder={searchPlaceholder}
        />
      </div>

      {error ? (
        <div className={`${sharedStyles.stateCard} ${sharedStyles.stateCardError}`}>
          {error}
        </div>
      ) : (
        <div className={styles.tableSurface}>
          <div className={styles.tableContainer}>
            <Table className={styles.table}>
              <colgroup>
                <col className={styles.colId} />
                <col className={styles.colKey} />
                <col className={styles.colName} />
                <col className={styles.colDescription} />
                <col className={styles.colActions} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className={styles.tableHead}>ID</TableHead>
                  <TableHead className={styles.tableHead}>Key</TableHead>
                  <TableHead className={styles.tableHead}>Название</TableHead>
                  <TableHead className={styles.tableHead}>Описание</TableHead>
                  <TableHead className={styles.tableHead} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className={styles.tableCell}>
                      {loadingLabel}
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={`${styles.tableCell} ${styles.emptyState}`}>
                      {emptyLabel}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className={styles.tableCell}>#{item.id}</TableCell>
                      <TableCell className={styles.tableCell}>
                        <span className={sharedStyles.mono}>{item.key}</span>
                      </TableCell>
                      <TableCell className={styles.tableCell}>{item.name || "—"}</TableCell>
                      <TableCell className={styles.tableCell}>{item.description || "—"}</TableCell>
                      <TableCell className={styles.tableCell}>
                        <div className={sharedStyles.actionsCell}>
                          <button
                            type="button"
                            className={sharedStyles.rowIconButton}
                            onClick={() => openEdit(item)}
                            aria-label="Изменить"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            className={`${sharedStyles.rowIconButton} ${sharedStyles.rowIconButtonDanger}`}
                            onClick={() => {
                              setDeleting(item)
                              setIsDeleteOpen(true)
                            }}
                            disabled={saving}
                            aria-label="Удалить"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {renderDialog(
        isCreateOpen,
        (open) => {
          setIsCreateOpen(open)
          if (!open) resetForm()
        },
        createDialogTitle,
        saveCreate
      )}

      {renderDialog(
        isEditOpen,
        (open) => {
          setIsEditOpen(open)
          if (!open) resetForm()
        },
        editDialogTitle,
        saveEdit
      )}

      <DeleteConfirmation
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false)
          setDeleting(null)
        }}
        onConfirm={() => {
          if (!deleting) return
          void deleteItem(deleting.id).finally(() => {
            setIsDeleteOpen(false)
            setDeleting(null)
          })
        }}
        order={null}
        loading={saving}
        title="Подтверждение удаления"
        message={deleting ? deleteMessageBuilder(deleting) : "Удалить запись?"}
        warning={deleteWarning}
        confirmText={saving ? "Удаление..." : "Удалить"}
        cancelText="Отмена"
      />
    </div>
  )

  if (embedded) return <div>{content}</div>

  return <div>{content}</div>
}
