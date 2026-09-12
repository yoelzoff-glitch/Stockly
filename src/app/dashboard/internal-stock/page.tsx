// src/app/dashboard/internal-stock/page.tsx
import { getInventoryItems, getFullStockData } from "./actions";
import { InternalStockClient } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stock - LibretaX",
  description: "Control de inventario, stock global y seguimiento de unidades en Bodega FULL."
};

export default async function InternalStockPage() {
  let items: any[] = [];
  let fullStockData = {
    fullProducts: [] as any[],
    totalFullUnits: 0,
    fullPublicationsCount: 0,
    criticalFullCount: 0
  };

  try {
    const [fetchedItems, fetchedFull] = await Promise.all([
      getInventoryItems(),
      getFullStockData()
    ]);
    items = fetchedItems;
    fullStockData = fetchedFull;
  } catch (e) {
    console.error("Failed to load inventory items or FULL stock:", e);
  }

  return (
    <InternalStockClient initialItems={items} initialFullData={fullStockData} />
  );
}
