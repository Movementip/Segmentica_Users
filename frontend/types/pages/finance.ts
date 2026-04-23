import type { ReactNode } from 'react';

export type FinanceSettings = {
    paymentsPerMonth: 1 | 2;
    firstDay: number;
    secondDay: number | null;
};

export type FinanceSuggestedPayment = {
    key: string;
    type: 'advance' | 'salary_cycle' | 'vacation' | 'bonus' | 'sick_leave';
    encodedType: string;
    label: string;
    amount: number;
    accruedAmount: number;
    withheldAmount: number;
    paidAmount: number;
    payableAmount: number;
    recommendedDate: string;
    periodFrom: string | null;
    periodTo: string | null;
    note: string | null;
    sourceSummary: string | null;
};

export type FinancePayment = {
    id: string;
    employeeId: number | null;
    employeeName: string | null;
    amount: number;
    date: string;
    type: string | null;
    status: string | null;
    comment: string | null;
    accruedAmount: number;
    withheldAmount: number;
    paidAmount: number;
    payableAmount: number;
    paymentKind: string | null;
    periodFrom: string | null;
    periodTo: string | null;
    calculation: Record<string, any> | null;
};

export type FinanceEmployeeBase = {
    id: number;
    fio: string;
    position: string | null;
};

export type FinanceEmployee = FinanceEmployeeBase & {
    rate: number | null;
    active: boolean;
    totalPaid: number;
    paymentCount: number;
    lastPaymentDate: string | null;
    currentAccrued: number;
    currentWithheld: number;
    currentPaid: number;
    currentPayable: number;
    currentOrgDebt: number;
    currentEmployeeDebt: number;
    currentContributions: number;
    currentContributionDetails: {
        taxableIncomeMonth: number;
        contributionBaseMonth: number;
        contributionYearBase30: number;
        contributionYearBase151: number;
    };
    currentBreakdown: {
        advance: number;
        salary: number;
        vacation: number;
        bonus: number;
        sickLeave: number;
    };
    suggestedPayments: FinanceSuggestedPayment[];
    paymentHistory: FinancePayment[];
};

export type FinancePayload = {
    settings: FinanceSettings;
    paymentTableAvailable: boolean;
    selectedMonth: string;
    selectedMonthLabel: string;
    employees: FinanceEmployee[];
    recentPayments: FinancePayment[];
    totals: {
        activeEmployees: number;
        totalPaid: number;
        paymentCount: number;
    };
};

export type FinanceColumn<Employee extends FinanceEmployeeBase> = {
    key: string;
    label: ReactNode;
    render: (employee: Employee) => string;
    total?: (employees: Employee[]) => string;
};

export type FinanceMonthOption = {
    value: string;
    label: string;
};
