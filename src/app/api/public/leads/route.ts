import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

// Rate limiting: 5 requests per minute per IP
const ipBuckets = new Map<string, { tokens: number; lastRefill: number }>();
const MAX_LEADS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkLeadRateLimit(ip: string): boolean {
  const now = Date.now();
  // Cleanup old entries
  for (const [key, b] of ipBuckets.entries()) {
    if (now - b.lastRefill > RATE_LIMIT_WINDOW_MS * 2) {
      ipBuckets.delete(key);
    }
  }

  let bucket = ipBuckets.get(ip);
  if (!bucket) {
    bucket = { tokens: MAX_LEADS_PER_MINUTE - 1, lastRefill: now };
    ipBuckets.set(ip, bucket);
    return true;
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed > RATE_LIMIT_WINDOW_MS) {
    bucket.tokens = MAX_LEADS_PER_MINUTE - 1;
    bucket.lastRefill = now;
    return true;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

const leadSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Formato de email inválido")
    .max(255, "El email no debe superar los 255 caracteres"),
  name: z
    .string()
    .trim()
    .max(100, "El nombre no debe superar los 100 caracteres")
    .optional()
    .nullable(),
  company: z
    .string()
    .trim()
    .max(100, "La empresa no debe superar los 100 caracteres")
    .optional()
    .nullable(),
  intent: z.enum(["meeting", "contact"]),
  source: z.string().trim().max(50).default("landing_popup"),
  page_path: z.string().trim().max(500).optional().nullable(),
  utm_source: z.string().trim().max(200).optional().nullable(),
  utm_medium: z.string().trim().max(200).optional().nullable(),
  utm_campaign: z.string().trim().max(200).optional().nullable(),
  utm_content: z.string().trim().max(200).optional().nullable(),
  utm_term: z.string().trim().max(200).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  // Honeypot fields (must remain empty)
  website: z.string().optional().nullable(),
  hp_title: z.string().optional().nullable(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Payload size guard (max 8KB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 8192) {
      return NextResponse.json(
        { error: "Payload demasiado grande" },
        { status: 413 }
      );
    }

    // 2. Client IP rate limiting
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0].trim() || "127.0.0.1";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    if (!checkLeadRateLimit(ipHash)) {
      logger.warn({
        event: "LEAD_RATE_LIMIT_EXCEEDED",
        ipHash,
      });
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Por favor, intentá nuevamente en un minuto." },
        { status: 429 }
      );
    }

    // 3. Body parsing & validation
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: "Formato de datos inválido" },
        { status: 400 }
      );
    }

    const parseResult = leadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || "Datos incompletos o inválidos";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parseResult.data;

    // 4. Honeypot check for bots
    if (data.website || data.hp_title) {
      logger.warn({
        event: "LEAD_SPAM_HONEYPOT_TRIGGERED",
        ipHash,
      });
      return NextResponse.json({ error: "Solicitud rechazada" }, { status: 400 });
    }

    // 5. Additional business rule: meeting requires name
    if (data.intent === "meeting" && (!data.name || data.name.trim().length < 2)) {
      return NextResponse.json(
        { error: "Por favor, ingresá tu nombre para coordinar la reunión" },
        { status: 400 }
      );
    }

    // 6. Safe database persistence
    const supabase = createAdminClient();
    const { data: lead, error: insertError } = await supabase
      .from("marketing_leads")
      .insert({
        email: data.email,
        name: data.name || null,
        company: data.company || null,
        intent: data.intent,
        source: data.source || "landing_popup",
        page_path: data.page_path || null,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_content: data.utm_content || null,
        utm_term: data.utm_term || null,
        referrer: data.referrer || null,
      })
      .select("id")
      .single();

    if (insertError) {
      logger.error({
        event: "LEAD_INSERT_ERROR",
        error: insertError.message,
        email: data.email,
      });
      return NextResponse.json(
        { error: "No pudimos enviar tus datos. Intentá nuevamente." },
        { status: 500 }
      );
    }

    logger.info({
      event: "LEAD_CAPTURED",
      leadId: lead?.id,
      intent: data.intent,
      utm_source: data.utm_source,
    });

    return NextResponse.json({
      success: true,
      id: lead?.id,
      message: "Lead registrado exitosamente",
    });
  } catch (err: any) {
    logger.error({
      event: "LEAD_API_EXCEPTION",
      error: err?.message,
    });
    return NextResponse.json(
      { error: "No pudimos enviar tus datos. Intentá nuevamente." },
      { status: 500 }
    );
  }
}
