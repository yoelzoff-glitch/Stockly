-- Atomic, tenant-scoped shipment persistence. Serializes competing order and
-- shipment workers; failures roll back the entire write and preserve old data.
BEGIN;

CREATE OR REPLACE FUNCTION public.persist_meli_shipment(
  p_tenant_id uuid, p_order_id uuid, p_shipment jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing public.shipments%ROWTYPE;
  v_shipment public.shipments%ROWTYPE;
  v_meli_shipment_id text;
BEGIN
  SELECT meli_shipment_id INTO v_meli_shipment_id
  FROM public.orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment order does not belong to tenant';
  END IF;
  IF v_meli_shipment_id IS DISTINCT FROM p_shipment->>'meli_shipment_id' THEN
    RAISE EXCEPTION 'Shipment does not match current order';
  END IF;

  SELECT * INTO v_existing FROM public.shipments
  WHERE tenant_id = p_tenant_id AND order_id = p_order_id
  ORDER BY last_updated DESC NULLS LAST, created_at DESC, id
  LIMIT 1;

  -- Older webhook deliveries must not regress a newer shipment state.
  IF v_existing.meli_shipment_id = v_meli_shipment_id
     AND v_existing.last_updated > (p_shipment->>'last_updated')::timestamptz THEN
    RETURN;
  END IF;
  v_shipment := jsonb_populate_record(v_existing, p_shipment);
  v_shipment.id := COALESCE(v_existing.id, gen_random_uuid());
  v_shipment.tenant_id := p_tenant_id;
  v_shipment.order_id := p_order_id;
  v_shipment.created_at := COALESCE(v_existing.created_at, now());

  INSERT INTO public.shipments SELECT v_shipment.*
  ON CONFLICT (id) DO UPDATE SET
    meli_shipment_id = EXCLUDED.meli_shipment_id,
    status = EXCLUDED.status, substatus = EXCLUDED.substatus,
    logistic_type = EXCLUDED.logistic_type, mode = EXCLUDED.mode,
    tracking_number = EXCLUDED.tracking_number,
    tracking_method = EXCLUDED.tracking_method,
    shipping_cost = EXCLUDED.shipping_cost,
    receiver_city = EXCLUDED.receiver_city, receiver_state = EXCLUDED.receiver_state,
    date_created = EXCLUDED.date_created, last_updated = EXCLUDED.last_updated,
    raw_data = EXCLUDED.raw_data;

  -- Normalize duplicate rows left by the previous delete/insert race, but only
  -- after a successful replacement, inside the same transaction.
  DELETE FROM public.shipments
  WHERE tenant_id = p_tenant_id AND order_id = p_order_id AND id <> v_shipment.id;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_meli_shipment(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_meli_shipment(uuid, uuid, jsonb) TO service_role;

COMMIT;
