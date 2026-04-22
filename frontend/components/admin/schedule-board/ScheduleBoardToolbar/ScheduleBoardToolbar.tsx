import React from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { RefreshButton } from "../../../RefreshButton/RefreshButton";
import { SegmentedTabs } from "../../../SegmentedTabs/SegmentedTabs";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import styles from "./ScheduleBoardToolbar.module.css";

type ScheduleBoardToolbarProps = {
  monthLabel: string;
  rangeLabel: string;
  employeeCount: number;
  includeInactive: boolean;
  refreshing: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onIncludeInactiveChange: (value: boolean) => void;
  onRefresh: () => void;
};

export function ScheduleBoardToolbar({
  monthLabel,
  rangeLabel,
  employeeCount,
  includeInactive,
  refreshing,
  onPrevMonth,
  onNextMonth,
  onIncludeInactiveChange,
  onRefresh,
}: ScheduleBoardToolbarProps) {
  return (
    <Card className={styles.card}>
      <div className={styles.layout}>
        <div className={styles.periodBlock}>
          <Button
            type="button"
            variant="outline"
            className={styles.periodNavButton}
            onClick={onPrevMonth}
            aria-label="Предыдущий месяц"
          >
            <FiChevronLeft />
          </Button>

          <div className={styles.periodText}>
            <p className={styles.periodCaption}>Период</p>
            <h2 className={styles.periodTitle}>{monthLabel}</h2>
            <p className={styles.periodMeta}>
              {rangeLabel} · {employeeCount} {employeeCount === 1 ? "сотрудник" : employeeCount < 5 ? "сотрудника" : "сотрудников"}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className={styles.periodNavButton}
            onClick={onNextMonth}
            aria-label="Следующий месяц"
          >
            <FiChevronRight />
          </Button>
        </div>

        <div className={styles.actions}>
          <div className={styles.tabsWrap}>
            <SegmentedTabs
              value={includeInactive ? "all" : "active"}
              items={[
                { value: "active", label: "Активные" },
                { value: "all", label: "Все сотрудники" },
              ]}
              ariaLabel="Состав сотрудников"
              onChange={(value) => onIncludeInactiveChange(value === "all")}
            />
          </div>

          <RefreshButton
            className={styles.refreshButton}
            isRefreshing={refreshing}
            iconClassName={styles.spin}
            onClick={onRefresh}
          />
        </div>
      </div>
    </Card>
  );
}
