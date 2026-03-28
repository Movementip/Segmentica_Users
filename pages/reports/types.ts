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
