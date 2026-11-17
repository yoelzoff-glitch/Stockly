"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { VatReconciliationData } from "@/services/finance/getVatReconciliation";
import type { MeliVatData } from "@/services/finance/getMeliVat";
import { calculateVatReconciliation, vatReconciliationSchema, type VatReconciliationInput } from "@/services/finance/vatReconciliation";
import { saveVatReconciliation } from "./vat-actions";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fields = [
  ["debitFiscal", "Corregir el IVA de ventas"],
  ["creditFiscal", "Otros importes de IVA a descontar"],
  ["previousTechnicalBalance", "Saldo técnico a favor anterior"],
  ["retentions", "Retenciones de IVA"],
  ["perceptions", "Percepciones de IVA"],
  ["paymentsOnAccount", "Pagos a cuenta"],
  ["previousFreeBalance", "Saldo anterior de libre disponibilidad"],
] as const;
type AmountKey = typeof fields[number][0];

export function VatReconciliationPanel({ data, ml, month, salesVat, canManage }: {
  data: VatReconciliationData; ml: MeliVatData; month: string; salesVat: number | null; canManage: boolean;
}) {
  const existing = data.record?.values;
  const [amounts, setAmounts] = useState<Record<AmountKey, string>>(() => Object.fromEntries(fields.map(([key]) =>
    [key, String(existing?.[key] ?? (key === "debitFiscal" ? salesVat ?? "" : 0))])) as Record<AmountKey, string>);
  const [purchases, setPurchases] = useState(() => (existing?.purchases || []).map(p => ({ ...p, vat: String(p.vat) })));
  const [arcaBalance, setArcaBalance] = useState(existing?.arcaBalance == null ? "" : String(existing.arcaBalance));
  const [reference, setReference] = useState(existing?.reference || "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const parsed = vatReconciliationSchema.safeParse({
    ...Object.fromEntries(fields.map(([key]) => [key, amounts[key] === "" ? NaN : Number(amounts[key])])),
    month, arcaBalance: arcaBalance === "" ? null : Number(arcaBalance), reference,
    commissionVat: ml.estimate?.commissionVat, shippingVat: ml.estimate?.shippingVat,
    mlFetchedAt: ml.estimate?.fetchedAt,
    purchases: purchases.map(p => ({ ...p, vat: p.vat === "" ? NaN : Number(p.vat) })),
  });
  const result = parsed.success ? calculateVatReconciliation(parsed.data) : null;
  const purchaseVat = purchases.reduce((total, purchase) => total + (
    purchase.invoiceType === "A" && purchase.eligible && Number.isFinite(Number(purchase.vat))
      ? Math.round(Number(purchase.vat) * 100) : 0
  ), 0) / 100;
  const hasAdjustments = fields.some(([key]) => key !== "debitFiscal" && Number(amounts[key]) !== 0);
  const displayedSales = amounts.debitFiscal !== "" && Number.isFinite(Number(amounts.debitFiscal))
    ? money.format(Number(amounts.debitFiscal)) : "Sin datos";

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed.success) { setMessage("Completá los importes y las referencias de los comprobantes."); return; }
    const input = parsed.data;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await saveVatReconciliation(input, data.record?.revision || 0);
        setMessage(response.error || "Conciliación guardada.");
        if (!response.error) router.refresh();
      } catch { setMessage("No se pudo guardar la conciliación. Verificá los permisos e intentá nuevamente."); }
    });
  }

  return (
    <section id="vat-reconciliation" className="rounded-lg border border-[#DCDAD4] bg-white p-5 space-y-4" aria-labelledby="vat-reconciliation-title">
      <h2 id="vat-reconciliation-title" className="text-lg font-semibold">Tu IVA del mes · {month}</h2>
      <p className="text-sm text-[#5F6875]">Al IVA de tus ventas le descontamos el de comisiones, envíos y las compras que agregues.</p>
      {data.error ? <p role="alert" className="text-red-700">{data.error}</p> : null}
      {ml.error ? <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">No pudimos traer los datos de Mercado Libre.</p>
        <p className="mt-1">Faltan las comisiones y los envíos. Cuando estén disponibles podremos calcular cuánto pagarías.</p>
        <Button className="mt-2" type="button" variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Reintentando…" : "Reintentar"}</Button>
      </div> : null}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["IVA de ventas", displayedSales, "Importe de partida"],
          ["IVA de comisiones", ml.estimate ? money.format(ml.estimate.commissionVat) : "Pendiente", "Se descuenta · automático"],
          ["IVA de envíos", ml.estimate ? money.format(ml.estimate.shippingVat) : "Pendiente", "Se descuenta · automático"],
          ["IVA de compras", money.format(purchaseVat), "Se descuenta · opcional"],
        ].map(([label, value, hint]) => <div key={label} className="rounded-md border border-[#DCDAD4] p-4">
          <dt className="text-sm text-[#5F6875]">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd>
          <dd className="mt-1 text-xs text-[#5F6875]">{hint}</dd>
        </div>)}
      </dl>
      <div className="rounded-lg bg-[#F5F3EE] p-5" aria-live="polite">
        <p className="text-sm font-semibold">IVA estimado a pagar</p>
        <p className="mt-1 text-3xl font-bold text-[#102A56]">{result && !data.error ? money.format(result.due) : "Pendiente"}</p>
        <p className="mt-2 text-sm text-[#5F6875]">{!ml.estimate ? "Faltan los datos de Mercado Libre." : !result ? "Revisá los importes y las facturas que agregaste." : "Es una estimación. El importe definitivo se confirma en ARCA."}</p>
        {hasAdjustments ? <p className="mt-1 text-xs text-[#5F6875]">Incluye los importes de Ajustes avanzados.</p> : null}
        {result && (result.technicalCarryForward > 0 || result.freeCarryForward > 0) ? <p className="mt-2 text-sm">Tenés saldo a favor. Podés ver el detalle en Ajustes avanzados.</p> : null}
      </div>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!canManage || pending || !!data.error} className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">Sumá el IVA de tus compras <span className="text-sm font-normal text-[#5F6875]">(opcional)</span></h3>
            <p className="text-sm text-[#5F6875]">Si tenés una factura A, agregá el IVA que figura en ella. Las facturas C no descuentan IVA.</p>
            {purchases.map((purchase, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-sm">Proveedor y número de factura
                <input className="w-full rounded border p-2" required maxLength={200} value={purchase.reference}
                  onChange={e => setPurchases(rows => rows.map((p, i) => i === index ? { ...p, reference: e.target.value } : p))} />
              </label>
              <label className="text-sm">Tipo de comprobante
                <select className="w-full rounded border p-2" value={purchase.invoiceType} onChange={e => {
                  const invoiceType = e.target.value as VatReconciliationInput["purchases"][number]["invoiceType"];
                  setPurchases(rows => rows.map((p, i) => i === index ? { ...p, invoiceType, eligible: false, vat: "0" } : p));
                }}><option value="A">Factura A</option><option value="C">Factura C (sin IVA)</option><option value="OTHER">Otro (no descuenta IVA)</option></select>
              </label>
              <label className="text-sm">IVA de la factura ($)
                <input className="w-full rounded border p-2" type="number" min="0" max="9999999999.99" step="0.01" required disabled={purchase.invoiceType !== "A"}
                  value={purchase.vat} onChange={e => setPurchases(rows => rows.map((p, i) => i === index ? { ...p, vat: e.target.value } : p))} />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={purchase.eligible} disabled={purchase.invoiceType !== "A"}
                onChange={e => setPurchases(rows => rows.map((p, i) => i === index ? { ...p, eligible: e.target.checked } : p))} />Descontar este IVA</label>
              <Button type="button" variant="outline" onClick={() => setPurchases(rows => rows.filter((_, i) => i !== index))}>Quitar comprobante {index + 1}</Button>
            </div>)}
            {canManage ? <Button type="button" variant="outline" disabled={purchases.length >= 500} onClick={() => setPurchases(rows => [...rows,
              { reference: "", invoiceType: "A", eligible: false, vat: "0" }])}>Agregar factura de compra</Button> : null}
            <p className="text-xs text-[#5F6875]">Agregá cada factura una sola vez. Esto no modifica tu stock.</p>
          </div>
          <details className="rounded-md border border-[#DCDAD4] p-4">
            <summary className="cursor-pointer font-semibold">Ajustes avanzados{hasAdjustments ? " · con importes cargados" : " (opcional)"}</summary>
            <p className="my-3 text-sm text-[#5F6875]">Usá esta sección si necesitás corregir el IVA de ventas o cargar datos de tu contador. No repitas las comisiones, los envíos ni las compras de arriba.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(([key, label]) => <label key={key} className="text-sm space-y-1">
                <span className="block">{label} ($)</span>
                <input className="w-full rounded-md border p-2" type="number" min="0" max="9999999999.99" step="0.01"
                  value={amounts[key]} onChange={e => setAmounts(current => ({ ...current, [key]: e.target.value }))} />
              </label>)}
            </div>
            <p className="mt-3 text-xs text-[#5F6875]">Los saldos anteriores se cargan manualmente y no se trasladan al mes siguiente.</p>
            {result ? <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><dt className="text-sm">Saldo técnico a favor</dt><dd className="font-semibold">{money.format(result.technicalCarryForward)}</dd></div>
              <div><dt className="text-sm">Saldo de libre disponibilidad</dt><dd className="font-semibold">{money.format(result.freeCarryForward)}</dd></div>
            </dl> : null}
          </details>
          <details className="rounded-md border border-[#DCDAD4] p-4">
            <summary className="cursor-pointer font-semibold">Comparar con ARCA (opcional){arcaBalance !== "" ? " · importe cargado" : ""}</summary>
            <p className="my-3 text-sm text-[#5F6875]">Si ya tenés el importe de tu declaración, cargalo para compararlo. No nos conectamos a ARCA ni presentamos nada por vos.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Importe a pagar según ARCA ($)
              <input className="w-full rounded border p-2" type="number" min="0" max="9999999999.99" step="0.01" value={arcaBalance} onChange={e => setArcaBalance(e.target.value)} />
            </label>
            <label className="text-sm">Referencia o nota sobre la declaración
              <input className="w-full rounded border p-2" maxLength={500} value={reference} onChange={e => setReference(e.target.value)} />
            </label>
          </div>
          {arcaBalance !== "" && reference.trim() === "" ? <p className="mt-2 text-sm text-amber-800">Agregá una referencia o nota para guardar este importe.</p> : null}
          {result?.difference !== null && result?.difference !== undefined ? <p className="mt-3 text-sm">Diferencia entre nuestra estimación y el importe que cargaste: <strong>{money.format(result.difference)}</strong></p> : null}
          </details>
        </fieldset>
        <p className="text-xs text-[#5F6875]">Guardá los cambios para actualizar el resumen de Finanzas. Todos los importes están en pesos.</p>
        {data.record ? <p className="text-xs text-[#5F6875]">Último guardado: {data.record.updatedAt.slice(0, 10)}</p> : null}
        {message ? <p role="status" className="text-sm">{message}</p> : null}
        {canManage ? <Button type="submit" disabled={pending || !!data.error || !parsed.success}>{pending ? "Guardando…" : "Guardar cambios"}</Button> : null}
      </form>
      {ml.estimate ? <details className="text-xs text-[#5F6875]">
        <summary className="cursor-pointer">Cómo se calcula</summary>
        <p className="mt-2">Estimamos el IVA incluido al 21% en las comisiones y los envíos del reporte de Mercado Libre, descontando sus bonificaciones. El IVA de compras es el que ingresás de tus facturas.</p>
        <p className="mt-1">Reporte de Mercado Libre: {ml.estimate.periodFrom} al {ml.estimate.periodTo}. Consultado el {ml.estimate.fetchedAt.slice(0, 10)}; se actualiza diariamente al consultar.</p>
        <p className="mt-1">Ese período puede diferir del mes calendario. Revisá las facturas y sus ajustes con tu contador antes de confirmar el pago.</p>
      </details> : null}
    </section>
  );
}
