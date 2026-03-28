BEGIN;

-- Allow planning work schedules ahead of time.
-- We keep the guard for inactive employees, but remove the
-- old restriction that rejected any future date.
CREATE OR REPLACE FUNCTION public.f_validate_work_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public."Сотрудники"
        WHERE id = NEW."сотрудник_id"
          AND "активен" = true
    ) THEN
        RAISE EXCEPTION 'Нельзя добавить график для неактивного сотрудника';
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
