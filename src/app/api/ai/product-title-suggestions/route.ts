import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/ai/openai";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";
import { incrementAIUsage } from "@/services/billing/checkLimits";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.tenant_id) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
    }

    const { product_id } = await req.json();

    if (!product_id) {
      return NextResponse.json({ error: "El ID del producto es requerido" }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("title, sku, category_id, price, raw_data")
      .eq("id", product_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Extract context for the prompt
    const context = {
      title: product.title,
      sku: product.sku,
      category_id: product.category_id,
      price: product.price,
      description: product.raw_data?.description || "",
      attributes: product.raw_data?.attributes || [],
    };

    const prompt = `Sos un experto en optimización de títulos para Mercado Libre Argentina.
Generá entre 5 y 8 alternativas de título para esta publicación.

Reglas:
- máximo 60 caracteres
- español argentino neutro
- sin emojis
- sin inventar datos
- usar palabras clave buscables
- priorizar claridad y conversión
- no repetir títulos similares
- devolver solo JSON válido con esta forma:
{
  "suggestions": [
    { "title": "...", "reason": "..." }
  ]
}

Datos del producto:
Título actual: ${context.title}
SKU: ${context.sku || 'N/A'}
Categoría: ${context.category_id || 'N/A'}
Precio: $${context.price}
Descripción: ${JSON.stringify(context.description).substring(0, 1000)}
Atributos: ${JSON.stringify(context.attributes).substring(0, 1000)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a specialized e-commerce assistant." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const resultText = completion.choices[0]?.message?.content || '{"suggestions": []}';
    let resultJson;
    
    try {
      resultJson = JSON.parse(resultText);
    } catch (e) {
      logger.error("Error parsing OpenAI response for title suggestions", "AI_SUGGESTIONS");
      return NextResponse.json({ error: "Error procesando las sugerencias de la IA" }, { status: 500 });
    }

    // Registrar 5 consultas de IA por generar múltiples sugerencias complejas
    await incrementAIUsage(profile.tenant_id, 5);

    return NextResponse.json(resultJson, { status: 200 });
  } catch (error: any) {
    logger.error(new AppError("OPENAI_ERROR", error.message, 500), "AI_TITLE_SUGGESTIONS");
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
