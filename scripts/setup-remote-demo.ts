import fs from "node:fs";
import path from "node:path";

if (fs.existsSync(path.resolve(process.cwd(), ".env.local"))) {
  process.loadEnvFile(".env.local");
}

import { createAdminClient } from "../src/lib/supabase/admin";
import { DEMO_RANDOM_SEED, DEMO_TENANT_SLUG, DEMO_SEED_VERSION } from "./seed-private-demo";

function createPRNG(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

async function setupRemoteDemo() {
  const supabase = createAdminClient();
  const rand = createPRNG(DEMO_RANDOM_SEED);
  const anchorDate = new Date();

  console.log("=================================================");
  console.log("CONFIGURING REMOTE SUPABASE DEMO VIA SERVICE ROLE");
  console.log("=================================================");

  // 1. Locate user
  const email = "yoel.zoff+demo@gmail.com";
  const { data: usersData, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) throw userErr;

  const targetUser = usersData.users.find(u => u.email === email);
  if (!targetUser) {
    throw new Error(`User ${email} not found in Supabase Auth.`);
  }

  const userId = targetUser.id;
  console.log(`Found target user: ${email} (UUID: ${userId})`);

  // 2. Ensure Demo Tenant
  let { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, is_demo")
    .eq("slug", DEMO_TENANT_SLUG)
    .maybeSingle();

  if (!tenant) {
    console.log(`Creating demo tenant '${DEMO_TENANT_SLUG}'...`);
    const { data: newTenant, error: insertTenantErr } = await supabase
      .from("tenants")
      .insert({
        name: "Casa Norte",
        slug: DEMO_TENANT_SLUG,
        plan: "starter",
        status: "active",
        currency: "ARS",
        timezone: "America/Argentina/Buenos_Aires",
        is_demo: true,
        demo_label: "Datos ficticios para demostración",
        metadata: {
          category: "Hogar, Muebles y Jardín",
          country: "Argentina",
          businessSize: "pyme",
          onboarded: true,
          packaging_cost: 350,
          demo_seed_version: DEMO_SEED_VERSION,
          demo_anchor_date: anchorDate.toISOString(),
          source: "demo_seed",
          correlation_id: "demo:casa-norte:v1",
          ai_pricing_strategy: "profit_first",
          ai_min_margin_percent: 18,
          auto_suggestions_enabled: false,
        }
      })
      .select()
      .single();

    if (insertTenantErr) throw insertTenantErr;
    tenant = newTenant;
  } else {
    console.log(`Demo tenant already exists (ID: ${tenant.id}). Updating metadata...`);
    await supabase
      .from("tenants")
      .update({
        is_demo: true,
        demo_label: "Datos ficticios para demostración",
      })
      .eq("id", tenant.id);
  }

  const tenantId = tenant.id;

  // 3. Link Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    console.log(`Creating profile for user ${userId} linked to tenant ${tenantId}...`);
    const { error: profileErr } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        tenant_id: tenantId,
        full_name: "Yoel Zoff (Demo)",
        email: email,
        role: "owner",
        is_active: true,
      });
    if (profileErr) throw profileErr;
  } else {
    console.log(`Updating profile ${userId} to point to tenant ${tenantId}...`);
    await supabase
      .from("profiles")
      .update({
        tenant_id: tenantId,
        role: "owner",
        full_name: "Yoel Zoff (Demo)",
        is_active: true,
      })
      .eq("id", userId);
  }

  // 4. Ensure Subscription
  await supabase
    .from("subscriptions")
    .upsert({
      tenant_id: tenantId,
      plan: "starter",
      status: "active",
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "tenant_id" });

  // 5. Cleanup existing demo tenant records safely
  console.log("Clearing previous demo records for tenantId...");
  await supabase.from("competition_snapshots").delete().eq("tenant_id", tenantId);
  await supabase.from("alerts").delete().eq("tenant_id", tenantId);
  await supabase.from("purchase_order_items").delete().eq("tenant_id", tenantId);
  await supabase.from("purchase_orders").delete().eq("tenant_id", tenantId);
  await supabase.from("product_components").delete().eq("tenant_id", tenantId);
  await supabase.from("product_sku_components").delete().eq("tenant_id", tenantId);
  await supabase.from("inventory_items").delete().eq("tenant_id", tenantId);
  await supabase.from("promotion_items").delete().eq("tenant_id", tenantId);
  await supabase.from("promotions").delete().eq("tenant_id", tenantId);
  await supabase.from("coupons").delete().eq("tenant_id", tenantId);
  await supabase.from("order_cancellations").delete().eq("tenant_id", tenantId);
  await supabase.from("shipments").delete().eq("tenant_id", tenantId);
  await supabase.from("order_items").delete().eq("tenant_id", tenantId);
  await supabase.from("orders").delete().eq("tenant_id", tenantId);
  await supabase.from("products").delete().eq("tenant_id", tenantId);
  await supabase.from("monthly_expenses").delete().eq("tenant_id", tenantId);
  await supabase.from("meli_accounts").delete().eq("tenant_id", tenantId);

  // 6. Insert simulated Meli account
  const { data: meliAccount, error: meliErr } = await supabase
    .from("meli_accounts")
    .insert({
      tenant_id: tenantId,
      meli_user_id: "DEMO_SELLER_001",
      nickname: "CASA_NORTE_OFICIAL",
      site_id: "MLA",
      status: "connected",
      token_expires_at: new Date(anchorDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      last_success_refresh: anchorDate.toISOString(),
      metadata: { simulation: true, source: "demo_seed" }
    })
    .select()
    .single();

  if (meliErr) throw meliErr;

  // 7. Seed 120 Products & Inventory
  console.log("Seeding 120 catalog products...");
  const categories = [
    { name: "Hogar", prefix: "HOG", count: 25 },
    { name: "Cocina", prefix: "COC", count: 25 },
    { name: "Organización", prefix: "ORG", count: 25 },
    { name: "Iluminación", prefix: "ILU", count: 15 },
    { name: "Oficina", prefix: "OFI", count: 15 },
    { name: "Jardín", prefix: "JAR", count: 15 },
  ];

  const productNamesByPrefix: Record<string, string[]> = {
    HOG: [
      "Mesa auxiliar Nórdica Oslo", "Estantería metálica compacta 4 niveles", "Perchero de pie Línea Uno",
      "Espejo circular marco madera 60cm", "Alfombra tejida boho 120x180", "Almohadón velvet geométrico",
      "Reloj de pared minimalista 30cm", "Cesto de ropa plegable bambú", "Revistero metálico dorado",
      "Manta tejida flannel suave", "Cuadro tríptico botánico", "Portavelas cerámico artesanal",
      "Repisa flotante roble 80cm", "Mesa ratona nido set x2", "Cojín lumbar ergonómico",
      "Paragüero diseño nórdico", "Cortina blackout texturada", "Puff otomano tapizado lino",
      "Lámpara de piso escandinava", "Florero cerámico mate", "Difusor aromático ultrasónico",
      "Organizador de calzado bajo cama", "Perchas de madera premium set x10", "Portallaves magnético madera",
      "Biombo separador de ambientes 3 paneles"
    ],
    COC: [
      "Organizador modular de cocina extensible", "Set de contenedores herméticos x6", "Bandeja organizadora de bambú",
      "Escurridor de platos acero inoxidable 2 niveles", "Portarrollos triple cocina pared", "Frascos especieros magnéticos x12",
      "Tabla de corte bambú reversible", "Portautensilios giratorio acero", "Dispensador de jabón y esponja cerámico",
      "Organizador de sartenes regulable", "Canasto colgante para alacena", "Frutera de dos niveles rústica",
      "Especiero giratorio de madera 16 frascos", "Set cuchillos de cocina acero japonés", "Organizador de tapas de ollas",
      "Tazas de café cerámica nórdica x4", "Salero y pimentero molinillo madera", "Molinillo de café manual cónico",
      "Jarra térmica acero doble pared 1.5L", "Hermético rectangular vidrio borosilicato x4", "Portavasos posavasos corcho x6",
      "Balanza digital de cocina ultra delgada", "Centrifugadora de vegetales compacta", "Mandolina cortadora profesional",
      "Dispensador de aceite y vinagre antigoteo"
    ],
    ORG: [
      "Caja organizadora tela con manija x3", "Organizador de cables y cargadores portátil", "Cesto organizador plegable lino",
      "Organizador acrílico de cosméticos 3 cajones", "Perchero para puerta 6 ganchos", "Separadores de cajón ajustables x4",
      "Bolsas de vacío para ropa set x6", "Zapatero colgante 10 compartimentos", "Cajas transparentes apilables x4",
      "Organizador de bijouterie terciopelo", "Neceser de viaje colgante impermeable", "Bandeja vaciabolsillos ecocuero",
      "Organizador de juguetes infantil cesto", "Contenedor con ruedas bajo cama 40L", "Organizador de escritorio metálico",
      "Porta documentos ignífugo A4", "Set organizador de valijas x6 piezas", "Canasto metálico con asa de madera",
      "Estante esquinero telescópico", "Caja fuerte camuflada libro", "Cinta velcro organizadora de cables 5m",
      "Perchas múltiples para pantalones 5 en 1", "Organizador de carteras para placard", "Organizador giratorio para mesada",
      "Caja organizadora con divisiones para ropa interior"
    ],
    ILU: [
      "Lámpara de escritorio Nórdica articulada", "Lámpara colgante industrial campana", "Velador moderno base madera esfera",
      "Guirnalda de luces led cálidas 10m", "Aplique de pared bidireccional moderno", "Luz led con sensor de movimiento recargable",
      "Lámpara de lectura clip recargable", "Lámpara de sal del Himalaya base madera", "Foco vintage filamento led dimerizable",
      "Plafón led moderno circular 24W", "Lámpara de pie trípode nórdica", "Tira led RGB inteligente 5m WiFi",
      "Lámpara velador táctil 3 intensidades", "Farol solar para jardín led exterior", "Proyector galaxia estrellas velador"
    ],
    OFI: [
      "Silla de escritorio ergonómica Urban", "Soporte elevador para notebook aluminio", "Pad mouse XL ecocuero 80x40",
      "Organizador de lapiceras y celular madera", "Lámpara led monitor barra regulable", "Papelera metálica de diseño compacta",
      "Cajonera móvil metálica 3 cajones", "Pizarra magnética blanca semanal 40x60", "Soporte doble para monitor articulado",
      "Reposapiés ergonómico inclinable", "Destructora de papel y tarjetas personal", "Carpeta organizadora acordeón fuelle",
      "Anotador ecológico tapa de bambú", "Base cargador inalámbrico rápido madera", "Mesa plegable para notebook cama o sillón"
    ],
    JAR: [
      "Maceta autorriego mediana geométrica", "Set de herramientas para jardín x3 piezas", "Manguera extensible mágica 15m con pistola",
      "Tijera de podar ergonómica acero carbono", "Pulverizador a presión manual 2L", "Jardinera colgante para balcón hierro",
      "Macetero trípode madera para interior", "Kit de semillas huerta urbana 8 variedades", "Farol solar estaca para césped x4",
      "Guantes de jardinería con garras", "Regadera vintage de metal 3L", "Tenedor escardillo manual para jardín",
      "Comedero colgante para pájaros madera", "Soporte con ruedas para macetas pesadas", "Repisa escalera para plantas 3 niveles"
    ]
  };

  const inventoryRows: any[] = [];
  const productRows: any[] = [];

  let pIndex = 1;
  for (const cat of categories) {
    const names = productNamesByPrefix[cat.prefix];
    for (let i = 0; i < cat.count; i++) {
      const pNum = String(i + 1).padStart(3, "0");
      const sku = `DEMO-${cat.prefix}-${pNum}`;
      const title = names[i] || `${cat.name} Modelo ${pNum}`;
      const meliItemId = `MLA${800000000 + pIndex}`;

      const isMissingCost = pIndex % 12 === 0;
      const isNegativeMargin = pIndex === 7 || pIndex === 43 || pIndex === 89;
      const isCriticalStock = pIndex % 8 === 0;
      const isPaused = pIndex % 25 === 0;

      let baseCost = 4500 + Math.round(rand() * 28000);
      let price = 0;

      if (isNegativeMargin) {
        price = Math.round(baseCost * 0.85);
      } else if (pIndex % 5 === 0) {
        price = Math.round(baseCost * 2.8);
      } else if (pIndex % 3 === 0) {
        price = Math.round(baseCost * 1.35);
      } else {
        price = Math.round(baseCost * 1.95);
      }

      const cost = isMissingCost ? null : baseCost;
      const availableQty = isCriticalStock ? (pIndex % 2 === 0 ? 2 : 3) : 15 + Math.round(rand() * 85);
      const soldQty = 20 + Math.round(rand() * 180);
      const estimatedFee = Math.round(price * 0.145);
      const estimatedShipping = price >= 30000 ? 3250 : 0;
      const estimatedTax = Math.round(price * 0.03);

      inventoryRows.push({
        tenant_id: tenantId,
        sku,
        sku_normalized: sku.toLowerCase(),
        name: title,
        category: cat.name,
        unit_cost: cost,
        average_cost: cost,
        last_purchase_cost: cost,
        current_stock: availableQty,
        minimum_stock: 10,
        metadata: { source: "demo_seed" }
      });

      productRows.push({
        tenant_id: tenantId,
        meli_account_id: meliAccount.id,
        meli_item_id: meliItemId,
        title,
        sku,
        status: isPaused ? "paused" : "active",
        listing_type_id: "gold_special",
        category_id: "MLA" + cat.prefix,
        price,
        base_price: price,
        available_quantity: availableQty,
        sold_quantity: soldQty,
        cost,
        estimated_fee: estimatedFee,
        estimated_shipping_cost: estimatedShipping,
        estimated_tax: estimatedTax,
        thumbnail_url: `https://http2.mlstatic.com/D_NQ_NP_${600000 + pIndex}-MLA-V.webp`,
        raw_data: {
          id: meliItemId,
          title,
          seller_sku: sku,
          price,
          currency_id: "ARS",
          available_quantity: availableQty,
          sold_quantity: soldQty,
          status: isPaused ? "paused" : "active",
          source: "demo_seed"
        },
        last_synced_at: anchorDate.toISOString()
      });

      pIndex++;
    }
  }

  // Insert inventory items in batches
  const { data: insertedInventory, error: invErr } = await supabase
    .from("inventory_items")
    .insert(inventoryRows)
    .select("id, sku");
  if (invErr) throw invErr;

  // Insert products in batches
  const { data: insertedProducts, error: prodErr } = await supabase
    .from("products")
    .insert(productRows)
    .select("id, meli_item_id, title, sku, price, cost");
  if (prodErr) throw prodErr;

  console.log(`Inserted ${insertedProducts.length} products and inventory items.`);

  // Insert components
  const componentRows: any[] = [];
  const skuComponentRows: any[] = [];
  for (const prod of insertedProducts) {
    const inv = insertedInventory.find((i: any) => i.sku === prod.sku);
    if (inv) {
      componentRows.push({
        tenant_id: tenantId,
        product_id: prod.id,
        inventory_item_id: inv.id,
        component_sku: prod.sku,
        component_normalized: prod.sku.toLowerCase(),
        quantity: 1,
        unit_cost: prod.cost,
        total_component_cost: prod.cost
      });
      skuComponentRows.push({
        tenant_id: tenantId,
        product_id: prod.id,
        component_sku: prod.sku,
        component_normalized: prod.sku.toLowerCase()
      });
    }
  }
  await supabase.from("product_components").insert(componentRows);
  await supabase.from("product_sku_components").insert(skuComponentRows);

  // 8. Generate 1,000 Orders
  console.log("Generating 1,000 orders across 120 days...");
  const TOTAL_ORDERS = 1000;
  const buyerFirstNames = ["Martín", "Lucía", "Esteban", "Florencia", "Gonzalo", "Valentina", "Facundo", "Camila", "Rodrigo", "Sofía"];
  const buyerLastNames = ["Gómez", "López", "Fernández", "Rodríguez", "González", "Pérez", "Martínez", "Sánchez", "Romero", "Díaz"];

  const ordersBatch: any[] = [];
  const orderItemsBatch: any[] = [];
  const shipmentsBatch: any[] = [];
  const cancellationsBatch: any[] = [];

  for (let oIdx = 1; oIdx <= TOTAL_ORDERS; oIdx++) {
    const rDist = rand();
    let dayOffset: number;
    if (rDist < 0.40) dayOffset = Math.floor(rand() * 30);
    else if (rDist < 0.70) dayOffset = 30 + Math.floor(rand() * 30);
    else if (rDist < 0.90) dayOffset = 60 + Math.floor(rand() * 30);
    else dayOffset = 90 + Math.floor(rand() * 30);

    const hour = 8 + Math.floor(rand() * 15);
    const minute = Math.floor(rand() * 60);
    const orderDate = new Date(anchorDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    orderDate.setHours(hour, minute, Math.floor(rand() * 60));

    const isCancelled = oIdx % 20 === 0;
    const isPending = !isCancelled && dayOffset <= 3 && rand() < 0.35;
    const isDelayed = !isCancelled && !isPending && dayOffset <= 7 && rand() < 0.12;

    const orderStatus = isCancelled ? "cancelled" : "paid";
    const shipmentStatus = isCancelled ? "cancelled" : isPending ? "pending" : isDelayed ? "delayed" : "delivered";

    const isAdOrder = oIdx % 5 === 0;
    const numItems = rand() < 0.85 ? 1 : rand() < 0.97 ? 2 : 3;

    let orderTotal = 0;
    const itemsForThisOrder: any[] = [];

    for (let it = 0; it < numItems; it++) {
      const pickIndex = rand() < 0.45 ? Math.floor(rand() * 20) : Math.floor(rand() * insertedProducts.length);
      const prod = insertedProducts[pickIndex];
      const qty = rand() < 0.90 ? 1 : 2;
      const linePrice = Number(prod.price) * qty;
      orderTotal += linePrice;

      itemsForThisOrder.push({
        product: prod,
        quantity: qty,
        unitPrice: Number(prod.price),
        totalPrice: linePrice,
        unitCost: prod.cost !== null ? Number(prod.cost) : null,
        fee: Math.round(linePrice * 0.145),
        shippingCost: prod.price >= 30000 ? 3250 : 0
      });
    }

    const meliOrderId = `4000${String(oIdx).padStart(6, "0")}`;
    const buyerName = `${buyerFirstNames[Math.floor(rand() * buyerFirstNames.length)]} ${buyerLastNames[Math.floor(rand() * buyerLastNames.length)]}`;
    const buyerId = `BUYER_${10000 + oIdx}`;
    const shipmentId = `SHIP_${700000 + oIdx}`;

    ordersBatch.push({
      tenant_id: tenantId,
      meli_account_id: meliAccount.id,
      meli_order_id: meliOrderId,
      status: orderStatus,
      buyer_nickname: buyerName,
      buyer_id: buyerId,
      total_amount: orderTotal,
      paid_amount: isCancelled ? 0 : orderTotal,
      currency_id: "ARS",
      date_created: orderDate.toISOString(),
      date_closed: orderDate.toISOString(),
      meli_shipment_id: shipmentId,
      raw_data: {
        id: meliOrderId,
        date_created: orderDate.toISOString(),
        date_closed: orderDate.toISOString(),
        status: orderStatus,
        total_amount: orderTotal,
        currency_id: "ARS",
        buyer: { id: buyerId, nickname: buyerName.toUpperCase() },
        tags: isAdOrder ? ["advertising", "paid", "not_delivered"] : ["paid"],
        shipping: {
          id: shipmentId,
          cost: orderTotal >= 30000 ? 3250 : 0,
          status: shipmentStatus,
          substatus: shipmentStatus === "delayed" ? "delayed" : "ready_to_ship"
        },
        order_items: itemsForThisOrder.map(oi => ({
          item: { id: oi.product.meli_item_id, title: oi.product.title, seller_sku: oi.product.sku },
          quantity: oi.quantity,
          unit_price: oi.unitPrice,
          sale_fee: oi.fee
        })),
        source: "demo_seed"
      }
    });
  }

  // Insert orders in chunks of 100
  console.log("Uploading orders to Supabase in chunks...");
  const insertedOrdersList: any[] = [];
  for (let i = 0; i < ordersBatch.length; i += 100) {
    const chunk = ordersBatch.slice(i, i + 100);
    const { data: chunkRes, error: oErr } = await supabase
      .from("orders")
      .insert(chunk)
      .select("id, meli_order_id, raw_data");
    if (oErr) throw oErr;
    insertedOrdersList.push(...chunkRes);
  }

  console.log(`Inserted ${insertedOrdersList.length} orders.`);

  // Prepare order_items, shipments, and cancellations
  for (const order of insertedOrdersList) {
    const raw = order.raw_data;
    const rawItems = raw?.order_items || [];
    const shipmentInfo = raw?.shipping || {};

    for (const ri of rawItems) {
      const prod = insertedProducts.find((p: any) => p.meli_item_id === ri.item?.id);
      orderItemsBatch.push({
        tenant_id: tenantId,
        order_id: order.id,
        product_id: prod?.id || null,
        meli_item_id: ri.item?.id,
        title: ri.item?.title || "Producto",
        sku: ri.item?.seller_sku || null,
        quantity: ri.quantity || 1,
        unit_price: ri.unit_price || 0,
        unit_cost: prod?.cost || null,
        estimated_fee: ri.sale_fee || 0,
        estimated_shipping_cost: Number(raw.total_amount) >= 30000 ? 3250 : 0,
        created_at: raw.date_created
      });
    }

    shipmentsBatch.push({
      tenant_id: tenantId,
      order_id: order.id,
      meli_shipment_id: shipmentInfo.id || `SHIP_${order.meli_order_id}`,
      status: shipmentInfo.status || "delivered",
      substatus: shipmentInfo.substatus || null,
      logistic_type: "cross_docking",
      mode: "me2",
      tracking_number: "AR" + Math.floor(10000000 + rand() * 90000000),
      tracking_method: "Mercado Envíos",
      shipping_cost: shipmentInfo.cost || 0,
      receiver_city: rand() < 0.5 ? "CABA" : rand() < 0.8 ? "Córdoba" : "Rosario",
      receiver_state: rand() < 0.5 ? "Buenos Aires" : rand() < 0.8 ? "Córdoba" : "Santa Fe",
      date_created: raw.date_created,
      raw_data: { source: "demo_seed" }
    });

    if (raw.status === "cancelled") {
      cancellationsBatch.push({
        tenant_id: tenantId,
        order_id: order.id,
        meli_order_id: order.meli_order_id,
        reason: rand() < 0.5 ? "Comprador se arrepintió" : "Error en la dirección",
        cancelled_by: "buyer",
        refund_amount: raw.total_amount,
        date_cancelled: raw.date_created,
        raw_data: { source: "demo_seed" }
      });
    }
  }

  // Insert items, shipments, cancellations in chunks
  console.log("Uploading order line items and shipments...");
  for (let i = 0; i < orderItemsBatch.length; i += 200) {
    const chunk = orderItemsBatch.slice(i, i + 200);
    await supabase.from("order_items").insert(chunk);
  }

  for (let i = 0; i < shipmentsBatch.length; i += 200) {
    const chunk = shipmentsBatch.slice(i, i + 200);
    await supabase.from("shipments").insert(chunk);
  }

  if (cancellationsBatch.length > 0) {
    await supabase.from("order_cancellations").insert(cancellationsBatch);
  }

  // 9. Promotions & Coupons
  const { data: promo } = await supabase
    .from("promotions")
    .insert({
      tenant_id: tenantId,
      meli_promotion_id: "PROMO-DEMO-SPRING-2026",
      type: "DEAL",
      status: "active",
      title: "Especial Hogar & Organización",
      description: "Descuentos especiales de temporada en artículos seleccionados",
      discount_type: "percentage",
      discount_value: 15,
      starts_at: new Date(anchorDate.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(anchorDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: anchorDate.toISOString()
    })
    .select()
    .single();

  if (promo) {
    const promoItems = insertedProducts.slice(0, 8).map((p: any) => ({
      tenant_id: tenantId,
      promotion_id: promo.id,
      product_id: p.id,
      meli_item_id: p.meli_item_id,
      current_price: p.price,
      discount_price: Math.round(p.price * 0.85),
      discount_percent: 15,
      expected_margin: 24.5,
      status: "active"
    }));
    await supabase.from("promotion_items").insert(promoItems);
  }

  await supabase.from("coupons").insert({
    tenant_id: tenantId,
    meli_coupon_id: "COUPON-CASANORTE-10",
    title: "Cupón Bienvenida Clientes",
    code: "CASANORTE10",
    coupon_type: "standard",
    discount_type: "percent",
    discount_value: 10,
    min_purchase_amount: 25000,
    max_uses: 100,
    status: "active",
    starts_at: new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(anchorDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
  });

  // 10. Monthly Expenses
  await supabase.from("monthly_expenses").insert([
    { tenant_id: tenantId, name: "Alquiler depósito Chacarita", type: "fixed", amount: 480000, is_active: true },
    { tenant_id: tenantId, name: "Embalajes, cartón y film", type: "variable", amount: 145000, is_active: true },
    { tenant_id: tenantId, name: "Servicios e internet fibra", type: "fixed", amount: 65000, is_active: true },
    { tenant_id: tenantId, name: "Honorarios contador", type: "fixed", amount: 110000, is_active: true }
  ]);

  // 11. Competition Snapshots (20 products)
  const compSnapshots = insertedProducts.slice(0, 20).map((prod: any, cs: number) => {
    const ownPrice = Number(prod.price);
    let marketAvg = ownPrice;
    if (cs % 5 === 0) marketAvg = Math.round(ownPrice * 0.85);
    else if (cs % 5 === 1) marketAvg = Math.round(ownPrice * 1.15);
    else marketAvg = Math.round(ownPrice * (0.98 + rand() * 0.04));

    return {
      tenant_id: tenantId,
      product_id: prod.id,
      query: prod.title,
      own_price: ownPrice,
      avg_price: marketAvg,
      min_price: Math.round(marketAvg * 0.88),
      max_price: Math.round(marketAvg * 1.22),
      median_price: marketAvg,
      competitors_count: 8 + Math.floor(rand() * 12),
      free_shipping_count: 4 + Math.floor(rand() * 6),
      raw_results: [
        { seller: "Competidor Norte", price: Math.round(marketAvg * 0.95), free_shipping: true },
        { seller: "Bazar Central", price: Math.round(marketAvg * 1.05), free_shipping: false },
        { seller: "Deco Hogar Online", price: marketAvg, free_shipping: true }
      ]
    };
  });
  await supabase.from("competition_snapshots").insert(compSnapshots);

  // 12. Alerts for missing costs and stock
  const missingCostProds = insertedProducts.filter((p: any) => p.cost === null).slice(0, 3);
  const alertRows: any[] = [];
  for (const m of missingCostProds) {
    alertRows.push({
      tenant_id: tenantId,
      product_id: m.id,
      title: "Falta costo de producto",
      body: `El producto "${m.title}" (${m.sku}) no tiene costo cargado. No es posible calcular su margen real.`,
      severity: "warning",
      is_read: false
    });
  }

  const criticalStockProds = insertedProducts.filter((p: any) => p.available_quantity <= 3).slice(0, 3);
  for (const c of criticalStockProds) {
    alertRows.push({
      tenant_id: tenantId,
      product_id: c.id,
      title: "Stock crítico",
      body: `El producto "${c.title}" tiene solo ${c.available_quantity} unidades disponibles.`,
      severity: "danger",
      is_read: false
    });
  }
  if (alertRows.length > 0) {
    await supabase.from("alerts").insert(alertRows);
  }

  console.log("\n=================================================");
  console.log("✅ REMOTE SUPABASE DEMO SETUP COMPLETED!");
  console.log("=================================================");
  console.log(`User: ${email}`);
  console.log(`Password: (Configurada por el usuario: KlyvoDemo)`);
  console.log(`Tenant: Casa Norte (${DEMO_TENANT_SLUG})`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Products: ${insertedProducts.length}`);
  console.log(`Orders: ${insertedOrdersList.length}`);
  console.log("Status: READY FOR LOGIN");
  console.log("=================================================\n");
}

setupRemoteDemo().catch(err => {
  console.error("Setup error:", err);
  process.exit(1);
});
