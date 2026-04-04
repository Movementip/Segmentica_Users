import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withLayout } from '../../layout';
import { Box, Button, Card, Dialog, DropdownMenu, Flex, Select, Text, TextField } from '@radix-ui/themes';
import {
    FiChevronLeft,
    FiChevronRight,
    FiExternalLink,
    FiFileText,
    FiMinus,
    FiPlus,
    FiPrinter,
    FiRefreshCw,
    FiSearch,
    FiX,
} from 'react-icons/fi';
import { BsFillFileEarmarkExcelFill, BsFillFileEarmarkPdfFill } from 'react-icons/bs';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import styles from './AdminFinance.module.css';

type FinanceSettings = {
    paymentsPerMonth: 1 | 2;
    firstDay: number;
    secondDay: number | null;
};

type FinanceSuggestedPayment = {
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

type FinancePayload = {
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

type StatementPreviewState = {
    title: string;
    description: string;
    previewUrl: string;
    kind: 'batch-payroll' | 'single-statement' | 'selected-statements' | 'timesheet';
    employeeIds: number[];
    employeeId?: number;
};

type PreviewPageImage = {
    src: string;
    width: number;
    height: number;
};

type PdfJsModule = {
    GlobalWorkerOptions: {
        workerSrc: string;
    };
    getDocument: (source: { data: Uint8Array }) => {
        promise: Promise<{
            numPages: number;
            getPage: (pageNumber: number) => Promise<{
                getViewport: (params: { scale: number }) => { width: number; height: number };
                render: (params: {
                    canvasContext: CanvasRenderingContext2D;
                    viewport: { width: number; height: number };
                    background: string;
                }) => { promise: Promise<void> };
            }>;
        }>;
    };
};

const PREVIEW_ZOOM_MIN = 0.6;
const PREVIEW_ZOOM_MAX = 2;
const PREVIEW_ZOOM_STEP = 0.2;

type FinanceTabKey = 'summary' | 'accruals' | 'withheld' | 'paid' | 'contributions';

type PayrollColumn = {
    key: string;
    label: React.ReactNode;
    render: (employee: FinanceEmployee) => string;
    total?: (employees: FinanceEmployee[]) => string;
};

const TABS: Array<{ key: FinanceTabKey; label: string }> = [
    { key: 'summary', label: 'Сводка' },
    { key: 'accruals', label: 'Начисления' },
    { key: 'withheld', label: 'Удержания' },
    { key: 'paid', label: 'Выплаченное' },
    { key: 'contributions', label: 'Взносы' },
];

const CONTRIBUTION_THRESHOLD_LABEL = '2 979 000 ₽';

const formatDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatNumber = (value: number | null | undefined): string =>
    new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const createMonthKey = (value: Date): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const shiftMonthKey = (monthKey: string, delta: number): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return createMonthKey(new Date());
    return createMonthKey(new Date(year, month - 1 + delta, 1));
};

const formatMonthLabel = (monthKey: string): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return monthKey;
    const label = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
    return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : monthKey;
};

const formatMonthFileLabel = (monthKey: string): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return monthKey;
    return `${String(month).padStart(2, '0')}.${year}`;
};

const toSurnameInitials = (value: string | null | undefined): string => {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return '';
    const [surname, name, middleName] = parts;
    const nameInitial = name ? `${name.charAt(0).toUpperCase()}.` : '';
    const middleInitial = middleName ? ` ${middleName.charAt(0).toUpperCase()}.` : '';
    return `${surname}${nameInitial ? ` ${nameInitial}` : ''}${middleInitial}`;
};

const createMonthEndDate = (monthKey: string): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return new Date().toISOString().slice(0, 10);
    }
    return new Date(year, month, 0).toISOString().slice(0, 10);
};

const getSuggestedPaymentTypeLabel = (type: FinanceSuggestedPayment['type']): string => {
    if (type === 'advance') return 'Аванс';
    if (type === 'vacation') return 'Отпускные';
    if (type === 'bonus') return 'Премия';
    if (type === 'sick_leave') return 'Больничный';
    return 'Зарплата';
};

const buildStatementUrl = (params: {
    employeeId?: number;
    employeeIds?: number[];
    sourceType: 'current' | 'history' | 'current_batch';
    documentKind?: 'statement' | 'payslip' | 'timesheet';
    format: 'excel' | 'pdf';
    month: string;
    sourceKey?: string | null;
    paymentId?: string | null;
    disposition?: 'inline' | 'attachment';
}): string => {
    const search = new URLSearchParams();
    search.set('sourceType', params.sourceType);
    search.set('documentKind', params.documentKind || 'statement');
    search.set('format', params.format);
    search.set('month', params.month);
    search.set('disposition', params.disposition || 'attachment');

    if (params.sourceType === 'current_batch') {
        if (params.employeeIds?.length) {
            search.set('employeeIds', params.employeeIds.join(','));
        }
    } else if (params.employeeId) {
        search.set('employeeId', String(params.employeeId));
    }

    if (params.sourceKey) search.set('sourceKey', params.sourceKey);
    if (params.paymentId) search.set('paymentId', params.paymentId);
    return `/api/admin/finance/statement?${search.toString()}`;
};

