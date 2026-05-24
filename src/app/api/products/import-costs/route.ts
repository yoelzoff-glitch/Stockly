import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const tenantId = profile.tenant_id;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: "El archivo parece estar vacío o no tiene datos" }, { status: 400 });
    }

    const header = lines[0].toLowerCase();
    const isSku = header.includes("sku,cost");
    const isMeliId = header.includes("meli_item_id,cost");

    if (!isSku && !isMeliId) {
      return NextResponse.json({ error: "El formato de cabecera es incorrecto. Debe ser 'sku,cost' o 'meli_item_id,cost'." }, { status: 400 });
    }

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

      if (isNaN(costVal) || costVal < 0) {
        errors.push({ line: i + 1, detail: `Costo inválido: ${costStr}` });
        continue;
      }

      // Update in DB
      let query = supabase.from("products").update({ cost: costVal }).eq("tenant_id", tenantId);

      if (isSku) {
        query = query.eq("sku", identifier);
      } else {
        query = query.eq("meli_item_id", identifier);
      }

      const { data, error, count } = await query.select("id");

      if (error) {
        errors.push({ line: i + 1, detail: error.message });
      } else if (data && data.length > 0) {
        updated += data.length; // Might update variations if they share SKU
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
    });

  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "IMPORT_COSTS" } });
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
