import { getActivationProgress } from "@/actions/activation";
import GetStartedClient from "./client-page";

export default async function GetStartedPage() {
  const data = await getActivationProgress();

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Activación de Cuenta</h2>
      </div>
      <p className="text-muted-foreground">
        Completa estos pasos para aprovechar al máximo las capacidades de Stockly.
      </p>

      <GetStartedClient data={data} />
    </div>
  );
}
