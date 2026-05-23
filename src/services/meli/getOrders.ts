import { meliFetch } from "./client";

export async function getOrders(tenantId: string, meliUserId: string, dateFrom?: string) {
  let allOrders: any[] = [];
  let offset = 0;
  const limit = 50; // Max allowed by Meli is usually 50
  let hasMore = true;

  try {
    while (hasMore) {
      const searchUrl = `/orders/search?seller=${meliUserId}&offset=${offset}&limit=${limit}${dateFrom ? `&order.date_created.from=${dateFrom}` : ""}`;
      const data = await meliFetch({
        tenantId,
        endpoint: searchUrl,
        method: "GET"
      });
      
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        allOrders = allOrders.concat(data.results);
        offset += limit;
      } else {
        hasMore = false;
      }

      // Safeguard: if there's paging object
      if (data.paging) {
        if (offset >= data.paging.total) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
  } catch (error) {
    console.error("Error fetching user orders from Meli:", error);
    throw error;
  }

  return allOrders;
}
