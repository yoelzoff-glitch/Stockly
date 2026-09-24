// src/app/dashboard/simulator/page.tsx
import { getSimulatorInitialDataAction, getSavedSimulationsAction } from "./actions";
import { SimulatorClient } from "./client-page";
import { OperationalPageHeader } from "@/components/operational/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Simulador de Rentabilidad y Precios - LibretaX",
  description: "Evalúa la ganancia neta, precio óptimo y costo máximo de compra antes de publicar en Mercado Libre.",
};

export default async function SimulatorPage() {
  const initialData = await getSimulatorInitialDataAction();
  const savedSims = await getSavedSimulationsAction(1, 10);

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <OperationalPageHeader
        title="Simulador de Rentabilidad y Precios"
        description="Calculá tu ganancia neta real con comisiones oficiales de Mercado Libre antes de comprar o publicar."
      />

      <SimulatorClient
        initialProducts={initialData.products}
        usdRate={initialData.usdRate}
        defaultPackagingCost={initialData.packagingCost}
        initialSavedSimulations={savedSims.simulations}
        totalSavedSimulations={savedSims.totalCount}
      />
    </div>
  );
}
