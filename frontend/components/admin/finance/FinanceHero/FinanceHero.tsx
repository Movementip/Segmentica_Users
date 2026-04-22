import React from 'react';
import { FiChevronLeft, FiChevronRight, FiFileText, FiPrinter, FiSearch } from 'react-icons/fi';

import { RefreshButton } from '../../../RefreshButton/RefreshButton';
import { Button } from '../../../ui/button';
import { Card } from '../../../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import styles from '../../../../pages/admin/AdminFinance.module.css';

type FinanceSettingsDraft = {
  paymentsPerMonth: 1 | 2;
  firstDay: number;
  secondDay: number | null;
};

type MonthOption = {
  value: string;
  label: string;
};

type FinanceHeroProps = {
  monthKey: string;
  monthLabel: string;
  monthOptions: MonthOption[];
  isNextMonthDisabled: boolean;
  settingsDraft: FinanceSettingsDraft;
  search: string;
  saving: boolean;
  selectedEmployeeIdsCount: number;
  canUseFinanceDocumentCenter: boolean;
  isManualPaymentDisabled: boolean;
  isBuildDisabled: boolean;
  isRefreshing: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (value: string) => void;
  onPaymentsPerMonthChange: (value: 1 | 2) => void;
  onFirstDayChange: (value: number) => void;
  onSecondDayChange: (value: number) => void;
  onSaveSettings: () => void;
  onSearchChange: (value: string) => void;
  onBuildEntries: () => void;
  onOpenManualPaymentDialog: () => void;
  onOpenBatchPayrollPreview: () => void;
  onOpenSelectedStatementsPreview: () => void;
  onOpenTimesheetPreview: () => void;
  onRefresh: () => void;
};

