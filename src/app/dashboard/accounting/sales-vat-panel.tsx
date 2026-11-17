"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SALES_VAT_RATES } from "@/services/finance/salesVat";
import type { SalesVatData } from "@/services/finance/getSalesVat";
import { saveSalesVatSettings } from "./vat-actions";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function SalesVatPanel({ data, month, canManage }: {
  data: SalesVatData; month: string; canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(data.settings.enabled);
  const [rate, setRate] = useState(data.settings.rate);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dirty = enabled !== data.settings.enabled || rate !== data.settings.rate;

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveSalesVatSettings({ enabled, rate });
        setMessage(result.error || "Configuración guardada.");
        if (!result.error) router.refresh();
      } catch {
        setMessage("No se pudo guardar. Verificá los permisos de tu cuenta e intentá nuevamente.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-[#DCDAD4] bg-white p-5 space-y-4" aria-labelledby="sales-vat-title" aria-busy={pending}>
      <div>
        <h2 id="sales-vat-title" className="text-lg font-semibold text-[#101828]">IVA de ventas · {month}</h2>
        <p className="text-sm text-[#5F6875]">Módulo opcional para responsables inscriptos.</p>
      </div>
      {data.error ? <p role="alert" className="text-sm text-red-700">{data.error} <Button variant="outline" size="sm" onClick={() => router.refresh()}>Reintentar</Button></p> : null}
      {canManage && !data.error ? (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} disabled={pending} onChange={e => setEnabled(e.target.checked)} />
            Soy responsable inscripto: activar módulo
          </label>
          <label className="flex items-center gap-2 text-sm">
            Porcentaje de IVA
            <select className="rounded-md border p-2 bg-white" value={rate} disabled={pending} onChange={e => setRate(Number(e.target.value))}>
              {SALES_VAT_RATES.map(value => <option key={value} value={value}>{value.toLocaleString("es-AR")}%</option>)}
            </select>
          </label>
          <Button size="sm" disabled={pending || !dirty} onClick={save}>{pending ? "Guardando…" : "Guardar configuración"}</Button>
        </div>
      ) : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {!data.error && !data.settings.enabled ? <p className="text-sm text-[#5F6875]">Módulo desactivado.{!canManage ? " Un administrador puede activarlo para esta cuenta." : " Activá y guardá la configuración para ver el acumulado mensual."}</p> : null}
      {data.settings.enabled && data.summary ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-[#5F6875]">Ventas consideradas (IVA incluido)</dt><dd className="text-xl font-semibold">{money.format(data.summary.gross)}</dd></div>
            <div><dt className="text-sm text-[#5F6875]">Importe sin IVA estimado</dt><dd className="text-xl font-semibold">{money.format(data.summary.net)}</dd></div>
            <div><dt className="text-sm text-[#5F6875]">IVA acumulado estimado ({data.settings.rate.toLocaleString("es-AR")}%)</dt><dd className="text-2xl font-bold text-[#102A56]">{money.format(data.summary.vat)}</dd></div>
          </dl>
          <p className="text-sm text-[#5F6875]">{data.summary.count} ventas pagadas en ARS según fecha de creación. {data.summary.excluded} órdenes excluidas (canceladas, otros estados, otras monedas, importes inválidos u ocultas).</p>
          {data.summary.count === 0 ? <p className="text-sm">No hay ventas que cumplan esos criterios en este mes.</p> : null}
        </>
      ) : null}
      <p className="text-xs text-[#5F6875]">Este es el IVA de tus ventas. Más abajo podés ver cuánto pagarías después de descontar comisiones, envíos y compras.</p>
      <details className="text-xs text-[#5F6875]">
        <summary className="cursor-pointer">Sobre esta estimación</summary>
        <p className="mt-2">Usamos el mismo porcentaje de IVA para todas las ventas, con IVA incluido en el precio. Cambiarlo recalcula también los meses anteriores. No se ajusta automáticamente por notas de crédito ni devoluciones parciales.</p>
      </details>
    </section>
  );
}
