import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';
import { requirePermission } from '../../../../lib/auth';
import {
    buildFinanceStatementBatchTemplatePayload,
    buildFinanceStatementFiles,
    buildFinanceStatementTemplatePayload,
    type StatementSourcePayload,
} from '../../../../lib/financeStatementDocument';
import {
    buildFinancePayslipBatchTemplatePayload,
    buildFinancePayslipTemplatePayload,
} from '../../../../lib/financePayslipDocument';
import { buildFinanceTimesheetBatchTemplatePayload } from '../../../../lib/financeTimesheetDocument';
import { convertOfficeDocumentToPdf } from '../../../../lib/documentConverter';
import { hasDocumentRenderer, renderXlsxTemplateDocument } from '../../../../lib/documentRendererClient';
import {
    getFinancePayload,
    type FinanceEmployee,
    type FinanceSuggestedPayment,
    type FinanceSuggestedPaymentType,
} from '../finance';

export const config = {
    api: {
        responseLimit: false,
    },
};

const normalizeQueryValue = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) return value[0] ? String(value[0]) : null;
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
};

const resolveFormat = (value: string | null): 'html' | 'excel' | 'pdf' => {
    if (value === 'excel') return value;
    if (value === 'pdf') return value;
    return 'html';
};

const resolveDocumentKind = (value: string | null): 'statement' | 'payslip' | 'timesheet' => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'payslip' || normalized === 'pay-slip' || normalized === 'расчетный_лист') return 'payslip';
    if (normalized === 'timesheet' || normalized === 'time-sheet' || normalized === 'табель' || normalized === 'т13') return 'timesheet';
    return 'statement';
};

const parseEmployeeIds = (value: string | null): number[] => {
    if (!value) return [];
    return Array.from(
        new Set(
            value
                .split(',')
                .map((part) => Number(String(part).trim()))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );
};

const resolvePaymentKind = (value: string | null | undefined): StatementSourcePayload['paymentKind'] => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'аванс' || normalized === 'advance') return 'advance';
    if (normalized === 'отпускные' || normalized === 'vacation') return 'vacation';
    if (normalized === 'премия' || normalized === 'bonus') return 'bonus';
    if (normalized === 'больничный' || normalized === 'больничные' || normalized === 'sick_leave' || normalized === 'sick') return 'sick_leave';
    return 'salary';
};

const getSuggestedPaymentPriority = (type: FinanceSuggestedPaymentType): number => {
    if (type === 'vacation') return 0;
    if (type === 'sick_leave') return 1;
    if (type === 'advance') return 2;
    if (type === 'salary_cycle') return 3;
    return 4;
};

const parseMonthKey = (value: string | null): Date | null => {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(normalized)) return null;
    const [yearRaw, monthRaw] = normalized.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return new Date(Date.UTC(year, month - 1, 1));
};

const parseDateOnly = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);
const roundMoney = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

const startOfMonthUtc = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const endOfMonthUtc = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));

