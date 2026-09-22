BEGIN;

ALTER FUNCTION public.persist_meli_shipment(uuid, uuid, jsonb)
  SET search_path = '';

COMMIT;
