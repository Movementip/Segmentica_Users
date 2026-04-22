import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { EmployeeSchedulePanel } from "@/components/pages/EmployeeSchedulePanel/EmployeeSchedulePanel"

import styles from "./ManagerWorkScheduleSection.module.css"

type ManagerWorkScheduleSectionProps = {
  employeeId: number
  canEdit: boolean
  canApplyPattern: boolean
  title?: string
  description?: string
  className?: string
}

export function ManagerWorkScheduleSection({
  employeeId,
  canEdit,
  canApplyPattern,
  title = "График работы",
  description = "Месяц, неделя, шаблон графика и отпуск сотрудника в одной карточке.",
  className,
}: ManagerWorkScheduleSectionProps) {
  return (
    <Card className={cn(styles.root, className)}>
      <CardHeader className={styles.header}>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={styles.content}>
        <EmployeeSchedulePanel
          employeeId={employeeId}
          canEdit={canEdit}
          canApplyPattern={canApplyPattern}
        />
      </CardContent>
    </Card>
  )
}
