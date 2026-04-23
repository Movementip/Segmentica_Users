import React from 'react';
import { CheckIcon, MinusIcon } from 'lucide-react';

import { Card } from '../../../ui/card';
import { Checkbox } from '../../../ui/checkbox';
import type { FinanceColumn, FinanceEmployeeBase } from '../../../../types/pages/finance';
import styles from '../../../../pages/admin/AdminFinance.module.css';

type FinancePayrollTableProps<Employee extends FinanceEmployeeBase> = {
  monthLabel: string;
  description: string;
  selectedCount: number;
  gridTemplateColumns: string;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  activeColumns: Array<FinanceColumn<Employee>>;
  employees: Employee[];
  totalEmployees: Employee[];
  isEmployeeSelected: (employeeId: number) => boolean;
  onToggleVisible: () => void;
  onToggleEmployee: (employeeId: number) => void;
  renderEmployeeHints: (employee: Employee) => React.ReactNode;
};

export function FinancePayrollTable<Employee extends FinanceEmployeeBase>({
  monthLabel,
  description,
  selectedCount,
  gridTemplateColumns,
  allVisibleSelected,
  someVisibleSelected,
  activeColumns,
  employees,
  totalEmployees,
  isEmployeeSelected,
  onToggleVisible,
  onToggleEmployee,
  renderEmployeeHints,
}: FinancePayrollTableProps<Employee>) {
  return (
    <Card className={`${styles.payrollCard} py-0 gap-0`}>
      <div className={styles.payrollCardHeader}>
        <div>
          <div className={styles.sectionTitle}>Месяц: {monthLabel}</div>
          <div className={styles.sectionSubtitle}>{description}</div>
        </div>
        <div className={styles.selectionMeta}>Выбрано сотрудников: {selectedCount}</div>
      </div>

      <div className={styles.payrollGrid}>
        <div className={styles.payrollHeaderRow} style={{ gridTemplateColumns }}>
          <div className={styles.checkboxCell}>
            <button
              type="button"
              role="checkbox"
              aria-checked={allVisibleSelected ? 'true' : (someVisibleSelected ? 'mixed' : 'false')}
              className={`${styles.financeCheckbox} ${allVisibleSelected || someVisibleSelected ? styles.financeCheckboxChecked : ''}`}
              onClick={onToggleVisible}
            >
              {allVisibleSelected ? <CheckIcon /> : someVisibleSelected ? <MinusIcon /> : null}
            </button>
          </div>
          <div className={styles.employeeHeaderCell}>Сотрудник</div>
          {activeColumns.map((column) => (
            <div key={column.key} className={styles.metricHeaderCell}>
              {column.label}
            </div>
          ))}
        </div>

        {employees.map((employee) => (
          <div key={employee.id} className={styles.payrollRow} style={{ gridTemplateColumns }}>
            <div className={styles.checkboxCell}>
              <Checkbox
                checked={isEmployeeSelected(employee.id)}
                onCheckedChange={() => onToggleEmployee(employee.id)}
                className={styles.financeCheckbox}
              />
            </div>
            <div className={styles.employeeCell}>
              <div className={styles.employeeName}>{employee.fio}</div>
              <div className={styles.employeeRole}>{employee.position || '—'}</div>
              <div className={styles.employeeHints}>{renderEmployeeHints(employee)}</div>
            </div>
            {activeColumns.map((column) => (
              <div key={column.key} className={styles.metricCell}>
                {column.render(employee)}
              </div>
            ))}
          </div>
        ))}

        <div className={styles.payrollTotalRow} style={{ gridTemplateColumns }}>
          <div />
          <div className={styles.totalLabel}>Итого</div>
          {activeColumns.map((column) => (
            <div key={column.key} className={styles.totalCell}>
              {column.total ? column.total(totalEmployees) : '—'}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
