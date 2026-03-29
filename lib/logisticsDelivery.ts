import { queryNoAudit, withTransaction } from './db';

let ensureLogisticsDeliverySchemaPromise: Promise<void> | null = null;

const runEnsureLogisticsDeliverySchema = async (): Promise<void> => {
    await withTransaction(async () => {
        await queryNoAudit(`
            ALTER TABLE IF EXISTS public."Закупки"
                ADD COLUMN IF NOT EXISTS "использовать_доставку" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "транспорт_id" integer,
                ADD COLUMN IF NOT EXISTS "стоимость_доставки" numeric(10, 2)
        `);

        await queryNoAudit(`
            ALTER TABLE IF EXISTS public."Отгрузки"
                ADD COLUMN IF NOT EXISTS "использовать_доставку" boolean NOT NULL DEFAULT true
        `);

        await queryNoAudit(`
            ALTER TABLE IF EXISTS public."Отгрузки"
                ADD COLUMN IF NOT EXISTS "без_учета_склада" boolean NOT NULL DEFAULT false
        `);

        await queryNoAudit(`
            ALTER TABLE IF EXISTS public."Отгрузки"
                ALTER COLUMN "заявка_id" DROP NOT NULL
        `);

        await queryNoAudit(`
            ALTER TABLE IF EXISTS public."Отгрузки"
                ALTER COLUMN "транспорт_id" DROP NOT NULL
        `);

        await queryNoAudit(`
            ALTER TABLE IF EXISTS public."Движения_склада"
                ADD COLUMN IF NOT EXISTS "отгрузка_id" integer
        `);

        await queryNoAudit(`
            DROP TRIGGER IF EXISTS trg_calculate_delivery_cost
            ON public."Отгрузки"
        `);

        await queryNoAudit(`
            DROP FUNCTION IF EXISTS public.f_calculate_delivery_cost()
        `);

        await queryNoAudit(`
            DROP TRIGGER IF EXISTS trg_create_finance_on_shipment
            ON public."Отгрузки"
        `);

        await queryNoAudit(`
            DROP FUNCTION IF EXISTS public.f_create_finance_on_shipment()
        `);

        await queryNoAudit(`
            DROP TRIGGER IF EXISTS trg_create_stock_movement_on_purchase_receipt
            ON public."Закупки"
        `);

        await queryNoAudit(`
            DROP TRIGGER IF EXISTS trg_create_stock_movement_on_shipment
            ON public."Отгрузки"
        `);

        await queryNoAudit(`
            DELETE FROM public."Движения_склада"
            WHERE COALESCE("комментарий", '') LIKE 'Отгрузка по заявке %'
              AND "заявка_id" IS NOT NULL
              AND "закупка_id" IS NULL
              AND "отгрузка_id" IS NULL
        `);

        await queryNoAudit(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'Движения_склада_отгрузка_id_fkey'
                ) THEN
                    ALTER TABLE public."Движения_склада"
                        ADD CONSTRAINT "Движения_склада_отгрузка_id_fkey"
                        FOREIGN KEY ("отгрузка_id")
                        REFERENCES public."Отгрузки" (id)
                        ON UPDATE NO ACTION
                        ON DELETE SET NULL;
                END IF;
            END $$;
        `);

        await queryNoAudit(`
            CREATE INDEX IF NOT EXISTS "idx_закупки_транспорт_id"
            ON public."Закупки"("транспорт_id")
        `);

        await queryNoAudit(`
            CREATE INDEX IF NOT EXISTS "idx_отгрузки_использовать_доставку"
            ON public."Отгрузки"("использовать_доставку")
        `);

        await queryNoAudit(`
            CREATE INDEX IF NOT EXISTS "idx_движения_отгрузка_id"
            ON public."Движения_склада"("отгрузка_id")
        `);
    });
};

export const ensureLogisticsDeliverySchema = async (): Promise<void> => {
    if (!ensureLogisticsDeliverySchemaPromise) {
        ensureLogisticsDeliverySchemaPromise = runEnsureLogisticsDeliverySchema().catch((error) => {
            ensureLogisticsDeliverySchemaPromise = null;
            throw error;
        });
    }

    await ensureLogisticsDeliverySchemaPromise;
};

export const toBoolean = (value: unknown, fallback = false): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
    }
    return fallback;
};

export const normalizeDeliveryCost = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return numeric;
};
