import Link from "next/link";
import type { SalesVatData } from "@/services/finance/getSalesVat";
import type { VatReconciliationData } from "@/services/finance/getVatReconciliation";
import { calculateVatReconciliation } from "@/services/finance/vatReconciliation";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function VatCard({ data, month, reconciliation }: { data: SalesVatData; month: string; reconciliation: VatReconciliationData }) {
  const result = reconciliation.record ? calculateVatReconciliation(reconciliation.record.values) : null;
  return (
    <section className="rounded-lg border border-[#DCDAD4] bg-white p-5 space-y-3" aria-labelledby="finance-vat-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="finance-vat-title" className="font-semibold text-[#101828]">IVA · {month}</h2>
        <Link className="text-sm font-semibold text-[#102A56] underline" href={`/dashboard/accounting?month=${month}#${data.settings.enabled ? "vat-reconciliation" : "sales-vat-title"}`}>
          {data.settings.enabled ? "Ver mi IVA" : "Configurar IVA"}
        </Link>
      </div>
      {data.error ? <p role="alert" className="text-sm text-red-700">{data.error}</p> :
        !data.settings.enabled ? <p className="text-sm text-[#5F6875]">Activá el módulo para responsables inscriptos desde Contabilidad.</p> :
          data.summary ? <div>
            <p className="text-sm text-[#5F6875]">IVA acumulado estimado de ventas</p>
            <p className="text-2xl font-bold text-[#102A56]">{money.format(data.summary.vat)}</p>
            <p className="text-xs text-[#5F6875]">{data.summary.count} ventas pagadas en ARS · Alícuota general {data.settings.rate.toLocaleString("es-AR")}%</p>
          </div> : null}
      {data.settings.enabled && !data.error ? <>
        {reconciliation.error ? <p role="alert" className="text-sm text-red-700">{reconciliation.error}</p> : result && reconciliation.record ?
          <div className="grid gap-3 sm:grid-cols-3 border-t pt-3">
            <div><p className="text-sm text-[#5F6875]">Saldo estimado a pagar · último guardado</p><p className="text-xl font-bold">{money.format(result.due)}</p>
              <p className="text-xs text-[#5F6875]">Guardado el {reconciliation.record.updatedAt.slice(0, 10)}. Actualizalo si cambian tus ventas o compras.</p></div>
            <div><p className="text-sm text-[#5F6875]">Saldo ARCA cargado manualmente</p><p className="text-xl font-bold">{reconciliation.record.values.arcaBalance === null ? "Sin cargar" : money.format(reconciliation.record.values.arcaBalance)}</p></div>
            <div><p className="text-sm text-[#5F6875]">Diferencia estimado − ARCA</p><p className="text-xl font-bold">{result.difference === null ? "Pendiente" : money.format(result.difference)}</p></div>
          </div> : <p className="text-sm text-[#5F6875]">Todavía no guardaste el cálculo del mes. Entrá en “Ver mi IVA” para revisar comisiones, envíos y compras.</p>}
      </> : null}
      <p className="text-xs text-[#5F6875]">Período fiscal mensual. Para “Últimos 30 días” y “Todo el historial” se muestra el mes actual. El IVA de ventas no es el saldo a pagar en ARCA.</p>
    </section>
  );
}
