import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Flex, Grid, Select, Text, TextField } from '@radix-ui/themes';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import styles from './EmployeeSchedulePanel.module.css';

type ScheduleItem = {
    id: number;
    date: string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    source: string;
    patternId: number | null;
    isOverride: boolean;
    isVirtual?: boolean;
};

type SchedulePayload = {
    employeeId: number;
    month: string;
    visibleDateFrom: string;
    visibleDateTo: string;
    canEdit: boolean;
    canApplyPattern: boolean;
    items: ScheduleItem[];
};

type EmployeeSchedulePanelProps = {
    employeeId: number;
    canEdit?: boolean;
    canApplyPattern?: boolean;
};

type StatusOption = {
    value: string;
    label: string;
    shortLabel: string;
    tone: 'green' | 'blue' | 'orange' | 'gray' | 'red';
};

const OFF_STATUS = '__off__';
const STATUSES_WITH_TIME = new Set(['Работал', 'командировка', 'работа на выезде']);

const STATUS_OPTIONS: StatusOption[] = [
    { value: 'Работал', label: 'Работает в офисе', shortLabel: 'Офис', tone: 'green' },
    { value: OFF_STATUS, label: 'Выходной', shortLabel: 'Выходной', tone: 'gray' },
    { value: 'отпуск', label: 'Отпуск', shortLabel: 'Отпуск', tone: 'blue' },
    { value: 'больничный', label: 'Больничный', shortLabel: 'Больничный', tone: 'red' },
    { value: 'командировка', label: 'Командировка', shortLabel: 'Команд.', tone: 'orange' },
    { value: 'работа на выезде', label: 'Работа на выезде', shortLabel: 'Выезд', tone: 'blue' },
];

const STATUS_MAP = new Map(STATUS_OPTIONS.map((option) => [option.value, option]));
const EDITOR_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value !== 'отпуск');

const createMonthKey = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
};

const createDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
    const [yearRaw, monthRaw, dayRaw] = String(value || '').split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return new Date();
    }
    return new Date(year, month - 1, day);
};

const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
};

const getWeekStart = (value: Date) => {
    const day = (value.getDay() + 6) % 7;
    return addDays(value, -day);
};

const formatMonthTitle = (monthKey: string) => {
    const [yearRaw, monthRaw] = String(monthKey).split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return monthKey;
    }
    return new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
};

const formatPatternRange = (monthKey: string) => {
    const [yearRaw, monthRaw] = String(monthKey).split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return monthKey;
    }

    const start = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', { month: 'long' });
    const end = new Date(year, 11, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return `с ${start} по ${end}`;
};

const formatShortDate = (dateKey: string) =>
    parseDateKey(dateKey).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
    });

const formatFullDate = (dateKey: string) =>
    parseDateKey(dateKey).toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

const formatWeekdayShort = (dateKey: string) =>
    parseDateKey(dateKey).toLocaleDateString('ru-RU', {
        weekday: 'short',
    });

const formatWeekRange = (dateKey: string) => {
    const start = getWeekStart(parseDateKey(dateKey));
    const end = addDays(start, 6);
    const startLabel = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const endLabel = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return `${startLabel} - ${endLabel}`;
};

const formatTimeRange = (item: ScheduleItem | null, compact = false) => {
    if (!item || !item.startTime || !item.endTime) {
        return compact ? 'Без времени' : 'Время не указано';
    }
    return `${item.startTime} - ${item.endTime}`;
};

const getStatusTone = (status: string): StatusOption['tone'] => STATUS_MAP.get(status)?.tone || 'gray';
const getStatusLabel = (status: string) => STATUS_MAP.get(status)?.label || status;
const getStatusShortLabel = (status: string) => STATUS_MAP.get(status)?.shortLabel || getStatusLabel(status);

const createSelectedDateForMonth = (monthKey: string) => {
    const today = new Date();
    if (createMonthKey(today) === monthKey) {
        return createDateKey(today);
    }

    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    return createDateKey(new Date(year, month - 1, 1));
};

