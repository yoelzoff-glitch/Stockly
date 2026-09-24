// src/app/dashboard/purchases/page.tsx
import { getPurchases, getTenantUsdRate } from "./actions";
import { PurchasesClient } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compras Internas - LibretaX",
  description: "Registra y gestiona las compras a tus proveedores con cálculo de Costo Promedio Ponderado (PPP) automático.",
};

export default async function PurchasesPage() {
  let purchases = [];
  let usdRate = 1500;
  try {
    [purchases, usdRate] = await Promise.all([
      getPurchases(),
      getTenantUsdRate()
    ]);
  } catch (e) {
    console.error("Failed to load purchases:", e);
  }

  return (
    <PurchasesClient initialPurchases={purchases} usdRate={usdRate} />
  );
}
