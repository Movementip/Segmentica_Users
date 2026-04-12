import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Switch, Text } from '@radix-ui/themes';
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';
import styles from './AdminScheduleBoard.module.css';

type BoardDay = {
    date: string;
    dayNumber: number;
    weekdayShort: string;
    isWeekend: boolean;
    isToday: boolean;
};

type BoardCell = {
    date: string;
    status: string;
    startTime: string | null;
    endTime: string | null;
    source: string;
    isOverride: boolean;
    isVirtual: boolean;
};

type BoardEmployee = {
    id: number;
    fio: string;
    position: string;
    isActive: boolean;
    cells: BoardCell[];
};

type BoardPayload = {
    month: string;
    monthLabel: string;
    visibleDateFrom: string;
    visibleDateTo: string;
    days: BoardDay[];
    employees: BoardEmployee[];
};

const createMonthKey = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
};

const shiftMonth = (monthKey: string, delta: number) => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return createMonthKey(new Date());
    }
    return createMonthKey(new Date(year, month - 1 + delta, 1));
};

const getCellLabel = (status: string) => {
    switch (status) {
        case 'Работал':
            return 'Раб.';
        case '__off__':
            return 'Вых.';
        case 'отпуск':
            return 'Отп.';
        case 'больничный':
            return 'Бол.';
        case 'командировка':
            return 'Ком.';
        case 'работа на выезде':
            return 'Выезд';
        case '__empty__':
            return '';
        default:
            return status;
    }
};

const getCellTitle = (cell: BoardCell) => {
    const statusLabel = (() => {
        switch (cell.status) {
            case 'Работал':
                return 'Работает';
            case '__off__':
                return 'Выходной';
            case 'отпуск':
                return 'Отпуск';
            case 'больничный':
                return 'Больничный';
            case 'командировка':
                return 'Командировка';
            case 'работа на выезде':
                return 'Работа на выезде';
            case '__empty__':
                return 'Нет данных';
            default:
                return cell.status;
        }
    })();

    const timeRange = cell.startTime && cell.endTime ? ` ${cell.startTime}-${cell.endTime}` : '';
    return `${statusLabel}${timeRange}`.trim();
};

const getCellClassName = (status: string) => {
    switch (status) {
        case 'Работал':
            return styles.cellWork;
        case '__off__':
            return styles.cellOff;
        case 'отпуск':
            return styles.cellVacation;
        case 'больничный':
            return styles.cellSick;
        case 'командировка':
            return styles.cellTrip;
        case 'работа на выезде':
            return styles.cellField;
        default:
            return styles.cellEmpty;
    }
};

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
                <div>
                    <h1 className={styles.title}>График сотрудников</h1>
                    <div className={styles.subtitle}>
                        Сводная доска по всем сотрудникам: строки — сотрудники, колонки — дни месяца.
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <Button
                        variant="surface"
                        color="gray"
                        highContrast
                        className={styles.surfaceButton}
                        onClick={() => void loadBoard(monthKey, includeInactive)}
                        loading={refreshing}
                    >
                        <FiRefreshCw />
                        Обновить
                    </Button>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.toolbarBlock}>
                    <div className={styles.monthPanel}>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={styles.iconButton}
                            onClick={() => setMonthKey((current) => shiftMonth(current, -1))}
                        >
                            <FiChevronLeft />
                        </Button>
                        <div className={styles.monthCenter}>
                            <div className={styles.monthCaption}>Период</div>
                            <div className={styles.monthTitle}>{payload?.monthLabel || monthKey}</div>
                        </div>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={styles.iconButton}
                            onClick={() => setMonthKey((current) => shiftMonth(current, 1))}
                        >
                            <FiChevronRight />
                        </Button>
                    </div>

                    <div className={styles.toolbarAside}>
                        <label className={styles.toggleRow}>
                            <Switch
                                checked={includeInactive}
                                onCheckedChange={setIncludeInactive}
                                className={styles.toggleSwitch}
                            />
                            <span>Показывать неактивных</span>
                        </label>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={styles.surfaceButton}
                            onClick={() => void loadBoard(monthKey, includeInactive)}
                            loading={refreshing}
                        >
                            <FiRefreshCw />
                            Обновить
                        </Button>
                    </div>
                </div>
            </div>

            <div className={styles.legend}>
                <span className={`${styles.legendItem} ${styles.cellWork}`}>Работа</span>
                <span className={`${styles.legendItem} ${styles.cellOff}`}>Выходной</span>
                <span className={`${styles.legendItem} ${styles.cellVacation}`}>Отпуск</span>
                <span className={`${styles.legendItem} ${styles.cellSick}`}>Больничный</span>
                <span className={`${styles.legendItem} ${styles.cellTrip}`}>Командировка</span>
                <span className={`${styles.legendItem} ${styles.cellField}`}>Выезд</span>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={styles.tableViewport}>
                <table className={styles.boardTable}>
                    <thead>
                        <tr>
                            <th className={`${styles.employeeHead} ${styles.stickyCol}`}>Сотрудник</th>
                            {(payload?.days || []).map((day) => (
                                <th
                                    key={day.date}
                                    className={`${styles.dayHead} ${day.isWeekend ? styles.dayHeadWeekend : ''} ${day.isToday ? styles.dayHeadToday : ''}`}
                                >
                                    <div className={styles.dayNumber}>{day.dayNumber}</div>
                                    <div className={styles.dayWeekday}>{day.weekdayShort}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {(payload?.employees || []).map((employee) => (
                            <tr key={employee.id}>
                                <td className={`${styles.employeeCell} ${styles.stickyCol}`}>
                                    <Link href={`/managers/${employee.id}`} className={styles.employeeLink}>
                                        {employee.fio}
                                    </Link>
                                    <div className={styles.employeeMeta}>
                                        {employee.position || 'Без должности'}
                                        {!employee.isActive ? ' · неактивен' : ''}
                                    </div>
                                </td>
                                {employee.cells.map((cell, index) => {
                                    const day = payload?.days[index];
                                    return (
                                        <td
                                            key={`${employee.id}-${cell.date}`}
                                            title={getCellTitle(cell)}
                                            className={`${styles.dayCell} ${getCellClassName(cell.status)} ${day?.isWeekend ? styles.dayCellWeekend : ''}`}
                                        >
                                            <div className={styles.cellLabel}>{getCellLabel(cell.status)}</div>
                                            {cell.startTime && cell.endTime ? (
                                                <div className={styles.cellTime}>
                                                    {cell.startTime}-{cell.endTime}
                                                </div>
                                            ) : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default withLayout(AdminScheduleBoardPage);
