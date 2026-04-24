DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'symuser') THEN
        CREATE ROLE symuser LOGIN;
    END IF;
END
$$;

DROP SCHEMA IF EXISTS public CASCADE;
