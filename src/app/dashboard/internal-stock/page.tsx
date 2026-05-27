// src/app/dashboard/internal-stock/page.tsx
import { getInventoryItems } from "./actions";
import { InternalStockClient } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inventario de Depósito - Klyvo",
  description: "Administra el stock físico de depósito, ajusta inventarios y monitorea costos promedio."
};

export default async function InternalStockPage() {
  let items = [];
  try {
    items = await getInventoryItems();
  } catch (e) {
    console.error("Failed to load inventory items:", e);
  }

  return (
    <InternalStockClient initialItems={items} />
  );
}
