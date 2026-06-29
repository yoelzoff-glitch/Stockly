import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeminiModel } from "@/lib/ai/gemini";
import { meliFetch } from "@/services/meli/client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.tenant_id) {
      return NextResponse.json({ error: "No se encontró el inquilino (tenant) para el usuario." }, { status: 400 });
    }

    const tenantId = profile.tenant_id;

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Extract Item ID or Catalog Product ID from Mercado Libre URL
    // We require 8 to 12 digits so we don't match short numbers in titles (like "plata-925")
    const match = url.match(/(ML[A-Z]{1,2})[-_]?(\d{8,12})/i);
    if (!match) {
      return NextResponse.json({ 
        error: "URL inválida. Asegúrate de ingresar un enlace válido de una publicación de Mercado Libre." 
      }, { status: 400 });
    }

    const matchedPrefix = match[1].toUpperCase();
    const digits = match[2];
    
    // Candidates to try: e.g. MLAU3911600852 and MLA3911600852
    const prefixesToTry = [matchedPrefix];
    if (matchedPrefix.length === 4) {
      prefixesToTry.push(matchedPrefix.substring(0, 3));
    }

    let itemData: any = null;
    let isCatalogProduct = false;
    let successfulId = "";

    // Try fetching as item first, then as catalog product
    for (const prefix of prefixesToTry) {
      const candidateId = `${prefix}${digits}`;
      
      // 1. Try as standard Item
      try {
        const res = await meliFetch({
          tenantId,
          endpoint: `/items/${candidateId}`
        });
        if (res && res.id) {
          itemData = res;
          successfulId = candidateId;
          break;
        }
      } catch (e) {
        // ignore and try next
      }

      // 2. Try as Catalog Product
      try {
        const res = await meliFetch({
          tenantId,
          endpoint: `/products/${candidateId}`
        });
        if (res && res.id) {
          itemData = res;
          successfulId = candidateId;
          isCatalogProduct = true;
          break;
        }
      } catch (e) {
        // ignore and try next
      }
    }

    if (!itemData || !itemData.id) {
      return NextResponse.json({ 
        error: `No se pudo obtener la publicación de Mercado Libre. Verifica que el ID extraído (${matchedPrefix}${digits}) sea válido y que tu cuenta de Mercado Libre esté conectada.` 
      }, { status: 404 });
    }

    // Normalize fields (catalog products have slightly different structures than items)
    const title = itemData.title || itemData.name || "Producto de Catálogo";
    const price = itemData.price || itemData.buy_box_winner?.price || 0;
    const originalPrice = itemData.original_price || itemData.buy_box_winner?.original_price || null;
    const availableQuantity = itemData.available_quantity || itemData.buy_box_winner?.available_quantity || "No especificado";
    const soldQuantity = itemData.sold_quantity || "No especificado";
    const thumbnail = itemData.thumbnail || itemData.pictures?.[0]?.url || itemData.secure_thumbnail || "";

    // 2. Fetch Description (only available for items, not directly for catalog products)
    let descriptionText = "";
    if (!isCatalogProduct) {
      try {
        const descData = await meliFetch({
          tenantId,
          endpoint: `/items/${successfulId}/description`
        });
        descriptionText = descData?.plain_text || "";
      } catch (e) {
        console.warn("Could not fetch item description", e);
      }
    }

    // 3. Fetch Seller Details
    let sellerData = null;
    const sellerId = itemData.seller_id || itemData.buy_box_winner?.seller_id;
    if (sellerId) {
      try {
        sellerData = await meliFetch({
          tenantId,
          endpoint: `/users/${sellerId}`
        });
      } catch (e) {
        console.warn("Could not fetch seller details", e);
      }
    }

    // Format listing type
    const listingTypeId = itemData.listing_type_id || itemData.buy_box_winner?.listing_type_id;
    const listingType = listingTypeId === "gold_pro" 
      ? "Premium (Ofrece Cuotas sin Interés)" 
      : listingTypeId === "gold_special" 
        ? "Clásica (Cuotas con interés estándar)" 
        : "Estándar / Exposición Baja";

    // Format shipping
    const shipping = itemData.shipping || itemData.buy_box_winner?.shipping;
    const shippingInfo = shipping?.free_shipping 
      ? "Envío Gratis a cargo del vendedor" 
      : "Envío a cargo del comprador";

    // Format reputation
    const repLevel = sellerData?.seller_reputation?.level_id || "Sin reputación";
    const powerSeller = sellerData?.seller_reputation?.power_seller_status || "Ninguno";
    const reputationDisplay = powerSeller !== "Ninguno" 
      ? `MercadoLíder ${powerSeller.replace(/_/g, " ")}` 
      : `Reputación Nivel ${repLevel}`;

    // Prepare data for Gemini
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
      description: descriptionText.substring(0, 1500), // limit length
      attributes: itemData.attributes?.slice(0, 15).map((a: any) => ({ name: a.name, value: a.value_name })) || [],
      is_catalog: isCatalogProduct
    };

    // 4. Call Gemini to analyze
    const model = getGeminiModel("gemini-1.5-flash");
    
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

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    const analysisResult = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      data: {
        ...analysisResult,
        permalink: itemData.permalink || url,
        thumbnail: thumbnail.replace("-I.jpg", "-O.jpg")
      }
    });

  } catch (error: any) {
    console.error("Error in competitor analysis:", error);
    return NextResponse.json({ 
      error: "Error interno al procesar el análisis de la competencia. Por favor intenta de nuevo." 
    }, { status: 500 });
  }
}
