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
  ["debitFiscal", "IVA de ventas / débito fiscal"],
  ["creditFiscal", "Otros créditos fiscales (sin repetir ML ni compras de abajo)"],
  ["previousTechnicalBalance", "Saldo técnico a favor anterior"],
  ["retentions", "Retenciones de IVA computables"],
  ["perceptions", "Percepciones de IVA computables"],
  ["paymentsOnAccount", "Pagos a cuenta computables"],
  ["previousFreeBalance", "Saldo de libre disponibilidad anterior aún disponible"],
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
      <h2 id="vat-reconciliation-title" className="text-lg font-semibold">Conciliación de IVA · {month}</h2>
      <p className="text-sm text-[#5F6875]">Comisiones y Mercado Envíos se obtienen automáticamente del reporte de facturación de ML. Las compras son opcionales: cargá el IVA discriminado y marcá si es computable. Una factura C no suma crédito fiscal.</p>
      {data.error ? <p role="alert" className="text-red-700">{data.error}</p> : null}
      {ml.error ? <p role="alert" className="text-red-700">{ml.error}</p> : null}
      {ml.estimate ? <div className="rounded-md bg-[#F5F3EE] p-3 text-sm space-y-1">
        <p>IVA estimado de comisiones ML: <strong>{money.format(ml.estimate.commissionVat)}</strong></p>
        <p>IVA estimado de Mercado Envíos: <strong>{money.format(ml.estimate.shippingVat)}</strong></p>
        <p className="text-xs">Reporte ML: {ml.estimate.periodFrom} al {ml.estimate.periodTo}. Consulta: {ml.estimate.fetchedAt.slice(0, 10)}. Actualización diaria al consultar.</p>
        <p className="text-xs">Se extrae el 21% incluido en cargos CV/CXD, descontando bonificaciones BV/BXD. No es IVA discriminado importado de la factura. Verificá período fiscal, notas de crédito y otros cargos antes de presentar.</p>
      </div> : null}
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!canManage || pending || !!data.error} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([key, label]) => <label key={key} className="text-sm space-y-1">
              <span className="block">{label} (ARS)</span>
              <input className="w-full rounded-md border p-2" type="number" min="0" max="999999999999.99" step="0.01" required
                value={amounts[key]} onChange={e => setAmounts(current => ({ ...current, [key]: e.target.value }))} />
            </label>)}
          </div>
          <p className="text-xs text-[#5F6875]">El débito inicial proviene de la estimación de ventas. Ajustalo al IVA de tus comprobantes, incluyendo sus ajustes. Los saldos anteriores se cargan manualmente; no se trasladan automáticamente.</p>
          <div className="space-y-3">
            <h3 className="font-semibold">Compras del período (opcional)</h3>
            <p className="text-xs text-[#5F6875]">Registrá aquí cada comprobante una sola vez, en pesos y con su IVA computable. Esta carga fiscal no modifica el inventario ni registra una nueva compra de mercadería.</p>
            {purchases.map((purchase, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-sm">Proveedor y número de factura
                <input className="w-full rounded border p-2" required maxLength={200} value={purchase.reference}
                  onChange={e => setPurchases(rows => rows.map((p, i) => i === index ? { ...p, reference: e.target.value } : p))} />
              </label>
              <label className="text-sm">Tipo de comprobante
                <select className="w-full rounded border p-2" value={purchase.invoiceType} onChange={e => {
                  const invoiceType = e.target.value as VatReconciliationInput["purchases"][number]["invoiceType"];
                  setPurchases(rows => rows.map((p, i) => i === index ? { ...p, invoiceType, eligible: false, vat: "0" } : p));
                }}><option value="A">Factura A</option><option value="C">Factura C (sin crédito IVA)</option><option value="OTHER">Otro / sin crédito</option></select>
              </label>
              <label className="text-sm">IVA discriminado (ARS)
                <input className="w-full rounded border p-2" type="number" min="0" max="999999999999.99" step="0.01" required disabled={purchase.invoiceType !== "A"}
                  value={purchase.vat} onChange={e => setPurchases(rows => rows.map((p, i) => i === index ? { ...p, vat: e.target.value } : p))} />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={purchase.eligible} disabled={purchase.invoiceType !== "A"}
                onChange={e => setPurchases(rows => rows.map((p, i) => i === index ? { ...p, eligible: e.target.checked } : p))} />Computar crédito</label>
              <Button type="button" variant="outline" onClick={() => setPurchases(rows => rows.filter((_, i) => i !== index))}>Quitar comprobante {index + 1}</Button>
            </div>)}
            {canManage ? <Button type="button" variant="outline" disabled={purchases.length >= 500} onClick={() => setPurchases(rows => [...rows,
              { reference: "", invoiceType: "A", eligible: false, vat: "0" }])}>Agregar comprobante de compra</Button> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Saldo a ingresar de la declaración ARCA (opcional, ARS)
              <input className="w-full rounded border p-2" type="number" min="0" max="999999999999.99" step="0.01" value={arcaBalance} onChange={e => setArcaBalance(e.target.value)} />
            </label>
            <label className="text-sm">Referencia de la declaración / observaciones
              <input className="w-full rounded border p-2" maxLength={500} required={arcaBalance !== ""} value={reference} onChange={e => setReference(e.target.value)} />
            </label>
          </div>
        </fieldset>
        {result ? <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-md bg-[#F5F3EE] p-4">
          <div><dt className="text-sm">Saldo estimado a pagar</dt><dd className="text-xl font-bold">{money.format(result.due)}</dd></div>
          <div><dt className="text-sm">Saldo técnico a favor</dt><dd className="font-semibold">{money.format(result.technicalCarryForward)}</dd></div>
          <div><dt className="text-sm">Libre disponibilidad estimada</dt><dd className="font-semibold">{money.format(result.freeCarryForward)}</dd></div>
          <div><dt className="text-sm">Diferencia: estimado − ARCA cargado</dt><dd className="font-semibold">{result.difference === null ? "ARCA sin cargar" : money.format(result.difference)}</dd></div>
        </dl> : <p className="text-sm">Saldo pendiente: completá los datos y verificá que el reporte ML esté disponible.</p>}
        <p className="text-xs text-[#5F6875]">Vista previa de los datos del formulario. Guardá para actualizar la card de Finanzas. El saldo de ARCA se carga manualmente desde la declaración; no se consulta ni se presenta una declaración en ARCA.</p>
        {data.record ? <p className="text-xs text-[#5F6875]">Último guardado: {data.record.updatedAt.replace("T", " ").slice(0, 19)} UTC · versión {data.record.revision}</p> : null}
        {message ? <p role="status" className="text-sm">{message}</p> : null}
        {canManage ? <Button type="submit" disabled={pending || !!data.error || !parsed.success}>{pending ? "Guardando…" : "Guardar conciliación mensual"}</Button> : null}
      </form>
    </section>
  );
}
