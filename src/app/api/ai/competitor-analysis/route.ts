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

    // Check if Gemini API Key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: "La clave de API de Gemini (GEMINI_API_KEY) no está configurada en el servidor. Asegúrate de haberla agregado en las variables de entorno de Vercel y haber redesplegado la aplicación." 
      }, { status: 500 });
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

    // 1. Extract Item ID or Catalog Product ID
    let itemId = "";
    
    // Check if there is a 'wid' parameter in the URL (which points to the specific listing in catalog pages)
    const widMatch = url.match(/[?&#]wid=(ML[A-Z]{0,2}\d{8,12})/i);
    if (widMatch) {
      itemId = widMatch[1].toUpperCase();
    } else {
      // Extract standard ID (require 8 to 12 digits so we don't match short numbers in titles like "plata-925")
      const match = url.match(/(ML[A-Z]{1,2})[-_]?(\d{8,12})/i);
      if (!match) {
        return NextResponse.json({ 
          error: "URL inválida. Asegúrate de ingresar un enlace válido de una publicación de Mercado Libre." 
        }, { status: 400 });
      }
      itemId = `${match[1].toUpperCase()}${match[2]}`;
    }

    const prefixesToTry = [itemId];
    if (itemId.startsWith("MLAU")) {
      prefixesToTry.push("MLA" + itemId.substring(4));
    }

    let itemData: any = null;
    let successfulId = "";
    let isCatalogProduct = false;
    const fetchErrors: string[] = [];

    // Try fetching the listing details
    for (const idToTry of prefixesToTry) {
      // A. Try as standard Item
      try {
        const res = await meliFetch({
          tenantId,
          endpoint: `/items/${idToTry}`
        });
        if (res && res.id) {
          itemData = res;
          successfulId = idToTry;
          break;
        }
      } catch (e: any) {
        fetchErrors.push(`[Ítem ${idToTry}]: ${e.message || e}`);
      }

      // B. Try via Search API (extremely robust fallback that avoids 403 Forbidden on competitor items)
      try {
        const siteId = idToTry.substring(0, 3).toUpperCase();
        const searchRes = await meliFetch({
          tenantId,
          endpoint: `/sites/${siteId}/search?q=${idToTry}`
        });
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          const foundItem = searchRes.results.find((r: any) => r.id === idToTry);
          if (foundItem) {
            itemData = foundItem;
            successfulId = idToTry;
            break;
          }
        }
      } catch (e: any) {
        fetchErrors.push(`[Búsqueda ${idToTry}]: ${e.message || e}`);
      }

      // C. Try as Catalog Product, and if successful, resolve to its Buy Box winner item
      try {
        const res = await meliFetch({
          tenantId,
          endpoint: `/products/${idToTry}`
        });
        if (res && res.id) {
          const buyBoxItemId = res.buy_box_winner?.item_id;
          if (buyBoxItemId) {
            try {
              // Fetch the actual item of the Buy Box winner (try standard then search)
              try {
                const itemRes = await meliFetch({
                  tenantId,
                  endpoint: `/items/${buyBoxItemId}`
                });
                if (itemRes && itemRes.id) {
                  itemData = itemRes;
                  successfulId = buyBoxItemId;
                  break;
                }
              } catch (e: any) {
                // Fallback to search for the buy box winner item
                const siteId = buyBoxItemId.substring(0, 3).toUpperCase();
                const searchRes = await meliFetch({
                  tenantId,
                  endpoint: `/sites/${siteId}/search?q=${buyBoxItemId}`
                });
                const foundItem = searchRes?.results?.find((r: any) => r.id === buyBoxItemId);
                if (foundItem) {
                  itemData = foundItem;
                  successfulId = buyBoxItemId;
                  break;
                }
                throw e; // throw if both failed
              }
            } catch (e: any) {
              fetchErrors.push(`[Catálogo ${idToTry} -> Ganador ${buyBoxItemId}]: ${e.message || e}`);
            }
          }
          // Fallback to the product details if no buy box winner item could be fetched
          itemData = res;
          successfulId = idToTry;
          isCatalogProduct = true;
          break;
        }
      } catch (e: any) {
        fetchErrors.push(`[Catálogo ${idToTry}]: ${e.message || e}`);
      }
    }

    if (!itemData || !itemData.id) {
      const detailedError = fetchErrors.length > 0 
        ? `No se pudo obtener la publicación de Mercado Libre. Detalles de errores: ${fetchErrors.join(" | ")}`
        : "No se pudo obtener la publicación de Mercado Libre. Verifica que el enlace sea válido y que tu cuenta de Mercado Libre esté conectada.";
      return NextResponse.json({ error: detailedError }, { status: 404 });
    }

    // Normalize fields
    const title = itemData.title || itemData.name || "Producto de Catálogo";
    const price = itemData.price || itemData.buy_box_winner?.price || 0;
    const originalPrice = itemData.original_price || itemData.buy_box_winner?.original_price || null;
    const availableQuantity = itemData.available_quantity || itemData.buy_box_winner?.available_quantity || "No especificado";
    const soldQuantity = itemData.sold_quantity !== undefined ? itemData.sold_quantity : (itemData.buy_box_winner?.sold_quantity || "No especificado");
    const thumbnail = itemData.thumbnail || itemData.pictures?.[0]?.url || itemData.secure_thumbnail || "";

    // 2. Fetch Description
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
    const sellerId = itemData.seller_id || itemData.seller?.id || itemData.buy_box_winner?.seller_id;
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
      description: descriptionText.substring(0, 1500),
      attributes: itemData.attributes?.slice(0, 15).map((a: any) => ({ name: a.name, value: a.value_name })) || [],
      is_catalog: isCatalogProduct
    };

    // 4. Call Gemini to analyze
    let analysisResult: any;
    try {
      const model = getGeminiModel("gemini-2.5-flash");
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
      analysisResult = JSON.parse(responseText);
    } catch (geminiError: any) {
      console.error("Error calling Gemini API:", geminiError);
      return NextResponse.json({ 
        error: `Error al conectar con la Inteligencia Artificial (Gemini): ${geminiError.message || "Por favor verifica que la clave de API sea válida."}` 
      }, { status: 502 });
    }

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
      error: `Error interno en el servidor: ${error.message || "Por favor intenta de nuevo."}` 
    }, { status: 500 });
  }
}