export function FinanceHero({
  monthKey,
  monthLabel,
  monthOptions,
  isNextMonthDisabled,
  settingsDraft,
  search,
  saving,
  selectedEmployeeIdsCount,
  canUseFinanceDocumentCenter,
  isManualPaymentDisabled,
  isBuildDisabled,
  isRefreshing,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  onPaymentsPerMonthChange,
  onFirstDayChange,
  onSecondDayChange,
  onSaveSettings,
  onSearchChange,
  onBuildEntries,
  onOpenManualPaymentDialog,
  onOpenBatchPayrollPreview,
  onOpenSelectedStatementsPreview,
  onOpenTimesheetPreview,
  onRefresh,
}: FinanceHeroProps) {
  return (
    <>
      <div className={styles.payrollHeroTop}>
        <div className={styles.payrollHeroTitleBlock}>
          <h1 className={styles.title}>Расчет зарплаты</h1>
          <div className={styles.subtitle}>
            Месячный расчет начислений, удержаний, выплат, задолженностей и взносов.
          </div>
        </div>
        <div className={styles.monthControls}>
          <Button
            type="button"
            variant="outline"
            className={`${styles.monthArrowButton} ${styles.surfaceButton}`}
            onClick={onPrevMonth}
          >
            <FiChevronLeft />
          </Button>
          <Select value={monthKey} onValueChange={(value) => onMonthChange(String(value))}>
            <SelectTrigger className={styles.monthSelect}>
              <SelectValue>{monthLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent className={styles.selectContent}>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className={`${styles.monthArrowButton} ${styles.surfaceButton}`}
            onClick={onNextMonth}
            disabled={isNextMonthDisabled}
            title={isNextMonthDisabled ? 'Следующий месяц ещё не наступил' : undefined}
          >
            <FiChevronRight />
          </Button>
        </div>
      </div>

      <div className={styles.payrollHero}>
        <Card className={styles.scheduleInlineCard}>
          <div className={styles.scheduleInlineHeader}>
            <div className={styles.scheduleInlineTitleBlock}>
              <div className={styles.panelLabel}>Режим начисления</div>
              <p className={styles.scheduleInlineHint}>
                Если режим — 2 раза в месяц, первый день используется как аванс, второй — как основная зарплата.
              </p>
            </div>
            <div className={styles.scheduleInlineNote}>
              <p className={styles.scheduleInlineLead}>
                Настройка влияет только на расчёт месяца: аванс, зарплата, отпускные и больничные считаются по этому графику.
              </p>
              <p className={styles.scheduleInlineLead}>
                Выплаты проводим вручную отдельным действием.
              </p>
            </div>
          </div>
          <div className={styles.scheduleInlineControls}>
            <Select
              value={String(settingsDraft.paymentsPerMonth)}
              onValueChange={(value) => onPaymentsPerMonthChange(value === '1' ? 1 : 2)}
            >
              <SelectTrigger className={styles.compactSelect}>
                <SelectValue>{settingsDraft.paymentsPerMonth === 1 ? '1 раз в месяц' : '2 раза в месяц'}</SelectValue>
              </SelectTrigger>
              <SelectContent className={styles.selectContent}>
                <SelectItem value="1">1 раз в месяц</SelectItem>
                <SelectItem value="2">2 раза в месяц</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(settingsDraft.firstDay)}
              onValueChange={(value) => onFirstDayChange(Number(value))}
            >
              <SelectTrigger className={styles.compactDaySelect}>
                <SelectValue>{String(settingsDraft.firstDay)}</SelectValue>
              </SelectTrigger>
              <SelectContent className={styles.selectContent}>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <SelectItem key={`first-${day}`} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {settingsDraft.paymentsPerMonth === 2 ? (
              <Select
                value={String(settingsDraft.secondDay || 25)}
                onValueChange={(value) => onSecondDayChange(Number(value))}
              >
                <SelectTrigger className={styles.compactDaySelect}>
                  <SelectValue>{String(settingsDraft.secondDay || 25)}</SelectValue>
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <SelectItem key={`second-${day}`} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={`${styles.inlineButton} ${styles.surfaceButton}`}
              onClick={onSaveSettings}
              disabled={saving}
            >
              Сохранить
            </Button>
          </div>
        </Card>

        <Card className={styles.toolbarPanel}>
          <div className={styles.toolbarSearchBlock}>
            <div className={styles.panelLabel}>Поиск сотрудника</div>
            <div className={styles.searchField}>
              <FiSearch className={styles.searchIcon} />
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className={styles.searchInput}
                placeholder="ФИО сотрудника"
              />
            </div>
          </div>

          <div className={styles.toolbarActionsBlock}>
            <div className={styles.actionButtonsRow}>
              <Button
                type="button"
                variant="default"
                className={styles.primaryButton}
                onClick={onBuildEntries}
                disabled={isBuildDisabled}
              >
                <FiFileText className={styles.icon} />
                {saving ? 'Проведение…' : 'Провести выплаты'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className={`${styles.actionButton} ${styles.surfaceButton}`}
                onClick={onOpenManualPaymentDialog}
                disabled={isManualPaymentDisabled}
              >
                Ручная выплата
              </Button>

              {canUseFinanceDocumentCenter ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={(
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.actionButton} ${styles.surfaceButton}`}
                        disabled={!selectedEmployeeIdsCount}
                      />
                    )}
                  >
                    <FiPrinter className={styles.icon} />
                    Напечатать
                    <FiChevronRight className={styles.menuChevron} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={styles.printMenu}>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        Выбрано {selectedEmployeeIdsCount} {selectedEmployeeIdsCount === 1 ? 'сотрудник' : selectedEmployeeIdsCount < 5 ? 'сотрудника' : 'сотрудников'}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onOpenBatchPayrollPreview}>Расчетно платежная ведомость</DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenSelectedStatementsPreview}>
                        {selectedEmployeeIdsCount === 1 ? 'Расчетный лист' : 'Расчетные листы'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenTimesheetPreview}>
                        {selectedEmployeeIdsCount === 1 ? 'Табель учета рабочего времени' : 'Табели учета рабочего времени'}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <RefreshButton
                className={`${styles.actionButton} ${styles.surfaceButton}`}
                isRefreshing={isRefreshing}
                iconClassName={styles.spin}
                onClick={onRefresh}
              />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
