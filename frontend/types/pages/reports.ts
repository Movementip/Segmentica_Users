export type ReportPeriod = "all" | "6m" | "3m" | "1m";

export type ReportsAnalyticsTab = "overview" | "sales" | "products" | "clients" | "logistics" | "custom";

export interface Report {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    viewName: string;
    color: string;
}

export interface ReportData {
    [key: string]: any;
}