export function EmployeeSchedulePanel({ employeeId, canEdit = false, canApplyPattern = false }: EmployeeSchedulePanelProps): JSX.Element {
    const [monthKey, setMonthKey] = useState(() => createMonthKey(new Date()));
    const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
    const [selectedDate, setSelectedDate] = useState(() => createSelectedDateForMonth(createMonthKey(new Date())));
    const [draftStatus, setDraftStatus] = useState(OFF_STATUS);
    const [draftStartTime, setDraftStartTime] = useState('');
    const [draftEndTime, setDraftEndTime] = useState('');
    const [patternType, setPatternType] = useState<'five_two' | 'two_two' | 'one_three' | 'custom'>('five_two');
    const [customWorkDays, setCustomWorkDays] = useState('3');
    const [customOffDays, setCustomOffDays] = useState('1');
    const [patternAnchorDate, setPatternAnchorDate] = useState(() => createDateKey(new Date()));
    const [patternShiftStart, setPatternShiftStart] = useState('09:00');
    const [patternShiftEnd, setPatternShiftEnd] = useState('18:00');
    const [respectProductionCalendar, setRespectProductionCalendar] = useState(true);
    const [shortenPreholiday, setShortenPreholiday] = useState(true);
    const [applyingPattern, setApplyingPattern] = useState(false);
    const [vacationDateFrom, setVacationDateFrom] = useState(() => createDateKey(new Date()));
    const [vacationDateTo, setVacationDateTo] = useState(() => createDateKey(new Date()));
    const [savingVacation, setSavingVacation] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/managers/${employeeId}/schedule?month=${encodeURIComponent(monthKey)}`);
                const payload = (await response.json().catch(() => ({}))) as SchedulePayload | { error?: string };

                if (!response.ok) {
                    throw new Error((payload as { error?: string }).error || 'Не удалось загрузить график');
                }

                if (!active) return;

                const nextSchedule = payload as SchedulePayload;
                setSchedule(nextSchedule);

                setSelectedDate((current) => {
                    if (current && current >= nextSchedule.visibleDateFrom && current <= nextSchedule.visibleDateTo) {
                        return current;
                    }
                    return createSelectedDateForMonth(monthKey);
                });
            } catch (loadError) {
                if (!active) return;
                setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить график');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            active = false;
        };
    }, [employeeId, monthKey]);

    const itemMap = useMemo(() => {
        const entries = new Map<string, ScheduleItem>();
        for (const item of schedule?.items || []) {
            entries.set(item.date, item);
        }
        return entries;
    }, [schedule]);

    const selectedItem = itemMap.get(selectedDate) || null;

    useEffect(() => {
        setDraftStatus(selectedItem?.status || OFF_STATUS);
        setDraftStartTime(selectedItem?.startTime || '');
        setDraftEndTime(selectedItem?.endTime || '');
        setVacationDateFrom(selectedDate);
        setVacationDateTo(selectedDate);
        setMessage(null);
    }, [selectedDate, selectedItem]);

    useEffect(() => {
        if (!STATUSES_WITH_TIME.has(draftStatus)) {
            setDraftStartTime('');
            setDraftEndTime('');
        }
    }, [draftStatus]);

    const calendarDays = useMemo(() => {
        if (!schedule) return [];

        const result: Array<{ dateKey: string; inCurrentMonth: boolean }> = [];
        const current = parseDateKey(schedule.visibleDateFrom);
        const end = schedule.visibleDateTo;

        while (createDateKey(current) <= end) {
            const dateKey = createDateKey(current);
            result.push({
                dateKey,
                inCurrentMonth: dateKey.startsWith(monthKey),
            });
            current.setDate(current.getDate() + 1);
        }

        return result;
    }, [monthKey, schedule]);

    const weekDates = useMemo(() => {
        const start = getWeekStart(parseDateKey(selectedDate));
        return Array.from({ length: 7 }, (_, index) => createDateKey(addDays(start, index)));
    }, [selectedDate]);

    const isReadOnly = !canEdit || !schedule?.canEdit;
    const canApplyPatternResolved = Boolean(canApplyPattern && schedule?.canApplyPattern);

    const handleMonthShift = (offset: number) => {
        const base = parseDateKey(`${monthKey}-01`);
        setMonthKey(createMonthKey(new Date(base.getFullYear(), base.getMonth() + offset, 1)));
    };

    useEffect(() => {
        setPatternAnchorDate((current) => {
            if (current.startsWith(monthKey)) return current;
            return `${monthKey}-01`;
        });
    }, [monthKey]);

    const reloadSchedule = async () => {
        const response = await fetch(`/api/managers/${employeeId}/schedule?month=${encodeURIComponent(monthKey)}`);
        const payload = (await response.json().catch(() => ({}))) as SchedulePayload | { error?: string };
        if (!response.ok) {
            throw new Error((payload as { error?: string }).error || 'Не удалось обновить график');
        }
        setSchedule(payload as SchedulePayload);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            if (draftStatus === OFF_STATUS) {
                const response = await fetch(`/api/managers/${employeeId}/schedule?date=${encodeURIComponent(selectedDate)}`, {
                    method: 'DELETE',
                });

                const payload = (await response.json().catch(() => ({}))) as { error?: string };
                if (!response.ok) {
                    throw new Error(payload.error || 'Не удалось отметить день как выходной');
                }

                await reloadSchedule();
                setMessage(selectedItem ? 'Запись за день удалена' : 'День оставлен без смены');
                return;
            }

            const response = await fetch(`/api/managers/${employeeId}/schedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    status: draftStatus,
                    startTime: STATUSES_WITH_TIME.has(draftStatus) ? (draftStartTime || null) : null,
                    endTime: STATUSES_WITH_TIME.has(draftStatus) ? (draftEndTime || null) : null,
                }),
            });

            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(payload.error || 'Не удалось сохранить смену');
            }

            await reloadSchedule();
            setMessage('Смена сохранена');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить смену');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const response = await fetch(`/api/managers/${employeeId}/schedule?date=${encodeURIComponent(selectedDate)}`, {
                method: 'DELETE',
            });

            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
                throw new Error(payload.error || 'Не удалось удалить запись графика');
            }

            await reloadSchedule();
            setMessage('Запись за день удалена');
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить запись графика');
        } finally {
            setSaving(false);
        }
    };

    const handleApplyPattern = async () => {
        try {
            setApplyingPattern(true);
            setError(null);
            setMessage(null);

            const response = await fetch(`/api/managers/${employeeId}/schedule-pattern`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: monthKey,
                    patternType,
                    anchorDate: patternAnchorDate,
                    shiftStart: patternShiftStart || null,
                    shiftEnd: patternShiftEnd || null,
                    customWorkDays: patternType === 'custom' ? Number(customWorkDays) : null,
                    customOffDays: patternType === 'custom' ? Number(customOffDays) : null,
                    respectProductionCalendar: patternType === 'five_two' ? respectProductionCalendar : false,
                    shortenPreholiday: patternType === 'five_two' ? shortenPreholiday : false,
                }),
            });

            const payload = (await response.json().catch(() => ({}))) as { error?: string; affectedDays?: number };
            if (!response.ok) {
                throw new Error(payload.error || 'Не удалось применить шаблон');
            }

            await reloadSchedule();
            setMessage(`Шаблон применен до конца года, рабочих дней: ${payload.affectedDays || 0}.`);
        } catch (applyError) {
            setError(applyError instanceof Error ? applyError.message : 'Не удалось применить шаблон');
        } finally {
            setApplyingPattern(false);
        }
    };

    const handleApplyVacation = async () => {
        try {
            setSavingVacation(true);
            setError(null);
            setMessage(null);

            const response = await fetch(`/api/managers/${employeeId}/schedule-vacation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateFrom: vacationDateFrom,
                    dateTo: vacationDateTo,
                }),
            });

            const payload = (await response.json().catch(() => ({}))) as { error?: string; affectedDays?: number };
            if (!response.ok) {
                throw new Error(payload.error || 'Не удалось оформить отпуск');
            }

            await reloadSchedule();
            setMessage(`Отпуск отмечен на ${payload.affectedDays || 0} дн.`);
        } catch (vacationError) {
            setError(vacationError instanceof Error ? vacationError.message : 'Не удалось оформить отпуск');
        } finally {
            setSavingVacation(false);
        }
    };

    return (
        <div className={styles.panel}>
            <Grid columns={{ initial: '1', xl: '3' }} gap="4">
                <div className={styles.mainColumn}>
                    {canApplyPatternResolved ? (
                        <Card size="2" variant="surface" className={styles.patternCard}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <Text size="4" weight="bold">Шаблон графика</Text>
                                    <Text as="div" size="2" color="gray">
                                        Применяется с начала выбранного месяца и строит график до конца года.
                                    </Text>
                                </div>
                            </div>

                            <div className={styles.patternBody}>
                                <Grid columns={{ initial: '1', md: '2', xl: '3' }} gap="3" className={styles.patternGrid}>
                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Шаблон</Text>
                                        <Select.Root value={patternType} onValueChange={(value) => setPatternType(value as 'five_two' | 'two_two' | 'one_three' | 'custom')}>
                                            <Select.Trigger className={styles.selectTrigger} />
                                            <Select.Content className={styles.selectContent}>
                                                <Select.Item value="five_two">5/2</Select.Item>
                                                <Select.Item value="two_two">2/2</Select.Item>
                                                <Select.Item value="one_three">1/3</Select.Item>
                                                <Select.Item value="custom">Свой цикл</Select.Item>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Старт цикла</Text>
                                        <TextField.Root type="date" value={patternAnchorDate} onChange={(event) => setPatternAnchorDate(event.target.value)} className={styles.input} />
                                    </div>

                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Период применения</Text>
                                        <TextField.Root value={formatPatternRange(monthKey)} readOnly className={styles.input} />
                                    </div>

                                    {patternType === 'custom' ? (
                                        <>
                                            <div className={styles.field}>
                                                <Text as="label" size="2" weight="medium">Рабочих дней</Text>
                                                <TextField.Root type="number" min="1" max="31" value={customWorkDays} onChange={(event) => setCustomWorkDays(event.target.value)} className={styles.input} />
                                            </div>
                                            <div className={styles.field}>
                                                <Text as="label" size="2" weight="medium">Выходных дней</Text>
                                                <TextField.Root type="number" min="1" max="31" value={customOffDays} onChange={(event) => setCustomOffDays(event.target.value)} className={styles.input} />
                                            </div>
                                        </>
                                    ) : null}

                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Начало дня</Text>
                                        <TextField.Root type="time" value={patternShiftStart} onChange={(event) => setPatternShiftStart(event.target.value)} className={styles.input} />
                                    </div>

                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Окончание дня</Text>
                                        <TextField.Root type="time" value={patternShiftEnd} onChange={(event) => setPatternShiftEnd(event.target.value)} className={styles.input} />
                                    </div>
                                </Grid>

                                <div className={styles.patternFooter}>
                                    <div className={styles.patternFooterInfo}>
                                        {patternType === 'five_two' ? (
                                            <div className={styles.patternOptions}>
                                                <label className={styles.checkboxRowInline}>
                                                    <input
                                                        type="checkbox"
                                                        checked={respectProductionCalendar}
                                                        onChange={(event) => setRespectProductionCalendar(event.target.checked)}
                                                    />
                                                    <span>Учитывать производственный календарь</span>
                                                </label>
                                                <label className={styles.checkboxRowInline}>
                                                    <input
                                                        type="checkbox"
                                                        checked={shortenPreholiday}
                                                        onChange={(event) => setShortenPreholiday(event.target.checked)}
                                                    />
                                                    <span>Сокращать предпраздничные дни на 1 час</span>
                                                </label>
                                            </div>
                                        ) : (
                                            <Text as="div" size="2" color="gray" className={styles.patternHint}>
                                                Для сменных графиков календарь праздников не отменяет смену, цикл идет подряд.
                                            </Text>
                                        )}
                                    </div>

                                    <div className={styles.patternFooterActions}>
                                        <Button type="button" variant="solid" color="gray" highContrast disabled={applyingPattern} loading={applyingPattern} onClick={() => void handleApplyPattern()}>
                                            Применить шаблон
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ) : null}

                    <Card size="2" variant="surface" className={styles.monthCard}>
                        <div className={styles.cardHeader}>
                            <div>
                                <Text size="4" weight="bold">Месяц</Text>
                                <Text as="div" size="2" color="gray">График по дням с быстрым выбором смены</Text>
                            </div>
                            <div className={styles.monthControls}>
                                <div className={styles.periodNav}>
                                    <Button type="button" variant="surface" color="gray" highContrast className={styles.iconButton} onClick={() => handleMonthShift(-1)} aria-label="Предыдущий месяц">
                                        <FiChevronLeft size={16} />
                                    </Button>
                                    <Text size="3" weight="bold" className={styles.monthTitle}>{formatMonthTitle(monthKey)}</Text>
                                    <Button type="button" variant="surface" color="gray" highContrast className={styles.iconButton} onClick={() => handleMonthShift(1)} aria-label="Следующий месяц">
                                        <FiChevronRight size={16} />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.weekdaysRow}>
                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                                <div key={day} className={styles.weekdayCell}>{day}</div>
                            ))}
                        </div>

                        {loading ? (
                            <div className={styles.loadingState}>Загрузка графика…</div>
                        ) : (
                            <div className={styles.monthGrid}>
                                {calendarDays.map((day) => {
                                    const item = itemMap.get(day.dateKey) || null;
                                    const isToday = day.dateKey === createDateKey(new Date());
                                    const isSelected = day.dateKey === selectedDate;

                                    return (
                                        <button
                                            key={day.dateKey}
                                            type="button"
                                            className={[
                                                styles.dayCell,
                                                day.inCurrentMonth ? '' : styles.dayCellMuted,
                                                isToday ? styles.dayCellToday : '',
                                                isSelected ? styles.dayCellSelected : '',
                                                item ? styles.dayCellFilled : '',
                                                item?.status === 'Работал' ? styles.dayCellWorking : '',
                                                item?.status === OFF_STATUS ? styles.dayCellOff : '',
                                                item?.status === 'отпуск' ? styles.dayCellVacation : '',
                                                item?.status === 'больничный' ? styles.dayCellSick : '',
                                            ].filter(Boolean).join(' ')}
                                            onClick={() => setSelectedDate(day.dateKey)}
                                        >
                                            <div className={styles.dayCellTop}>
                                                <span className={styles.dayNumber}>{parseDateKey(day.dateKey).getDate()}</span>
                                                {item ? <span className={`${styles.dot} ${styles[`dot${getStatusTone(item.status)[0].toUpperCase()}${getStatusTone(item.status).slice(1)}`]}`} /> : null}
                                            </div>
                                    <div className={styles.dayCellBottom}>
                                        {item ? (
                                            <>
                                                <span className={styles.dayStatus}>
                                                    {getStatusShortLabel(item.status)}
                                                </span>
                                                <span className={styles.dayTime}>{item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : 'Без времени'}</span>
                                            </>
                                                ) : (
                                                    <span className={styles.dayPlaceholder}>Нет записи</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    <Card size="2" variant="surface">
                        <div className={styles.cardHeader}>
                            <div>
                                <Text size="4" weight="bold">Неделя</Text>
                                <Text as="div" size="2" color="gray">{formatWeekRange(selectedDate)}</Text>
                            </div>
                        </div>

                        <div className={styles.weekGrid}>
                            {weekDates.map((dateKey) => {
                                const item = itemMap.get(dateKey) || null;
                                const isSelected = dateKey === selectedDate;

                                return (
                                    <button
                                        key={dateKey}
                                        type="button"
                                        className={`${styles.weekCard} ${isSelected ? styles.weekCardSelected : ''}`}
                                        onClick={() => setSelectedDate(dateKey)}
                                    >
                                        <Text size="1" color="gray" className={styles.weekdayShort}>{formatWeekdayShort(dateKey)}</Text>
                                        <Text size="3" weight="bold">{parseDateKey(dateKey).getDate()}</Text>
                                        {item ? (
                                            <>
                                                <Badge variant="soft" color={getStatusTone(item.status)} highContrast className={styles.statusBadge}>
                                                    {getStatusShortLabel(item.status)}
                                                </Badge>
                                                <Text size="1" color="gray" className={styles.weekTime}>{formatTimeRange(item, true)}</Text>
                                            </>
                                        ) : (
                                            <Text size="1" color="gray">Свободно</Text>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                <div className={styles.sideColumn}>
                    <Card size="2" variant="surface">
                        <div className={styles.cardHeader}>
                            <div>
                                <Text size="4" weight="bold">{isReadOnly ? 'Смена на день' : 'Редактирование дня'}</Text>
                                <Text as="div" size="2" color="gray">{formatFullDate(selectedDate)}</Text>
                            </div>
                            <div className={styles.headerIcon}>
                                <FiCalendar size={18} />
                            </div>
                        </div>

                        {error ? <Text size="2" className={styles.errorText}>{error}</Text> : null}
                        {message ? <Text size="2" className={styles.successText}>{message}</Text> : null}

                        {isReadOnly ? (
                            <div className={styles.detailsStack}>
                                <div className={styles.detailRow}>
                                    <Text size="2" color="gray">Статус</Text>
                                    {selectedItem ? (
                                        <Badge variant="soft" color={getStatusTone(selectedItem.status)} highContrast className={styles.statusBadge}>
                                            {getStatusLabel(selectedItem.status)}
                                        </Badge>
                                    ) : (
                                        <Text size="2">Выходной или нет смены</Text>
                                    )}
                                </div>
                                <div className={styles.detailRow}>
                                    <Text size="2" color="gray">Источник</Text>
                                    <Text size="2" weight="medium">
                                        {!selectedItem
                                            ? 'Нет данных'
                                            : selectedItem.isOverride
                                                ? 'Ручная корректировка шаблона'
                                                : selectedItem.source === 'pattern'
                                                    ? 'Шаблон'
                                                    : selectedItem.source === 'vacation'
                                                        ? 'Отпуск'
                                                    : selectedItem.source === 'calendar'
                                                        ? 'Производственный календарь'
                                                    : 'Вручную'}
                                    </Text>
                                </div>
                                <div className={styles.detailRow}>
                                    <Text size="2" color="gray">Время</Text>
                                    <Text size="2" weight="medium">{formatTimeRange(selectedItem)}</Text>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.editorStack}>
                                <div className={styles.field}>
                                    <Text as="label" size="2" weight="medium">Статус</Text>
                                        <Select.Root value={draftStatus} onValueChange={setDraftStatus}>
                                            <Select.Trigger className={styles.selectTrigger} />
                                            <Select.Content className={styles.selectContent}>
                                            {EDITOR_STATUS_OPTIONS.map((option) => (
                                                <Select.Item key={option.value} value={option.value}>
                                                    {option.label}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                </div>

                                <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Начало</Text>
                                        <TextField.Root
                                            type="time"
                                            value={draftStartTime}
                                            onChange={(event) => setDraftStartTime(event.target.value)}
                                            className={styles.input}
                                            disabled={!STATUSES_WITH_TIME.has(draftStatus)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <Text as="label" size="2" weight="medium">Окончание</Text>
                                        <TextField.Root
                                            type="time"
                                            value={draftEndTime}
                                            onChange={(event) => setDraftEndTime(event.target.value)}
                                            className={styles.input}
                                            disabled={!STATUSES_WITH_TIME.has(draftStatus)}
                                        />
                                    </div>
                                </Grid>

                                <Flex gap="3" wrap="wrap" className={styles.editorActions}>
                                    <Button type="button" variant="solid" color="gray" highContrast disabled={saving} loading={saving} onClick={() => void handleSave()}>
                                        Сохранить
                                    </Button>
                                    {selectedItem && !selectedItem.isVirtual ? (
                                        <Button type="button" variant="surface" color="gray" highContrast className={styles.deleteButton} disabled={saving} onClick={() => void handleDelete()}>
                                            <FiTrash2 size={15} />
                                            Удалить запись
                                        </Button>
                                    ) : null}
                                </Flex>
                            </div>
                        )}
                    </Card>

                    <Card size="2" variant="surface">
                        <div className={styles.cardHeader}>
                            <div>
                                <Text size="4" weight="bold">Отпуск сотрудника</Text>
                                <Text as="div" size="2" color="gray">Отметь диапазон, и календарь заполнится автоматически.</Text>
                            </div>
                        </div>

                        <div className={styles.editorStack}>
                            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                                <div className={styles.field}>
                                    <Text as="label" size="2" weight="medium">Дата начала</Text>
                                    <TextField.Root
                                        type="date"
                                        value={vacationDateFrom}
                                        onChange={(event) => setVacationDateFrom(event.target.value)}
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <Text as="label" size="2" weight="medium">Дата окончания</Text>
                                    <TextField.Root
                                        type="date"
                                        value={vacationDateTo}
                                        onChange={(event) => setVacationDateTo(event.target.value)}
                                        className={styles.input}
                                    />
                                </div>
                            </Grid>

                            <Flex justify="start">
                                <Button
                                    type="button"
                                    variant="solid"
                                    color="gray"
                                    highContrast
                                    disabled={savingVacation}
                                    loading={savingVacation}
                                    onClick={() => void handleApplyVacation()}
                                >
                                    Оформить отпуск
                                </Button>
                            </Flex>
                        </div>
                    </Card>
                </div>
            </Grid>
        </div>
    );
}
