import { EntityStatsPanel } from "@/components/EntityStatsPanel/EntityStatsPanel"

import type { UserRow } from "@/types/pages/admin-rbac"

type UsersStatsProps = {
  users: UserRow[]
  roleKeysByUserId: Map<number, string[]>
}

export function UsersStats({ users, roleKeysByUserId }: UsersStatsProps) {
  const totalUsers = users.length
  const activeUsers = users.filter((user) => user.is_active !== false).length
  const linkedEmployees = users.filter((user) => user.employee_id != null).length
  const directors = users.filter((user) =>
    (roleKeysByUserId.get(Number(user.user_id)) || []).includes("director")
  ).length

  return (
    <EntityStatsPanel
      title="Статистика сотрудников"
      items={[
        { label: "Всего пользователей", value: totalUsers },
        { label: "Активные", value: activeUsers },
        { label: "Привязаны к сотруднику", value: linkedEmployees },
        { label: "С ролью director", value: directors },
      ]}
    />
  )
}
