// src/app/dashboard/settings/costs/page.tsx
import { getExtraCosts } from "./actions";
import { ExtraCostsClient } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configuración de Costos Extra - LibretaX",
  description: "Configura costos de embalaje y tarifarios de motos Flex por zona."
};

export default async function CostsSettingsPage() {
  let costs = [];
  try {
    costs = await getExtraCosts();
  } catch (e) {
    console.error("Failed to load extra costs:", e);
  }

  return (
    <ExtraCostsClient initialCosts={costs} />
  );
}