const aggregateCurrentMonthPayroll = (
    employee: Pick<FinanceEmployee, 'currentAccrued' | 'currentWithheld' | 'currentPaid' | 'currentPayable' | 'currentOrgDebt' | 'currentEmployeeDebt' | 'currentBreakdown' | 'paymentHistory' | 'suggestedPayments'>,
    monthKey: string | null
): StatementSourcePayload | null => {
    const monthDate = parseMonthKey(monthKey) || new Date();
    const periodFrom = formatDateOnly(startOfMonthUtc(monthDate));
    const periodTo = formatDateOnly(endOfMonthUtc(monthDate));
    const monthPayments = employee.paymentHistory.filter((item) => {
        const paymentDate = parseDateOnly(item.date);
        return Boolean(paymentDate && paymentDate >= startOfMonthUtc(monthDate) && paymentDate <= endOfMonthUtc(monthDate));
    });

    if (monthPayments.length) {
        const accruals = {
            salary: 0,
            bonus: 0,
            sickLeave: 0,
            vacation: 0,
            otherIncome: 0,
            totalAccrued: 0,
            incomeTax: 0,
            hospitalOffset: 0,
            advanceOffset: 0,
            orgDebt: 0,
            employeeDebt: 0,
            payable: 0,
        };

        let paidAmount = 0;

        for (const payment of monthPayments) {
            const kind = resolvePaymentKind(
                typeof payment.calculation?.paymentKind === 'string'
                    ? payment.calculation.paymentKind
                    : payment.paymentKind || payment.type
            );
            const accruedAmount = Number(payment.accruedAmount || payment.amount || 0);
            const withheldAmount = Number(payment.withheldAmount || 0);
            const paid = Number(payment.paidAmount || payment.amount || 0);
            const remaining = Math.max(0, Number(payment.payableAmount || 0) || roundMoney(accruedAmount - withheldAmount - paid));

            if (kind === 'advance' || kind === 'salary') accruals.salary += accruedAmount;
            else if (kind === 'bonus') accruals.bonus += accruedAmount;
            else if (kind === 'sick_leave') accruals.sickLeave += accruedAmount;
            else if (kind === 'vacation') accruals.vacation += accruedAmount;
            else accruals.otherIncome += accruedAmount;

            accruals.totalAccrued += accruedAmount;
            accruals.incomeTax += withheldAmount;
            accruals.payable += paid + remaining;
            paidAmount += paid;
        }

        const paymentDates = monthPayments
            .map((item) => item.date)
            .filter((value): value is string => Boolean(value))
            .sort();

        return {
            key: `month-recorded#${monthKey || periodFrom}`,
            label: 'Фактические выплаты за месяц',
            paymentKind: 'salary',
            sourceType: 'current',
            paymentId: null,
            accruedAmount: roundMoney(accruals.totalAccrued),
            withheldAmount: roundMoney(accruals.incomeTax),
            paidAmount: roundMoney(paidAmount),
            payableAmount: roundMoney(accruals.payable),
            amount: roundMoney(accruals.payable),
            periodFrom,
            periodTo,
            paymentDate: paymentDates[paymentDates.length - 1] || null,
            comment: 'Сформировано по фактическим записям журнала выплат за месяц',
            sourceSummary: 'Журнал выплат за выбранный месяц',
            accruals: {
                salary: roundMoney(accruals.salary),
                bonus: roundMoney(accruals.bonus),
                sickLeave: roundMoney(accruals.sickLeave),
                vacation: roundMoney(accruals.vacation),
                otherIncome: roundMoney(accruals.otherIncome),
                totalAccrued: roundMoney(accruals.totalAccrued),
                incomeTax: roundMoney(accruals.incomeTax),
                hospitalOffset: 0,
                advanceOffset: 0,
                orgDebt: 0,
                employeeDebt: 0,
                payable: roundMoney(accruals.payable),
            },
        };
    }

    if (
        !employee.currentAccrued
        && !employee.currentWithheld
        && !employee.currentPaid
        && !employee.currentPayable
        && !employee.currentOrgDebt
        && !employee.currentEmployeeDebt
    ) {
        return null;
    }

    const sortedSuggestions = [...employee.suggestedPayments].sort((a, b) => {
        const dateDiff = String(a.recommendedDate).localeCompare(String(b.recommendedDate));
        if (dateDiff !== 0) return dateDiff;
        return getSuggestedPaymentPriority(a.type) - getSuggestedPaymentPriority(b.type);
    });
    const paymentDates = [
        ...sortedSuggestions.map((item) => item.recommendedDate).filter((value): value is string => Boolean(value)),
        ...employee.paymentHistory.map((item) => item.date).filter((value): value is string => Boolean(value && String(value).startsWith(monthKey || ''))),
    ].sort();

    const accruals = {
        salary: Number(employee.currentBreakdown.salary || 0),
        bonus: Number(employee.currentBreakdown.bonus || 0),
        sickLeave: Number(employee.currentBreakdown.sickLeave || 0),
        vacation: Number(employee.currentBreakdown.vacation || 0),
        otherIncome: 0,
        totalAccrued: Number(employee.currentAccrued || 0),
        incomeTax: Number(employee.currentWithheld || 0),
        hospitalOffset: 0,
        advanceOffset: Number(employee.currentBreakdown.advance || 0),
        orgDebt: Number(employee.currentOrgDebt || 0),
        employeeDebt: Number(employee.currentEmployeeDebt || 0),
        payable: Number(employee.currentPayable || 0),
    };

    return {
        key: `month-current#${monthKey || periodFrom}`,
        label: 'Сводное начисление за месяц',
        paymentKind: 'salary',
        sourceType: 'current',
        paymentId: null,
        accruedAmount: Number(employee.currentAccrued || 0),
        withheldAmount: Number(employee.currentWithheld || 0),
        paidAmount: Number(employee.currentPaid || 0),
        payableAmount: Number(employee.currentPayable || 0),
        amount: Number(employee.currentPayable || 0),
        periodFrom,
        periodTo,
        paymentDate: paymentDates[paymentDates.length - 1] || null,
        comment: sortedSuggestions.map((item) => item.note).filter(Boolean).join(' | ') || null,
        sourceSummary: sortedSuggestions.map((item) => item.sourceSummary).filter(Boolean).join(' | ') || 'Сводная расчетка по выбранному месяцу',
        accruals,
    };
};

