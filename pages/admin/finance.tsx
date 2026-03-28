import React, { useEffect, useMemo, useState } from 'react';
import { withLayout } from '../../layout';
import { Badge, Box, Button, Card, Dialog, Flex, Grid, Select, Table, Text, TextArea, TextField } from '@radix-ui/themes';
import { FiDollarSign, FiRefreshCw, FiSave, FiSearch } from 'react-icons/fi';
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

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(value) || 0);
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
    const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), comment: '' });
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [totals, setTotals] = useState<FinancePayload['totals']>({ activeEmployees: 0, totalPaid: 0, paymentCount: 0 });

    const isDirector = Boolean(user?.roles?.includes('director'));

    const loadData = async () => {
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
            setTotals(payload.totals);
            setRateDrafts(
                Object.fromEntries((payload.employees || []).map((employee) => [employee.id, employee.rate == null ? '' : String(employee.rate)]))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки финансов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!isDirector) return;
        void loadData();
    }, [authLoading, isDirector, months]);

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((employee) =>
            String(employee.id).includes(q) ||
            String(employee.fio || '').toLowerCase().includes(q) ||
            String(employee.position || '').toLowerCase().includes(q)
        );
    }, [employees, search]);

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
        setPaymentDialogEmployee(employee);
        setPaymentError(null);
        setPaymentForm({
            amount: employee.rate == null ? '' : String(employee.rate),
            date: new Date().toISOString().slice(0, 10),
            comment: '',
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

    if (authLoading || loading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!isDirector) {
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
                        <Select.Content>
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

            <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="4" className={styles.metricsGrid}>
                <Card className={styles.metricCard}>
                    <Text size="2" color="gray">Активных сотрудников</Text>
                    <Text as="div" size="7" weight="bold">{totals.activeEmployees}</Text>
                </Card>
                <Card className={styles.metricCard}>
                    <Text size="2" color="gray">Выплачено за период</Text>
                    <Text as="div" size="7" weight="bold">{formatCurrency(totals.totalPaid)}</Text>
                </Card>
                <Card className={styles.metricCard}>
                    <Text size="2" color="gray">Всего выплат за период</Text>
                    <Text as="div" size="7" weight="bold">{totals.paymentCount}</Text>
                </Card>
                <Card className={styles.metricCard}>
                    <Text size="2" color="gray">Статус модуля выплат</Text>
                    <Badge variant="soft" color={paymentTableAvailable ? 'green' : 'orange'} highContrast className={styles.statusBadge}>
                        {paymentTableAvailable ? 'ГОТОВ К РАБОТЕ' : 'ТРЕБУЕТ ПРОВЕРКИ'}
                    </Badge>
                </Card>
            </Grid>

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
                            <Select.Content>
                                <Select.Item value="1">1 раз в месяц</Select.Item>
                                <Select.Item value="2">2 раза в месяц</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <div className={styles.field}>
                        <Text as="label" size="2" weight="medium">Первая дата начисления</Text>
                        <Select.Root value={String(settings.firstDay)} onValueChange={(value) => setSettings((prev) => ({ ...prev, firstDay: Number(value) }))}>
                            <Select.Trigger className={styles.fieldSelect} />
                            <Select.Content>
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
                            <Select.Content>
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
                </div>

                <div className={styles.tableWrapper}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Сотрудник</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Должность</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Ставка</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Выплачено</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Последняя выплата</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell className={styles.actionsCell}>Действия</Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredEmployees.map((employee) => (
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
                                    <Table.Cell>{formatCurrency(employee.totalPaid)}</Table.Cell>
                                    <Table.Cell>{formatDate(employee.lastPaymentDate)}</Table.Cell>
                                    <Table.Cell className={styles.actionsCell}>
                                        <Button
                                            variant="solid"
                                            color="gray"
                                            highContrast
                                            className={styles.payButton}
                                            onClick={() => openPaymentDialog(employee)}
                                            disabled={!paymentTableAvailable || saving}
                                        >
                                            <FiDollarSign className={styles.icon} />
                                            Выплатить сейчас
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
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
                                    <Table.Cell>{payment.status || '—'}</Table.Cell>
                                    <Table.Cell>{payment.comment || '—'}</Table.Cell>
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
                            <FiDollarSign className={styles.icon} />
                            {saving ? 'Сохранение…' : 'Выплатить'}
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(AdminFinancePage);
