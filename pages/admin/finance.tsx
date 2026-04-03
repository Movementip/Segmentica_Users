import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withLayout } from '../../layout';
import { Box, Button, Card, Dialog, Flex, Grid, Select, Table, Text, TextArea, TextField } from '@radix-ui/themes';
import { FiDownload, FiFileText, FiPrinter, FiRefreshCw, FiSave, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import styles from './AdminFinance.module.css';

type FinanceSettings = {
    paymentsPerMonth: 1 | 2;
    firstDay: number;
    secondDay: number | null;
};

type FinanceEmployee = {
    id: number;
    fio: string;
    position: string | null;
    rate: number | null;
    active: boolean;
    totalPaid: number;
    paymentCount: number;
    lastPaymentDate: string | null;
    currentAccrued: number;
    currentWithheld: number;
    currentPaid: number;
    currentPayable: number;
    suggestedPayments: FinanceSuggestedPayment[];
    paymentHistory: FinancePayment[];
};

type FinancePayment = {
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

type FinanceSuggestedPayment = {
    key: string;
    type: 'advance' | 'salary_cycle' | 'vacation' | 'bonus';
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

type FinancePayload = {
    settings: FinanceSettings;
    paymentTableAvailable: boolean;
    employees: FinanceEmployee[];
    recentPayments: FinancePayment[];
    totals: {
        activeEmployees: number;
        totalPaid: number;
        paymentCount: number;
    };
};

type StatementPreviewState = {
    title: string;
    url: string;
};

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(value) || 0);
}

function formatSuggestedPaymentLabel(value: FinanceSuggestedPayment | null | undefined): string {
    if (!value) return 'Ручная выплата';
    return value.label;
}

function getPrimarySuggestion(items: FinanceSuggestedPayment[]): FinanceSuggestedPayment | null {
    if (!items.length) return null;

    return items.reduce<FinanceSuggestedPayment | null>((best, item) => {
        if (!best) return item;

        const bestTime = new Date(best.recommendedDate).getTime();
        const itemTime = new Date(item.recommendedDate).getTime();
        if (itemTime !== bestTime) return itemTime > bestTime ? item : best;

        const bestRank = best.type === 'salary_cycle' ? 3 : best.type === 'advance' ? 2 : best.type === 'vacation' ? 1 : 0;
        const itemRank = item.type === 'salary_cycle' ? 3 : item.type === 'advance' ? 2 : item.type === 'vacation' ? 1 : 0;
        return itemRank > bestRank ? item : best;
    }, null);
}

function formatPeriod(dateFrom: string | null | undefined, dateTo: string | null | undefined): string {
    if (!dateFrom && !dateTo) return '—';
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
    return formatDate(dateFrom || dateTo || '');
}

function buildStatementUrl(params: {
    employeeId: number;
    employeeIds?: number[];
    sourceType: 'current' | 'history' | 'current_batch';
    format: 'html' | 'excel' | 'pdf';
    sourceKey?: string | null;
    paymentId?: string | null;
    disposition?: 'inline' | 'attachment';
}): string {
    const search = new URLSearchParams();
    search.set('sourceType', params.sourceType);
    search.set('format', params.format);
    search.set('disposition', params.disposition || 'attachment');
    if (params.sourceType === 'current_batch') {
        if (params.employeeIds?.length) {
            search.set('employeeIds', params.employeeIds.join(','));
        }
    } else {
        search.set('employeeId', String(params.employeeId));
    }
    if (params.sourceKey) search.set('sourceKey', params.sourceKey);
    if (params.paymentId) search.set('paymentId', params.paymentId);
    return `/api/admin/finance/statement?${search.toString()}`;
}

function AdminFinancePage(): JSX.Element {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [employees, setEmployees] = useState<FinanceEmployee[]>([]);
    const [recentPayments, setRecentPayments] = useState<FinancePayment[]>([]);
    const [paymentTableAvailable, setPaymentTableAvailable] = useState(false);
    const [months, setMonths] = useState('6');
    const [search, setSearch] = useState('');
    const [settings, setSettings] = useState<FinanceSettings>({ paymentsPerMonth: 2, firstDay: 10, secondDay: 25 });
    const [rateDrafts, setRateDrafts] = useState<Record<number, string>>({});
    const [paymentDialogEmployee, setPaymentDialogEmployee] = useState<FinanceEmployee | null>(null);
    const [statementEmployee, setStatementEmployee] = useState<FinanceEmployee | null>(null);
    const [statementPreview, setStatementPreview] = useState<StatementPreviewState | null>(null);
    const [batchStatementOpen, setBatchStatementOpen] = useState(false);
    const [batchStatementSelection, setBatchStatementSelection] = useState<number[]>([]);
    const [paymentForm, setPaymentForm] = useState({
        suggestionKey: 'manual',
        paymentType: 'зарплата',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        comment: '',
    });
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const previewFrameRef = useRef<HTMLIFrameElement | null>(null);

    const canViewFinance = Boolean(user?.permissions?.includes('admin.finance'));

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/admin/finance?months=${encodeURIComponent(months)}`);
            const data = (await response.json().catch(() => ({}))) as FinancePayload | { error?: string };
            if (!response.ok) {
                throw new Error((data as { error?: string })?.error || 'Ошибка загрузки финансов');
            }

            const payload = data as FinancePayload;
            setEmployees(payload.employees || []);
            setRecentPayments(payload.recentPayments || []);
            setPaymentTableAvailable(Boolean(payload.paymentTableAvailable));
            setSettings(payload.settings);
            setRateDrafts(
                Object.fromEntries((payload.employees || []).map((employee) => [employee.id, employee.rate == null ? '' : String(employee.rate)]))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки финансов');
        } finally {
            setLoading(false);
        }
    }, [months]);

    useEffect(() => {
        if (authLoading) return;
        if (!canViewFinance) return;
        void loadData();
    }, [authLoading, canViewFinance, loadData]);

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((employee) =>
            String(employee.id).includes(q) ||
            String(employee.fio || '').toLowerCase().includes(q) ||
            String(employee.position || '').toLowerCase().includes(q)
        );
    }, [employees, search]);

    const batchStatementCandidates = useMemo(
        () => filteredEmployees.filter((employee) => employee.active && employee.suggestedPayments.length > 0),
        [filteredEmployees]
    );

    const getSuggestionByKey = (employee: FinanceEmployee | null, key: string): FinanceSuggestedPayment | null => {
        if (!employee) return null;
        return employee.suggestedPayments.find((item) => item.key === key) || null;
    };

    const handleSaveSettings = async () => {
        try {
            setSaving(true);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/finance', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save-settings',
                    paymentsPerMonth: settings.paymentsPerMonth,
                    firstDay: settings.firstDay,
                    secondDay: settings.paymentsPerMonth === 2 ? settings.secondDay : null,
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(data?.error || 'Ошибка сохранения графика');
            }
            setNotice('График начисления сохранен.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка сохранения графика');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRate = async (employee: FinanceEmployee) => {
        try {
            setSaving(true);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/finance', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update-rate',
                    employeeId: employee.id,
                    rate: rateDrafts[employee.id] === '' ? null : Number(rateDrafts[employee.id]),
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(data?.error || 'Ошибка сохранения ставки');
            }
            setNotice(`Ставка сотрудника "${employee.fio}" обновлена.`);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка сохранения ставки');
        } finally {
            setSaving(false);
        }
    };

    const openPaymentDialog = (employee: FinanceEmployee) => {
        const firstSuggestion = getPrimarySuggestion(employee.suggestedPayments);
        setPaymentDialogEmployee(employee);
        setPaymentError(null);
        setPaymentForm({
            suggestionKey: firstSuggestion?.key || 'manual',
            paymentType: firstSuggestion?.encodedType || 'зарплата',
            amount: firstSuggestion ? String(firstSuggestion.amount) : (employee.rate == null ? '' : String(employee.rate)),
            date: firstSuggestion?.recommendedDate || new Date().toISOString().slice(0, 10),
            comment: firstSuggestion?.note || '',
        });
    };

    const handleSuggestionChange = (value: string) => {
        setPaymentForm((prev) => {
            const suggestion = getSuggestionByKey(paymentDialogEmployee, value);
            if (!suggestion) {
                return {
                    ...prev,
                    suggestionKey: 'manual',
                    paymentType: 'зарплата',
                };
            }

            return {
                ...prev,
                suggestionKey: suggestion.key,
                paymentType: suggestion.encodedType,
                amount: String(suggestion.amount),
                date: suggestion.recommendedDate,
                comment: suggestion.note || '',
            };
        });
    };

    const handlePayNow = async () => {
        if (!paymentDialogEmployee) return;
        try {
            setSaving(true);
            setPaymentError(null);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'pay-now',
                    employeeId: paymentDialogEmployee.id,
                    amount: Number(paymentForm.amount),
                    date: paymentForm.date,
                    paymentType: paymentForm.paymentType,
                    comment: paymentForm.comment,
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                setPaymentError(data?.error || 'Ошибка выплаты');
                return;
            }

            setPaymentDialogEmployee(null);
            setNotice(`Выплата сотруднику "${paymentDialogEmployee.fio}" сохранена.`);
            await loadData();
        } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Ошибка выплаты');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkPayrollToday = async () => {
        try {
            setSaving(true);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'bulk-payroll-today',
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(data?.error || 'Ошибка массовой выплаты по графику');
            }

            setNotice('Все начисления, которые по графику нужно выплатить сегодня, проведены текущей датой.');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка массовой выплаты по графику');
        } finally {
            setSaving(false);
        }
    };

    const openStatementPreviewForSuggestion = (employee: FinanceEmployee, suggestion: FinanceSuggestedPayment) => {
        setStatementPreview({
            title: `${employee.fio} · ${suggestion.type === 'advance' ? 'Аванс' : suggestion.type === 'vacation' ? 'Отпускные' : suggestion.type === 'bonus' ? 'Премия' : 'Зарплата'}`,
            url: buildStatementUrl({
                employeeId: employee.id,
                sourceType: 'current',
                sourceKey: suggestion.key,
                format: 'pdf',
                disposition: 'inline',
            }),
        });
    };

    const openStatementPreviewForPayment = (employee: FinanceEmployee, payment: FinancePayment) => {
        setStatementPreview({
            title: `${employee.fio} · ${payment.paymentKind || payment.type || 'Выплата'}`,
            url: buildStatementUrl({
                employeeId: employee.id,
                sourceType: 'history',
                paymentId: payment.id,
                format: 'pdf',
                disposition: 'inline',
            }),
        });
    };

    const downloadStatementForSuggestion = (employee: FinanceEmployee, suggestion: FinanceSuggestedPayment, format: 'excel' | 'pdf') => {
        window.open(
            buildStatementUrl({
                employeeId: employee.id,
                sourceType: 'current',
                sourceKey: suggestion.key,
                format,
                disposition: 'attachment',
            }),
            '_blank',
            'noopener,noreferrer'
        );
    };

    const downloadStatementForPayment = (employee: FinanceEmployee, payment: FinancePayment, format: 'excel' | 'pdf') => {
        window.open(
            buildStatementUrl({
                employeeId: employee.id,
                sourceType: 'history',
                paymentId: payment.id,
                format,
                disposition: 'attachment',
            }),
            '_blank',
            'noopener,noreferrer'
        );
    };

    const handlePrintStatementPreview = () => {
        previewFrameRef.current?.contentWindow?.focus();
        previewFrameRef.current?.contentWindow?.print();
    };

    const openBatchStatementDialog = () => {
        setBatchStatementSelection(batchStatementCandidates.map((employee) => employee.id));
        setBatchStatementOpen(true);
    };

    const toggleBatchStatementEmployee = (employeeId: number) => {
        setBatchStatementSelection((prev) => (
            prev.includes(employeeId)
                ? prev.filter((id) => id !== employeeId)
                : [...prev, employeeId]
        ));
    };

    const openBatchStatementPreview = () => {
        if (!batchStatementSelection.length) return;
        setStatementPreview({
            title: `Расчетно-платежная ведомость · ${batchStatementSelection.length} сотрудников`,
            url: buildStatementUrl({
                employeeId: 0,
                employeeIds: batchStatementSelection,
                sourceType: 'current_batch',
                format: 'pdf',
                disposition: 'inline',
            }),
        });
    };

    const downloadBatchStatement = (format: 'excel' | 'pdf') => {
        if (!batchStatementSelection.length) return;
        window.open(
            buildStatementUrl({
                employeeId: 0,
                employeeIds: batchStatementSelection,
                sourceType: 'current_batch',
                format,
                disposition: 'attachment',
            }),
            '_blank',
            'noopener,noreferrer'
        );
    };

    if (authLoading || loading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canViewFinance) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Финансы</h1>
                    <div className={styles.subtitle}>Начисления зарплаты, ставки сотрудников и ручные выплаты (доступ: director)</div>
                </div>
                <div className={styles.actions}>
                    <Select.Root value={months} onValueChange={setMonths}>
                        <Select.Trigger className={styles.periodSelect} />
                        <Select.Content className={styles.selectContent}>
                            <Select.Item value="1">1 месяц</Select.Item>
                            <Select.Item value="3">3 месяца</Select.Item>
                            <Select.Item value="6">6 месяцев</Select.Item>
                            <Select.Item value="12">12 месяцев</Select.Item>
                            <Select.Item value="24">24 месяца</Select.Item>
                        </Select.Content>
                    </Select.Root>
                    <Button variant="surface" color="gray" highContrast className={`${styles.actionButton} ${styles.surfaceButton}`} onClick={() => void loadData()}>
                        <FiRefreshCw className={styles.icon} />
                        Обновить
                    </Button>
                </div>
            </div>

            <Card className={styles.scheduleCard}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <Text size="4" weight="bold">График начисления зарплаты</Text>
                        <Text as="div" size="2" color="gray">
                            Это настройка графика. Автоматического начисления пока нет, но директор может управлять датами и делать выплаты вручную.
                        </Text>
                    </div>
                    <Button variant="solid" color="gray" highContrast className={styles.primaryButton} onClick={() => void handleSaveSettings()} disabled={saving}>
                        <FiSave className={styles.icon} />
                        Сохранить график
                    </Button>
                </div>

                <Grid columns={{ initial: '1', md: '3' }} gap="4">
                    <div className={styles.field}>
                        <Text as="label" size="2" weight="medium">Начислений в месяц</Text>
                        <Select.Root
                            value={String(settings.paymentsPerMonth)}
                            onValueChange={(value) => setSettings((prev) => ({
                                ...prev,
                                paymentsPerMonth: value === '1' ? 1 : 2,
                                secondDay: value === '1' ? null : (prev.secondDay || 25),
                            }))}
                        >
                            <Select.Trigger className={styles.fieldSelect} />
                            <Select.Content className={styles.selectContent}>
                                <Select.Item value="1">1 раз в месяц</Select.Item>
                                <Select.Item value="2">2 раза в месяц</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <div className={styles.field}>
                        <Text as="label" size="2" weight="medium">Первая дата начисления</Text>
                        <Select.Root value={String(settings.firstDay)} onValueChange={(value) => setSettings((prev) => ({ ...prev, firstDay: Number(value) }))}>
                            <Select.Trigger className={styles.fieldSelect} />
                            <Select.Content className={styles.selectContent}>
                                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                    <Select.Item key={day} value={String(day)}>{day}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <div className={styles.field}>
                        <Text as="label" size="2" weight="medium">Вторая дата начисления</Text>
                        <Select.Root
                            value={settings.paymentsPerMonth === 2 && settings.secondDay ? String(settings.secondDay) : '25'}
                            onValueChange={(value) => setSettings((prev) => ({ ...prev, secondDay: Number(value) }))}
                            disabled={settings.paymentsPerMonth !== 2}
                        >
                            <Select.Trigger className={styles.fieldSelect} />
                            <Select.Content className={styles.selectContent}>
                                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                    <Select.Item key={day} value={String(day)}>{day}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    </div>
                </Grid>
            </Card>

            {error ? <div className={styles.errorBanner}>{error}</div> : null}
            {notice ? <div className={styles.successBanner}>{notice}</div> : null}

            <Card className={styles.tableCard}>
                <div className={styles.tableToolbar}>
                    <div className={styles.searchInput}>
                        <TextField.Root value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по сотруднику..." size="3">
                            <TextField.Slot side="left">
                                <FiSearch />
                            </TextField.Slot>
                        </TextField.Root>
                    </div>
                    <div className={styles.tableToolbarActions}>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.actionButton} ${styles.surfaceButton}`}
                            onClick={() => void handleBulkPayrollToday()}
                            disabled={!paymentTableAvailable || saving}
                        >
                            Провести выплаты сегодня
                        </Button>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.actionButton} ${styles.surfaceButton}`}
                            onClick={openBatchStatementDialog}
                            disabled={!batchStatementCandidates.length}
                        >
                            <FiFileText className={styles.icon} />
                            Общая расчетка
                        </Button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Сотрудник</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Должность</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Ставка</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Начислено</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Удержано</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Выплачено</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>К выплате</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Последняя выплата</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell className={styles.actionsCell}>Действия</Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredEmployees.map((employee) => {
                                const primarySuggestion = getPrimarySuggestion(employee.suggestedPayments);
                                return (
                                <Table.Row key={employee.id}>
                                    <Table.Cell>#{employee.id}</Table.Cell>
                                    <Table.Cell>
                                        <div className={styles.employeeName}>{employee.fio}</div>
                                        <div className={styles.employeeMeta}>{employee.active ? 'Активен' : 'Неактивен'}</div>
                                    </Table.Cell>
                                    <Table.Cell>{employee.position || '—'}</Table.Cell>
                                    <Table.Cell>
                                        <div className={styles.rateEditor}>
                                            <TextField.Root
                                                type="number"
                                                size="2"
                                                className={styles.rateInput}
                                                value={rateDrafts[employee.id] ?? ''}
                                                onChange={(e) => setRateDrafts((prev) => ({ ...prev, [employee.id]: e.target.value }))}
                                                placeholder="0"
                                            />
                                            <Button
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                onClick={() => void handleSaveRate(employee)}
                                                disabled={saving}
                                            >
                                                <FiSave className={styles.icon} />
                                                Ставка
                                            </Button>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {employee.suggestedPayments.length ? (
                                            <div className={styles.suggestionCell}>
                                                <div className={styles.suggestionAmount}>{formatCurrency(employee.currentAccrued)}</div>
                                                <div className={styles.suggestionMeta}>{formatSuggestedPaymentLabel(primarySuggestion)}</div>
                                                {employee.suggestedPayments.length > 1 ? (
                                                    <div className={styles.employeeMeta}>Ещё оснований: {employee.suggestedPayments.length - 1}</div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className={styles.suggestionCell}>
                                                <div className={styles.suggestionAmount}>—</div>
                                                <div className={styles.suggestionMeta}>Нет начислений к выплате</div>
                                            </div>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>{formatCurrency(employee.currentWithheld)}</Table.Cell>
                                    <Table.Cell>{formatCurrency(employee.currentPaid)}</Table.Cell>
                                    <Table.Cell>{formatCurrency(employee.currentPayable)}</Table.Cell>
                                    <Table.Cell>{formatDate(employee.lastPaymentDate)}</Table.Cell>
                                    <Table.Cell className={styles.actionsCell}>
                                        <Flex gap="2" justify="end" wrap="wrap">
                                            <Button
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                onClick={() => setStatementEmployee(employee)}
                                            >
                                                <FiFileText className={styles.icon} />
                                                Расчетка
                                            </Button>
                                            <Button
                                                variant="solid"
                                                color="gray"
                                                highContrast
                                                className={styles.payButton}
                                                onClick={() => openPaymentDialog(employee)}
                                                disabled={!paymentTableAvailable || saving}
                                            >
                                                Выплатить сейчас
                                            </Button>
                                        </Flex>
                                    </Table.Cell>
                                </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table.Root>
                </div>
            </Card>

            <Card className={styles.tableCard}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <Text size="4" weight="bold">Последние выплаты</Text>
                        <Text as="div" size="2" color="gray">Журнал последних операций по таблице выплат.</Text>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Сотрудник</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Комментарий</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell className={styles.actionsCell}>Сумма</Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {recentPayments.length ? recentPayments.map((payment) => (
                                <Table.Row key={payment.id}>
                                    <Table.Cell>{formatDate(payment.date)}</Table.Cell>
                                    <Table.Cell>{payment.employeeName || '—'}</Table.Cell>
                                    <Table.Cell>{payment.type || '—'}</Table.Cell>
                                    <Table.Cell>{payment.status?.trim() || 'Выплачено'}</Table.Cell>
                                    <Table.Cell>{payment.comment?.trim() || payment.calculation?.note || '—'}</Table.Cell>
                                    <Table.Cell className={styles.actionsCell}>{formatCurrency(payment.amount)}</Table.Cell>
                                </Table.Row>
                            )) : (
                                <Table.Row>
                                    <Table.Cell colSpan={6}>
                                        <Text color="gray">Выплат пока нет.</Text>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table.Root>
                </div>
            </Card>

            <Dialog.Root open={Boolean(paymentDialogEmployee)} onOpenChange={(open) => (!open ? setPaymentDialogEmployee(null) : undefined)}>
                <Dialog.Content className={styles.paymentDialog}>
                    <Dialog.Title>Выплатить сотруднику</Dialog.Title>
                    <Dialog.Description>
                        {paymentDialogEmployee ? `${paymentDialogEmployee.fio} (${paymentDialogEmployee.position || '—'})` : '—'}
                    </Dialog.Description>

                    <div className={styles.dialogForm}>
                        {paymentDialogEmployee?.suggestedPayments?.length ? (
                            <div className={styles.field}>
                                <Text as="label" size="2" weight="medium">Основание выплаты</Text>
                                <Select.Root value={paymentForm.suggestionKey} onValueChange={handleSuggestionChange}>
                                    <Select.Trigger className={styles.fieldSelect} />
                                    <Select.Content className={styles.selectContent}>
                                        {paymentDialogEmployee.suggestedPayments.map((suggestion) => (
                                            <Select.Item key={suggestion.key} value={suggestion.key}>
                                                {suggestion.type === 'vacation' ? 'Отпускные' : suggestion.type === 'advance' ? 'Аванс' : 'Зарплата'} · {formatCurrency(suggestion.amount)}
                                            </Select.Item>
                                        ))}
                                        <Select.Item value="manual">Ручная выплата</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                                {getSuggestionByKey(paymentDialogEmployee, paymentForm.suggestionKey)?.note ? (
                                    <div className={styles.helpText}>
                                        {getSuggestionByKey(paymentDialogEmployee, paymentForm.suggestionKey)?.note}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {paymentForm.suggestionKey === 'manual' ? (
                            <div className={styles.field}>
                                <Text as="label" size="2" weight="medium">Тип выплаты</Text>
                                <Select.Root
                                    value={paymentForm.paymentType}
                                    onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, paymentType: value }))}
                                >
                                    <Select.Trigger className={styles.fieldSelect} />
                                    <Select.Content className={styles.selectContent}>
                                        <Select.Item value="зарплата">Зарплата</Select.Item>
                                        <Select.Item value="премия">Премия</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        ) : null}
                        <div className={styles.field}>
                            <Text as="label" size="2" weight="medium">Сумма</Text>
                            <TextField.Root
                                type="number"
                                size="3"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                                className={styles.dialogInput}
                            />
                        </div>
                        <div className={styles.field}>
                            <Text as="label" size="2" weight="medium">Дата выплаты</Text>
                            <TextField.Root
                                type="date"
                                size="3"
                                value={paymentForm.date}
                                onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
                                className={styles.dialogInput}
                            />
                        </div>
                        <div className={styles.field}>
                            <Text as="label" size="2" weight="medium">Комментарий</Text>
                            <TextArea
                                size="3"
                                value={paymentForm.comment}
                                onChange={(e) => setPaymentForm((prev) => ({ ...prev, comment: e.target.value }))}
                                className={styles.dialogTextArea}
                                placeholder="Например: зарплата за март"
                            />
                        </div>
                        {paymentError ? <div className={styles.inlineError}>{paymentError}</div> : null}
                    </div>

                    <Flex justify="end" gap="3" mt="4">
                        <Button variant="surface" color="gray" highContrast className={`${styles.actionButton} ${styles.surfaceButton}`} onClick={() => setPaymentDialogEmployee(null)} disabled={saving}>
                            Закрыть
                        </Button>
                        <Button variant="solid" color="gray" highContrast className={styles.primaryButton} onClick={() => void handlePayNow()} disabled={saving}>
                            {saving ? 'Сохранение…' : 'Выплатить'}
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={Boolean(statementEmployee)} onOpenChange={(open) => (!open ? setStatementEmployee(null) : undefined)}>
                <Dialog.Content className={styles.paymentDialog}>
                    <Dialog.Title>Расчетка сотрудника</Dialog.Title>
                    <Dialog.Description>
                        {statementEmployee ? `${statementEmployee.fio} (${statementEmployee.position || '—'})` : '—'}
                    </Dialog.Description>

                    {statementEmployee ? (
                        <div className={styles.dialogForm}>
                            <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3">
                                <Card className={styles.statementMetricCard}>
                                    <Text size="2" color="gray">Начислено</Text>
                                    <Text as="div" size="5" weight="bold">{formatCurrency(statementEmployee.currentAccrued)}</Text>
                                </Card>
                                <Card className={styles.statementMetricCard}>
                                    <Text size="2" color="gray">Удержано</Text>
                                    <Text as="div" size="5" weight="bold">{formatCurrency(statementEmployee.currentWithheld)}</Text>
                                </Card>
                                <Card className={styles.statementMetricCard}>
                                    <Text size="2" color="gray">Выплачено</Text>
                                    <Text as="div" size="5" weight="bold">{formatCurrency(statementEmployee.currentPaid)}</Text>
                                </Card>
                                <Card className={styles.statementMetricCard}>
                                    <Text size="2" color="gray">К выплате</Text>
                                    <Text as="div" size="5" weight="bold">{formatCurrency(statementEmployee.currentPayable)}</Text>
                                </Card>
                            </Grid>

                            <div className={styles.statementBlock}>
                                <Text size="3" weight="bold">Текущие основания</Text>
                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Вид</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Период</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Начислено</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Удержано</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>К выплате</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Источник</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell className={styles.actionsCell}>Документы</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {statementEmployee.suggestedPayments.length ? statementEmployee.suggestedPayments.map((item) => (
                                                <Table.Row key={item.key}>
                                                    <Table.Cell>{item.type === 'advance' ? 'Аванс' : item.type === 'vacation' ? 'Отпускные' : 'Зарплата'}</Table.Cell>
                                                    <Table.Cell>{formatPeriod(item.periodFrom, item.periodTo)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(item.accruedAmount)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(item.withheldAmount)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(item.payableAmount)}</Table.Cell>
                                                    <Table.Cell>{item.sourceSummary || item.note || '—'}</Table.Cell>
                                                    <Table.Cell className={styles.actionsCell}>
                                                        <Flex gap="2" justify="end" wrap="wrap" className={styles.statementActions}>
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                                onClick={() => openStatementPreviewForSuggestion(statementEmployee, item)}
                                                            >
                                                                Просмотр
                                                            </Button>
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                                onClick={() => downloadStatementForSuggestion(statementEmployee, item, 'excel')}
                                                            >
                                                                Excel
                                                            </Button>
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                                onClick={() => downloadStatementForSuggestion(statementEmployee, item, 'pdf')}
                                                            >
                                                                PDF
                                                            </Button>
                                                        </Flex>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )) : (
                                                <Table.Row>
                                                    <Table.Cell colSpan={7}>
                                                        <Text color="gray">Сейчас открытых начислений нет.</Text>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </div>

                            <div className={styles.statementBlock}>
                                <Text size="3" weight="bold">Прошлые выплаты</Text>
                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Вид</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Период</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Начислено</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Удержано</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Выплачено</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Комментарий</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell className={styles.actionsCell}>Документы</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {statementEmployee.paymentHistory.length ? statementEmployee.paymentHistory.map((payment) => (
                                                <Table.Row key={payment.id}>
                                                    <Table.Cell>{formatDate(payment.date)}</Table.Cell>
                                                    <Table.Cell>{payment.paymentKind || payment.type || '—'}</Table.Cell>
                                                    <Table.Cell>{formatPeriod(payment.periodFrom, payment.periodTo)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(payment.accruedAmount || payment.amount)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(payment.withheldAmount)}</Table.Cell>
                                                    <Table.Cell>{formatCurrency(payment.paidAmount || payment.amount)}</Table.Cell>
                                                    <Table.Cell>{payment.comment?.trim() || payment.calculation?.note || '—'}</Table.Cell>
                                                    <Table.Cell className={styles.actionsCell}>
                                                        <Flex gap="2" justify="end" wrap="wrap" className={styles.statementActions}>
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                                onClick={() => openStatementPreviewForPayment(statementEmployee, payment)}
                                                            >
                                                                Просмотр
                                                            </Button>
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                                onClick={() => downloadStatementForPayment(statementEmployee, payment, 'excel')}
                                                            >
                                                                Excel
                                                            </Button>
                                                            <Button
                                                                variant="surface"
                                                                color="gray"
                                                                highContrast
                                                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                                                onClick={() => downloadStatementForPayment(statementEmployee, payment, 'pdf')}
                                                            >
                                                                PDF
                                                            </Button>
                                                        </Flex>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )) : (
                                                <Table.Row>
                                                    <Table.Cell colSpan={8}>
                                                        <Text color="gray">История выплат пока пуста.</Text>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <Flex justify="end" gap="3" mt="4">
                        <Button variant="surface" color="gray" highContrast className={`${styles.actionButton} ${styles.surfaceButton}`} onClick={() => setStatementEmployee(null)}>
                            Закрыть
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={batchStatementOpen} onOpenChange={setBatchStatementOpen}>
                <Dialog.Content className={styles.paymentDialog}>
                    <Dialog.Title>Общая расчетка</Dialog.Title>
                    <Dialog.Description>
                        Выбери сотрудников с текущими начислениями, которых нужно включить в ведомость.
                    </Dialog.Description>

                    <div className={styles.dialogForm}>
                        <Flex gap="2" wrap="wrap">
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                onClick={() => setBatchStatementSelection(batchStatementCandidates.map((employee) => employee.id))}
                            >
                                Выбрать всех
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.inlineButton} ${styles.surfaceButton}`}
                                onClick={() => setBatchStatementSelection([])}
                            >
                                Очистить
                            </Button>
                        </Flex>

                        <div className={styles.batchStatementList}>
                            {batchStatementCandidates.length ? batchStatementCandidates.map((employee) => {
                                const checked = batchStatementSelection.includes(employee.id);
                                const suggestion = getPrimarySuggestion(employee.suggestedPayments);
                                return (
                                    <label key={employee.id} className={styles.batchStatementItem}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleBatchStatementEmployee(employee.id)}
                                        />
                                        <div className={styles.batchStatementMeta}>
                                            <div className={styles.employeeName}>{employee.fio}</div>
                                            <div className={styles.employeeMeta}>
                                                {employee.position || '—'} · {suggestion ? formatSuggestedPaymentLabel(suggestion) : 'Без основания'} · {formatCurrency(suggestion?.payableAmount || 0)}
                                            </div>
                                        </div>
                                    </label>
                                );
                            }) : (
                                <Text color="gray">Нет сотрудников с текущими начислениями.</Text>
                            )}
                        </div>
                    </div>

                    <Flex justify="between" align="center" gap="3" mt="4" wrap="wrap">
                        <Text size="2" color="gray">Выбрано: {batchStatementSelection.length}</Text>
                        <Flex gap="3" wrap="wrap" justify="end">
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={openBatchStatementPreview}
                                disabled={!batchStatementSelection.length}
                            >
                                Просмотр
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => downloadBatchStatement('excel')}
                                disabled={!batchStatementSelection.length}
                            >
                                Excel
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => downloadBatchStatement('pdf')}
                                disabled={!batchStatementSelection.length}
                            >
                                PDF
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => setBatchStatementOpen(false)}
                            >
                                Закрыть
                            </Button>
                        </Flex>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={Boolean(statementPreview)} onOpenChange={(open) => (!open ? setStatementPreview(null) : undefined)}>
                <Dialog.Content className={styles.previewDialog}>
                    <Dialog.Title>{statementPreview?.title || 'Предпросмотр расчетки'}</Dialog.Title>
                    <Dialog.Description>Документ сформирован из xlsx-шаблона, сконвертирован в PDF и показан в браузере.</Dialog.Description>

                    <Box mt="3">
                        {statementPreview ? (
                            <iframe
                                ref={previewFrameRef}
                                src={statementPreview.url}
                                title={statementPreview.title}
                                className={styles.previewFrame}
                            />
                        ) : null}
                    </Box>

                    <Flex justify="end" gap="3" mt="4" wrap="wrap">
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.actionButton} ${styles.surfaceButton}`}
                            onClick={handlePrintStatementPreview}
                        >
                            <FiPrinter className={styles.icon} />
                            Печать
                        </Button>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.actionButton} ${styles.surfaceButton}`}
                            onClick={() => statementPreview ? window.open(statementPreview.url, '_blank', 'noopener,noreferrer') : undefined}
                        >
                            <FiDownload className={styles.icon} />
                            Открыть в новой вкладке
                        </Button>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.actionButton} ${styles.surfaceButton}`}
                            onClick={() => setStatementPreview(null)}
                        >
                            Закрыть
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(AdminFinancePage);
