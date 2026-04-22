type DbLike = {
    query: (text: string, params?: any[]) => Promise<any>;
};

export const normalizeTransportStatsMonth = (month: string): string | null => {
    const rawMonth = String(month || '').trim();
    const monthMatch = rawMonth.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!monthMatch) return null;
    return `${monthMatch[1]}-${monthMatch[2]}-01`;
};

export const getTransportCompaniesAggregate = async (db: DbLike) => {
    return db.query(
        `
            SELECT
              тк.*,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN 1 END), 0)::integer as общее_количество_отгрузок,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') NOT IN ('доставлено', 'получено', 'отменено') THEN 1 END), 0)::integer as активные_отгрузки,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') IN ('доставлено', 'получено') THEN 1 END), 0)::integer as завершенные_отгрузки,
              COALESCE(AVG(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" END), 0) as средняя_стоимость,
              COALESCE(SUM(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" ELSE 0 END), 0) as общая_выручка
            FROM "Транспортные_компании" тк
            LEFT JOIN "Отгрузки" о ON тк.id = о."транспорт_id"
            GROUP BY тк.id, тк."название", тк."телефон", тк.email, тк."тариф", тк.created_at
            ORDER BY общее_количество_отгрузок DESC, тк."название" ASC
        `
    );
};

export const getTransportCompanyAggregate = async (db: DbLike, companyId: string | number) => {
    return db.query(
        `
            SELECT
              тк.*,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN 1 END), 0)::integer as общее_количество_отгрузок,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') NOT IN ('доставлено', 'получено', 'отменено') THEN 1 END), 0)::integer as активные_отгрузки,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') IN ('доставлено', 'получено') THEN 1 END), 0)::integer as завершенные_отгрузки,
              COALESCE(AVG(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" END), 0) as средняя_стоимость,
              COALESCE(SUM(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" ELSE 0 END), 0) as общая_выручка
            FROM "Транспортные_компании" тк
            LEFT JOIN "Отгрузки" о ON тк.id = о."транспорт_id"
            WHERE тк.id = $1
            GROUP BY тк.id, тк."название", тк."телефон", тк.email, тк."тариф", тк.created_at
            LIMIT 1
        `,
        [companyId]
    );
};

export const getTransportPerformance = async (db: DbLike, companyId: string | number) => {
    return db.query(
        `
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', now()) - interval '11 months',
                date_trunc('month', now()),
                interval '1 month'
              )::date AS месяц
            ),
            agg AS (
              SELECT
                DATE_TRUNC('month', о."дата_отгрузки")::date as месяц,
                COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN 1 END), 0)::integer as количество_отгрузок,
                COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') IN ('доставлено', 'получено') THEN 1 END), 0)::integer as успешные_доставки,
                COALESCE(AVG(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" END), 0) as средняя_стоимость,
                COALESCE(SUM(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" ELSE 0 END), 0) as общая_выручка
              FROM "Отгрузки" о
              WHERE о."транспорт_id" = $1
                AND о."дата_отгрузки" >= (date_trunc('month', now()) - interval '11 months')
                AND о."дата_отгрузки" < (date_trunc('month', now()) + interval '1 month')
              GROUP BY 1
            )
            SELECT
              TO_CHAR(m.месяц, 'YYYY-MM-01') as месяц,
              COALESCE(a.количество_отгрузок, 0)::integer as количество_отгрузок,
              COALESCE(a.успешные_доставки, 0)::integer as успешные_доставки,
              COALESCE(a.средняя_стоимость, 0) as средняя_стоимость,
              COALESCE(a.общая_выручка, 0) as общая_выручка
            FROM months m
            LEFT JOIN agg a ON a.месяц = m.месяц
            ORDER BY m.месяц DESC
        `,
        [companyId]
    );
};

export const getTransportPeriodTotals = async (db: DbLike, companyId: string | number) => {
    return db.query(
        `
            SELECT
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN 1 END), 0)::integer as количество_отгрузок,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') IN ('доставлено', 'получено') THEN 1 END), 0)::integer as успешные_доставки,
              COALESCE(AVG(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" END), 0) as средняя_стоимость,
              COALESCE(SUM(CASE WHEN COALESCE(о."статус", 'в пути') <> 'отменено' THEN о."стоимость_доставки" ELSE 0 END), 0) as общая_выручка
            FROM "Отгрузки" о
            WHERE о."транспорт_id" = $1
              AND о."дата_отгрузки" >= (date_trunc('month', now()) - interval '11 months')
              AND о."дата_отгрузки" < (date_trunc('month', now()) + interval '1 month')
        `,
        [companyId]
    );
};

export const getTransportMonthShipments = async (
    db: DbLike,
    companyId: string | number,
    normalizedMonth: string
) => {
    return db.query(
        `
            SELECT
              s.id,
              s."статус",
              s."номер_отслеживания",
              s."дата_отгрузки",
              s."стоимость_доставки",
              o.id as заявка_номер,
              COALESCE(o."статус", s."статус", 'в пути') as заявка_статус,
              COALESCE(c."название", 'Самостоятельная отгрузка') as клиент_название
            FROM "Отгрузки" s
            LEFT JOIN "Заявки" o ON s."заявка_id" = o.id
            LEFT JOIN "Клиенты" c ON o."клиент_id" = c.id
            WHERE s."транспорт_id" = $1
              AND s."дата_отгрузки" >= $2::date
              AND s."дата_отгрузки" < ($2::date + interval '1 month')
            ORDER BY s."дата_отгрузки" DESC, s.id DESC
        `,
        [companyId, normalizedMonth]
    );
};
