import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNoMovementProducts } from "@/services/analytics/noMovementProducts";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { AlertCircle, PackageX, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NoMovementProductsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) redirect("/onboarding");

  const resolvedSearchParams = await props.searchParams;

  const days = Number(resolvedSearchParams.days) || 30;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const minStock = resolvedSearchParams.minStock ? Number(resolvedSearchParams.minStock) : undefined;
  
  let hasCost: boolean | undefined = undefined;
  if (resolvedSearchParams.hasCost === 'true') hasCost = true;
  if (resolvedSearchParams.hasCost === 'false') hasCost = false;

  const data = await getNoMovementProducts(tenantId, {
    days,
    status,
    minStock,
    hasCost
  });

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50/50 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shadow-sm border border-amber-200/50">
                <PackageX className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Productos sin movimiento</h1>
                <p className="text-slate-500 mt-1">Publicaciones que no registran ventas en el período seleccionado.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/products/no-movement?days=30`} className={days === 30 ? "bg-slate-100" : ""}>30 días</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/products/no-movement?days=60`} className={days === 60 ? "bg-slate-100" : ""}>60 días</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/products/no-movement?days=90`} className={days === 90 ? "bg-slate-100" : ""}>90 días</Link>
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
            <span className="text-slate-500 text-sm font-medium">Total Inmovilizado</span>
            <span className="text-2xl font-bold text-slate-900 mt-2">
              ${data.reduce((acc, p) => acc + (p.immobilizedCost || 0), 0).toLocaleString()}
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
            <span className="text-slate-500 text-sm font-medium">Productos Estancados</span>
            <span className="text-2xl font-bold text-slate-900 mt-2">{data.length}</span>
          </div>
          <div className="bg-amber-50 border-amber-200 p-5 rounded-xl border shadow-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-amber-900 text-sm font-semibold">Consejo de Klyvo</span>
              <span className="text-amber-700 text-sm mt-1 leading-relaxed">
                Prioriza pausar publicaciones con alto costo inmovilizado y sin margen. Si tienen buen margen, prueba con una oferta relámpago.
              </span>
            </div>
          </div>
        </div>

        <DataTable columns={columns} data={data} />
      </div>

      {/* AI Context Panel */}
      <div className="w-80 border-l bg-white flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-5 border-b bg-gradient-to-br from-indigo-50 to-white">
          <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
              <MessageSquare className="h-3 w-3" />
            </span>
            Preguntarle a Klyvo
          </h2>
          <p className="text-xs text-indigo-700/80 mt-2 leading-relaxed">
            La IA tiene contexto de los {data.length} productos que estás viendo. Usa estos accesos rápidos:
          </p>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group">
            <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 block mb-1">
              ¿Cuáles conviene pausar?
            </span>
            <span className="text-xs text-slate-500 line-clamp-2">Analiza el costo inmovilizado y recomienda cierres.</span>
          </button>
          
          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group">
            <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 block mb-1">
              ¿Cuáles poner en oferta?
            </span>
            <span className="text-xs text-slate-500 line-clamp-2">Busca productos con buen margen y alto stock.</span>
          </button>

          <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group">
            <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 block mb-1">
              ¿Por qué no venden?
            </span>
            <span className="text-xs text-slate-500 line-clamp-2">Análisis de precio vs competencia y calidad.</span>
          </button>
        </div>
        
        <div className="p-4 border-t bg-slate-50">
           <Button className="w-full shadow-sm" asChild>
             <Link href="/dashboard/messages">Ir al Chat Completo</Link>
           </Button>
        </div>
      </div>
    </div>
  );
}
