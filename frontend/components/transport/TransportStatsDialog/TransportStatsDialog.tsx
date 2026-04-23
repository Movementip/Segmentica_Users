import { Fragment } from "react"

import {
  EntityTableSurface,
} from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import type {
  TransportCompany,
  TransportMonthShipmentRow,
  TransportPerformanceRow,
  TransportStatsResponse,
} from "@/types/pages/transport"
import {
  getTransportShipmentStatusLabel,
  getTransportShipmentStatusTone,
} from "@/components/transport/utils"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import styles from "./TransportStatsDialog.module.css"

type TransportStatsDialogProps = {
  company: TransportCompany | null
  error: string
  expandedMonth: string
  formatCurrency: (amount: number | null) => string
  formatDateTime: (date: string) => string
  formatMonth: (date: string) => string
  loading: boolean
  monthShipments: TransportMonthShipmentRow[]
  monthShipmentsError: string
  monthShipmentsLoading: boolean
  open: boolean
  performance: TransportPerformanceRow[]
  periodTotals: TransportStatsResponse["periodTotals"] | null
  onClose: () => void
  onToggleMonth: (month: string) => void
}

export function TransportStatsDialog({
  company,
  error,
  expandedMonth,
  formatCurrency,
  formatDateTime,
  formatMonth,
  loading,
  monthShipments,
  monthShipmentsError,
  monthShipmentsLoading,
  open,
  performance,
  periodTotals,
  onClose,
  onToggleMonth,
}: TransportStatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <EntityModalShell
        className={styles.modalContent}
        title="Статистика"
        description={company?.название || ""}
        onClose={onClose}
        footer={(
          <Button type="button" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        )}
      >
        {company ? (
          <div className={styles.content}>
            <div className={styles.cardsGrid}>
              <StatCard label="Тариф" value={formatCurrency(company.тариф)} />
              <StatCard label="Всего отгрузок" value={company.общее_количество_отгрузок || 0} />
              <StatCard label="Активные" value={company.активные_отгрузки || 0} />
              <StatCard label="Завершенные" value={company.завершенные_отгрузки || 0} />
              <StatCard label="Средняя стоимость" value={formatCurrency(company.средняя_стоимость)} />
              <StatCard label="Выручка" value={formatCurrency(company.общая_выручка)} />
            </div>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Итоги за период (последние 12 месяцев)</h3>

              {loading ? (
                <PageLoader label="Загрузка статистики..." />
              ) : error ? (
                <p className={styles.errorText}>{error}</p>
              ) : periodTotals ? (
                <div className={styles.cardsGrid}>
                  <StatCard label="Количество отгрузок" value={Number(periodTotals.количество_отгрузок) || 0} />
                  <StatCard label="Успешные доставки" value={Number(periodTotals.успешные_доставки) || 0} />
                  <StatCard
                    label="Процент успешности"
                    value={(() => {
                      const total = Number(periodTotals.количество_отгрузок) || 0
                      const success = Number(periodTotals.успешные_доставки) || 0
                      return total ? `${Math.round((success / total) * 100)}%` : "0%"
                    })()}
                  />
                  <StatCard label="Средняя стоимость" value={formatCurrency(Number(periodTotals.средняя_стоимость) || 0)} />
                  <StatCard label="Общая выручка" value={formatCurrency(Number(periodTotals.общая_выручка) || 0)} />
                </div>
              ) : (
                <p className={styles.emptyText}>Нет данных</p>
              )}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Статистика по месяцам</h3>

              {loading ? (
                <PageLoader label="Загрузка статистики..." />
              ) : error ? (
                <p className={styles.errorText}>{error}</p>
              ) : (
                <EntityTableSurface variant="standalone" className={styles.tableSurface}>
                  <Table className={styles.table}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Месяц</TableHead>
                        <TableHead className={styles.textRight}>Количество отгрузок</TableHead>
                        <TableHead className={styles.textRight}>Успешные доставки</TableHead>
                        <TableHead className={styles.textRight}>Процент успешности</TableHead>
                        <TableHead className={styles.textRight}>Средняя стоимость</TableHead>
                        <TableHead className={styles.textRight}>Общая выручка</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className={styles.emptyCell}>
                            Нет данных
                          </TableCell>
                        </TableRow>
                      ) : performance.map((row) => {
                        const total = Number(row.количество_отгрузок) || 0
                        const success = Number(row.успешные_доставки) || 0
                        const successRate = total ? Math.round((success / total) * 100) : 0
                        const isExpanded = expandedMonth === row.месяц

                        return (
                          <Fragment key={row.месяц}>
                            <TableRow
                              className={styles.expandableRow}
                              onClick={() => onToggleMonth(row.месяц)}
                            >
                              <TableCell>
                                <div className={styles.monthTitle}>{formatMonth(row.месяц)}</div>
                                <div className={styles.monthHint}>
                                  {isExpanded ? "Нажми, чтобы свернуть" : "Нажми, чтобы раскрыть"}
                                </div>
                              </TableCell>
                              <TableCell className={styles.textRight}>{total}</TableCell>
                              <TableCell className={styles.textRight}>{success}</TableCell>
                              <TableCell className={styles.textRight}>{successRate}%</TableCell>
                              <TableCell className={styles.textRight}>{formatCurrency(Number(row.средняя_стоимость) || 0)}</TableCell>
                              <TableCell className={styles.textRight}>{formatCurrency(Number(row.общая_выручка) || 0)}</TableCell>
                            </TableRow>

                            {isExpanded ? (
                              <TableRow>
                                <TableCell colSpan={6} className={styles.expandedCell}>
                                  {monthShipmentsLoading ? (
                                    <PageLoader label="Загрузка отгрузок..." />
                                  ) : monthShipmentsError ? (
                                    <p className={styles.errorText}>{monthShipmentsError}</p>
                                  ) : (
                                    <EntityTableSurface variant="embedded" className={styles.innerTableSurface}>
                                      <Table className={styles.table}>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Трек</TableHead>
                                            <TableHead>Клиент</TableHead>
                                            <TableHead>Статус</TableHead>
                                            <TableHead className={styles.textRight}>Стоимость</TableHead>
                                            <TableHead>Дата</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {monthShipments.length === 0 ? (
                                            <TableRow>
                                              <TableCell colSpan={6} className={styles.emptyCell}>
                                                Нет отгрузок
                                              </TableCell>
                                            </TableRow>
                                          ) : monthShipments.map((shipment) => (
                                            <TableRow key={shipment.id}>
                                              <TableCell>#{shipment.id}</TableCell>
                                              <TableCell>{shipment.номер_отслеживания || "—"}</TableCell>
                                              <TableCell>{shipment.клиент_название}</TableCell>
                                              <TableCell>
                                                <EntityStatusBadge
                                                  value={shipment.заявка_статус}
                                                  label={getTransportShipmentStatusLabel(shipment.заявка_статус)}
                                                  tone={getTransportShipmentStatusTone(shipment.заявка_статус)}
                                                  compact
                                                />
                                              </TableCell>
                                              <TableCell className={styles.textRight}>
                                                {formatCurrency(shipment.стоимость_доставки)}
                                              </TableCell>
                                              <TableCell>{formatDateTime(shipment.дата_отгрузки)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </EntityTableSurface>
                                  )}
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </EntityTableSurface>
              )}
            </section>
          </div>
        ) : null}
      </EntityModalShell>
    </Dialog>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  )
}
