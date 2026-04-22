export type BoardDay = {
  date: string;
  dayNumber: number;
  weekdayShort: string;
  isWeekend: boolean;
  isToday: boolean;
};

export type BoardCell = {
  date: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  source: string;
  isOverride: boolean;
  isVirtual: boolean;
};

export type BoardEmployee = {
  id: number;
  fio: string;
  position: string;
  isActive: boolean;
  cells: BoardCell[];
};

export type BoardPayload = {
  month: string;
  monthLabel: string;
  visibleDateFrom: string;
  visibleDateTo: string;
  days: BoardDay[];
  employees: BoardEmployee[];
};

export type ScheduleLegendTone = "work" | "off" | "vacation" | "sick" | "trip" | "field";

export const SCHEDULE_LEGEND_ITEMS: Array<{ label: string; tone: ScheduleLegendTone }> = [
  { label: "Работа", tone: "work" },
  { label: "Выходной", tone: "off" },
  { label: "Отпуск", tone: "vacation" },
  { label: "Больничный", tone: "sick" },
  { label: "Командировка", tone: "trip" },
  { label: "Выезд", tone: "field" },
];

export const createMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
};

export const shiftMonth = (monthKey: string, delta: number): string => {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return createMonthKey(new Date());
  }
  return createMonthKey(new Date(year, month - 1 + delta, 1));
};

export const getCellLabel = (status: string): string => {
  switch (status) {
    case "Работал":
      return "Раб.";
    case "__off__":
      return "Вых.";
    case "отпуск":
      return "Отп.";
    case "больничный":
      return "Бол.";
    case "командировка":
      return "Ком.";
    case "работа на выезде":
      return "Выезд";
    case "__empty__":
      return "";
    default:
      return status;
  }
};

export const getCellTitle = (cell: BoardCell): string => {
  const statusLabel = (() => {
    switch (cell.status) {
      case "Работал":
        return "Работает";
      case "__off__":
        return "Выходной";
      case "отпуск":
        return "Отпуск";
      case "больничный":
        return "Больничный";
      case "командировка":
        return "Командировка";
      case "работа на выезде":
        return "Работа на выезде";
      case "__empty__":
        return "Нет данных";
      default:
        return cell.status;
    }
  })();

  const timeRange = cell.startTime && cell.endTime ? ` ${cell.startTime}-${cell.endTime}` : "";
  return `${statusLabel}${timeRange}`.trim();
};

export const getCellTone = (status: string): ScheduleLegendTone | "empty" => {
  switch (status) {
    case "Работал":
      return "work";
    case "__off__":
      return "off";
    case "отпуск":
      return "vacation";
    case "больничный":
      return "sick";
    case "командировка":
      return "trip";
    case "работа на выезде":
      return "field";
    default:
      return "empty";
  }
};

export const formatBoardRange = (from: string, to: string): string => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return `${from} - ${to}`;
  }

  return `${fromDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  })} - ${toDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
};
