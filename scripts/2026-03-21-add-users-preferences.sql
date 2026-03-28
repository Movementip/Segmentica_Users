ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_preferences_theme
ON public.users (((preferences->>'theme')));
