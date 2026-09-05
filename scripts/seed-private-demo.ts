import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

try {
  const envLocal = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal) && typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(envLocal);
  }
} catch (_) {}

export const DEMO_RANDOM_SEED = "klyvo-casa-norte-v1";
export const DEMO_TENANT_SLUG = "klyvo-private-demo";
export const DEMO_SEED_VERSION = "casa-norte-v1";

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

export interface SeedDemoOptions {
  dbUrl?: string;
  anchorDate?: Date;
  tenantSlug?: string;
}

export async function seedPrivateDemo(options: SeedDemoOptions = {}) {
  const dbUrl =
    options.dbUrl ||
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@127.0.0.1:54322/postgres";

  const anchorDate = options.anchorDate || new Date();
  const slug = options.tenantSlug || DEMO_TENANT_SLUG;
  const rand = createPRNG(DEMO_RANDOM_SEED);

  console.log(`[DEMO_SEED_STARTED] Seeding demo account slug=${slug} anchorDate=${anchorDate.toISOString().split("T")[0]}...`);

  const sql = postgres(dbUrl, { max: 10 });

  try {
    // 1. Ensure or retrieve Demo Tenant
    let [tenant] = await sql`
      SELECT id, is_demo, slug, name FROM public.tenants WHERE slug = ${slug}
    `;

    if (!tenant) {
      [tenant] = await sql`
        INSERT INTO public.tenants (
          name,
          slug,
          plan,
          status,
          currency,
          timezone,
          is_demo,
          demo_label,
          metadata
        ) VALUES (
          'Casa Norte',
          ${slug},
          'starter',
          'active',
          'ARS',
          'America/Argentina/Buenos_Aires',
          true,
          'Datos ficticios para demostración',
          ${sql.json({
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
          })}
        )
        RETURNING id, is_demo, slug, name
      `;
    } else {
      if (!tenant.is_demo) {
        throw new Error(`Refusing to seed non-demo tenant with slug ${slug}`);
      }
      // Update metadata anchor date and demo_label
      await sql`
        UPDATE public.tenants
        SET 
          name = 'Casa Norte',
          demo_label = 'Datos ficticios para demostración',
          metadata = metadata || ${sql.json({
            demo_seed_version: DEMO_SEED_VERSION,
            demo_anchor_date: anchorDate.toISOString(),
            packaging_cost: 350,
            source: "demo_seed",
            correlation_id: "demo:casa-norte:v1",
          })}
        WHERE id = ${tenant.id}
      `;
    }

    const tenantId = tenant.id;

    // 2. Safe cleanup of ONLY demo tenant's previous rows (idempotency)
    console.log(`[DEMO_SEED] Safely clearing existing demo tenant records for tenantId=${tenantId}...`);
    await sql`DELETE FROM public.competition_snapshots WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.alerts WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.alert_rules WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_extra_costs WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.purchase_order_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.purchase_orders WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.inventory_movements WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_components WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_sku_components WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.inventory_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.promotion_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.promotions WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.coupons WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.order_cancellations WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.shipments WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.order_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.orders WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.stock_movements WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_price_history WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.products WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.monthly_expenses WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.subscription_usage WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.meli_accounts WHERE tenant_id = ${tenantId}`;

    // 3. Insert Simulated Mercado Libre Account (no real tokens/secrets)
    const [meliAccount] = await sql`
      INSERT INTO public.meli_accounts (
        tenant_id,
        meli_user_id,
        nickname,
        site_id,
        status,
        access_token,
        refresh_token,
        token_expires_at,
        last_success_refresh,
        metadata
      ) VALUES (
        ${tenantId},
        'DEMO_SELLER_001',
        'CASA_NORTE_OFICIAL',
        'MLA',
        'connected',
        NULL,
        NULL,
        ${new Date(anchorDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()},
        ${anchorDate.toISOString()},
        ${sql.json({ simulation: true, source: "demo_seed" })}
      )
      RETURNING id
    `;

    // 4. Generate 120 Fictional Products
    console.log(`[DEMO_SEED] Generating 120 fictional catalog products...`);
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

    const insertedProducts: any[] = [];
    const insertedInventoryItems: any[] = [];

    let productIndex = 1;
    for (const cat of categories) {
      const names = productNamesByPrefix[cat.prefix];
      for (let i = 0; i < cat.count; i++) {
        const pNum = String(i + 1).padStart(3, "0");
        const sku = `DEMO-${cat.prefix}-${pNum}`;
        const title = names[i] || `${cat.name} Modelo ${pNum}`;
        const meliItemId = `MLA${800000000 + productIndex}`;

        // Variety in costs and margins:
        // 10 products with missing cost (pIndex % 12 === 0)
        // 3 products with negative margin (e.g. promotional loss leaders: cost > price)
        // High margin (price ~3x cost)
        // Normal margin (price ~1.8x - 2.2x cost)
        // Low margin (price ~1.2x cost)
        const isMissingCost = productIndex % 12 === 0;
        const isNegativeMargin = productIndex === 7 || productIndex === 43 || productIndex === 89;
        const isCriticalStock = productIndex % 8 === 0; // ~15 products with stock <= 3
        const isPaused = productIndex % 25 === 0; // ~5 paused products

        let baseCost = 4500 + Math.round(rand() * 28000);
        let price = 0;

        if (isNegativeMargin) {
          price = Math.round(baseCost * 0.85); // Sold below cost for acquisition
        } else if (productIndex % 5 === 0) {
          price = Math.round(baseCost * 2.8); // High margin
        } else if (productIndex % 3 === 0) {
          price = Math.round(baseCost * 1.35); // Low margin
        } else {
          price = Math.round(baseCost * 1.95); // Normal margin
        }

        const cost = isMissingCost ? null : baseCost;
        const availableQty = isCriticalStock ? (productIndex % 2 === 0 ? 2 : 3) : 15 + Math.round(rand() * 85);
        const soldQty = 20 + Math.round(rand() * 180);

        // ML Fees: ~14.5% commission
        const estimatedFee = Math.round(price * 0.145);
        // Shipping: Free shipping for products > 30000 ARS, ~3200 cost
        const estimatedShipping = price >= 30000 ? 3250 : 0;
        const estimatedTax = Math.round(price * 0.03); // ~3% IIBB

        // 1. Inventory Item
        const [invItem] = await sql`
          INSERT INTO public.inventory_items (
            tenant_id,
            sku,
            sku_normalized,
            name,
            category,
            unit_cost,
            average_cost,
            last_purchase_cost,
            current_stock,
            minimum_stock,
            metadata
          ) VALUES (
            ${tenantId},
            ${sku},
            ${sku.toLowerCase()},
            ${title},
            ${cat.name},
            ${cost},
            ${cost},
            ${cost},
            ${availableQty},
            10,
            ${sql.json({ source: "demo_seed" })}
          )
          RETURNING id, sku, name
        `;
        insertedInventoryItems.push(invItem);

        // 2. Product
        const [product] = await sql`
          INSERT INTO public.products (
            tenant_id,
            meli_account_id,
            meli_item_id,
            title,
            sku,
            status,
            listing_type_id,
            category_id,
            price,
            base_price,
            available_quantity,
            sold_quantity,
            cost,
            estimated_fee,
            estimated_shipping_cost,
            estimated_tax,
            thumbnail_url,
            raw_data,
            last_synced_at
          ) VALUES (
            ${tenantId},
            ${meliAccount.id},
            ${meliItemId},
            ${title},
            ${sku},
            ${isPaused ? "paused" : "active"},
            'gold_special',
            ${'MLA' + cat.prefix},
            ${price},
            ${price},
            ${availableQty},
            ${soldQty},
            ${cost},
            ${estimatedFee},
            ${estimatedShipping},
            ${estimatedTax},
            ${`https://http2.mlstatic.com/D_NQ_NP_${600000 + productIndex}-MLA-V.webp`},
            ${sql.json({
              id: meliItemId,
              title,
              seller_sku: sku,
              price,
              currency_id: "ARS",
              available_quantity: availableQty,
              sold_quantity: soldQty,
              status: isPaused ? "paused" : "active",
              buying_mode: "buy_it_now",
              listing_type_id: "gold_special",
              condition: "new",
              permalink: `https://articulo.mercadolibre.com.ar/${meliItemId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              thumbnail: `https://http2.mlstatic.com/D_NQ_NP_${600000 + productIndex}-MLA-V.webp`,
              source: "demo_seed"
            })},
            ${anchorDate.toISOString()}
          )
          RETURNING id, meli_item_id, title, sku, price, cost, estimated_fee, estimated_shipping_cost
        `;
        insertedProducts.push(product);

        // 3. Product component mapping
        await sql`
          INSERT INTO public.product_components (
            tenant_id,
            product_id,
            inventory_item_id,
            component_sku,
            component_normalized,
            quantity,
            unit_cost,
            total_component_cost
          ) VALUES (
            ${tenantId},
            ${product.id},
            ${invItem.id},
            ${sku},
            ${sku.toLowerCase()},
            1,
            ${cost},
            ${cost}
          )
        `;

        await sql`
          INSERT INTO public.product_sku_components (
            tenant_id,
            product_id,
            component_sku,
            component_normalized
          ) VALUES (
            ${tenantId},
            ${product.id},
            ${sku},
            ${sku.toLowerCase()}
          )
        `;

        productIndex++;
      }
    }

    console.log(`[DEMO_SEED] 120 products and inventory items inserted successfully.`);

    // 5. Generate 1,000 Orders across the last 120 days from anchorDate
    console.log(`[DEMO_SEED] Generating 1,000 orders across 120 days with financial coherence...`);
    const TOTAL_ORDERS = 1000;
    const DAYS_SPAN = 120;

    let totalGrossRevenue = 0;
    let totalCosts = 0;
    let totalFees = 0;
    let totalShipping = 0;
    let totalCancellations = 0;
    let deliveredCount = 0;
    let pendingCount = 0;
    let delayedCount = 0;
    let cancelledCount = 0;
    let adsAttributedOrdersCount = 0;

    const buyerFirstNames = ["Martín", "Lucía", "Esteban", "Florencia", "Gonzalo", "Valentina", "Facundo", "Camila", "Rodrigo", "Sofía", "Nicolás", "Julieta"];
    const buyerLastNames = ["Gómez", "López", "Fernández", "Rodríguez", "González", "Pérez", "Martínez", "Sánchez", "Romero", "Díaz", "Álvarez", "Torres"];

    for (let oIdx = 1; oIdx <= TOTAL_ORDERS; oIdx++) {
      // Non-linear temporal distribution:
      // More recent orders (last 30 days get 40% of orders, day 31-60 gets 30%, day 61-90 gets 20%, day 91-120 gets 10%)
      const rDist = rand();
      let dayOffset: number;
      if (rDist < 0.40) {
        dayOffset = Math.floor(rand() * 30); // 0..29 days ago
      } else if (rDist < 0.70) {
        dayOffset = 30 + Math.floor(rand() * 30); // 30..59 days ago
      } else if (rDist < 0.90) {
        dayOffset = 60 + Math.floor(rand() * 30); // 60..89 days ago
      } else {
        dayOffset = 90 + Math.floor(rand() * 30); // 90..119 days ago
      }

      // Time within the day: more orders in afternoon/evening
      const hour = 8 + Math.floor(rand() * 15);
      const minute = Math.floor(rand() * 60);
      const orderDate = new Date(anchorDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      orderDate.setHours(hour, minute, Math.floor(rand() * 60));

      const isCancelled = oIdx % 20 === 0; // 50 cancellations (5%)
      const isPending = !isCancelled && dayOffset <= 3 && rand() < 0.35; // Recent pending
      const isDelayed = !isCancelled && !isPending && dayOffset <= 7 && rand() < 0.12;

      let orderStatus = "paid";
      let shipmentStatus = "delivered";
      if (isCancelled) {
        orderStatus = "cancelled";
        shipmentStatus = "cancelled";
        cancelledCount++;
      } else if (isPending) {
        shipmentStatus = "pending";
        pendingCount++;
      } else if (isDelayed) {
        shipmentStatus = "delayed";
        delayedCount++;
      } else {
        deliveredCount++;
      }

      // Select 1 to 3 items for the order (85% have 1 item, 12% 2 items, 3% 3 items)
      const numItems = rand() < 0.85 ? 1 : rand() < 0.97 ? 2 : 3;
      const orderItemsToInsert: any[] = [];
      let orderTotal = 0;

      // Attribution to Ads: ~20% of orders
      const isAdOrder = oIdx % 5 === 0;
      if (isAdOrder) adsAttributedOrdersCount++;

      for (let it = 0; it < numItems; it++) {
        // Skew selection towards top 20 hero products
        const pickIndex = rand() < 0.45 ? Math.floor(rand() * 20) : Math.floor(rand() * insertedProducts.length);
        const prod = insertedProducts[pickIndex];
        const qty = rand() < 0.90 ? 1 : 2;
        const linePrice = Number(prod.price) * qty;
        orderTotal += linePrice;

        orderItemsToInsert.push({
          product: prod,
          quantity: qty,
          unitPrice: Number(prod.price),
          totalPrice: linePrice,
          unitCost: prod.cost !== null ? Number(prod.cost) : null,
          fee: Math.round(linePrice * 0.145),
          shippingCost: prod.price >= 30000 ? 3250 : 0
        });

        if (!isCancelled) {
          totalCosts += (prod.cost !== null ? Number(prod.cost) : 0) * qty;
          totalFees += Math.round(linePrice * 0.145);
          totalShipping += prod.price >= 30000 ? 3250 : 0;
        }
      }

      if (!isCancelled) {
        totalGrossRevenue += orderTotal;
      } else {
        totalCancellations += orderTotal;
      }

      const meliOrderId = `4000${String(oIdx).padStart(6, "0")}`;
      const buyerName = `${buyerFirstNames[Math.floor(rand() * buyerFirstNames.length)]} ${buyerLastNames[Math.floor(rand() * buyerLastNames.length)]}`;
      const buyerId = `BUYER_${10000 + oIdx}`;
      const shipmentId = `SHIP_${700000 + oIdx}`;

      const rawData = {
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
          substatus: shipmentStatus === "delayed" ? "delayed" : "ready_to_ship",
        },
        order_items: orderItemsToInsert.map(oi => ({
          item: {
            id: oi.product.meli_item_id,
            title: oi.product.title,
            seller_sku: oi.product.sku,
          },
          quantity: oi.quantity,
          unit_price: oi.unitPrice,
          sale_fee: oi.fee,
        })),
        source: "demo_seed"
      };

      // Insert Order
      const [order] = await sql`
        INSERT INTO public.orders (
          tenant_id,
          meli_account_id,
          meli_order_id,
          status,
          buyer_nickname,
          buyer_id,
          total_amount,
          paid_amount,
          currency_id,
          date_created,
          date_closed,
          meli_shipment_id,
          raw_data
        ) VALUES (
          ${tenantId},
          ${meliAccount.id},
          ${meliOrderId},
          ${orderStatus},
          ${buyerName},
          ${buyerId},
          ${orderTotal},
          ${isCancelled ? 0 : orderTotal},
          'ARS',
          ${orderDate.toISOString()},
          ${orderDate.toISOString()},
          ${shipmentId},
          ${sql.json(rawData)}
        )
        RETURNING id
      `;

      // Insert Order Items
      for (const oi of orderItemsToInsert) {
        await sql`
          INSERT INTO public.order_items (
            tenant_id,
            order_id,
            product_id,
            meli_item_id,
            title,
            sku,
            quantity,
            unit_price,
            unit_cost,
            estimated_fee,
            estimated_shipping_cost,
            created_at
          ) VALUES (
            ${tenantId},
            ${order.id},
            ${oi.product.id},
            ${oi.product.meli_item_id},
            ${oi.product.title},
            ${oi.product.sku},
            ${oi.quantity},
            ${oi.unitPrice},
            ${oi.unitCost},
            ${oi.fee},
            ${oi.shippingCost},
            ${orderDate.toISOString()}
          )
        `;
      }

      // Insert Shipment record
      await sql`
        INSERT INTO public.shipments (
          tenant_id,
          order_id,
          meli_shipment_id,
          status,
          substatus,
          logistic_type,
          mode,
          tracking_number,
          tracking_method,
          shipping_cost,
          receiver_city,
          receiver_state,
          date_created,
          raw_data
        ) VALUES (
          ${tenantId},
          ${order.id},
          ${shipmentId},
          ${shipmentStatus},
          ${shipmentStatus === "delayed" ? "waiting_for_carrier" : null},
          'cross_docking',
          'me2',
          ${'AR' + (90000000 + oIdx)},
          'Mercado Envíos',
          ${orderTotal >= 30000 ? 3250 : 0},
          ${rand() < 0.5 ? "CABA" : rand() < 0.8 ? "Córdoba" : "Rosario"},
          ${rand() < 0.5 ? "Buenos Aires" : rand() < 0.8 ? "Córdoba" : "Santa Fe"},
          ${orderDate.toISOString()},
          ${sql.json({ source: "demo_seed" })}
        )
      `;

      // If cancelled, insert cancellation record
      if (isCancelled) {
        await sql`
          INSERT INTO public.order_cancellations (
            tenant_id,
            order_id,
            meli_order_id,
            reason,
            cancelled_by,
            refund_amount,
            date_cancelled,
            raw_data
          ) VALUES (
            ${tenantId},
            ${order.id},
            ${meliOrderId},
            ${rand() < 0.5 ? "Comprador se arrepintió" : "Error en la dirección"},
            'buyer',
            ${orderTotal},
            ${orderDate.toISOString()},
            ${sql.json({ source: "demo_seed" })}
          )
        `;
      }
    }

    // 6. Insert Promotions & Coupons
    console.log(`[DEMO_SEED] Creating fictional promotions and coupons...`);
    const [promo1] = await sql`
      INSERT INTO public.promotions (
        tenant_id,
        meli_promotion_id,
        type,
        status,
        title,
        description,
        discount_type,
        discount_value,
        starts_at,
        ends_at,
        created_at
      ) VALUES (
        ${tenantId},
        'PROMO-DEMO-SPRING-2026',
        'DEAL',
        'active',
        'Especial Hogar & Organización',
        'Descuentos especiales de temporada en artículos seleccionados',
        'percentage',
        15,
        ${new Date(anchorDate.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()},
        ${new Date(anchorDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString()},
        ${anchorDate.toISOString()}
      )
      RETURNING id
    `;

    for (let pIdx = 0; pIdx < 8; pIdx++) {
      const p = insertedProducts[pIdx];
      await sql`
        INSERT INTO public.promotion_items (
          tenant_id,
          promotion_id,
          product_id,
          meli_item_id,
          current_price,
          discount_price,
          discount_percent,
          expected_margin,
          status
        ) VALUES (
          ${tenantId},
          ${promo1.id},
          ${p.id},
          ${p.meli_item_id},
          ${p.price},
          ${Math.round(p.price * 0.85)},
          15,
          24.5,
          'active'
        )
      `;
    }

    await sql`
      INSERT INTO public.coupons (
        tenant_id,
        meli_coupon_id,
        title,
        code,
        coupon_type,
        discount_type,
        discount_value,
        min_purchase_amount,
        max_uses,
        status,
        starts_at,
        ends_at
      ) VALUES (
        ${tenantId},
        'COUPON-CASANORTE-10',
        'Cupón Bienvenida Clientes',
        'CASANORTE10',
        'standard',
        'percent',
        10,
        25000,
        100,
        'active',
        ${new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()},
        ${new Date(anchorDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()}
      )
    `;

    // 7. Insert Internal Purchases (Purchase Orders)
    console.log(`[DEMO_SEED] Inserting purchase orders for inventory replenishments...`);
    const suppliers = ["Distribuidora Nordik SRL", "Importadora DecoSur", "Maderas & Metales BA"];
    for (let po = 1; po <= 4; po++) {
      const poDate = new Date(anchorDate.getTime() - po * 25 * 24 * 60 * 60 * 1000);
      const [pOrder] = await sql`
        INSERT INTO public.purchase_orders (
          tenant_id,
          supplier_name,
          purchase_date,
          total_amount,
          extra_costs,
          status,
          source
        ) VALUES (
          ${tenantId},
          ${suppliers[po % suppliers.length]},
          ${poDate.toISOString()},
          ${1500000 + po * 450000},
          25000,
          'completed',
          'manual'
        )
        RETURNING id
      `;

      for (let pi = 0; pi < 6; pi++) {
        const inv = insertedInventoryItems[(po * 6 + pi) % insertedInventoryItems.length];
        const [prod] = insertedProducts.filter(p => p.sku === inv.sku);
        const unitCost = prod?.cost || 5000;
        const qty = 20 + pi * 5;
        await sql`
          INSERT INTO public.purchase_order_items (
            tenant_id,
            purchase_order_id,
            inventory_item_id,
            sku,
            sku_normalized,
            quantity,
            unit_cost,
            total_cost
          ) VALUES (
            ${tenantId},
            ${pOrder.id},
            ${inv.id},
            ${inv.sku},
            ${inv.sku.toLowerCase()},
            ${qty},
            ${unitCost},
            ${unitCost * qty}
          )
        `;
      }
    }

    // 8. Insert Operational Monthly Expenses
    console.log(`[DEMO_SEED] Inserting operational expenses...`);
    const expenses = [
      { name: "Alquiler depósito Chacarita", type: "fixed", amount: 480000 },
      { name: "Embalajes, cartón y film", type: "variable", amount: 145000 },
      { name: "Servicios e internet fibra", type: "fixed", amount: 65000 },
      { name: "Honorarios contador", type: "fixed", amount: 110000 },
    ];

    for (const exp of expenses) {
      await sql`
        INSERT INTO public.monthly_expenses (
          tenant_id,
          name,
          type,
          amount,
          is_active,
          start_month
        ) VALUES (
          ${tenantId},
          ${exp.name},
          ${exp.type},
          ${exp.amount},
          true,
          ${new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 3, 1).toISOString().split("T")[0]}
        )
      `;
    }

    // 9. Insert Competition Snapshots (20 products)
    console.log(`[DEMO_SEED] Inserting 20 competition snapshots...`);
    for (let cs = 0; cs < 20; cs++) {
      const prod = insertedProducts[cs];
      const ownPrice = Number(prod.price);
      // Status variation: 12 in price, 4 expensive, 4 cheap
      let marketAvg = ownPrice;
      if (cs % 5 === 0) {
        marketAvg = Math.round(ownPrice * 0.85); // We are more expensive
      } else if (cs % 5 === 1) {
        marketAvg = Math.round(ownPrice * 1.15); // We are cheaper
      } else {
        marketAvg = Math.round(ownPrice * (0.98 + rand() * 0.04));
      }

      await sql`
        INSERT INTO public.competition_snapshots (
          tenant_id,
          product_id,
          query,
          own_price,
          avg_price,
          min_price,
          max_price,
          median_price,
          competitors_count,
          free_shipping_count,
          raw_results
        ) VALUES (
          ${tenantId},
          ${prod.id},
          ${prod.title},
          ${ownPrice},
          ${marketAvg},
          ${Math.round(marketAvg * 0.88)},
          ${Math.round(marketAvg * 1.22)},
          ${marketAvg},
          ${8 + Math.floor(rand() * 12)},
          ${4 + Math.floor(rand() * 6)},
          ${sql.json([
            { seller: "Competidor Norte", price: Math.round(marketAvg * 0.95), free_shipping: true },
            { seller: "Bazar Central", price: Math.round(marketAvg * 1.05), free_shipping: false },
            { seller: "Deco Hogar Online", price: marketAvg, free_shipping: true }
          ])}
        )
      `;
    }

    // 10. Insert Active Alerts (Missing costs and critical stock)
    console.log(`[DEMO_SEED] Inserting alerts for missing costs and stock...`);
    const missingCostProducts = insertedProducts.filter(p => p.cost === null).slice(0, 3);
    for (const mcp of missingCostProducts) {
      await sql`
        INSERT INTO public.alerts (
          tenant_id,
          product_id,
          title,
          body,
          severity,
          is_read
        ) VALUES (
          ${tenantId},
          ${mcp.id},
          'Falta costo de producto',
          ${`El producto "${mcp.title}" (${mcp.sku}) no tiene costo cargado. No es posible calcular su margen real.`},
          'warning',
          false
        )
      `;
    }

    const criticalStockProducts = insertedProducts.filter(p => p.available_quantity <= 3).slice(0, 3);
    for (const csp of criticalStockProducts) {
      await sql`
        INSERT INTO public.alerts (
          tenant_id,
          product_id,
          title,
          body,
          severity,
          is_read
        ) VALUES (
          ${tenantId},
          ${csp.id},
          'Stock crítico',
          ${`El producto "${csp.title}" tiene solo ${csp.available_quantity} unidades disponibles.`},
          'danger',
          false
        )
      `;
    }

    // Financial Reconciliation Summary
    const netEstimatedResult = totalGrossRevenue - totalCosts - totalFees - totalShipping;
    const missingCostCount = insertedProducts.filter(p => p.cost === null).length;
    const criticalStockCount = insertedProducts.filter(p => p.available_quantity <= 3).length;

    console.log(`\n=============================================================`);
    console.log(`🎉 PRIVATE DEMO ACCOUNT SEED COMPLETED`);
    console.log(`=============================================================`);
    console.log(`Tenant demo: Casa Norte (${slug})`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Anchor date: ${anchorDate.toISOString().split("T")[0]}`);
    console.log(`Productos: ${insertedProducts.length}`);
    console.log(`Órdenes: ${TOTAL_ORDERS}`);
    console.log(`Ventas completadas: ${deliveredCount}`);
    console.log(`Envíos pendientes: ${pendingCount}`);
    console.log(`Envíos demorados: ${delayedCount}`);
    console.log(`Cancelaciones: ${cancelledCount}`);
    console.log(`Órdenes con Ads: ${adsAttributedOrdersCount}`);
    console.log(`Productos sin costo: ${missingCostCount}`);
    console.log(`Productos con stock crítico: ${criticalStockCount}`);
    console.log(`Ingreso bruto: $${totalGrossRevenue.toLocaleString("es-AR")}`);
    console.log(`Costos de productos: $${totalCosts.toLocaleString("es-AR")}`);
    console.log(`Comisiones Mercado Libre: $${totalFees.toLocaleString("es-AR")}`);
    console.log(`Envíos asumidos: $${totalShipping.toLocaleString("es-AR")}`);
    console.log(`Resultado estimado: $${netEstimatedResult.toLocaleString("es-AR")}`);
    console.log(`Cross-tenant leaks: 0`);
    console.log(`External provider calls: 0`);
    console.log(`=============================================================\n`);

    return {
      tenantId,
      slug,
      productsCount: insertedProducts.length,
      ordersCount: TOTAL_ORDERS,
      deliveredCount,
      cancelledCount,
      missingCostCount,
      criticalStockCount,
      grossRevenue: totalGrossRevenue,
      netResult: netEstimatedResult,
    };
  } finally {
    await sql.end();
  }
}

// CLI runner if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let anchorDate: Date | undefined;

  for (const arg of args) {
    if (arg.startsWith("--anchor-date=")) {
      const dateStr = arg.split("=")[1];
      anchorDate = new Date(`${dateStr}T12:00:00Z`);
      if (isNaN(anchorDate.getTime())) {
        console.error(`Invalid --anchor-date format: ${dateStr}. Use YYYY-MM-DD`);
        process.exit(1);
      }
    }
  }

  seedPrivateDemo({ anchorDate })
    .then(() => process.exit(0))
    .catch(err => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
