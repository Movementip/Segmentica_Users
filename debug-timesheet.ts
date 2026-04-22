import { getFinancePayload } from './backend/pages/api/admin/finance';
import { buildFinanceTimesheetBatchTemplatePayload } from './backend/lib/financeTimesheetDocument';

async function main() {
    const payload = await getFinancePayload(24, '2026-04');
    const employees = (payload.employees || []).slice(0, 4);

    const entries = employees.map((employee) => ({
        employee: {
            id: employee.id,
            fio: employee.fio,
            position: employee.position,
            rate: employee.rate,
        },
        source: {
            key: `month-timesheet#2026-04-${employee.id}`,
            label: 'Сводный табель за месяц',
            paymentKind: 'salary',
            sourceType: 'current' as const,
            paymentId: null,
            accruedAmount: Number(employee.currentAccrued || 0),
            withheldAmount: Number(employee.currentWithheld || 0),
            paidAmount: Number(employee.currentPaid || 0),
            payableAmount: Number(employee.currentPayable || 0),
            amount: Number(employee.currentPayable || 0),
            periodFrom: '2026-04-01',
            periodTo: '2026-04-30',
            paymentDate: null,
            comment: null,
            sourceSummary: 'debug',
            accruals: {
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
            },
        },
    }));

    const result = await buildFinanceTimesheetBatchTemplatePayload({
        actor: {
            fio: 'Тестовый Пользователь',
            position: 'Администратор',
        },
        entries,
    });

    console.log(JSON.stringify({
        templateName: result.templateName,
        fileBaseName: result.fileBaseName,
        cells: result.cells.length,
        printAreas: result.printAreas,
        rangeCopies: result.rangeCopies,
        hiddenSheets: result.hiddenSheets,
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
