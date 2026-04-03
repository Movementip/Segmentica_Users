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
import { convertOfficeDocumentToPdf } from '../../../../lib/documentConverter';
import { hasDocumentRenderer, renderXlsxTemplateDocument } from '../../../../lib/documentRendererClient';
import { getFinancePayload } from '../finance';

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

const getPrimarySuggestion = (items: Array<{
    type: 'advance' | 'salary_cycle' | 'vacation' | 'bonus';
    recommendedDate: string;
}>): typeof items[number] | null => {
    if (!items.length) return null;
    return items.reduce<typeof items[number] | null>((best, item) => {
        if (!best) return item;

        const bestTime = new Date(best.recommendedDate).getTime();
        const itemTime = new Date(item.recommendedDate).getTime();
        if (itemTime !== bestTime) return itemTime > bestTime ? item : best;

        const bestRank = best.type === 'salary_cycle' ? 3 : best.type === 'advance' ? 2 : best.type === 'vacation' ? 1 : 0;
        const itemRank = item.type === 'salary_cycle' ? 3 : item.type === 'advance' ? 2 : item.type === 'vacation' ? 1 : 0;
        return itemRank > bestRank ? item : best;
    }, null);
};

const resolvePaymentKind = (value: string | null | undefined): StatementSourcePayload['paymentKind'] => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'аванс' || normalized === 'advance') return 'advance';
    if (normalized === 'отпускные' || normalized === 'vacation') return 'vacation';
    if (normalized === 'премия' || normalized === 'bonus') return 'bonus';
    return 'salary';
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
        const disposition = normalizeQueryValue(req.query.disposition) === 'inline' ? 'inline' : 'attachment';
        const format = resolveFormat(normalizeQueryValue(req.query.format));

        const isBatchCurrent = sourceType === 'current_batch';

        if (!isBatchCurrent && (!Number.isInteger(employeeId) || employeeId <= 0)) {
            return res.status(400).json({ error: 'Некорректный сотрудник' });
        }

        if (sourceType !== 'current' && sourceType !== 'history' && sourceType !== 'current_batch') {
            return res.status(400).json({ error: 'Некорректный источник расчетки' });
        }

        const payload = await getFinancePayload(24);
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

        if (sourceType === 'current') {
            const currentEmployee = employee!;
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

        if (sourceType === 'current_batch') {
            if (!employeeIds.length) {
                return res.status(400).json({ error: 'Не выбраны сотрудники для общей расчетки' });
            }

            const employeeMap = new Map(payload.employees.map((item) => [item.id, item]));
            batchEntries = employeeIds.flatMap((id) => {
                const currentEmployee = employeeMap.get(id);
                if (!currentEmployee) return [];
                const suggestion = getPrimarySuggestion(currentEmployee.suggestedPayments);
                if (!suggestion) return [];

                return [{
                    employee: {
                        id: currentEmployee.id,
                        fio: currentEmployee.fio,
                        position: currentEmployee.position,
                        rate: currentEmployee.rate,
                    },
                    source: {
                        key: suggestion.key,
                        label: suggestion.label,
                        paymentKind: suggestion.type === 'advance'
                            ? 'advance'
                            : suggestion.type === 'vacation'
                                ? 'vacation'
                                : suggestion.type === 'bonus'
                                    ? 'bonus'
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
                    },
                }];
            });

            if (!batchEntries.length) {
                return res.status(400).json({ error: 'У выбранных сотрудников нет текущих начислений для ведомости' });
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

        if (hasDocumentRenderer() && (format === 'excel' || format === 'pdf')) {
            const templatePayload = isBatchCurrent
                ? await buildFinanceStatementBatchTemplatePayload({
                    actor: {
                        fio: actor.employee.fio,
                        position: actor.employee.position,
                    },
                    entries: batchEntries,
                })
                : await buildFinanceStatementTemplatePayload({
                    employee: {
                        id: employee.id,
                        fio: employee.fio,
                        position: employee.position,
                        rate: employee.rate,
                    },
                    actor: {
                        fio: actor.employee.fio,
                        position: actor.employee.position,
                    },
                    source: source!,
                });
            const rendered = await renderXlsxTemplateDocument({
                templateName: templatePayload.templateName,
                fileBaseName: templatePayload.fileBaseName,
                cells: templatePayload.cells,
                rowVisibility: templatePayload.rowVisibility,
                rowHeights: templatePayload.rowHeights,
                printAreas: templatePayload.printAreas,
                rangeCopies: templatePayload.rangeCopies,
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

        const statementParams = {
            employee: {
                id: employee.id,
                fio: employee.fio,
                position: employee.position,
                rate: employee.rate,
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
        return res.status(500).json({ error: 'Не удалось сформировать расчетку' });
    } finally {
        if (cleanupDir) {
            await fs.rm(cleanupDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }
}
