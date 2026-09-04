import { NextResponse } from "next/server";
import { openai } from "@/lib/ai/openai";
import { preparePriceChangeAction, prepareStockChangeAction, prepareStatusChangeAction } from "@/actions/product-command-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { consumeQuota } from "@/lib/billing/quotaService";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";

export async function POST(request: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(request);
    correlationId = context.correlationId;
    const tenantId = context.tenantId;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const { product_id, message } = body || {};

    if (!product_id || typeof product_id !== "string" || !message || typeof message !== "string") {
      return NextResponse.json(
        { error: "product_id and message are required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Load Product Context with strict tenant check (IDOR protection)
    const adminSupabase = createAdminClient();
    const { data: product, error: productError } = await adminSupabase
      .from("products")
      .select("*")
      .eq("id", product_id.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Save User Message
    const { error: inboundError } = await adminSupabase.from("messages").insert({
      tenant_id: tenantId,
      product_id: product.id,
      channel: "whatsapp", // Mapped to whatsapp due to database enum constraints
      direction: "inbound",
      text: message.trim(),
      intent: "product_context"
    });
    if (inboundError) {
      logger.error({
        event: "PRODUCT_CHAT_INBOUND_ERROR",
        correlationId,
        tenantId,
        error: inboundError,
        message: "Error inserting product-chat inbound message",
      });
    }

    const systemPrompt = `Sos Klyvo, un asistente IA experto en Mercado Libre.
Estás conversando con el vendedor sobre un producto en particular.
No inventes datos. Usa el contexto proporcionado.
Si falta el costo, aclarale que no podés calcular márgenes reales hasta que lo cargue.
Si te pide cambiar el precio, stock o pausar, usa las funciones provistas. No ejecutes acciones sin que el usuario las pida claramente.
Si la intención no es de ejecutar acción, respondé de manera concisa, clara y amigable, con tono profesional pero cercano.

CONTEXTO DEL PRODUCTO:
- Título: ${product.title}
- SKU: ${product.sku || 'N/A'}
- Precio de Venta: $${product.price}
- Costo: ${product.cost ? '$' + product.cost : 'NO CARGADO'}
- Stock Disponible: ${product.available_quantity} unidades
- Estado: ${product.status}
- Comisión ML (Estimada): $${product.estimated_fee || 0}
- Extra Cuotas (Si aplica): $${product.extra_fee_amount || 0}
- Envío (Estimado): $${product.estimated_shipping_cost || 0}
- Ganancia Neta (Aproximada): $${product.profit_real_estimated ?? product.margin_amount ?? 'Desconocida'}
- Margen Neto: ${product.profit_real_margin ?? product.margin_percent ?? 'Desconocido'}%`;

    const functions = [
      {
        name: "change_price",
        description: "Prepara una acción para cambiar el precio del producto.",
        parameters: {
          type: "object",
          properties: {
            new_price: { type: "number", description: "El nuevo precio propuesto." }
          },
          required: ["new_price"]
        }
      },
      {
        name: "change_stock",
        description: "Prepara una acción para modificar el stock del producto.",
        parameters: {
          type: "object",
          properties: {
            new_stock: { type: "number", description: "El nuevo nivel de stock." },
            operation: { type: "string", enum: ["set", "add", "subtract"], description: "set para fijar, add para sumar, subtract para restar" }
          },
          required: ["new_stock", "operation"]
        }
      },
      {
        name: "pause_product",
        description: "Prepara una acción para pausar el producto.",
        parameters: { type: "object", properties: {} }
      }
    ];

    const idempotencyKey = `ai_product_chat_${product.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const quotaReservation = await consumeQuota({
      tenantId,
      metric: "ai_credits_used",
      amount: 1,
      idempotencyKey,
      source: "ai_product_chat",
      correlationId,
    });

    if (!quotaReservation.allowed) {
      return NextResponse.json(
        { error: "Límite mensual de consultas de Inteligencia Artificial alcanzado para tu plan." },
        { status: 429, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message.trim() }
      ],
      functions,
      function_call: "auto",
      temperature: 0.2
    });

    const responseMessage = completion.choices[0].message;
    let replyText = responseMessage.content || "";
    let actionPending = null;

    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const args = JSON.parse(responseMessage.function_call.arguments);
      
      try {
        if (functionName === "change_price") {
          const res = await preparePriceChangeAction(product.id, product.sku, product.title, args.new_price);
          if (res.error) throw new Error(res.error);
          actionPending = res;
          replyText = `Preparé la acción para actualizar el precio a $${args.new_price}. Por favor, revisá la previsualización y confirmá.`;
        } else if (functionName === "change_stock") {
          const res = await prepareStockChangeAction(product.id, product.sku, product.title, args.new_stock, args.operation);
          if (res.error) throw new Error(res.error);
          actionPending = res;
          replyText = `Preparé la acción para actualizar el stock. Por favor, revisá la previsualización y confirmá.`;
        } else if (functionName === "pause_product") {
          const res = await prepareStatusChangeAction(product.id, product.sku, product.title, 'paused');
          if (res.error) throw new Error(res.error);
          actionPending = res;
          replyText = `Preparé la acción para pausar la publicación. Por favor, revisá la previsualización y confirmá.`;
        }
      } catch (e: any) {
        replyText = `Hubo un error al preparar la acción: ${e.message}`;
      }
    }

    // Save AI response
    const { error: outboundError } = await adminSupabase.from("messages").insert({
      tenant_id: tenantId,
      product_id: product.id,
      channel: "whatsapp", // Mapped to whatsapp due to database enum constraints
      direction: "outbound",
      text: replyText,
      intent: "product_context",
      ai_response: true
    });
    if (outboundError) {
      logger.error({
        event: "PRODUCT_CHAT_OUTBOUND_ERROR",
        correlationId,
        tenantId,
        error: outboundError,
        message: "Error inserting product-chat outbound message",
      });
    }

    return NextResponse.json(
      { reply: replyText, action_pending: actionPending },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );

  } catch (error: any) {
    logger.error({
      event: "PRODUCT_CHAT_ERROR",
      correlationId,
      error,
      message: error?.message || "Product Chat Error",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
