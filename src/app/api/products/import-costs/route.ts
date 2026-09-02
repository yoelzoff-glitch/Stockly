import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantRole, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantRole(["owner", "admin"], req);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { error: "Archivo no recibido" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "El archivo parece estar vacío o no tiene datos" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Limit maximum lines to prevent denial of service (safe max 2000 items)
    if (lines.length > 2000) {
      return NextResponse.json(
        { error: "El archivo excede el límite máximo permitido de 2000 filas" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const header = lines[0].toLowerCase();
    const isSku = header.includes("sku,cost");
    const isMeliId = header.includes("meli_item_id,cost");

    if (!isSku && !isMeliId) {
      return NextResponse.json(
        { error: "El formato de cabecera es incorrecto. Debe ser 'sku,cost' o 'meli_item_id,cost'." },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const supabase = createAdminClient();
    let updated = 0;
    let notFound = 0;
    const errors = [];

    // Process rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(",");
      if (parts.length < 2) {
        errors.push({ line: i + 1, detail: "Faltan columnas" });
        continue;
      }

      const identifier = parts[0].trim();
      const costStr = parts[1].trim();
      const costVal = parseFloat(costStr);

      if (isNaN(costVal) || costVal < 0 || !Number.isFinite(costVal)) {
        errors.push({ line: i + 1, detail: `Costo inválido: ${costStr}` });
        continue;
      }

      // Update in DB strictly scoped to tenant
      let query = supabase.from("products").update({ cost: costVal }).eq("tenant_id", tenantId);

      if (isSku) {
        query = query.eq("sku", identifier);
      } else {
        query = query.eq("meli_item_id", identifier);
      }

      const { data, error } = await query.select("id");

      if (error) {
        errors.push({ line: i + 1, detail: error.message });
      } else if (data && data.length > 0) {
        updated += data.length;
      } else {
        notFound++;
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        updated,
        not_found: notFound,
        errors
      }
    }, { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } });

  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "IMPORT_COSTS", correlationId } });
    logger.error({
      event: "IMPORT_COSTS_ERROR",
      correlationId,
      error,
      message: error?.message || "Error importando costos",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
