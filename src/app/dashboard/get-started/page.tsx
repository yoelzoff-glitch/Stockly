import { getActivationProgress } from "@/actions/activation";
import GetStartedClient from "./client-page";
import { OperationalPageHeader } from "@/components/operational/page-header";

export default async function GetStartedPage() {
  const data = await getActivationProgress();

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Configuración inicial"
        description="Pasos requeridos y recomendados para habilitar el control de catálogo, costos, márgenes y sincronización."
      />
      <GetStartedClient data={data} />
    </div>
  );
}
