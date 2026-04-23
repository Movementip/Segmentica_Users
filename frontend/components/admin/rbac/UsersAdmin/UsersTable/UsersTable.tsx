import { AnimatePresence, motion } from "framer-motion"

import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type { UserRow } from "@/types/pages/admin-rbac"
import styles from "./UsersTable.module.css"

const MotionTableRow = motion(TableRow)

type UsersTableProps = {
  users: UserRow[]
  roleKeysByUserId: Map<number, string[]>
  onOpenUser: (user: UserRow) => void
}

export function UsersTable({ users, roleKeysByUserId, onOpenUser }: UsersTableProps) {
  return (
    <Table className={`${entityTableClassName} ${styles.table}`}>
      <colgroup>
        <col className={styles.colUserId} />
        <col className={styles.colEmployeeId} />
        <col className={styles.colFio} />
        <col className={styles.colPosition} />
        <col className={styles.colStatus} />
        <col className={styles.colRoles} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>User ID</TableHead>
          <TableHead>Сотрудник</TableHead>
          <TableHead>ФИО</TableHead>
          <TableHead>Должность</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Роли</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {users.map((user) => {
            const roleKeys = roleKeysByUserId.get(Number(user.user_id)) || []

            return (
              <MotionTableRow
                key={user.user_id}
                className={cn(styles.tableRow, styles.tableRowClickable)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => onOpenUser(user)}
              >
                <TableCell className={styles.tableCell}>
                  <span className={styles.idValue}>#{user.user_id}</span>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <span className={styles.primaryText}>
                    {user.employee_id ? `#${user.employee_id}` : "—"}
                  </span>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <div className={styles.personCell}>
                    <div className={cn(styles.primaryText, styles.personName)}>
                      {user.fio || "—"}
                    </div>
                  </div>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <div className={cn(styles.secondaryText, styles.positionText)}>
                    {user.position || "—"}
                  </div>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  <div className={styles.statusWrap}>
                    <EntityStatusBadge
                      value={user.is_active === false ? "Отключен" : "Активен"}
                      label={user.is_active === false ? "Отключен" : "Активен"}
                      tone={user.is_active === false ? "muted" : "success"}
                      compact
                    />
                  </div>
                </TableCell>

                <TableCell className={styles.tableCell}>
                  {roleKeys.length > 0 ? (
                    <div className={styles.roleBadges}>
                      {roleKeys.map((roleKey) => (
                        <Badge key={roleKey} variant="secondary" className={styles.roleBadge}>
                          {roleKey}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.mutedText}>Нет ролей</span>
                  )}
                </TableCell>
              </MotionTableRow>
            )
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  )
}
