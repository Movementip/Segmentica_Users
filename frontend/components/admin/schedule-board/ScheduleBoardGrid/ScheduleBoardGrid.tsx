import React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { Card } from "../../../ui/card";
import { BoardPayload, getCellLabel, getCellTitle, getCellTone } from "../model";
import styles from "./ScheduleBoardGrid.module.css";

type ScheduleBoardGridProps = {
  payload: BoardPayload;
};

export function ScheduleBoardGrid({ payload }: ScheduleBoardGridProps) {
  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Матрица смен</h2>
          <p className={styles.subtitle}>
            По строкам сотрудники, по столбцам календарные дни месяца.
          </p>
        </div>
        <p className={styles.meta}>
          {payload.days.length} {payload.days.length === 1 ? "день" : payload.days.length < 5 ? "дня" : "дней"} в периоде
        </p>
      </div>

      <div className={styles.viewport}>
        {payload.employees.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={cn(styles.employeeHead, styles.stickyCol)}>Сотрудник</th>
                {payload.days.map((day) => (
                  <th
                    key={day.date}
                    className={cn(
                      styles.dayHead,
                      day.isWeekend && styles.dayHeadWeekend,
                      day.isToday && styles.dayHeadToday
                    )}
                  >
                    <div className={styles.dayNumber}>{day.dayNumber}</div>
                    <div className={styles.dayWeekday}>{day.weekdayShort}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {payload.employees.map((employee) => (
                <tr key={employee.id} className={styles.row}>
                  <td className={cn(styles.employeeCell, styles.stickyCol)}>
                    <Link href={`/managers/${employee.id}`} className={styles.employeeLink}>
                      {employee.fio}
                    </Link>
                    <div className={styles.employeeMeta}>
                      {employee.position || "Без должности"}
                      {!employee.isActive ? " · неактивен" : ""}
                    </div>
                  </td>

                  {employee.cells.map((cell, index) => {
                    const day = payload.days[index];
                    const tone = getCellTone(cell.status);

                    return (
                      <td
                        key={`${employee.id}-${cell.date}`}
                        title={getCellTitle(cell)}
                        className={cn(
                          styles.dayCell,
                          styles[tone],
                          day?.isWeekend && styles.dayCellWeekend
                        )}
                      >
                        <div className={styles.cellLabel}>{getCellLabel(cell.status)}</div>
                        {cell.startTime && cell.endTime ? (
                          <div className={styles.cellTime}>
                            {cell.startTime}-{cell.endTime}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>За выбранный период сотрудников для отображения нет.</div>
        )}
      </div>
    </Card>
  );
}
