import { meliFetch } from "./client";

export async function getOrders(tenantId: string, meliUserId: string, dateFrom?: string) {
  let allOrders: any[] = [];
  const seenIds = new Set<number>();
  const endpoints = ["/orders/search", "/orders/search/archived"];

  for (const endpointBase of endpoints) {
    let offset = 0;
    const limit = 50; // Max allowed by Meli is usually 50
    let hasMore = true;

    try {
      while (hasMore) {
        const searchUrl = `${endpointBase}?seller=${meliUserId}&offset=${offset}&limit=${limit}${dateFrom ? `&order.date_created.from=${dateFrom}` : ""}`;
        const data = await meliFetch({
          tenantId,
          endpoint: searchUrl,
          method: "GET"
        });
        
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
          data.results.forEach((order: any) => {
            if (!seenIds.has(order.id)) {
              seenIds.add(order.id);
              allOrders.push(order);
            }
          });
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
      console.error(`Error fetching user orders from Meli endpoint ${endpointBase}:`, error);
    }
  }

  return allOrders;
}
