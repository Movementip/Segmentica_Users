export interface ArchiveRecord {
    id: number;
    тип_записи: string;
    запись_id: number;
    дата_архивации: string;
    причина?: string;
    данные: any;
}
