ALTER TABLE IF EXISTS public.imported_requests
  ADD COLUMN IF NOT EXISTS viewed_at timestamp(6) without time zone;

CREATE INDEX IF NOT EXISTS imported_requests_viewed_at_idx
  ON public.imported_requests USING btree (viewed_at);
