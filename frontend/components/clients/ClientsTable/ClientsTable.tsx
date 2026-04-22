import { AnimatePresence, motion } from "framer-motion"

import { ClientAttachmentBadges } from "@/components/clients/ClientAttachmentBadges/ClientAttachmentBadges"
import { ClientRowActionsMenu } from "@/components/clients/ClientRowActionsMenu/ClientRowActionsMenu"
import { ClientTypeBadge } from "@/components/clients/ClientTypeBadge/ClientTypeBadge"
import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClientContragent } from "@/lib/clientContragents"
import { getClientContragentTypeLabel, normalizeClientContragentType } from "@/lib/clientContragents"
import { cn } from "@/lib/utils"

import styles from "./ClientsTable.module.css"

const MotionTableRow = motion(TableRow)

type ClientsTableProps = {
  clients: ClientContragent[]
  canView: boolean
  canEdit: boolean
  canHistory: boolean
  canDelete: boolean
  attachmentTypesByClientId: Record<number, string[]>
  onOpenClient: (client: ClientContragent) => void
  onEditClient: (client: ClientContragent) => void | Promise<void>
  onOpenHistory: (client: ClientContragent) => void
  onDeleteClient: (client: ClientContragent) => void
}

const getClientTypeList = (raw?: string | null) => {
  return raw ? [normalizeClientContragentType(raw)] : [] as string[]
}

export function ClientsTable({
  clients,
  canView,
  canEdit,
  canHistory,
  canDelete,
  attachmentTypesByClientId,
  onOpenClient,
  onEditClient,
  onOpenHistory,
  onDeleteClient,
}: ClientsTableProps) {
  return (
    <Table className={entityTableClassName}>
      <colgroup>
        <col className={styles.colId} />
        <col className={styles.colName} />
        <col className={styles.colType} />
        <col className={styles.colPhone} />
        <col className={styles.colEmail} />
        <col className={styles.colAddress} />
        <col className={styles.colActions} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Название</TableHead>
          <TableHead>Тип клиента</TableHead>
          <TableHead>Телефон</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Адрес</TableHead>
          <TableHead className={styles.actionsHeader}>Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {clients.map((client) => {
            const hasRowActions = canView || canEdit || canHistory || canDelete
            const clientTypes = getClientTypeList(client.тип)

            return (
              <MotionTableRow
                key={client.id}
                className={cn(styles.tableRow, canView && styles.tableRowClickable)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={canView ? () => onOpenClient(client) : undefined}
              >
                <TableCell className={styles.tableCell}>
                  <div>
                    <div className={styles.clientId}>{client.id}</div>
                    <ClientAttachmentBadges types={attachmentTypesByClientId[client.id] || []} />
                  </div>
                </TableCell>
                <TableCell className={cn(styles.tableCell, styles.nameCell)}>
                  {client.название}
                </TableCell>
                <TableCell className={styles.tableCell}>
                  {clientTypes.length ? (
                    <div className={styles.typeBadges}>
                      {clientTypes.map((type) => (
                        <ClientTypeBadge key={type} value={type} />
                      ))}
                    </div>
                  ) : (
                    <span>{getClientContragentTypeLabel(client.тип || "") || "-"}</span>
                  )}
                </TableCell>
                <TableCell className={cn(styles.tableCell, styles.mutedCell)}>
                  {client.телефон || "-"}
                </TableCell>
                <TableCell className={cn(styles.tableCell, styles.mutedCell)}>
                  {client.email || "-"}
                </TableCell>
                <TableCell className={cn(styles.tableCell, styles.mutedCell)}>
                  {client.адрес || "-"}
                </TableCell>
                <TableCell className={styles.tableCell}>
                  {hasRowActions ? (
                    <div className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                      <ClientRowActionsMenu
                        client={client}
                        canView={canView}
                        canEdit={canEdit}
                        canHistory={canHistory}
                        canDelete={canDelete}
                        onOpenClient={onOpenClient}
                        onEditClient={onEditClient}
                        onOpenHistory={onOpenHistory}
                        onDeleteClient={onDeleteClient}
                      />
                    </div>
                  ) : null}
                </TableCell>
              </MotionTableRow>
            )
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
