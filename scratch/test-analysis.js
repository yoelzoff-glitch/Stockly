const { createAdminClient } = require("../src/lib/supabase/admin");
const { meliFetch } = require("../src/services/meli/client");
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function main() {
  const url = "https://www.mercadolibre.com.ar/collar-corazon-cristal-swarovski-plata-925-mujer-rosa/p/MLA66075336#polycard_client=search-desktop&be_origin=backend&search_layout=grid&position=3&type=product&tracking_id=882b3063-5c2b-477a-998f-4c0994481cd1&wid=MLA1847440869&sid=search";
  
  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("meli_accounts").select("tenant_id").limit(1);
  const tenantId = accounts[0].tenant_id;
  
  console.log("Using tenant ID:", tenantId);

  // Extract Item ID
  const match = url.match(/(ML[A-Z]{1,2})[-_]?(\d{8,12})/i);
  if (!match) {
    console.log("No match found");
    return;
  }
  const matchedPrefix = match[1].toUpperCase();
  const digits = match[2];
  console.log(`Matched: ${matchedPrefix} and ${digits}`);

  const prefixesToTry = [matchedPrefix];
  if (matchedPrefix.length === 4) {
    prefixesToTry.push(matchedPrefix.substring(0, 3));
  }

  let itemData = null;
  let isCatalogProduct = false;
  let successfulId = "";

  for (const prefix of prefixesToTry) {
    const candidateId = `${prefix}${digits}`;
    try {
      console.log(`Trying item: ${candidateId}`);
      itemData = await meliFetch({
        tenantId,
        endpoint: `/items/${candidateId}`
      });
      if (itemData && itemData.id) {
        successfulId = candidateId;
        break;
      }
    } catch (e) {
      console.log(`Item fail: ${e.message}`);
    }

    try {
      console.log(`Trying product: ${candidateId}`);
      itemData = await meliFetch({
        tenantId,
        endpoint: `/products/${candidateId}`
      });
      if (itemData && itemData.id) {
        successfulId = candidateId;
        isCatalogProduct = true;
        break;
      }
    } catch (e) {
      console.log(`Product fail: ${e.message}`);
    }
  }

  if (!itemData) {
    console.log("Could not fetch item/product data");
    return;
  }

  console.log("Successfully fetched data! ID:", itemData.id);
  console.log("Is catalog:", isCatalogProduct);

  const title = itemData.title || itemData.name || "Producto de Catálogo";
  const price = itemData.price || itemData.buy_box_winner?.price || 0;
  const originalPrice = itemData.original_price || itemData.buy_box_winner?.original_price || null;
  const availableQuantity = itemData.available_quantity || itemData.buy_box_winner?.available_quantity || "No especificado";
  const soldQuantity = itemData.sold_quantity || "No especificado";
  const thumbnail = itemData.thumbnail || itemData.pictures?.[0]?.url || itemData.secure_thumbnail || "";

  let descriptionText = "";
  if (!isCatalogProduct) {
    try {
      const descData = await meliFetch({
        tenantId,
        endpoint: `/items/${successfulId}/description`
      });
      descriptionText = descData?.plain_text || "";
    } catch (e) {
      console.log("Description fail:", e.message);
    }
  }

  let sellerData = null;
  const sellerId = itemData.seller_id || itemData.buy_box_winner?.seller_id;
  if (sellerId) {
    try {
      sellerData = await meliFetch({
        tenantId,
        endpoint: `/users/${sellerId}`
      });
    } catch (e) {
      console.log("Seller fail:", e.message);
    }
  }

  const listingTypeId = itemData.listing_type_id || itemData.buy_box_winner?.listing_type_id;
  const listingType = listingTypeId === "gold_pro" 
    ? "Premium (Ofrece Cuotas sin Interés)" 
    : listingTypeId === "gold_special" 
      ? "Clásica (Cuotas con interés estándar)" 
      : "Estándar / Exposición Baja";

  const shipping = itemData.shipping || itemData.buy_box_winner?.shipping;
  const shippingInfo = shipping?.free_shipping 
    ? "Envío Gratis a cargo del vendedor" 
    : "Envío a cargo del comprador";

  const repLevel = sellerData?.seller_reputation?.level_id || "Sin reputación";
  const powerSeller = sellerData?.seller_reputation?.power_seller_status || "Ninguno";
  const reputationDisplay = powerSeller !== "Ninguno" 
    ? `MercadoLíder ${powerSeller.replace(/_/g, " ")}` 
    : `Reputación Nivel ${repLevel}`;

  const competitorPayload = {
    title,
    price,
    original_price: originalPrice,
    available_quantity: availableQuantity,
    sold_quantity: soldQuantity,
    listing_type: listingType,
    free_shipping: shipping?.free_shipping || false,
    logistic_type: shipping?.logistic_type || "No especificado",
    seller_nickname: sellerData?.nickname || "Anónimo",
    seller_reputation: reputationDisplay,
    description: descriptionText.substring(0, 1500),
    attributes: itemData.attributes?.slice(0, 15).map((a) => ({ name: a.name, value: a.value_name })) || [],
    is_catalog: isCatalogProduct
  };

  console.log("Competitor payload prepared:", JSON.stringify(competitorPayload, null, 2));

  // Test Gemini call
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY found, skipping Gemini call");
    return;
  }

  console.log("Calling Gemini...");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
  Actúa como un analista experto en E-commerce y Mercado Libre de Latinoamérica.
  Analiza la siguiente publicación de la competencia y proporciona un análisis estratégico detallado estructurado en JSON.

  Datos de la Publicación Competidora:
  ${JSON.stringify(competitorPayload, null, 2)}

  El JSON devuelto DEBE seguir estrictamente esta estructura y todos los campos deben ser en español:
  {
    "title": "Título analizado",
    "price": precio_numero,
    "listingType": "Clásica o Premium",
    "shipping": "Detalle del envío",
    "estimatedSales": "Estimación de ventas del competidor",
    "reputation": "Nivel de reputación del vendedor",
    "analysis": {
      "strengths": ["Punto fuerte 1", "Punto fuerte 2", ...],
      "weaknesses": ["Punto débil 1", "Punto débil 2", ...],
      "opportunities": ["Oportunidad para ganarle 1", "Oportunidad para ganarle 2", ...]
    },
    "pricingStrategy": "Análisis detallado de su estrategia de precio, financiamiento en cuotas y envío gratis.",
    "actionPlan": [
      "Paso 1 del plan de acción para superarlo",
      "Paso 2 del plan de acción para superarlo",
      "Paso 3 del plan de acción para superarlo"
    ]
  }
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    console.log("Gemini response:", result.response.text());
  } catch (e) {
    console.log("Gemini fail:", e.message);
  }
}

main().catch(console.error);
