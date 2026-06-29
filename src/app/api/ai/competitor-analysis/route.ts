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

    // Extract Item ID from Mercado Libre URL
    const match = url.match(/([A-Z]{3})[-_]?(\d+)/i);
    if (!match) {
      return NextResponse.json({ 
        error: "URL inválida. Asegúrate de ingresar un enlace válido de una publicación de Mercado Libre." 
      }, { status: 400 });
    }

    const itemId = `${match[1].toUpperCase()}${match[2]}`;

    // 1. Fetch Item Details from Mercado Libre API using authenticated client
    let itemData: any;
    try {
      itemData = await meliFetch({
        tenantId,
        endpoint: `/items/${itemId}`
      });
    } catch (e: any) {
      console.error("Error fetching item from Meli:", e);
      return NextResponse.json({ 
        error: `No se pudo obtener la publicación de Mercado Libre. Verifica que el ID ${itemId} sea correcto y que tu cuenta de Mercado Libre esté conectada.` 
      }, { status: 404 });
    }

    if (!itemData || !itemData.id) {
      return NextResponse.json({ 
        error: `No se pudo obtener la publicación de Mercado Libre.` 
      }, { status: 404 });
    }

    // 2. Fetch Description
    let descriptionText = "";
    try {
      const descData = await meliFetch({
        tenantId,
        endpoint: `/items/${itemId}/description`
      });
      descriptionText = descData?.plain_text || "";
    } catch (e) {
      console.warn("Could not fetch item description", e);
    }

    // 3. Fetch Seller Details
    let sellerData = null;
    if (itemData.seller_id) {
      try {
        sellerData = await meliFetch({
          tenantId,
          endpoint: `/users/${itemData.seller_id}`
        });
      } catch (e) {
        console.warn("Could not fetch seller details", e);
      }
    }

    // Format listing type
    const listingType = itemData.listing_type_id === "gold_pro" 
      ? "Premium (Ofrece Cuotas sin Interés)" 
      : itemData.listing_type_id === "gold_special" 
        ? "Clásica (Cuotas con interés estándar)" 
        : "Estándar / Exposición Baja";

    // Format shipping
    const shippingInfo = itemData.shipping?.free_shipping 
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
      title: itemData.title,
      price: itemData.price,
      original_price: itemData.original_price,
      available_quantity: itemData.available_quantity,
      sold_quantity: itemData.sold_quantity || "No especificado",
      listing_type: listingType,
      free_shipping: itemData.shipping?.free_shipping,
      logistic_type: itemData.shipping?.logistic_type,
      seller_nickname: sellerData?.nickname || "Anónimo",
      seller_reputation: reputationDisplay,
      description: descriptionText.substring(0, 1500), // limit length
      attributes: itemData.attributes?.slice(0, 15).map((a: any) => ({ name: a.name, value: a.value_name })) || []
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
        permalink: itemData.permalink,
        thumbnail: itemData.thumbnail?.replace("-I.jpg", "-O.jpg") || itemData.secure_thumbnail
      }
    });

  } catch (error: any) {
    console.error("Error in competitor analysis:", error);
    return NextResponse.json({ 
      error: "Error interno al procesar el análisis de la competencia. Por favor intenta de nuevo." 
    }, { status: 500 });
  }
}
