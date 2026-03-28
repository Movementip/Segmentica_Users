BEGIN;

-- Rename action permissions: applications.* -> orders.*
UPDATE public.permissions
SET key = regexp_replace(key, '^applications\.', 'orders.')
WHERE key LIKE 'applications.%';

COMMIT;
