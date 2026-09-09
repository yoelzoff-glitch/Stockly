// src/services/inventory/replenishment/buildReplenishmentSnapshot.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSku } from "@/services/products/sku/normalizeSku";
import { ReplenishmentSnapshot } from "./types";

/**
 * Extrae y consolida los snapshots de inventario y ventas para todos los productos FULL del tenant.
 * Agrupa publicaciones compartidas/espejadas por SKU físico para evitar doble conteo de stock o demanda.
 */
export async function buildReplenishmentSnapshots(
  tenantId: string,
  supabase: SupabaseClient
): Promise<ReplenishmentSnapshot[]> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Obtener productos del tenant
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, title, sku, meli_item_id, available_quantity, sold_quantity, price, cost, profit_real_margin, margin_percent, thumbnail_url, raw_data, status"
    )
    .eq("tenant_id", tenantId);

  const fullProducts = (products || []).filter(
    (p) =>
      p.raw_data?.shipping?.logistic_type === "fulfillment" ||
      p.raw_data?.logistic_type === "fulfillment"
  );

  if (fullProducts.length === 0) {
    return [];
  }

  // 2. Agrupar publicaciones por SKU físico normalizado
  interface SkuGroup {
    primaryProductId: string;
    productIds: string[];
    meliItemIds: string[];
    sku: string | null;
    normSku: string;
    title: string;
    thumbnailUrl: string | null;
    fullStock: number;
    unitPrice: number | null;
    unitCost: number | null;
    marginPercent: number | null;
  }

  const skuGroupMap = new Map<string, SkuGroup>();

  for (const p of fullProducts) {
    const rawSku = p.sku?.trim() || null;
    const normSku = rawSku ? normalizeSku(rawSku) : `no-sku-${p.meli_item_id}`;
    const price = p.price ? Number(p.price) : null;
    const cost = p.cost !== null && p.cost !== undefined ? Number(p.cost) : null;
    const margin = p.profit_real_margin ?? p.margin_percent ?? null;
    const stock = Number(p.available_quantity) || 0;

    const existing = skuGroupMap.get(normSku);
    if (!existing) {
      skuGroupMap.set(normSku, {
        primaryProductId: p.id,
        productIds: [p.id],
        meliItemIds: p.meli_item_id ? [p.meli_item_id] : [],
        sku: rawSku,
        normSku,
        title: p.title || "Producto sin título",
        thumbnailUrl: p.thumbnail_url || null,
        fullStock: stock,
        unitPrice: price,
        unitCost: cost,
        marginPercent: margin !== null ? Number(margin) : null,
      });
    } else {
      existing.productIds.push(p.id);
      if (p.meli_item_id && !existing.meliItemIds.includes(p.meli_item_id)) {
        existing.meliItemIds.push(p.meli_item_id);
      }
      // Publicaciones compartidas (clásica vs premium): el stock físico es el mismo
      existing.fullStock = Math.max(existing.fullStock, stock);
      if (!existing.unitCost && cost) existing.unitCost = cost;
      if (!existing.thumbnailUrl && p.thumbnail_url) existing.thumbnailUrl = p.thumbnail_url;
    }
  }

  // 3. Obtener stock interno en depósito para los productos
  const allProductIds = Array.from(
    new Set(Array.from(skuGroupMap.values()).flatMap((g) => g.productIds))
  );

  // Linkages via product_components
  const { data: productComponents } = await supabase
    .from("product_components")
    .select("product_id, inventory_item_id, quantity, inventory_items(current_stock)")
    .in("product_id", allProductIds);

  const productComponentsMap = new Map<string, any[]>();
  productComponents?.forEach((comp) => {
    const list = productComponentsMap.get(comp.product_id) || [];
    list.push(comp);
    productComponentsMap.set(comp.product_id, list);
  });

  // Direct inventory_items lookup por sku_normalized
  const { data: invItems } = await supabase
    .from("inventory_items")
    .select("sku_normalized, current_stock")
    .eq("tenant_id", tenantId);

  const invSkuMap = new Map<string, number>();
  invItems?.forEach((item) => {
    if (item.sku_normalized) {
      invSkuMap.set(item.sku_normalized.toLowerCase(), item.current_stock || 0);
    }
  });

  // 4. Obtener órdenes válidas de los últimos 60 días para el tenant
  const { data: orders } = await supabase
    .from("orders")
    .select("id, date_created, status")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", d60);

  const validOrders = orders || [];
  const orderDateMap = new Map<string, Date>();
  let accountOrders7d = 0;
  let accountOrdersPrev7d = 0;
  let accountOrders30d = 0;
  let accountOrdersPrev30d = 0;

  const tNow = now.getTime();
  const t7 = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const t14 = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const t30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const t60 = now.getTime() - 60 * 24 * 60 * 60 * 1000;

  for (const o of validOrders) {
    const oDate = new Date(o.date_created);
    const ot = oDate.getTime();
    orderDateMap.set(o.id, oDate);

    if (ot >= t7) {
      accountOrders7d++;
    } else if (ot >= t14) {
      accountOrdersPrev7d++;
    }

    if (ot >= t30) {
      accountOrders30d++;
    } else if (ot >= t60) {
      accountOrdersPrev30d++;
    }
  }

  const accountGrowth7d =
    accountOrdersPrev7d > 0 ? (accountOrders7d / accountOrdersPrev7d) - 1 : null;
  const accountGrowth30d =
    accountOrdersPrev30d > 0 ? (accountOrders30d / accountOrdersPrev30d) - 1 : null;

  // 5. Obtener order_items para las órdenes válidas
  const orderIds = validOrders.map((o) => o.id);
  const orderItemsList: any[] = [];

  // En bloques de 500 para evitar límites de URL de Supabase
  for (let i = 0; i < orderIds.length; i += 500) {
    const chunk = orderIds.slice(i, i + 500);
    const { data: itemsChunk } = await supabase
      .from("order_items")
      .select("order_id, product_id, meli_item_id, sku, quantity, unit_price")
      .in("order_id", chunk);

    if (itemsChunk) {
      orderItemsList.push(...itemsChunk);
    }
  }

  // Mapear ventas por SKU Group
  // Creamos lookup inverso: meli_item_id -> groupKey, product_id -> groupKey, sku -> groupKey
  const meliToGroup = new Map<string, SkuGroup>();
  const prodToGroup = new Map<string, SkuGroup>();
  const skuToGroup = new Map<string, SkuGroup>();

  for (const group of skuGroupMap.values()) {
    for (const pid of group.productIds) {
      prodToGroup.set(pid, group);
    }
    for (const mid of group.meliItemIds) {
      meliToGroup.set(mid.toLowerCase(), group);
    }
    if (group.sku) {
      skuToGroup.set(group.normSku, group);
    }
  }

  // Acumuladores de ventas por grupo
  interface SalesAccumulator {
    sales7d: number;
    sales14d: number;
    sales30d: number;
    sales60d: number;
    revenue30d: number;
  }

  const salesByGroup = new Map<string, SalesAccumulator>();

  for (const item of orderItemsList) {
    const oDate = orderDateMap.get(item.order_id);
    if (!oDate) continue;
    const ot = oDate.getTime();
    const qty = Number(item.quantity) || 1;
    const revenue = (Number(item.unit_price) || 0) * qty;

    // Resolver a qué grupo pertenece
    let matchedGroup: SkuGroup | undefined = undefined;
    if (item.product_id && prodToGroup.has(item.product_id)) {
      matchedGroup = prodToGroup.get(item.product_id);
    } else if (item.meli_item_id && meliToGroup.has(item.meli_item_id.toLowerCase())) {
      matchedGroup = meliToGroup.get(item.meli_item_id.toLowerCase());
    } else if (item.sku) {
      const nSku = normalizeSku(item.sku);
      if (skuToGroup.has(nSku)) {
        matchedGroup = skuToGroup.get(nSku);
      }
    }

    if (!matchedGroup) continue;

    const acc = salesByGroup.get(matchedGroup.normSku) || {
      sales7d: 0,
      sales14d: 0,
      sales30d: 0,
      sales60d: 0,
      revenue30d: 0,
    };

    if (ot >= t7) {
      acc.sales7d += qty;
    }
    if (ot >= t14) {
      acc.sales14d += qty;
    }
    if (ot >= t30) {
      acc.sales30d += qty;
      acc.revenue30d += revenue;
    }
    if (ot >= t60) {
      acc.sales60d += qty;
    }

    salesByGroup.set(matchedGroup.normSku, acc);
  }

  // 6. Construir Snapshots finales
  const snapshots: ReplenishmentSnapshot[] = [];

  for (const group of skuGroupMap.values()) {
    // Calcular stock interno
    let internalStock: number | null = null;

    // Chequear componentes vinculados
    let minComboStock = Infinity;
    let hasComponents = false;

    for (const pid of group.productIds) {
      const comps = productComponentsMap.get(pid);
      if (comps && comps.length > 0) {
        hasComponents = true;
        for (const comp of comps) {
          const cStock = comp.inventory_items?.current_stock ?? 0;
          const reqQty = comp.quantity || 1;
          const potential = Math.floor(cStock / reqQty);
          if (potential < minComboStock) minComboStock = potential;
        }
      }
    }

    if (hasComponents && minComboStock !== Infinity) {
      internalStock = minComboStock;
    } else {
      // Fallback directo por sku_normalized en inventory_items
      const directStock = invSkuMap.get(group.normSku.toLowerCase());
      if (directStock !== undefined) {
        internalStock = directStock;
      }
    }

    const sales = salesByGroup.get(group.normSku) || {
      sales7d: 0,
      sales14d: 0,
      sales30d: 0,
      sales60d: 0,
      revenue30d: 0,
    };

    snapshots.push({
      productId: group.primaryProductId,
      sku: group.sku,
      title: group.title,
      thumbnailUrl: group.thumbnailUrl,
      fullStock: group.fullStock,
      internalStock,
      sales7d: sales.sales7d,
      sales14d: sales.sales14d,
      sales30d: sales.sales30d,
      sales60d: sales.sales60d,
      revenue30d: Math.round(sales.revenue30d),
      unitPrice: group.unitPrice,
      unitCost: group.unitCost,
      marginPercent: group.marginPercent,
      accountOrdersLast7d: accountOrders7d,
      accountOrdersPrev7d: accountOrdersPrev7d,
      accountGrowth7d,
      accountOrdersLast30d: accountOrders30d,
      accountOrdersPrev30d: accountOrdersPrev30d,
      accountGrowth30d,
      publicationsCount: group.productIds.length,
      meliItemIds: group.meliItemIds,
    });
  }

  return snapshots;
}
