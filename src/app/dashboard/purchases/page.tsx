// src/app/dashboard/purchases/page.tsx
import { getPurchases } from "./actions";
import { PurchasesClient } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compras Internas - LibretaX",
  description: "Registra y gestiona las compras a tus proveedores con cálculo de Costo Promedio Ponderado (PPP) automático.",
};

export default async function PurchasesPage() {
  let purchases = [];
  try {
    purchases = await getPurchases();
  } catch (e) {
    console.error("Failed to load purchases:", e);
  }

  return (
    <PurchasesClient initialPurchases={purchases} />
  );
}