const buildEmptyCurrentMonthSource = (monthKey: string | null): StatementSourcePayload => {
    const monthDate = parseMonthKey(monthKey) || new Date();
    const periodFrom = formatDateOnly(startOfMonthUtc(monthDate));
    const periodTo = formatDateOnly(endOfMonthUtc(monthDate));

    return {
        key: `month-timesheet#${monthKey || periodFrom}`,
        label: 'Сводный табель за месяц',
        paymentKind: 'salary',
        sourceType: 'current',
        paymentId: null,
        accruedAmount: 0,
        withheldAmount: 0,
        paidAmount: 0,
        payableAmount: 0,
        amount: 0,
        periodFrom,
        periodTo,
        paymentDate: null,
        comment: null,
        sourceSummary: 'Сводный табель по выбранному месяцу',
        accruals: {
            salary: 0,
            bonus: 0,
            sickLeave: 0,
            vacation: 0,
            otherIncome: 0,
            totalAccrued: 0,
            incomeTax: 0,
            hospitalOffset: 0,
            advanceOffset: 0,
            orgDebt: 0,
            employeeDebt: 0,
            payable: 0,
        },
    };
};

const getMimeType = (format: 'html' | 'excel' | 'pdf'): string => {
    if (format === 'excel') {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (format === 'pdf') {
        return 'application/pdf';
    }
    return 'text/html; charset=utf-8';
};

const getFilePath = (
    files: Awaited<ReturnType<typeof buildFinanceStatementFiles>>,
    format: 'html' | 'excel'
): string => {
    if (format === 'excel') return files.excelPath;
    return files.htmlPath;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Buffer | { error: string }>) {
    let cleanupDir: string | null = null;

    try {
        const actor = await requirePermission(req, res, 'admin.finance');
        if (!actor) return;

        if (req.method !== 'GET') {
            res.setHeader('Allow', ['GET']);
            return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        }

        const employeeId = Number(normalizeQueryValue(req.query.employeeId));
        const employeeIds = parseEmployeeIds(normalizeQueryValue(req.query.employeeIds));
        const sourceType = normalizeQueryValue(req.query.sourceType);
        const sourceKey = normalizeQueryValue(req.query.sourceKey);
        const paymentId = normalizeQueryValue(req.query.paymentId);
        const month = normalizeQueryValue(req.query.month);
        const documentKind = resolveDocumentKind(normalizeQueryValue(req.query.documentKind));
        const disposition = normalizeQueryValue(req.query.disposition) === 'inline' ? 'inline' : 'attachment';
        const format = resolveFormat(normalizeQueryValue(req.query.format));

        const isBatchCurrent = sourceType === 'current_batch';

        if (!isBatchCurrent && (!Number.isInteger(employeeId) || employeeId <= 0)) {
            return res.status(400).json({ error: 'Некорректный сотрудник' });
        }

        if (sourceType !== 'current' && sourceType !== 'history' && sourceType !== 'current_batch') {
            return res.status(400).json({ error: 'Некорректный источник расчетки' });
        }

        const payload = await getFinancePayload(24, month);
        const employee = isBatchCurrent ? null : payload.employees.find((item) => item.id === employeeId);

        if (!isBatchCurrent && !employee) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        let source: StatementSourcePayload | null = null;
        let batchEntries: Array<{
            employee: {
                id: number;
                fio: string;
                position: string | null;
                rate: number | null;
            };
            source: StatementSourcePayload;
        }> = [];
        let payslipBatchEntries: Parameters<typeof buildFinancePayslipBatchTemplatePayload>[0] = [];

        if (sourceType === 'current') {
            const currentEmployee = employee!;
            if (!sourceKey) {
                source = aggregateCurrentMonthPayroll(currentEmployee, month);
                if (!source) {
                    return res.status(404).json({ error: 'Для выбранного месяца нет начислений для расчетки' });
                }
            } else {
                const suggestion = currentEmployee.suggestedPayments.find((item) => item.key === sourceKey);
                if (!suggestion) {
                    return res.status(404).json({ error: 'Текущее основание не найдено' });
                }

                source = {
                    key: suggestion.key,
                    label: suggestion.label,
                    paymentKind: suggestion.type === 'advance'
                        ? 'advance'
                        : suggestion.type === 'vacation'
                            ? 'vacation'
                            : suggestion.type === 'bonus'
                                ? 'bonus'
                                : suggestion.type === 'sick_leave'
                                    ? 'sick_leave'
                                    : 'salary',
                    sourceType: 'current',
                    paymentId: null,
                    accruedAmount: suggestion.accruedAmount,
                    withheldAmount: suggestion.withheldAmount,
                    paidAmount: suggestion.paidAmount,
                    payableAmount: suggestion.payableAmount,
                    amount: suggestion.amount,
                    periodFrom: suggestion.periodFrom,
                    periodTo: suggestion.periodTo,
                    paymentDate: suggestion.recommendedDate,
                    comment: suggestion.note,
                    sourceSummary: suggestion.sourceSummary,
                };
            }
        }

        if (sourceType === 'current_batch') {
            if (!employeeIds.length) {
                return res.status(400).json({ error: 'Не выбраны сотрудники для общей расчетки' });
            }

            const employeeMap = new Map(payload.employees.map((item) => [item.id, item]));
            batchEntries = employeeIds.flatMap((id) => {
                const currentEmployee = employeeMap.get(id);
                if (!currentEmployee) return [];
                const aggregatedSource = documentKind === 'timesheet'
                    ? (aggregateCurrentMonthPayroll(currentEmployee, month) || buildEmptyCurrentMonthSource(month))
                    : aggregateCurrentMonthPayroll(currentEmployee, month);
                if (!aggregatedSource) return [];

                return [{
                    employee: {
                        id: currentEmployee.id,
                        fio: currentEmployee.fio,
                        position: currentEmployee.position,
                        rate: currentEmployee.rate,
                    },
                    source: aggregatedSource,
                }];
            });

            payslipBatchEntries = employeeIds.flatMap((id) => {
                const currentEmployee = employeeMap.get(id);
                if (!currentEmployee) return [];
                const aggregatedSource = aggregateCurrentMonthPayroll(currentEmployee, month);
                if (!aggregatedSource) return [];

                return [{
                    employee: {
                        id: currentEmployee.id,
                        fio: currentEmployee.fio,
                        position: currentEmployee.position,
                        rate: currentEmployee.rate,
                    },
                    source: aggregatedSource,
                    paymentHistory: currentEmployee.paymentHistory,
                    settings: payload.settings,
                    contributionDetails: currentEmployee.currentContributionDetails,
                    currentContributions: currentEmployee.currentContributions,
                    currentOrgDebt: currentEmployee.currentOrgDebt,
                    currentEmployeeDebt: currentEmployee.currentEmployeeDebt,
                }];
            });

            if (documentKind === 'payslip' && !payslipBatchEntries.length) {
                return res.status(400).json({ error: 'У выбранных сотрудников нет текущих начислений для расчетных листов' });
            }

            if (documentKind === 'statement' && !batchEntries.length) {
                return res.status(400).json({ error: 'У выбранных сотрудников нет текущих начислений для ведомости' });
            }

            if (documentKind === 'timesheet' && !batchEntries.length) {
                return res.status(400).json({ error: 'У выбранных сотрудников нет данных для табеля учета рабочего времени' });
            }
        }

        if (sourceType === 'history') {
            const currentEmployee = employee!;
            const payment = currentEmployee.paymentHistory.find((item) => item.id === paymentId);
            if (!payment) {
                return res.status(404).json({ error: 'Прошлая выплата не найдена' });
            }

            const paidAmount = Number(payment.paidAmount || payment.amount || 0);
            source = {
                key: payment.id,
                label: payment.paymentKind || payment.type || 'Выплата',
                paymentKind: resolvePaymentKind(payment.calculation?.paymentKind || payment.paymentKind || payment.type),
                sourceType: 'history',
                paymentId: payment.id,
                accruedAmount: Number(payment.accruedAmount || paidAmount),
                withheldAmount: Number(payment.withheldAmount || 0),
                paidAmount,
                payableAmount: paidAmount,
                amount: paidAmount,
                periodFrom: payment.periodFrom,
                periodTo: payment.periodTo,
                paymentDate: payment.date,
                comment: payment.comment || payment.calculation?.note || null,
                sourceSummary: payment.calculation?.source || payment.paymentKind || payment.type || null,
            };
        }

        if (!isBatchCurrent && !source) {
            return res.status(400).json({ error: 'Не удалось подготовить источник расчетки' });
        }

        const resolvedEmployee = isBatchCurrent ? null : employee;

        if (hasDocumentRenderer() && (format === 'excel' || format === 'pdf')) {
            const templatePayload = isBatchCurrent
                ? documentKind === 'payslip'
                    ? await buildFinancePayslipBatchTemplatePayload(payslipBatchEntries)
                    : documentKind === 'timesheet'
                        ? await buildFinanceTimesheetBatchTemplatePayload({
                            actor: {
                                fio: actor.employee.fio,
                                position: actor.employee.position,
                            },
                            entries: batchEntries,
                        })
                    : await buildFinanceStatementBatchTemplatePayload({
                        actor: {
                            fio: actor.employee.fio,
                            position: actor.employee.position,
                        },
                        entries: batchEntries,
                    })
                : documentKind === 'payslip'
                    ? await buildFinancePayslipTemplatePayload({
                        employee: {
                            id: resolvedEmployee!.id,
                            fio: resolvedEmployee!.fio,
                            position: resolvedEmployee!.position,
                            rate: resolvedEmployee!.rate,
                        },
                        source: source!,
                        paymentHistory: resolvedEmployee!.paymentHistory,
                        settings: payload.settings,
                        contributionDetails: resolvedEmployee!.currentContributionDetails,
                        currentContributions: resolvedEmployee!.currentContributions,
                        currentOrgDebt: resolvedEmployee!.currentOrgDebt,
                        currentEmployeeDebt: resolvedEmployee!.currentEmployeeDebt,
                    })
                    : documentKind === 'timesheet'
                        ? null
                    : await buildFinanceStatementTemplatePayload({
                        employee: {
                            id: resolvedEmployee!.id,
                            fio: resolvedEmployee!.fio,
                            position: resolvedEmployee!.position,
                            rate: resolvedEmployee!.rate,
                        },
                        actor: {
                            fio: actor.employee.fio,
                            position: actor.employee.position,
                        },
                        source: source!,
                    });
            if (!templatePayload) {
                return res.status(400).json({ error: 'Табель учета рабочего времени формируется только по выбранным сотрудникам' });
            }
            const rendered = await renderXlsxTemplateDocument({
                templateName: templatePayload.templateName,
                fileBaseName: templatePayload.fileBaseName,
                cells: templatePayload.cells,
                rowVisibility: templatePayload.rowVisibility,
                rowHeights: templatePayload.rowHeights,
                printAreas: templatePayload.printAreas,
                rangeCopies: templatePayload.rangeCopies,
                sheetCopies: templatePayload.sheetCopies,
                hiddenSheets: templatePayload.hiddenSheets,
                sheetPageSetup: templatePayload.sheetPageSetup,
                outputFormat: format,
                postprocess: format === 'pdf' ? templatePayload.pdfPostprocess : 'none',
            });

            const finalDisposition = format === 'pdf' && disposition === 'inline' ? 'inline' : 'attachment';
            res.setHeader('Content-Type', rendered.contentType);
            res.setHeader('Content-Disposition', `${finalDisposition}; filename*=UTF-8''${encodeURIComponent(rendered.filename)}`);
            return res.status(200).send(rendered.buffer);
        }

        if (isBatchCurrent) {
            return res.status(400).json({ error: 'Для общей расчетки нужен включенный document renderer' });
        }

        if (documentKind === 'payslip') {
            return res.status(400).json({ error: 'Для расчетного листка нужен включенный document renderer' });
        }

        if (documentKind === 'timesheet') {
            return res.status(400).json({ error: 'Для табеля учета рабочего времени нужен включенный document renderer' });
        }

        const statementParams = {
            employee: {
                id: resolvedEmployee!.id,
                fio: resolvedEmployee!.fio,
                position: resolvedEmployee!.position,
                rate: resolvedEmployee!.rate,
            },
            actor: {
                fio: actor.employee.fio,
                position: actor.employee.position,
            },
            source: source!,
        } as const;

        const files = await buildFinanceStatementFiles(statementParams);

        const filePath = format === 'pdf'
            ? await convertOfficeDocumentToPdf(files.excelPath)
            : getFilePath(files, format);
        cleanupDir = path.dirname(filePath);
        const buffer = await fs.readFile(filePath);
        const filename = path.basename(filePath);
        const finalDisposition = (format === 'html' || format === 'pdf') && disposition === 'inline' ? 'inline' : 'attachment';

        res.setHeader('Content-Type', getMimeType(format));
        res.setHeader('Content-Disposition', `${finalDisposition}; filename*=UTF-8''${encodeURIComponent(filename)}`);
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Finance statement API error:', error);
        const message = error instanceof Error ? error.message : 'Не удалось сформировать расчетку';
        return res.status(500).json({
            error: process.env.NODE_ENV === 'production' ? 'Не удалось сформировать расчетку' : message,
        });
    } finally {
        if (cleanupDir) {
            await fs.rm(cleanupDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }
}
