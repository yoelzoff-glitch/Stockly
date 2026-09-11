import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrders } from "./getOrders";
import { decrementInternalStockFromOrder } from "../inventory/decrementInternalStockFromOrder";
import { syncShipments } from "./syncShipments";
import { normalizeSku } from "../products/sku/normalizeSku";
import { acquireLock, releaseLock, isLocked } from "@/lib/locks";
import { logEgressSample } from "@/lib/observability/egress";

export async function syncOrders(tenantId: string, specificMeliOrderId?: string, dateFrom?: string) {
  const lockKey = `sync-orders:${tenantId}:${specificMeliOrderId || "all"}`;
  const acquired = await acquireLock(lockKey, 15000);
  if (!acquired) {
    console.log(`[syncOrders] Could not acquire lock for key ${lockKey}. Skipping to prevent concurrent sync.`);
    return 0;
  }

  const supabase = createAdminClient();

  // 1. Get the Meli account for this tenant
  const { data: meliAccount, error: accountError } = await supabase
    .from("meli_accounts")
    .select("id, access_token, meli_user_id")
    .eq("tenant_id", tenantId)
    .single();

  if (accountError || !meliAccount) {
    releaseLock(lockKey);
    throw new Error("Mercado Libre account not connected for this tenant.");
  }

  const { meli_user_id, id: meli_account_id } = meliAccount;

  // 1.5 Get tenant metadata for operational costs
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .single();
  
  const tenantMetadata = (tenantData?.metadata as any) || {};
  const isFullSync = !specificMeliOrderId;
  const now = Date.now();

  if (specificMeliOrderId) {
    // Si es una orden específica, esperamos a que termine cualquier sincronización completa activa en memoria
    const fullSyncKey = `sync-orders:${tenantId}:all`;
    const start = Date.now();
    while (isLocked(fullSyncKey)) {
      if (Date.now() - start > 15000) {
        break; // Timeout, procedemos de todos modos
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (isFullSync) {
    if (tenantMetadata.orders_sync_lock && now - tenantMetadata.orders_sync_lock < 60000) {
      console.log(`[syncOrders] Tenant ${tenantId} is already running a full sync. Skipping to prevent duplicates.`);
      releaseLock(lockKey);
      return 0;
    }

    // Establecer bloqueo en base de datos solo para sincronizaciones completas
    const updatedMetadata = { ...tenantMetadata, orders_sync_lock: now };
    await supabase
      .from("tenants")
      .update({ metadata: updatedMetadata })
      .eq("id", tenantId);
  }

  try {
    const packagingCost = tenantMetadata.packaging_cost || 0;
    const flexZones = tenantMetadata.flex_zones || [];

    // 2. Fetch orders from Meli API
    let rawOrders: any[] = [];
  if (specificMeliOrderId) {
    const { meliFetch } = await import("./client");
    try {
      const orderData = await meliFetch({
        tenantId,
        endpoint: `/orders/${specificMeliOrderId}`,
        method: "GET"
      });
      if (orderData) {
        rawOrders = [orderData];
      }
    } catch (err: any) {
      console.error(`Failed to fetch specific order ${specificMeliOrderId}:`, err.message);
      return 0;
    }
  } else {
    // Incremental sync: custom dateFrom or last 7 days only
    let startIso: string;
    if (dateFrom) {
      startIso = dateFrom;
    } else {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      startIso = sevenDaysAgo.toISOString();
    }
    rawOrders = await getOrders(tenantId, meli_user_id, startIso);
  }

  if (rawOrders.length === 0) {
    return 0; // No orders to sync
  }

  // 3. Get all existing products for this tenant to map order_items properly
  const { data: localProducts, error: productsError } = await supabase
    .from("products")
    .select("id, meli_item_id, sku, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId);

  logEgressSample({
    tenantId,
    operation: "syncOrders.localProducts",
    table: "products",
    data: localProducts,
  });

  // Map of meli_item_id -> local product info
  const productMap: Record<string, any> = {};
  // Map of normalized SKU -> local product info
  const productSkuMap: Record<string, any> = {};

  if (!productsError && localProducts) {
    localProducts.forEach(p => {
      if (p.meli_item_id) {
        productMap[p.meli_item_id] = p;
      }
      if (p.sku) {
        const normSku = normalizeSku(p.sku);
        if (normSku) {
          productSkuMap[normSku] = p;
        }
      }
    });
  }

  // 2.5 Fetch shipment details using multiget to resolve flex zones
  const shipmentIds = rawOrders
    .map((o: any) => o.shipping?.id)
    .filter((id: any) => id); // get all non-null shipment ids

  const shipmentsMap: Record<string, any> = {};
  if (shipmentIds.length > 0) {
    const { meliFetch } = await import("./client");
    // ML allows up to 50 ids per multiget request
    for (let i = 0; i < shipmentIds.length; i += 50) {
      const chunk = shipmentIds.slice(i, i + 50);
      const endpoint = `/shipments?ids=${chunk.join(",")}`;
      try {
        const shipmentsData = await meliFetch({
          tenantId,
          endpoint,
          method: "GET"
        });
        
        if (Array.isArray(shipmentsData)) {
          for (const s of shipmentsData) {
            if (s.code === 200 && s.body) {
              shipmentsMap[s.body.id.toString()] = s.body;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch shipments for flex zones:", err);
      }
    }
  }

  // 4. Check existing orders for new sales / cancelled transitions and cost snapshots
  const syncTimestamp = new Date().toISOString();
  const meliOrderIds = rawOrders.map((o: any) => o.id?.toString()).filter(Boolean);
  const { data: existingOrders } = await supabase
    .from("orders")
    .select("id, meli_order_id, status, packaging_cost_snapshot, flex_cost_snapshot, operational_cost_snapshot_version, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_status")
    .eq("tenant_id", tenantId)
    .in("meli_order_id", meliOrderIds);

  logEgressSample({
    tenantId,
    operation: "syncOrders.existingOrders",
    table: "orders",
    data: existingOrders,
  });

  const existingMap = new Map<string, any>();
  existingOrders?.forEach(o => {
    existingMap.set(o.meli_order_id, o);
  });

  // 4.5 Map Orders to DB Schema with Immutable Cost Snapshotting
  const ordersToUpsert = rawOrders.map((order: any) => {
      const shipmentId = order.shipping?.id?.toString();
      const shipmentData = shipmentId ? shipmentsMap[shipmentId] : null;
      let orderFlexCost = 0;

      if (shipmentData && shipmentData.logistic_type === 'self_service') {
        const mlCost = shipmentData.base_cost || shipmentData.shipping_option?.list_cost || 0;
        let matchedZone = null;
        let minDiff = Infinity;

        for (const z of flexZones) {
          const configuredPays = Number(z.ml_pays) || 0;
          const candidates = [configuredPays];
          if (configuredPays < 1000) {
            candidates.push(configuredPays * 10);
          }
          for (const candidate of candidates) {
            const diff = Math.abs(candidate - mlCost);
            if (diff < minDiff) {
              minDiff = diff;
              matchedZone = z;
            }
          }
        }

        if (matchedZone) {
          let motoCost = Number(matchedZone.moto_costs) || 0;
          if (motoCost > 0 && motoCost < 1000) {
            motoCost = motoCost * 10;
          }
          orderFlexCost = motoCost;
        } else {
          orderFlexCost = flexZones.length > 0 ? (Number(flexZones[0].moto_costs) || 0) : 0;
          if (orderFlexCost > 0 && orderFlexCost < 1000) {
            orderFlexCost = orderFlexCost * 10;
          }
        }
      }

      const existing = existingMap.get(order.id.toString());
      const isPaid = order.status === 'paid';

      // FIRST WRITE WINS: If existing order already has frozen snapshot, PRESERVE IT!
      let packagingSnapshot = existing?.packaging_cost_snapshot ?? null;
      let flexSnapshot = existing?.flex_cost_snapshot ?? null;
      let snapshotFrozenAt = existing?.cost_snapshot_frozen_at ?? null;
      let snapshotSource = existing?.cost_snapshot_source ?? null;
      let snapshotVersion = existing?.operational_cost_snapshot_version ?? "v1";
      let snapshotStatus = existing?.cost_snapshot_status ?? null;

      if (!snapshotFrozenAt && isPaid) {
        // Freeze operational cost snapshots upon observing valid paid sale
        packagingSnapshot = packagingCost;
        flexSnapshot = orderFlexCost;
        snapshotFrozenAt = syncTimestamp;
        snapshotSource = "captured_at_sale";
        snapshotVersion = "v1";
        snapshotStatus = "complete";
      }

      // Preserve historical operational costs in raw_data if already frozen
      const effectivePackagingForRaw = snapshotFrozenAt && packagingSnapshot !== null ? Number(packagingSnapshot) : packagingCost;
      const effectiveFlexForRaw = snapshotFrozenAt && flexSnapshot !== null ? Number(flexSnapshot) : orderFlexCost;

      // Inject calculated costs into raw_data for backwards compatibility
      const operationalCosts = {
        packaging_cost: effectivePackagingForRaw,
        flex_cost: effectiveFlexForRaw,
        total_operational_cost: effectivePackagingForRaw + effectiveFlexForRaw
      };
      const enrichedRawData = {
        ...order,
        shipping: shipmentData ? {
          ...order.shipping,
          logistic_type: shipmentData.logistic_type,
          status: shipmentData.status,
          substatus: shipmentData.substatus,
        } : order.shipping,
        libretax_operational_costs: operationalCosts,
        klyvo_operational_costs: operationalCosts,
      };

      return {
        tenant_id: tenantId,
        meli_account_id: meli_account_id,
        meli_order_id: order.id.toString(),
        status: order.status,
        buyer_nickname: order.buyer?.nickname,
        buyer_id: order.buyer?.id?.toString(),
        total_amount: order.total_amount,
        paid_amount: order.paid_amount,
        currency_id: order.currency_id,
        date_created: order.date_created,
        date_closed: order.date_closed,
        raw_data: enrichedRawData,
        meli_shipment_id: order.shipping?.id?.toString(),
        last_seen_at: syncTimestamp,
        updated_at: syncTimestamp,
        packaging_cost_snapshot: packagingSnapshot,
        flex_cost_snapshot: flexSnapshot,
        operational_cost_snapshot_version: snapshotVersion,
        cost_snapshot_frozen_at: snapshotFrozenAt,
        cost_snapshot_source: snapshotSource,
        cost_snapshot_status: snapshotStatus
      };
    });

    // 5. Upsert Orders
    const { data: upsertedOrders, error: upsertError } = await supabase
      .from("orders")
      .upsert(ordersToUpsert, {
        onConflict: "tenant_id, meli_order_id",
      })
      .select("id, meli_order_id");

    if (upsertError) {
      console.error("Error upserting orders to DB:", upsertError);
      throw new Error("Failed to save synced orders to database.");
    }

    // Map of meli_order_id -> local order UUID
    const orderMap: Record<string, string> = {};
    if (upsertedOrders) {
      upsertedOrders.forEach(o => {
        orderMap[o.meli_order_id] = o.id;
      });
    }

    // Log ORDER_COST_SNAPSHOT_CREATED for newly frozen orders
    const newlyFrozenOrders = ordersToUpsert.filter(
      o => !existingMap.get(o.meli_order_id)?.cost_snapshot_frozen_at && o.cost_snapshot_frozen_at
    );
    for (const fo of newlyFrozenOrders) {
      const localId = orderMap[fo.meli_order_id];
      const itemsCount = rawOrders.find((ro: any) => ro.id.toString() === fo.meli_order_id)?.order_items?.length || 1;
      console.log(JSON.stringify({
        event: "ORDER_COST_SNAPSHOT_CREATED",
        tenantId,
        orderId: localId,
        meliOrderId: fo.meli_order_id,
        itemsCount,
        snapshotVersion: fo.operational_cost_snapshot_version,
        source: fo.cost_snapshot_source,
        timestamp: fo.cost_snapshot_frozen_at
      }));
    }

    // 6. Map Order Items with deterministic line_key and cost snapshots
    const localOrderIds = Array.from(new Set(Object.values(orderMap)));
    const { data: existingOrderItems } = localOrderIds.length > 0
      ? await supabase
          .from("order_items")
          .select("id, order_id, line_key, meli_item_id, sku, unit_cost_snapshot, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_version, estimated_fee_snapshot, estimated_shipping_cost_snapshot, extra_fee_amount_snapshot, promotion_discount_amount_snapshot, estimated_tax_snapshot")
          .eq("tenant_id", tenantId)
          .in("order_id", localOrderIds)
      : { data: [] };

    logEgressSample({
      tenantId,
      operation: "syncOrders.existingOrderItems",
      table: "order_items",
      data: existingOrderItems,
    });

    const existingItemsMap = new Map<string, any>();
    (existingOrderItems || []).forEach(item => {
      if (item.line_key) {
        existingItemsMap.set(`${item.order_id}_${item.line_key}`, item);
      }
      // Also index by order_id + meli_item_id + normalized sku to match historical items
      const normSku = item.sku ? normalizeSku(item.sku) : "";
      if (item.order_id && item.meli_item_id) {
        existingItemsMap.set(`${item.order_id}_${item.meli_item_id}_${normSku}`, item);
        if (!normSku) {
          existingItemsMap.set(`${item.order_id}_${item.meli_item_id}`, item);
        }
      }
    });

    const orderItemsToUpsert: any[] = [];

    rawOrders.forEach((order: any) => {
      const localOrderId = orderMap[order.id.toString()];
      if (!localOrderId || !order.order_items) return;

      order.order_items.forEach((item: any, itemIndex: number) => {
        const meliItemId = item.item?.id;
        const itemSku = item.item?.seller_sku;
        const normItemSku = itemSku ? normalizeSku(itemSku) : "";
        const variationId = item.item?.variation_id ? String(item.item.variation_id) : "0";

        // Deterministic line_key (Req 4)
        const deterministicLineKey = `${meliItemId || 'item'}_${variationId}_${normItemSku || 'nosku'}_${itemIndex}`;
        const existingItem = existingItemsMap.get(`${localOrderId}_${deterministicLineKey}`)
          || existingItemsMap.get(`${localOrderId}_${meliItemId}_${normItemSku}`)
          || existingItemsMap.get(`${localOrderId}_${meliItemId}`);

        // If existingItem already exists with an older line_key format, preserve it so ON CONFLICT matches the existing DB row
        const lineKey = existingItem?.line_key || deterministicLineKey;
        const isOrderPaid = order.status === 'paid';

        let productInfo = meliItemId ? productMap[meliItemId] : undefined;
        if (!productInfo && normItemSku) {
          productInfo = productSkuMap[normItemSku];
        }

        const localProductId = productInfo?.id;
        const currentUnitCost = productInfo?.cost ?? null;

        // FIRST WRITE WINS: If existing item already has frozen snapshot, PRESERVE IT!
        let unitCostSnapshot = existingItem?.unit_cost_snapshot ?? null;
        let costFrozenAt = existingItem?.cost_snapshot_frozen_at ?? null;
        let costSource = existingItem?.cost_snapshot_source ?? null;
        let costVersion = existingItem?.cost_snapshot_version ?? "v1";

        let estFeeSnapshot = existingItem?.estimated_fee_snapshot ?? null;
        let estShipSnapshot = existingItem?.estimated_shipping_cost_snapshot ?? null;
        let extraFeeSnapshot = existingItem?.extra_fee_amount_snapshot ?? null;
        let promoDiscountSnapshot = existingItem?.promotion_discount_amount_snapshot ?? null;
        let estTaxSnapshot = existingItem?.estimated_tax_snapshot ?? null;

        if (!costFrozenAt && isOrderPaid) {
          // Freeze at sale time
          unitCostSnapshot = currentUnitCost;
          costFrozenAt = syncTimestamp;
          costSource = currentUnitCost !== null && currentUnitCost > 0 ? "captured_at_sale" : "legacy_missing";
          costVersion = "v1";
          estFeeSnapshot = Number(item.sale_fee) || Number(productInfo?.estimated_fee) || null;
          estShipSnapshot = Number(productInfo?.estimated_shipping_cost) || null;
          extraFeeSnapshot = Number(productInfo?.extra_fee_amount) || null;
          promoDiscountSnapshot = Number(productInfo?.promotion_discount_amount) || null;
          estTaxSnapshot = null;
        }

        const itemToUpsert: any = {
          id: existingItem?.id || randomUUID(),
          tenant_id: tenantId,
          order_id: localOrderId,
          product_id: localProductId,
          meli_item_id: meliItemId,
          title: item.item?.title,
          sku: item.item?.seller_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          estimated_fee: item.sale_fee,
          unit_cost: unitCostSnapshot ?? currentUnitCost,
          line_key: lineKey,
          unit_cost_snapshot: unitCostSnapshot,
          cost_snapshot_frozen_at: costFrozenAt,
          cost_snapshot_source: costSource,
          cost_snapshot_version: costVersion,
          estimated_fee_snapshot: estFeeSnapshot,
          estimated_shipping_cost_snapshot: estShipSnapshot,
          extra_fee_amount_snapshot: extraFeeSnapshot,
          promotion_discount_amount_snapshot: promoDiscountSnapshot,
          estimated_tax_snapshot: estTaxSnapshot,
        };

        orderItemsToUpsert.push(itemToUpsert);
      });
    });

    if (orderItemsToUpsert.length > 0) {
      // SPRINT 31: Selective idempotent UPSERT instead of DELETE + INSERT
      for (let i = 0; i < orderItemsToUpsert.length; i += 100) {
        const chunk = orderItemsToUpsert.slice(i, i + 100);
        const { error: itemsError } = await supabase
          .from("order_items")
          .upsert(chunk, {
            onConflict: "tenant_id, order_id, line_key",
          });

        if (itemsError) {
          console.error("Error upserting order items batch, retrying individually:", itemsError);
          for (const singleItem of chunk) {
            const { error: singleError } = await supabase
              .from("order_items")
              .upsert(singleItem, {
                onConflict: "tenant_id, order_id, line_key",
              });
            if (singleError) {
              console.error(`Error upserting single order item for order ${singleItem.order_id} (line_key: ${singleItem.line_key}):`, singleError.message);
            }
          }
        }
      }

      // --- SPRINT 35: Descuento automático de stock interno ---
      const paidOrders = ordersToUpsert.filter(o => o.status === 'paid');
      for (const order of paidOrders) {
        const localOrderId = orderMap[order.meli_order_id];
        if (localOrderId) {
          await decrementInternalStockFromOrder(tenantId, localOrderId).catch(err => {
            console.error(`Error decrementando stock interno para orden ${localOrderId}:`, err);
          });
        }
      }
    }

  // --- SPRINT 12: Notificaciones operativas de ventas y cancelaciones ---
  try {
    const { publishImmutableEvent } = await import("@/services/notifications/notificationService");
    for (const rawOrder of rawOrders) {
      const meliId = rawOrder.id?.toString();
      const localId = orderMap[meliId];
      if (!localId) continue;

      const existing = existingMap.get(meliId);

      if (rawOrder.status !== "cancelled") {
        // Sprint 32: Do not publish sale_created if order already existed in database (resync/webhook retry/cron)
        if (existing) {
          continue;
        }

        const firstItem = rawOrder.order_items?.[0];
        const prodTitle = firstItem?.item?.title || "Producto";
        const prodQty = firstItem?.quantity || 1;
        const unitText = prodQty === 1 ? "1 unidad" : `${prodQty} unidades`;
        const otherCount = (rawOrder.order_items?.length || 1) - 1;
        const desc = otherCount > 0 ? `${prodTitle} · ${unitText} (+${otherCount} más)` : `${prodTitle} · ${unitText}`;
        const formattedAmount = `$${Math.round(Number(rawOrder.total_amount) || 0).toLocaleString("es-AR")}`;

        // Idempotent publication: resilient against worker crashes between DB order persist & notification
        await publishImmutableEvent({
          tenantId,
          type: "sale_created",
          title: `Nueva venta por ${formattedAmount}`,
          body: desc,
          actionUrl: `/dashboard/sales/${localId}`,
          actionLabel: "Ver venta",
          entityType: "order",
          entityId: localId,
          dedupeKey: `tenant:${tenantId}:sale:${meliId}:created`,
          eventTimestamp: rawOrder.date_created,
          metadata: {
            meli_order_id: meliId,
            total_amount: rawOrder.total_amount,
            items_count: rawOrder.order_items?.length || 0,
          },
        }).catch(err => {
          console.error(`Failed to publish sale_created notification for order ${meliId}:`, err);
        });
      } else {
        // Sprint 32: Do not publish sale_cancelled if already known as cancelled
        if (existing && existing.status === "cancelled") {
          continue;
        }

        const formattedAmount = `$${Math.round(Number(rawOrder.total_amount) || 0).toLocaleString("es-AR")}`;
        // Idempotent publication: guarantees cancelled sale notification delivery
        await publishImmutableEvent({
          tenantId,
          type: "sale_cancelled",
          title: `Se canceló una venta por ${formattedAmount}`,
          body: "La facturación y la rentabilidad fueron actualizadas.",
          severity: "warning",
          actionUrl: `/dashboard/sales/${localId}`,
          actionLabel: "Ver cancelación",
          entityType: "order",
          entityId: localId,
          dedupeKey: `tenant:${tenantId}:sale:${meliId}:cancelled`,
          eventTimestamp: rawOrder.date_closed || rawOrder.date_created,
          metadata: {
            meli_order_id: meliId,
            total_amount: rawOrder.total_amount,
          },
        }).catch(err => {
          console.error(`Failed to publish sale_cancelled notification for order ${meliId}:`, err);
        });
      }
    }
  } catch (notifErr: any) {
    console.error("Error dispatching sale notifications in syncOrders:", notifErr);
  }

  // --- SPRINT 36: Sincronización automática de envíos ---
    await syncShipments(tenantId).catch((err) => {
      console.error(`Failed to sync shipments during syncOrders for tenant ${tenantId}:`, err);
    });

    // --- SPRINT 37: Sincronización automática de cancelaciones ---
    const { syncCancellations } = await import("./syncCancellations");
    await syncCancellations(tenantId).catch((err) => {
      console.error(`Failed to sync cancellations during syncOrders for tenant ${tenantId}:`, err);
    });

    // Actualizar timestamp de última sincronización en meli_accounts
    await supabase
      .from("meli_accounts")
      .update({ last_sync_at: syncTimestamp, updated_at: syncTimestamp })
      .eq("tenant_id", tenantId);

    // Invalidate Next.js dashboard route caches & tags so refresh immediately reflects the synced orders
    try {
      const { revalidatePath, revalidateTag } = await import("next/cache");
      if (typeof revalidatePath === "function") {
        revalidatePath("/dashboard/sales");
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/finance");
      }
      if (typeof revalidateTag === "function") {
        (revalidateTag as any)(`orders-${tenantId}`);
        (revalidateTag as any)(`tenant-${tenantId}`);
      }
    } catch {
      // Safe no-op when executing in background worker / non-request context
    }

    return ordersToUpsert.length;
  } finally {
    // Release in-memory lock
    releaseLock(lockKey);
    // Release lock from DB only if it was a full sync
    if (isFullSync) {
      const { data: tenantLatest } = await supabase
        .from("tenants")
        .select("metadata")
        .eq("id", tenantId)
        .single();
      const latestMetadata = (tenantLatest?.metadata as any) || {};
      delete latestMetadata.orders_sync_lock;
      await supabase
        .from("tenants")
        .update({ metadata: latestMetadata })
        .eq("id", tenantId);
    }
  }
}
