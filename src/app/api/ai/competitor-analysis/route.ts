import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/ai/gemini";
import { meliFetch } from "@/services/meli/client";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

export async function POST(request: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(request);
    correlationId = context.correlationId;
    const tenantId = context.tenantId;

    // Check if Gemini API Key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: "La clave de API de Gemini (GEMINI_API_KEY) no está configurada en el servidor. Asegúrate de haberla agregado en las variables de entorno de Vercel y haber redesplegado la aplicación." 
      }, { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }
    const { action = "all", url } = body || {};

    // --- STEP 1: RESOLVE URL ---
    if (action === "resolve") {
      if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }

      // Extract Item ID or Catalog Product ID
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

      let itemData: any = null;
      let successfulId = "";
      let isCatalogProduct = false;
      const fetchErrors: string[] = [];

      const hasWid = /[?&]wid=/i.test(url);
      const isCatalogUrl = !hasWid && (itemId.startsWith("MLAU") || url.includes("/p/") || url.includes("/up/"));

      // A. If it is a Catalog Product
      if (isCatalogUrl) {
        const idsToTry = [itemId];
        if (itemId.startsWith("MLAU")) {
          idsToTry.push("MLA" + itemId.substring(4));
        }

        for (const idToTry of idsToTry) {
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
      } else {
        // B. If it is a standard Item ID
        // 1. Try as standard Item
        try {
          const res = await meliFetch({
            tenantId,
            endpoint: `/items/${itemId}`
          });
          if (res && res.id) {
            itemData = res;
            successfulId = itemId;
          }
        } catch (e: any) {
          fetchErrors.push(`[Ítem ${itemId}]: ${e.message || e}`);
        }

        // 2. Try via Search API as fallback (only if the direct fetch failed)
        if (!itemData) {
          try {
            const siteId = itemId.substring(0, 3).toUpperCase();
            const searchRes = await meliFetch({
              tenantId,
              endpoint: `/sites/${siteId}/search?q=${itemId}`
            });
            if (searchRes && searchRes.results && searchRes.results.length > 0) {
              const foundItem = searchRes.results.find((r: any) => r.id === itemId);
              if (foundItem) {
                itemData = foundItem;
                successfulId = itemId;
              }
            }
          } catch (e: any) {
            fetchErrors.push(`[Búsqueda ${itemId}]: ${e.message || e}`);
          }
        }
      }

      if (!itemData || !itemData.id) {
        const detailedError = fetchErrors.length > 0 
          ? `No se pudo obtener la publicación de Mercado Libre. Detalles de errores: ${fetchErrors.join(" | ")}`
          : "No se pudo obtener la publicación de Mercado Libre. Verifica que el enlace sea válido y que tu cuenta de Mercado Libre esté conectada.";
        return NextResponse.json({ error: detailedError }, { status: 404 });
      }

      // Fetch Seller Details
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

      return NextResponse.json({
        success: true,
        data: {
          id: successfulId,
          itemData,
          sellerData,
          isCatalogProduct
        }
      });
    }

    // --- STEP 2: ANALYZE WITH GEMINI ---
    if (action === "analyze" || action === "all") {
      let resolvedItemData = body.itemData;
      let resolvedSellerData = body.sellerData;
      let descriptionText = body.description || "";
      let isCatalogProduct = body.isCatalogProduct || false;
      let successfulId = body.id || resolvedItemData?.id;

      if (!resolvedItemData) {
        return NextResponse.json({ error: "itemData is required for analysis" }, { status: 400 });
      }

      // Normalize fields
      const title = resolvedItemData.title || resolvedItemData.name || "Producto de Catálogo";
      const price = resolvedItemData.price || resolvedItemData.buy_box_winner?.price || 0;
      const originalPrice = resolvedItemData.original_price || resolvedItemData.buy_box_winner?.original_price || null;
      const availableQuantity = resolvedItemData.available_quantity || resolvedItemData.buy_box_winner?.available_quantity || "No especificado";
      const soldQuantity = resolvedItemData.sold_quantity !== undefined ? resolvedItemData.sold_quantity : (resolvedItemData.buy_box_winner?.sold_quantity || "No especificado");
      const thumbnail = resolvedItemData.thumbnail || resolvedItemData.pictures?.[0]?.url || resolvedItemData.secure_thumbnail || "";

      // Format listing type
      const listingTypeId = resolvedItemData.listing_type_id || resolvedItemData.buy_box_winner?.listing_type_id;
      const listingType = listingTypeId === "gold_pro" 
        ? "Premium (Ofrece Cuotas sin Interés)" 
        : listingTypeId === "gold_special" 
          ? "Clásica (Cuotas con interés estándar)" 
          : "Estándar / Exposición Baja";

      // Format shipping
      const shipping = resolvedItemData.shipping || resolvedItemData.buy_box_winner?.shipping;
      const shippingInfo = shipping?.free_shipping 
        ? "Envío Gratis a cargo del vendedor" 
        : "Envío a cargo del comprador";

      // Format reputation
      const repLevel = resolvedSellerData?.seller_reputation?.level_id || "Sin reputación";
      const powerSeller = resolvedSellerData?.seller_reputation?.power_seller_status || "Ninguno";
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
        seller_nickname: resolvedSellerData?.nickname || "Anónimo",
        seller_reputation: reputationDisplay,
        description: descriptionText.substring(0, 2500),
        attributes: resolvedItemData.attributes?.slice(0, 15).map((a: any) => ({ name: a.name, value: a.value_name })) || [],
        is_catalog: isCatalogProduct
      };

      // Call Gemini to analyze
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
          permalink: resolvedItemData.permalink || url,
          thumbnail: thumbnail.replace("-I.jpg", "-O.jpg")
        }
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    if (error?.name === "TenantAuthError" || error?.statusCode === 401 || error?.statusCode === 403) {
      return toAuthErrorResponse(error, correlationId);
    }
    return NextResponse.json({ 
      error: `Error interno en el servidor: ${error.message || "Por favor intenta de nuevo."}` 
    }, { status: 500, headers: correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {} });
  }
}