function AdminFinancePage(): JSX.Element {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [payload, setPayload] = useState<FinancePayload | null>(null);
    const [monthKey, setMonthKey] = useState(() => createMonthKey(new Date()));
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<FinanceTabKey>('summary');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [settingsDraft, setSettingsDraft] = useState<FinanceSettings>({ paymentsPerMonth: 2, firstDay: 10, secondDay: 25 });
    const [manualPaymentEmployee, setManualPaymentEmployee] = useState<FinanceEmployee | null>(null);
    const [manualPaymentError, setManualPaymentError] = useState<string | null>(null);
    const [manualPaymentForm, setManualPaymentForm] = useState({
        paymentType: 'зарплата',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        comment: '',
    });
    const [statementPreview, setStatementPreview] = useState<StatementPreviewState | null>(null);
    const [previewPages, setPreviewPages] = useState<PreviewPageImage[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewPdfObjectUrl, setPreviewPdfObjectUrl] = useState<string | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);
    const previewPrintFrameRef = useRef<HTMLIFrameElement | null>(null);
    const previewStageRef = useRef<HTMLDivElement | null>(null);
    const previewPdfBytesRef = useRef<Uint8Array | null>(null);
    const previewPdfSourceUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!statementPreview) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [statementPreview]);

    useEffect(() => {
        if (!statementPreview) {
            setPreviewPages([]);
            setPreviewLoading(false);
            setPreviewError(null);
            setPreviewZoom(1);
            if (previewPrintFrameRef.current) {
                previewPrintFrameRef.current.removeAttribute('src');
            }
            previewPdfBytesRef.current = null;
            previewPdfSourceUrlRef.current = null;
            setPreviewPdfObjectUrl((current) => {
                if (current) {
                    window.URL.revokeObjectURL(current);
                }
                return null;
            });
            return undefined;
        }

        let cancelled = false;

        const renderPreview = async () => {
            try {
                setPreviewLoading(true);
                setPreviewError(null);
                setPreviewPages([]);

                const loadPdfJs = Function('return import("/pdfjs/pdf.mjs")') as () => Promise<PdfJsModule>;
                const pdfjs = await loadPdfJs();
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
                let fileBytes = previewPdfBytesRef.current;

                if (!fileBytes || previewPdfSourceUrlRef.current !== statementPreview.previewUrl) {
                    const response = await fetch(statementPreview.previewUrl, { credentials: 'include' });
                    if (!response.ok) {
                        const errorText = await response.text().catch(() => '');
                        throw new Error(errorText || 'Не удалось загрузить PDF для предпросмотра');
                    }

                    fileBytes = new Uint8Array(await response.arrayBuffer());
                    previewPdfBytesRef.current = fileBytes;
                    previewPdfSourceUrlRef.current = statementPreview.previewUrl;

                    const pdfBuffer = fileBytes.buffer.slice(
                        fileBytes.byteOffset,
                        fileBytes.byteOffset + fileBytes.byteLength
                    ) as ArrayBuffer;
                    const pdfObjectUrl = window.URL.createObjectURL(new Blob([pdfBuffer], { type: 'application/pdf' }));
                    setPreviewPdfObjectUrl((current) => {
                        if (current) {
                            window.URL.revokeObjectURL(current);
                        }
                        return pdfObjectUrl;
                    });
                }

                const loadingTask = pdfjs.getDocument({ data: fileBytes.slice() });
                const pdf = await loadingTask.promise;

                const availableWidth = Math.max((previewStageRef.current?.clientWidth ?? 1200) - 8, 320);
                const pages: PreviewPageImage[] = [];

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                    const page = await pdf.getPage(pageNumber);
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scale = (availableWidth / baseViewport.width) * previewZoom;
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { alpha: false });

                    if (!context) {
                        throw new Error('Не удалось подготовить canvas для предпросмотра PDF');
                    }

                    const outputScale = typeof window !== 'undefined'
                        ? Math.min(window.devicePixelRatio || 1, 2)
                        : 1;

                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);

                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    if (outputScale !== 1) {
                        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
                    }

                    await page.render({
                        canvasContext: context,
                        viewport,
                        background: 'rgb(255,255,255)',
                    }).promise;

                    pages.push({
                        src: canvas.toDataURL('image/png'),
                        width: viewport.width,
                        height: viewport.height,
                    });
                }

                if (!cancelled) {
                    setPreviewPages(pages);
                }
            } catch (error) {
                if (!cancelled) {
                    setPreviewError(error instanceof Error ? error.message : 'Не удалось открыть предпросмотр PDF');
                }
            } finally {
                if (!cancelled) {
                    setPreviewLoading(false);
                }
            }
        };

        void renderPreview();

        return () => {
            cancelled = true;
        };
    }, [previewZoom, statementPreview]);

    const canViewFinance = Boolean(user?.permissions?.includes('admin.finance'));

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/admin/finance?months=6&month=${encodeURIComponent(monthKey)}`);
            const data = (await response.json().catch(() => ({}))) as FinancePayload | { error?: string };
            if (!response.ok) {
                throw new Error((data as { error?: string })?.error || 'Ошибка загрузки расчета зарплаты');
            }

            const nextPayload = data as FinancePayload;
            setPayload(nextPayload);
            setSettingsDraft(nextPayload.settings);
            setSelectedEmployeeIds((prev) => {
                const existingIds = new Set(nextPayload.employees.map((employee) => employee.id));
                const preserved = prev.filter((id) => existingIds.has(id));
                if (preserved.length) return preserved;

                return nextPayload.employees
                    .filter((employee) => employee.active && (
                        employee.currentAccrued > 0
                        || employee.currentPaid > 0
                        || employee.currentPayable > 0
                        || employee.currentOrgDebt > 0
                        || employee.currentEmployeeDebt > 0
                    ))
                    .map((employee) => employee.id);
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки расчета зарплаты');
        } finally {
            setLoading(false);
        }
    }, [monthKey]);

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
                    paymentsPerMonth: settingsDraft.paymentsPerMonth,
                    firstDay: settingsDraft.firstDay,
                    secondDay: settingsDraft.paymentsPerMonth === 2 ? settingsDraft.secondDay : null,
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось сохранить график выплат');
            }

            setNotice('График выплат сохранён.');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось сохранить график выплат');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (authLoading || !canViewFinance) return;
        void loadData();
    }, [authLoading, canViewFinance, loadData]);

    const employees = useMemo(() => payload?.employees || [], [payload]);
    const recentPayments = useMemo(() => payload?.recentPayments || [], [payload]);

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((employee) =>
            String(employee.fio || '').toLowerCase().includes(q)
            || String(employee.position || '').toLowerCase().includes(q)
            || String(employee.id).includes(q)
        );
    }, [employees, search]);

    const selectedEmployees = useMemo(
        () => employees.filter((employee) => selectedEmployeeIds.includes(employee.id)),
        [employees, selectedEmployeeIds]
    );

    const totalEmployees = useMemo(
        () => (selectedEmployees.length ? selectedEmployees : filteredEmployees),
        [filteredEmployees, selectedEmployees]
    );

    const visibleEmployeeIds = useMemo(() => filteredEmployees.map((employee) => employee.id), [filteredEmployees]);
    const allVisibleSelected = useMemo(
        () => visibleEmployeeIds.length > 0 && visibleEmployeeIds.every((id) => selectedEmployeeIds.includes(id)),
        [selectedEmployeeIds, visibleEmployeeIds]
    );

    const someVisibleSelected = useMemo(
        () => visibleEmployeeIds.some((id) => selectedEmployeeIds.includes(id)),
        [selectedEmployeeIds, visibleEmployeeIds]
    );

    const toggleEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((prev) => (
            prev.includes(employeeId)
                ? prev.filter((id) => id !== employeeId)
                : [...prev, employeeId]
        ));
    };

    const toggleVisible = () => {
        setSelectedEmployeeIds((prev) => {
            if (allVisibleSelected) {
                return prev.filter((id) => !visibleEmployeeIds.includes(id));
            }

            return Array.from(new Set([...prev, ...visibleEmployeeIds]));
        });
    };

    const activeColumns = useMemo<PayrollColumn[]>(() => {
        if (activeTab === 'accruals') {
            return [
                {
                    key: 'advance',
                    label: 'Аванс, ₽',
                    render: (employee) => formatNumber(employee.currentBreakdown.advance),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentBreakdown.advance, 0)),
                },
                {
                    key: 'salary',
                    label: 'Зарплата, ₽',
                    render: (employee) => formatNumber(employee.currentBreakdown.salary),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentBreakdown.salary, 0)),
                },
                {
                    key: 'vacation',
                    label: 'Отпускные, ₽',
                    render: (employee) => formatNumber(employee.currentBreakdown.vacation),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentBreakdown.vacation, 0)),
                },
                {
                    key: 'sickLeave',
                    label: 'Больничный, ₽',
                    render: (employee) => formatNumber(employee.currentBreakdown.sickLeave),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentBreakdown.sickLeave, 0)),
                },
                {
                    key: 'bonus',
                    label: 'Премия, ₽',
                    render: (employee) => formatNumber(employee.currentBreakdown.bonus),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentBreakdown.bonus, 0)),
                },
            ];
        }

        if (activeTab === 'withheld') {
            return [
                {
                    key: 'withheld',
                    label: 'Удержано, ₽',
                    render: (employee) => formatNumber(employee.currentWithheld),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentWithheld, 0)),
                },
                {
                    key: 'orgDebt',
                    label: 'Долг компании, ₽',
                    render: (employee) => formatNumber(employee.currentOrgDebt),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentOrgDebt, 0)),
                },
                {
                    key: 'employeeDebt',
                    label: 'Долг сотрудника, ₽',
                    render: (employee) => formatNumber(employee.currentEmployeeDebt),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentEmployeeDebt, 0)),
                },
                {
                    key: 'payable',
                    label: 'К выплате, ₽',
                    render: (employee) => formatNumber(employee.currentPayable),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentPayable, 0)),
                },
            ];
        }

        if (activeTab === 'paid') {
            return [
                {
                    key: 'paid',
                    label: 'Выплачено, ₽',
                    render: (employee) => formatNumber(employee.currentPaid),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentPaid, 0)),
                },
                {
                    key: 'historyPaid',
                    label: 'Всего выплачено, ₽',
                    render: (employee) => formatNumber(employee.totalPaid),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.totalPaid, 0)),
                },
                {
                    key: 'paymentCount',
                    label: 'Платежей',
                    render: (employee) => String(employee.paymentCount),
                    total: (items) => String(items.reduce((sum, employee) => sum + employee.paymentCount, 0)),
                },
                {
                    key: 'lastPaymentDate',
                    label: 'Последняя выплата',
                    render: (employee) => formatDate(employee.lastPaymentDate),
                    total: () => '—',
                },
            ];
        }

        if (activeTab === 'contributions') {
            return [
                {
                    key: 'taxableIncomeMonth',
                    label: 'Облагаемый доход за месяц, ₽',
                    render: (employee) => formatNumber(employee.currentContributionDetails.taxableIncomeMonth),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentContributionDetails.taxableIncomeMonth, 0)),
                },
                {
                    key: 'contributionBaseMonth',
                    label: 'Доход для взносов за месяц, ₽',
                    render: (employee) => formatNumber(employee.currentContributionDetails.contributionBaseMonth),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentContributionDetails.contributionBaseMonth, 0)),
                },
                {
                    key: 'contributionYearBase30',
                    label: (
                        <>
                            <div>С начала года по ставке 30%, ₽</div>
                            <div className={styles.metricHeaderHint}>в пределах {CONTRIBUTION_THRESHOLD_LABEL}</div>
                        </>
                    ),
                    render: (employee) => formatNumber(employee.currentContributionDetails.contributionYearBase30),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentContributionDetails.contributionYearBase30, 0)),
                },
                {
                    key: 'contributionYearBase151',
                    label: (
                        <>
                            <div>С начала года по ставке 15,1%, ₽</div>
                            <div className={styles.metricHeaderHint}>свыше {CONTRIBUTION_THRESHOLD_LABEL}</div>
                        </>
                    ),
                    render: (employee) => formatNumber(employee.currentContributionDetails.contributionYearBase151),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentContributionDetails.contributionYearBase151, 0)),
                },
                {
                    key: 'currentContributions',
                    label: 'Взносы за месяц, ₽',
                    render: (employee) => formatNumber(employee.currentContributions),
                    total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentContributions, 0)),
                },
            ];
        }

        return [
            {
                key: 'accrued',
                label: 'Начислено, ₽',
                render: (employee) => formatNumber(employee.currentAccrued),
                total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentAccrued, 0)),
            },
            {
                key: 'withheld',
                label: 'Удержано, ₽',
                render: (employee) => formatNumber(employee.currentWithheld),
                total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentWithheld, 0)),
            },
            {
                key: 'paid',
                label: 'Выплачено, ₽',
                render: (employee) => formatNumber(employee.currentPaid),
                total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentPaid, 0)),
            },
            {
                key: 'payable',
                label: 'К выплате, ₽',
                render: (employee) => formatNumber(employee.currentPayable),
                total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentPayable, 0)),
            },
            {
                key: 'contributions',
                label: 'Взносы, ₽',
                render: (employee) => formatNumber(employee.currentContributions),
                total: (items) => formatNumber(items.reduce((sum, employee) => sum + employee.currentContributions, 0)),
            },
        ];
    }, [activeTab]);

    const gridTemplateColumns = useMemo(
        () => `44px minmax(320px, 1.8fr) ${activeColumns.map(() => 'minmax(140px, 1fr)').join(' ')}`,
        [activeColumns]
    );

    const activeTabDescription = useMemo(() => {
        if (activeTab === 'accruals') {
            return 'Зарплата, аванс, отпускные, больничные и премии за выбранный месяц.';
        }
        if (activeTab === 'withheld') {
            return 'НДФЛ, задолженность компании, задолженность сотрудника и итог к выплате.';
        }
        if (activeTab === 'paid') {
            return 'Что уже реально проведено в журнале выплат за выбранный месяц.';
        }
        if (activeTab === 'contributions') {
            return `Взносы считаются по месяцу с порогом ${CONTRIBUTION_THRESHOLD_LABEL}: 30% в пределах порога и 15,1% сверх него.`;
        }
        return 'Сводка по выбранному месяцу: начислено, удержано, выплачено, к выплате и взносы.';
    }, [activeTab]);

    const openPreview = (preview: StatementPreviewState) => {
        setPreviewZoom(1);
        setStatementPreview(preview);
    };

    const updatePreviewZoom = (nextZoom: number) => {
        const normalizedZoom = Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, Number(nextZoom.toFixed(2))));
        setPreviewZoom(normalizedZoom);
    };

    const buildPreviewDownloadFileName = (
        kind: StatementPreviewState['kind'],
        employeeIds: number[],
        format: 'pdf' | 'excel'
    ): string => {
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        const monthLabel = formatMonthFileLabel(monthKey);
        const selectedEmployees = payload?.employees.filter((employee) => employeeIds.includes(employee.id)) || [];
        const singleEmployee = selectedEmployees.length === 1 ? selectedEmployees[0] : null;
        const employeeLabel = singleEmployee ? toSurnameInitials(singleEmployee.fio) : '';

        if (kind === 'batch-payroll') {
            const base = employeeLabel
                ? `Расчетно платежная ведомость ${employeeLabel} ${monthLabel}`
                : `Расчетно платежная ведомость ${monthLabel}`;
            return `${base}.${extension}`;
        }

        if (kind === 'timesheet') {
            const base = employeeLabel
                ? `Табель учета рабочего времени ${employeeLabel} ${monthLabel}`
                : `Табели учета рабочего времени ${monthLabel}`;
            return `${base}.${extension}`;
        }

        const base = employeeLabel
            ? `Расчетный листок ${employeeLabel} ${monthLabel}`
            : `Расчетные листки ${monthLabel}`;
        return `${base}.${extension}`;
    };

    const downloadStatementFile = async (url: string, fileName: string) => {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || 'Не удалось скачать документ');
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
    };

    const openBatchPayrollPreview = () => {
        if (!selectedEmployeeIds.length) return;
        openPreview({
            title: 'Предпросмотр 1 документа',
            description: 'Расчетная ведомость по выбранному месяцу и выбранным сотрудникам.',
            previewUrl: buildStatementUrl({
                sourceType: 'current_batch',
                documentKind: 'statement',
                employeeIds: selectedEmployeeIds,
                month: monthKey,
                format: 'pdf',
                disposition: 'inline',
            }),
            kind: 'batch-payroll',
            employeeIds: selectedEmployeeIds,
        });
    };

    const openSelectedStatements = (format: 'excel' | 'pdf') => {
        if (!selectedEmployeeIds.length) return;

        window.open(
            buildStatementUrl({
                sourceType: 'current_batch',
                documentKind: 'payslip',
                employeeIds: selectedEmployeeIds,
                month: monthKey,
                format,
                disposition: format === 'pdf' ? 'inline' : 'attachment',
            }),
            '_blank',
            'noopener,noreferrer'
        );
    };

    const openSelectedStatementsPreview = () => {
        if (!selectedEmployeeIds.length) return;

        openPreview({
            title: `Предпросмотр ${selectedEmployeeIds.length} ${selectedEmployeeIds.length === 1 ? 'документа' : 'документов'}`,
            description: selectedEmployeeIds.length === 1
                ? `Расчетный лист за ${payload?.selectedMonthLabel || formatMonthLabel(monthKey)}.`
                : `Расчетные листы по выбранному месяцу для ${selectedEmployeeIds.length} сотрудников.`,
            previewUrl: buildStatementUrl({
                sourceType: 'current_batch',
                documentKind: 'payslip',
                employeeIds: selectedEmployeeIds,
                month: monthKey,
                format: 'pdf',
                disposition: 'inline',
            }),
            kind: 'selected-statements',
            employeeIds: selectedEmployeeIds,
        });
    };

    const openTimesheetPreview = () => {
        if (!selectedEmployeeIds.length) return;

        openPreview({
            title: 'Предпросмотр 1 документа',
            description: selectedEmployeeIds.length === 1
                ? `Табель учета рабочего времени за ${payload?.selectedMonthLabel || formatMonthLabel(monthKey)}.`
                : `Табель учета рабочего времени по выбранному месяцу для ${selectedEmployeeIds.length} сотрудников.`,
            previewUrl: buildStatementUrl({
                sourceType: 'current_batch',
                documentKind: 'timesheet',
                employeeIds: selectedEmployeeIds,
                month: monthKey,
                format: 'pdf',
                disposition: 'inline',
            }),
            kind: 'timesheet',
            employeeIds: selectedEmployeeIds,
        });
    };

    const handlePrintPreview = () => {
        if (!statementPreview || !previewPdfObjectUrl) return;

        if (previewPrintFrameRef.current) {
            const frame = previewPrintFrameRef.current;
            const printFrame = () => {
                frame.contentWindow?.focus();
                frame.contentWindow?.print();
            };

            if (frame.src !== previewPdfObjectUrl) {
                frame.onload = () => {
                    frame.onload = null;
                    printFrame();
                };
                frame.src = previewPdfObjectUrl;
                return;
            }

            printFrame();
            return;
        }

        window.open(previewPdfObjectUrl, '_blank', 'noopener,noreferrer');
    };

    const handlePreviewDownload = (format: 'pdf' | 'excel') => {
        if (!statementPreview) return;
        const previewDownloadName = buildPreviewDownloadFileName(statementPreview.kind, statementPreview.employeeIds, format);
        const handleDownloadError = (error: unknown) => {
            setPreviewError(error instanceof Error ? error.message : 'Не удалось скачать документ');
        };

        if (format === 'pdf' && previewPdfObjectUrl) {
            const link = document.createElement('a');
            link.href = previewPdfObjectUrl;
            link.download = previewDownloadName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            return;
        }

        if (statementPreview.kind === 'batch-payroll') {
            void downloadStatementFile(
                buildStatementUrl({
                    sourceType: 'current_batch',
                    documentKind: 'statement',
                    employeeIds: statementPreview.employeeIds,
                    month: monthKey,
                    format,
                    disposition: 'attachment',
                }),
                previewDownloadName
            ).catch(handleDownloadError);
            return;
        }

        if (statementPreview.kind === 'selected-statements') {
            void downloadStatementFile(
                buildStatementUrl({
                    sourceType: 'current_batch',
                    documentKind: 'payslip',
                    employeeIds: statementPreview.employeeIds,
                    month: monthKey,
                    format,
                    disposition: 'attachment',
                }),
                previewDownloadName
            ).catch(handleDownloadError);
            return;
        }

        if (statementPreview.kind === 'timesheet') {
            void downloadStatementFile(
                buildStatementUrl({
                    sourceType: 'current_batch',
                    documentKind: 'timesheet',
                    employeeIds: statementPreview.employeeIds,
                    month: monthKey,
                    format,
                    disposition: 'attachment',
                }),
                previewDownloadName
            ).catch(handleDownloadError);
        }
    };

    const handleBuildEntries = async () => {
        if (!selectedEmployeeIds.length) return;

        try {
            setSaving(true);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'bulk-payroll-month',
                    month: monthKey,
                    employeeIds: selectedEmployeeIds,
                    comment: `Ручное проведение выплат за ${payload?.selectedMonthLabel || formatMonthLabel(monthKey)}`,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось провести выплаты');
            }

            setNotice('Выплаты по выбранному месяцу проведены.');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось провести выплаты');
        } finally {
            setSaving(false);
        }
    };

    const openManualPaymentDialog = () => {
        if (selectedEmployees.length !== 1) return;
        const employee = selectedEmployees[0];
        setManualPaymentEmployee(employee);
        setManualPaymentError(null);
        setManualPaymentForm({
            paymentType: 'зарплата',
            amount: employee.currentPayable > 0 ? String(employee.currentPayable) : '',
            date: createMonthEndDate(monthKey),
            comment: '',
        });
    };

    const handleManualPaymentSave = async () => {
        if (!manualPaymentEmployee) return;

        try {
            setSaving(true);
            setManualPaymentError(null);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'pay-now',
                    employeeId: manualPaymentEmployee.id,
                    amount: Number(manualPaymentForm.amount),
                    date: manualPaymentForm.date,
                    paymentType: manualPaymentForm.paymentType,
                    comment: manualPaymentForm.comment,
                    month: monthKey,
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось сохранить ручную выплату');
            }

            setManualPaymentEmployee(null);
            setNotice(`Выплата для "${manualPaymentEmployee.fio}" сохранена.`);
            await loadData();
        } catch (err) {
            setManualPaymentError(err instanceof Error ? err.message : 'Не удалось сохранить ручную выплату');
        } finally {
            setSaving(false);
        }
    };

    const monthOptions = useMemo(
        () => Array.from({ length: 24 }, (_, index) => {
            const value = shiftMonthKey(createMonthKey(new Date()), -index);
            return { value, label: formatMonthLabel(value) };
        }),
        []
    );
    const currentMonthKey = useMemo(() => createMonthKey(new Date()), []);
    const isNextMonthDisabled = monthKey >= currentMonthKey;

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
            <div className={styles.payrollHero}>
                <div className={styles.payrollHeroTop}>
                    <div className={styles.payrollHeroTitleBlock}>
                        <h1 className={styles.title}>Расчет зарплаты</h1>
                        <Text as="div" className={styles.subtitle}>
                            Месячный расчет начислений, удержаний, выплат, задолженностей и взносов.
                        </Text>
                    </div>
                    <div className={styles.monthControls}>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.monthArrowButton} ${styles.surfaceButton}`}
                            onClick={() => setMonthKey((prev) => shiftMonthKey(prev, -1))}
                        >
                            <FiChevronLeft />
                        </Button>
                        <Select.Root value={monthKey} onValueChange={setMonthKey}>
                            <Select.Trigger className={styles.monthSelect} />
                            <Select.Content className={styles.selectContent}>
                                {monthOptions.map((option) => (
                                    <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.monthArrowButton} ${styles.surfaceButton}`}
                            onClick={() => {
                                if (isNextMonthDisabled) return;
                                setMonthKey((prev) => shiftMonthKey(prev, 1));
                            }}
                            disabled={isNextMonthDisabled}
                            title={isNextMonthDisabled ? 'Следующий месяц ещё не наступил' : undefined}
                        >
                            <FiChevronRight />
                        </Button>
                    </div>
                </div>

                <div className={styles.scheduleInlineCard}>
                    <div className={styles.scheduleInlineHeader}>
                        <div className={styles.scheduleInlineTitleBlock}>
                            <Text size="2" weight="medium" className={styles.panelLabel}>Режим начисления</Text>
                            <Text size="1" color="gray" className={styles.scheduleInlineHint}>
                                Если режим — 2 раза в месяц, первый день используется как аванс, второй — как основная зарплата.
                            </Text>
                        </div>
                        <div className={styles.scheduleInlineNote}>
                            <Text size="2" color="gray" className={styles.scheduleInlineLead}>
                                Настройка влияет только на расчёт месяца: аванс, зарплата, отпускные и больничные считаются по этому графику.
                            </Text>
                            <Text size="2" color="gray" className={styles.scheduleInlineLead}>
                                Выплаты проводим вручную отдельным действием.
                            </Text>
                        </div>
                    </div>
                    <div className={styles.scheduleInlineControls}>
                        <Select.Root
                            value={String(settingsDraft.paymentsPerMonth)}
                            onValueChange={(value) => setSettingsDraft((prev) => ({
                                ...prev,
                                paymentsPerMonth: value === '1' ? 1 : 2,
                                secondDay: value === '1' ? null : (prev.secondDay || 25),
                            }))}
                        >
                            <Select.Trigger className={styles.compactSelect} />
                            <Select.Content className={styles.selectContent}>
                                <Select.Item value="1">1 раз в месяц</Select.Item>
                                <Select.Item value="2">2 раза в месяц</Select.Item>
                            </Select.Content>
                        </Select.Root>
                        <Select.Root
                            value={String(settingsDraft.firstDay)}
                            onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, firstDay: Number(value) }))}
                        >
                            <Select.Trigger className={styles.compactDaySelect} />
                            <Select.Content className={styles.selectContent}>
                                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                    <Select.Item key={`first-${day}`} value={String(day)}>{day}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                        {settingsDraft.paymentsPerMonth === 2 ? (
                            <Select.Root
                                value={String(settingsDraft.secondDay || 25)}
                                onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, secondDay: Number(value) }))}
                            >
                                <Select.Trigger className={styles.compactDaySelect} />
                                <Select.Content className={styles.selectContent}>
                                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                        <Select.Item key={`second-${day}`} value={String(day)}>{day}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        ) : null}
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.inlineButton} ${styles.surfaceButton}`}
                            onClick={() => void handleSaveSettings()}
                            disabled={saving}
                        >
                            Сохранить
                        </Button>
                    </div>
                </div>

                <div className={styles.toolbarPanel}>
                    <div className={styles.toolbarSearchBlock}>
                        <Text size="2" weight="medium" className={styles.panelLabel}>Поиск сотрудника</Text>
                        <TextField.Root
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className={styles.searchInput}
                            placeholder="ФИО сотрудника"
                        >
                            <TextField.Slot>
                                <FiSearch className={styles.icon} />
                            </TextField.Slot>
                        </TextField.Root>
                    </div>

                    <div className={styles.toolbarActionsBlock}>
                        <div className={styles.actionButtonsRow}>
                            <Button
                                variant="solid"
                                color="gray"
                                highContrast
                                className={styles.primaryButton}
                                onClick={() => void handleBuildEntries()}
                                disabled={saving || !selectedEmployeeIds.length || !payload?.paymentTableAvailable}
                            >
                                <FiFileText className={styles.icon} />
                                {saving ? 'Проведение…' : 'Провести выплаты'}
                            </Button>

                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={openManualPaymentDialog}
                                disabled={selectedEmployees.length !== 1}
                            >
                                Ручная выплата
                            </Button>

                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger>
                                    <Button
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={`${styles.actionButton} ${styles.surfaceButton}`}
                                        disabled={!selectedEmployeeIds.length}
                                    >
                                        <FiPrinter className={styles.icon} />
                                        Напечатать
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content align="end" className={styles.printMenu}>
                                    <DropdownMenu.Label>
                                        Выбрано {selectedEmployeeIds.length} {selectedEmployeeIds.length === 1 ? 'сотрудник' : selectedEmployeeIds.length < 5 ? 'сотрудника' : 'сотрудников'}
                                    </DropdownMenu.Label>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item onSelect={openBatchPayrollPreview}>Расчетно платежная ведомость</DropdownMenu.Item>
                                    <DropdownMenu.Item onSelect={openSelectedStatementsPreview}>
                                        {selectedEmployeeIds.length === 1 ? 'Расчетный лист' : 'Расчетные листы'}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item onSelect={openTimesheetPreview}>
                                        {selectedEmployeeIds.length === 1 ? 'Табель учета рабочего времени' : 'Табели учета рабочего времени'}
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>

                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => void loadData()}
                            >
                                <FiRefreshCw className={styles.icon} />
                                Обновить
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.payrollHint}>
                Зарплата не начисляется автоматически сама по себе. Экран только рассчитывает месяц. Дальше ты вручную нажимаешь
                {' '}<strong>«Провести выплаты»</strong> для отмеченных сотрудников или <strong>«Ручная выплата»</strong> для одного сотрудника.
                При массовом проведении выплаты попадут в журнал по своим датам графика: отдельно аванс, отдельно зарплата, отпускные и другие начисления.
            </div>

            {error ? <div className={styles.errorBanner}>{error}</div> : null}
            {notice ? <div className={styles.successBanner}>{notice}</div> : null}

            <div className={styles.tabsRow}>
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={tab.key === activeTab ? styles.activeTab : styles.tabButton}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <Card className={styles.payrollCard}>
                <div className={styles.payrollCardHeader}>
                    <div>
                        <Text size="4" weight="bold">Месяц: {payload?.selectedMonthLabel || formatMonthLabel(monthKey)}</Text>
                        <Text as="div" size="2" color="gray">
                            {activeTabDescription}
                        </Text>
                    </div>
                    <Text size="2" color="gray">
                        Выбрано сотрудников: {selectedEmployeeIds.length}
                    </Text>
                </div>

                <div className={styles.payrollGrid}>
                    <div className={styles.payrollHeaderRow} style={{ gridTemplateColumns }}>
                        <div className={styles.checkboxCell}>
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                ref={(node) => {
                                    if (node) node.indeterminate = !allVisibleSelected && someVisibleSelected;
                                }}
                                onChange={toggleVisible}
                            />
                        </div>
                        <div className={styles.employeeHeaderCell}>Сотрудник</div>
                        {activeColumns.map((column) => (
                            <div key={column.key} className={styles.metricHeaderCell}>{column.label}</div>
                        ))}
                    </div>

                    {filteredEmployees.map((employee) => (
                        <div key={employee.id} className={styles.payrollRow} style={{ gridTemplateColumns }}>
                            <div className={styles.checkboxCell}>
                                <input
                                    type="checkbox"
                                    checked={selectedEmployeeIds.includes(employee.id)}
                                    onChange={() => toggleEmployee(employee.id)}
                                />
                            </div>
                            <div className={styles.employeeCell}>
                                <div className={styles.employeeName}>{employee.fio}</div>
                                <div className={styles.employeeRole}>{employee.position || '—'}</div>
                                <div className={styles.employeeHints}>
                                    {employee.suggestedPayments.length
                                        ? employee.suggestedPayments
                                            .map((item) => `${getSuggestedPaymentTypeLabel(item.type)}: ${formatNumber(item.payableAmount)} ₽`)
                                            .join(' · ')
                                        : 'Нет открытых начислений'}
                                </div>
                            </div>
                            {activeColumns.map((column) => (
                                <div key={column.key} className={styles.metricCell}>{column.render(employee)}</div>
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

            <Card className={styles.tableCard}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <Text size="4" weight="bold">Журнал проведённых выплат</Text>
                        <Text as="div" size="2" color="gray">
                            Здесь видно, что уже реально занесено в таблицу выплат за {payload?.selectedMonthLabel || formatMonthLabel(monthKey)}.
                        </Text>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.simpleTable}>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Сотрудник</th>
                                <th>Вид</th>
                                <th>Период</th>
                                <th>Начислено</th>
                                <th>Удержано</th>
                                <th>Выплачено</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.length ? recentPayments.map((payment) => (
                                <tr key={payment.id}>
                                    <td>{formatDate(payment.date)}</td>
                                    <td>{payment.employeeName || '—'}</td>
                                    <td>{payment.paymentKind || payment.type || '—'}</td>
                                    <td>{payment.periodFrom || payment.periodTo ? `${formatDate(payment.periodFrom)} - ${formatDate(payment.periodTo)}` : '—'}</td>
                                    <td>{formatNumber(payment.accruedAmount || payment.amount)}</td>
                                    <td>{formatNumber(payment.withheldAmount)}</td>
                                    <td>{formatNumber(payment.paidAmount || payment.amount)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className={styles.emptyCell}>За выбранный месяц выплат пока нет.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {statementPreview ? (
                <div className={styles.previewScreen}>
                    <div className={styles.previewBackdrop} />
                    <section
                        className={styles.previewPanel}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={statementPreview.title}
                    >
                        <div className={styles.previewPanelHeader}>
                            <div className={styles.previewPanelTitleBlock}>
                                <h2 className={styles.previewPanelTitle}>{statementPreview.title}</h2>
                            </div>
                            <button
                                type="button"
                                className={styles.previewCloseButton}
                                onClick={() => setStatementPreview(null)}
                                aria-label="Закрыть предпросмотр"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.previewToolbar}>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={handlePrintPreview}
                            >
                                <FiPrinter className={styles.icon} />
                                Напечатать
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => handlePreviewDownload('pdf')}
                            >
                                <BsFillFileEarmarkPdfFill className={`${styles.icon} ${styles.pdfIcon}`} />
                                PDF
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => handlePreviewDownload('excel')}
                            >
                                <BsFillFileEarmarkExcelFill className={`${styles.icon} ${styles.excelIcon}`} />
                                Excel
                            </Button>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.actionButton} ${styles.surfaceButton}`}
                                onClick={() => window.open(previewPdfObjectUrl || statementPreview.previewUrl, '_blank', 'noopener,noreferrer')}
                            >
                                <FiExternalLink className={styles.icon} />
                                Открыть
                            </Button>
                            <div className={styles.previewZoomControls}>
                                <button
                                    type="button"
                                    className={styles.previewZoomButton}
                                    onClick={() => updatePreviewZoom(previewZoom - PREVIEW_ZOOM_STEP)}
                                    disabled={previewLoading || previewZoom <= PREVIEW_ZOOM_MIN}
                                    aria-label="Уменьшить масштаб"
                                >
                                    <FiMinus />
                                </button>
                                <button
                                    type="button"
                                    className={styles.previewZoomValue}
                                    onClick={() => updatePreviewZoom(1)}
                                    disabled={previewLoading || previewZoom === 1}
                                    aria-label="Сбросить масштаб"
                                >
                                    {Math.round(previewZoom * 100)}%
                                </button>
                                <button
                                    type="button"
                                    className={styles.previewZoomButton}
                                    onClick={() => updatePreviewZoom(previewZoom + PREVIEW_ZOOM_STEP)}
                                    disabled={previewLoading || previewZoom >= PREVIEW_ZOOM_MAX}
                                    aria-label="Увеличить масштаб"
                                >
                                    <FiPlus />
                                </button>
                            </div>
                        </div>

                        <div className={styles.previewCanvas}>
                            <div ref={previewStageRef} className={styles.previewStage}>
                                {previewLoading ? (
                                    <div className={styles.previewLoading}>Готовим предпросмотр PDF...</div>
                                ) : null}
                                {previewError ? (
                                    <div className={styles.inlineError}>{previewError}</div>
                                ) : null}
                                {!previewLoading && !previewError ? (
                                    <div className={styles.previewPages}>
                                        {previewPages.map((page, index) => (
                                            <img
                                                key={`${statementPreview.previewUrl}-${index + 1}`}
                                                src={page.src}
                                                alt={`Страница ${index + 1}`}
                                                className={styles.previewPageImage}
                                                style={{ width: `${page.width}px`, height: `${page.height}px` }}
                                            />
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <iframe
                            ref={previewPrintFrameRef}
                            title="Скрытый фрейм печати"
                            className={styles.hiddenPrintFrame}
                        />
                    </section>
                </div>
            ) : null}

            <Dialog.Root open={Boolean(manualPaymentEmployee)} onOpenChange={(open) => (!open ? setManualPaymentEmployee(null) : undefined)}>
                <Dialog.Content className={styles.paymentDialog}>
                    <Dialog.Title>Ручная выплата</Dialog.Title>
                    <Dialog.Description>
                        {manualPaymentEmployee ? `${manualPaymentEmployee.fio} · ${manualPaymentEmployee.position || '—'}` : '—'}
                    </Dialog.Description>

                    <div className={styles.dialogForm}>
                        <Select.Root
                            value={manualPaymentForm.paymentType}
                            onValueChange={(value) => setManualPaymentForm((prev) => ({ ...prev, paymentType: value }))}
                        >
                            <Select.Trigger className={styles.fieldSelect} />
                            <Select.Content className={styles.selectContent}>
                                <Select.Item value="зарплата">Зарплата</Select.Item>
                                <Select.Item value="аванс">Аванс</Select.Item>
                                <Select.Item value="отпускные">Отпускные</Select.Item>
                                <Select.Item value="больничный">Больничный</Select.Item>
                                <Select.Item value="премия">Премия</Select.Item>
                            </Select.Content>
                        </Select.Root>

                        <TextField.Root
                            value={manualPaymentForm.amount}
                            onChange={(event) => setManualPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
                            className={styles.dialogInput}
                            placeholder="Сумма"
                        />

                        <input
                            type="date"
                            value={manualPaymentForm.date}
                            onChange={(event) => setManualPaymentForm((prev) => ({ ...prev, date: event.target.value }))}
                            className={styles.processingDateInput}
                        />

                        <TextField.Root
                            value={manualPaymentForm.comment}
                            onChange={(event) => setManualPaymentForm((prev) => ({ ...prev, comment: event.target.value }))}
                            className={styles.dialogInput}
                            placeholder="Комментарий"
                        />

                        {manualPaymentError ? <div className={styles.inlineError}>{manualPaymentError}</div> : null}
                    </div>

                    <Flex justify="end" gap="3" mt="4">
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.actionButton} ${styles.surfaceButton}`}
                            onClick={() => setManualPaymentEmployee(null)}
                        >
                            Закрыть
                        </Button>
                        <Button
                            variant="solid"
                            color="gray"
                            highContrast
                            className={styles.primaryButton}
                            onClick={() => void handleManualPaymentSave()}
                            disabled={saving}
                        >
                            {saving ? 'Сохранение…' : 'Сохранить выплату'}
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(AdminFinancePage);
