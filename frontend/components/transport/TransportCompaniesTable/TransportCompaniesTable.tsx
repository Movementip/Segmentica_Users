import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { FiMail, FiPhone } from "react-icons/fi"

import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { TransportCompanyRowActionsMenu } from "@/components/transport/TransportCompanyRowActionsMenu/TransportCompanyRowActionsMenu"
import type { TransportCompany } from "@/components/transport/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import styles from "./TransportCompaniesTable.module.css"

const MotionTableRow = motion(TableRow)

type TransportCompaniesTableProps = {
  canDelete: boolean
  canEdit: boolean
  canStatsView: boolean
  canView: boolean
  companies: TransportCompany[]
  formatCurrency: (amount: number | null) => string
  formatDate: (date: string) => string
  renderAttachmentBadges: (companyId: number) => ReactNode
  onDeleteCompany: (company: TransportCompany) => void
  onEditCompany: (company: TransportCompany) => void
  onOpenCompany: (company: TransportCompany) => void
  onOpenStats: (company: TransportCompany) => void
}

export function TransportCompaniesTable({
  canDelete,
  canEdit,
  canStatsView,
  canView,
  companies,
  formatCurrency,
  formatDate,
  renderAttachmentBadges,
  onDeleteCompany,
  onEditCompany,
  onOpenCompany,
  onOpenStats,
}: TransportCompaniesTableProps) {
  return (
    <Table className={entityTableClassName}>
      <TableHeader>
        <TableRow>
          <TableHead>Компания</TableHead>
          <TableHead>Контакты</TableHead>
          <TableHead className={styles.textRight}>Тариф</TableHead>
          <TableHead className={styles.textRight}>Всего</TableHead>
          <TableHead className={styles.textRight}>Активные</TableHead>
          <TableHead className={styles.textRight}>Завершенные</TableHead>
          <TableHead className={`${styles.textRight} ${styles.sumColumn}`}>
            <div className={styles.sumColumnInner}>Средняя</div>
          </TableHead>
          <TableHead className={`${styles.textRight} ${styles.sumColumn}`}>
            <div className={styles.sumColumnInner}>Выручка</div>
          </TableHead>
          <TableHead>Регистрация</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {companies.map((company) => (
            <MotionTableRow
              key={company.id}
              className={cn(styles.tableRow, canView && styles.tableRowClickable)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={canView ? () => onOpenCompany(company) : undefined}
            >
              <TableCell className={styles.tableCell}>
                <div className={styles.companyCell}>
                  <div className={styles.companyName}>{company.название}</div>
                  {renderAttachmentBadges(company.id)}
                  <div className={styles.companyMeta}>ID: {company.id}</div>
                </div>
              </TableCell>

              <TableCell className={styles.tableCell}>
                <div className={styles.contactsCell}>
                  {company.телефон ? (
                    <div className={styles.contactLine}>
                      <FiPhone className={styles.contactIcon} />
                      <span>{company.телефон}</span>
                    </div>
                  ) : null}
                  {company.email ? (
                    <div className={styles.contactLine}>
                      <FiMail className={styles.contactIcon} />
                      <span>{company.email}</span>
                    </div>
                  ) : null}
                  {!company.телефон && !company.email ? (
                    <span className={styles.mutedText}>Не указаны</span>
                  ) : null}
                </div>
              </TableCell>

              <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell}`}>
                {formatCurrency(company.тариф)}
              </TableCell>
              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.metricValue}>{company.общее_количество_отгрузок || 0}</div>
              </TableCell>
              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.metricValue}>{company.активные_отгрузки || 0}</div>
              </TableCell>
              <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                <div className={styles.metricValue}>{company.завершенные_отгрузки || 0}</div>
              </TableCell>
              <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                <div className={styles.sumColumnInner}>{formatCurrency(company.средняя_стоимость)}</div>
              </TableCell>
              <TableCell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                <div className={styles.sumColumnInner}>{formatCurrency(company.общая_выручка)}</div>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <span className={styles.companyMeta}>{formatDate(company.created_at)}</span>
              </TableCell>
              <TableCell className={styles.tableCell}>
                <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                  <TransportCompanyRowActionsMenu
                    company={company}
                    canDelete={canDelete}
                    canEdit={canEdit}
                    canStatsView={canStatsView}
                    canView={canView}
                    onDeleteCompany={onDeleteCompany}
                    onEditCompany={onEditCompany}
                    onOpenCompany={onOpenCompany}
                    onOpenStats={onOpenStats}
                  />
                </div>
              </TableCell>
            </MotionTableRow>
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
