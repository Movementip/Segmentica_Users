BEGIN;

DO $$
DECLARE
    trigger_row record;
BEGIN
    FOR trigger_row IN
        SELECT
            ns.nspname AS schema_name,
            cls.relname AS table_name,
            trg.tgname AS trigger_name,
            proc.oid AS function_oid
        FROM pg_trigger trg
        JOIN pg_class cls
            ON cls.oid = trg.tgrelid
        JOIN pg_namespace ns
            ON ns.oid = cls.relnamespace
        JOIN pg_proc proc
            ON proc.oid = trg.tgfoid
        WHERE NOT trg.tgisinternal
          AND ns.nspname = 'public'
          AND cls.relname = 'Недостающие_товары'
          AND pg_get_functiondef(proc.oid) ILIKE '%INSERT INTO "Закупки"%'
          AND pg_get_functiondef(proc.oid) ILIKE '%Позиции_закупки%'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I.%I',
            trigger_row.trigger_name,
            trigger_row.schema_name,
            trigger_row.table_name
        );
    END LOOP;
END
$$;

COMMIT;
