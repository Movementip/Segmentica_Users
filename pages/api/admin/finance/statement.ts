import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';
import { requirePermission } from '../../../../lib/auth';
import { buildFinanceStatementFiles, type StatementSourcePayload } from '../../../../lib/financeStatementDocument';
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

const resolveFormat = (value: string | null): 'html' | 'excel' => {
    if (value === 'excel') return value;
    return 'html';
};

const resolvePaymentKind = (value: string | null | undefined): StatementSourcePayload['paymentKind'] => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'аванс' || normalized === 'advance') return 'advance';
    if (normalized === 'отпускные' || normalized === 'vacation') return 'vacation';
    if (normalized === 'премия' || normalized === 'bonus') return 'bonus';
    return 'salary';
};

const getMimeType = (format: 'html' | 'excel'): string => {
    if (format === 'excel') {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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
        const sourceType = normalizeQueryValue(req.query.sourceType);
        const sourceKey = normalizeQueryValue(req.query.sourceKey);
        const paymentId = normalizeQueryValue(req.query.paymentId);
        const disposition = normalizeQueryValue(req.query.disposition) === 'inline' ? 'inline' : 'attachment';
        const format = resolveFormat(normalizeQueryValue(req.query.format));

        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({ error: 'Некорректный сотрудник' });
        }

        if (sourceType !== 'current' && sourceType !== 'history') {
            return res.status(400).json({ error: 'Некорректный источник расчетки' });
        }

        const payload = await getFinancePayload(24);
        const employee = payload.employees.find((item) => item.id === employeeId);

        if (!employee) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        let source: StatementSourcePayload | null = null;

        if (sourceType === 'current') {
            const suggestion = employee.suggestedPayments.find((item) => item.key === sourceKey);
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

        if (sourceType === 'history') {
            const payment = employee.paymentHistory.find((item) => item.id === paymentId);
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

        if (!source) {
            return res.status(400).json({ error: 'Не удалось подготовить источник расчетки' });
        }

        const files = await buildFinanceStatementFiles({
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
            source,
        });

        const filePath = getFilePath(files, format);
        cleanupDir = path.dirname(filePath);
        const buffer = await fs.readFile(filePath);
        const filename = path.basename(filePath);
        const finalDisposition = format === 'html' && disposition === 'inline' ? 'inline' : 'attachment';

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
