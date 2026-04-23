import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { FiEye } from "react-icons/fi"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
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
import { formatRuCurrency, formatRuDateTime } from "@/utils/formatters"

import styles from "./ProductPriceHistoryModal.module.css"

interface ProductPriceHistoryEntry {
  id: number
  товар_id: number
  цена_закупки?: number
  цена_продажи?: number
  изменено_в: string
  источник?: string
  комментарий?: string
}

interface ProductPriceHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  productId: number | null
  productName?: string
}

type SortValue = "date-desc" | "date-asc" | "sale-desc" | "sale-asc"

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "date-desc", label: "Сначала новые" },
  { value: "date-asc", label: "Сначала старые" },
  { value: "sale-desc", label: "Цена продажи по убыванию" },
  { value: "sale-asc", label: "Цена продажи по возрастанию" },
]

export const ProductPriceHistoryModal: React.FC<ProductPriceHistoryModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
}) => {
  const router = useRouter()
  const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortValue>("date-desc")

  const handleClose = () => {
    setError(null)
    onClose()
  }

  useEffect(() => {
    if (!isOpen || !productId) return

    const fetchHistory = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/products?id=${productId}&include_price_history=1`)
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Нет доступа к истории цен")
          }

          throw new Error("Ошибка загрузки истории цен")
        }

        const data = await response.json()
        setHistory(Array.isArray(data.история_цен) ? data.история_цен : [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Неизвестная ошибка")
      } finally {
        setLoading(false)
      }
    }

    void fetchHistory()
  }, [isOpen, productId])

  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          history
            .map((entry) => entry.источник)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [history]
  )

  const filteredHistory = useMemo(() => {
    const result = [...history]

    const filtered = sourceFilter === "all"
      ? result
      : result.filter((entry) => entry.источник === sourceFilter)

    filtered.sort((left, right) => {
      if (sortBy === "date-asc") {
        return new Date(left.изменено_в).getTime() - new Date(right.изменено_в).getTime()
      }

      if (sortBy === "sale-asc") {
        return (left.цена_продажи || 0) - (right.цена_продажи || 0)
      }

      if (sortBy === "sale-desc") {
        return (right.цена_продажи || 0) - (left.цена_продажи || 0)
      }

      return new Date(right.изменено_в).getTime() - new Date(left.изменено_в).getTime()
    })

    return filtered
  }, [history, sortBy, sourceFilter])

  const formatDateTime = (dateString: string) => formatRuDateTime(dateString)

  const formatCurrency = (amount?: number) => formatRuCurrency(amount)

  if (!isOpen || !productId) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <EntityModalShell
        className={styles.modalContent}
        onClose={handleClose}
        title={`История цен${productName ? `: ${productName}` : ""}`}
        footerClassName={styles.modalActions}
        footer={(
          <Button type="button" variant="outline" onClick={handleClose}>
            Закрыть
          </Button>
        )}
      >
        <div className={styles.form}>
          <div className={styles.toolbar}>
            <div className={styles.formGroup}>
              <div className={styles.label}>Источник</div>
              <Select
                value={sourceFilter}
                items={[
                  { value: "all", label: "Все" },
                  ...sourceOptions.map((option) => ({ value: option, label: option })),
                ]}
                onValueChange={(value) => setSourceFilter(String(value))}
              >
                <SelectTrigger className={styles.selectTrigger} />
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.label}>Сортировка</div>
              <Select
                value={sortBy}
                items={sortOptions}
                onValueChange={(value) => setSortBy(String(value) as SortValue)}
              >
                <SelectTrigger className={styles.selectTrigger} />
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.toolbarAction}>
              <Button
                type="button"
                variant="outline"
                className={styles.headerActionButton}
                onClick={() => void router.push(`/products/${productId}#price-history`)}
              >
                <FiEye data-icon="inline-start" className="size-4" />
                Открыть страницу товара
              </Button>
            </div>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.tableContainer}>
            <Table className={styles.table}>
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <span className={styles.mutedText}>Загрузка...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <span className={styles.mutedText}>История цен отсутствует</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDateTime(entry.изменено_в)}</TableCell>
                      <TableCell className={styles.textRight}>
                        {formatCurrency(entry.цена_закупки)}
                      </TableCell>
                      <TableCell className={styles.textRight}>
                        {formatCurrency(entry.цена_продажи)}
                      </TableCell>
                      <TableCell>{entry.источник || "—"}</TableCell>
                      <TableCell>{entry.комментарий || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </EntityModalShell>
    </Dialog>
  )
}
