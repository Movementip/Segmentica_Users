import React from 'react';

import { Card } from '../../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import styles from '../../../../pages/admin/AdminFinance.module.css';

type FinancePaymentRow = {
  id: string;
  employeeName: string | null;
  date: string;
  paymentKind: string | null;
  type: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  accruedAmount: number;
  paidAmount: number;
  amount: number;
  withheldAmount: number;
};

type FinancePaymentsJournalProps = {
  monthLabel: string;
  payments: FinancePaymentRow[];
  formatDate: (value: string | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
};

export function FinancePaymentsJournal({
  monthLabel,
  payments,
  formatDate,
  formatNumber,
}: FinancePaymentsJournalProps) {
  return (
    <Card className={`${styles.tableCard} py-0 gap-0`}>
      <div className={styles.sectionTitleRow}>
        <div>
          <div className={styles.sectionTitle}>Журнал проведённых выплат</div>
          <div className={styles.sectionSubtitle}>
            Здесь видно, что уже реально занесено в таблицу выплат за {monthLabel}.
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <Table className={styles.simpleTable}>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Вид</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Начислено</TableHead>
              <TableHead>Удержано</TableHead>
              <TableHead>Выплачено</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length ? payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.date)}</TableCell>
                <TableCell>{payment.employeeName || '—'}</TableCell>
                <TableCell>{payment.paymentKind || payment.type || '—'}</TableCell>
                <TableCell>
                  {payment.periodFrom || payment.periodTo ? `${formatDate(payment.periodFrom)} - ${formatDate(payment.periodTo)}` : '—'}
                </TableCell>
                <TableCell>{formatNumber(payment.accruedAmount || payment.amount)}</TableCell>
                <TableCell>{formatNumber(payment.withheldAmount)}</TableCell>
                <TableCell>{formatNumber(payment.paidAmount || payment.amount)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className={styles.emptyCell}>
                  За выбранный месяц выплат пока нет.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
