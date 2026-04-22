export interface TransportCompany {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    инн?: string;
    стоимость_доставки?: number;
    срок_доставки?: number;
    created_at?: string;
}
