import React, { useCallback, useEffect, useState } from 'react';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { ScheduleBoardGrid } from '../../components/admin/schedule-board/ScheduleBoardGrid/ScheduleBoardGrid';
import { ScheduleBoardLegend } from '../../components/admin/schedule-board/ScheduleBoardLegend/ScheduleBoardLegend';
import { ScheduleBoardToolbar } from '../../components/admin/schedule-board/ScheduleBoardToolbar/ScheduleBoardToolbar';
import { BoardPayload, createMonthKey, formatBoardRange, shiftMonth } from '../../components/admin/schedule-board/model';
import styles from './AdminScheduleBoard.module.css';

function AdminScheduleBoardPage(): JSX.Element {
    const { user, loading: authLoading } = useAuth();
    const [monthKey, setMonthKey] = useState(() => createMonthKey(new Date()));
    const [includeInactive, setIncludeInactive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<BoardPayload | null>(null);

    const canViewScheduleBoard = Boolean(
        user?.permissions?.includes('admin.schedule_board')
        || (user?.permissions?.includes('managers.list') && user?.permissions?.includes('schedule.manage'))
    );

    const loadBoard = useCallback(async (nextMonth: string, nextIncludeInactive: boolean) => {
        try {
            setError(null);
            setRefreshing(true);
            const params = new URLSearchParams({
                month: nextMonth,
                includeInactive: nextIncludeInactive ? '1' : '0',
            });
            const response = await fetch(`/api/admin/schedule-board?${params.toString()}`);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error((data as { error?: string }).error || 'Не удалось загрузить сводный график');
            }

            setPayload(data as BoardPayload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить сводный график');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading || !canViewScheduleBoard) return;
        void loadBoard(monthKey, includeInactive);
    }, [authLoading, canViewScheduleBoard, includeInactive, loadBoard, monthKey]);

    if (authLoading || loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canViewScheduleBoard) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>График сотрудников</h1>
                <div className={styles.subtitle}>
                    Сводная доска по всем сотрудникам: строки — сотрудники, колонки — дни месяца.
                </div>
            </div>

            <ScheduleBoardToolbar
                monthLabel={payload?.monthLabel || monthKey}
                rangeLabel={payload ? formatBoardRange(payload.visibleDateFrom, payload.visibleDateTo) : monthKey}
                employeeCount={payload?.employees.length || 0}
                includeInactive={includeInactive}
                refreshing={refreshing}
                onPrevMonth={() => setMonthKey((current) => shiftMonth(current, -1))}
                onNextMonth={() => setMonthKey((current) => shiftMonth(current, 1))}
                onIncludeInactiveChange={setIncludeInactive}
                onRefresh={() => void loadBoard(monthKey, includeInactive)}
            />

            <div className={styles.section}>
                <ScheduleBoardLegend />
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={styles.section}>
                {payload ? <ScheduleBoardGrid payload={payload} /> : null}
            </div>
        </div>
    );
}

export default withLayout(AdminScheduleBoardPage);
