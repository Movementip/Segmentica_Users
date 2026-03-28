BEGIN;

CREATE TABLE IF NOT EXISTS public.order_assembly_batches
(
    id serial NOT NULL,
    order_id integer NOT NULL,
    branch_no integer NOT NULL,
    batch_type character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'сборка'::character varying,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes text COLLATE pg_catalog."default",
    CONSTRAINT order_assembly_batches_pkey PRIMARY KEY (id),
    CONSTRAINT order_assembly_batches_order_branch_key UNIQUE (order_id, branch_no)
);

CREATE TABLE IF NOT EXISTS public.order_assembly_batch_positions
(
    id serial NOT NULL,
    batch_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT order_assembly_batch_positions_pkey PRIMARY KEY (id),
    CONSTRAINT order_assembly_batch_positions_batch_product_key UNIQUE (batch_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.shipment_positions
(
    id serial NOT NULL,
    shipment_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    price numeric(10, 2) NOT NULL DEFAULT 0,
    vat_id smallint NOT NULL DEFAULT 5,
    CONSTRAINT shipment_positions_pkey PRIMARY KEY (id),
    CONSTRAINT shipment_positions_shipment_product_key UNIQUE (shipment_id, product_id)
);

ALTER TABLE IF EXISTS public."Отгрузки"
    ADD COLUMN IF NOT EXISTS branch_no integer NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS public."Отгрузки"
    ADD COLUMN IF NOT EXISTS shipment_kind character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'основная'::character varying;

ALTER TABLE IF EXISTS public.order_assembly_batches
    ADD CONSTRAINT order_assembly_batches_order_id_fkey FOREIGN KEY (order_id)
    REFERENCES public."Заявки" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_order_assembly_batches_order_id
    ON public.order_assembly_batches(order_id);

ALTER TABLE IF EXISTS public.order_assembly_batch_positions
    ADD CONSTRAINT order_assembly_batch_positions_batch_id_fkey FOREIGN KEY (batch_id)
    REFERENCES public.order_assembly_batches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_order_assembly_batch_positions_batch_id
    ON public.order_assembly_batch_positions(batch_id);

ALTER TABLE IF EXISTS public.order_assembly_batch_positions
    ADD CONSTRAINT order_assembly_batch_positions_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public."Товары" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_order_assembly_batch_positions_product_id
    ON public.order_assembly_batch_positions(product_id);

ALTER TABLE IF EXISTS public.shipment_positions
    ADD CONSTRAINT shipment_positions_shipment_id_fkey FOREIGN KEY (shipment_id)
    REFERENCES public."Отгрузки" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_shipment_positions_shipment_id
    ON public.shipment_positions(shipment_id);

ALTER TABLE IF EXISTS public.shipment_positions
    ADD CONSTRAINT shipment_positions_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public."Товары" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_shipment_positions_product_id
    ON public.shipment_positions(product_id);

ALTER TABLE IF EXISTS public.shipment_positions
    ADD CONSTRAINT shipment_positions_vat_id_fkey FOREIGN KEY (vat_id)
    REFERENCES public."Ставки_НДС" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_shipment_positions_vat_id
    ON public.shipment_positions(vat_id);

WITH ranked_shipments AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "заявка_id"
            ORDER BY COALESCE("дата_отгрузки", CURRENT_TIMESTAMP), id
        ) AS next_branch_no
    FROM public."Отгрузки"
)
UPDATE public."Отгрузки" shipments
SET branch_no = ranked_shipments.next_branch_no,
    shipment_kind = CASE
        WHEN ranked_shipments.next_branch_no = 1 THEN 'основная'
        ELSE 'доотгрузка'
    END
FROM ranked_shipments
WHERE shipments.id = ranked_shipments.id;

INSERT INTO public.order_assembly_batches (order_id, branch_no, batch_type, created_at, notes)
SELECT
    movements."заявка_id" AS order_id,
    1 AS branch_no,
    'сборка' AS batch_type,
    MIN(movements."дата_операции") AS created_at,
    'Автоматически восстановлено из движений склада' AS notes
FROM public."Движения_склада" movements
WHERE movements."заявка_id" IS NOT NULL
  AND movements."тип_операции" = 'расход'
  AND NOT EXISTS (
      SELECT 1
      FROM public.order_assembly_batches batches
      WHERE batches.order_id = movements."заявка_id"
  )
GROUP BY movements."заявка_id";

INSERT INTO public.order_assembly_batch_positions (batch_id, product_id, quantity)
SELECT
    batches.id AS batch_id,
    movements."товар_id" AS product_id,
    SUM(movements."количество")::integer AS quantity
FROM public.order_assembly_batches batches
INNER JOIN public."Движения_склада" movements
    ON movements."заявка_id" = batches.order_id
   AND movements."тип_операции" = 'расход'
WHERE batches.branch_no = 1
  AND NOT EXISTS (
      SELECT 1
      FROM public.order_assembly_batch_positions positions
      WHERE positions.batch_id = batches.id
  )
GROUP BY batches.id, movements."товар_id";

INSERT INTO public.shipment_positions (shipment_id, product_id, quantity, price, vat_id)
SELECT
    shipments.id AS shipment_id,
    order_positions."товар_id" AS product_id,
    order_positions."количество" AS quantity,
    order_positions."цена" AS price,
    order_positions."ндс_id" AS vat_id
FROM public."Отгрузки" shipments
INNER JOIN public."Позиции_заявки" order_positions
    ON order_positions."заявка_id" = shipments."заявка_id"
LEFT JOIN public.shipment_positions existing
    ON existing.shipment_id = shipments.id
   AND existing.product_id = order_positions."товар_id"
WHERE existing.id IS NULL;

COMMIT;
