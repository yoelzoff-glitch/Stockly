import { meliFetch } from "./client";

export async function getOrders(accessToken: string, meliUserId: string) {
  let allOrders: any[] = [];
  let offset = 0;
  const limit = 50; // Max allowed by Meli is usually 50
  let hasMore = true;

  try {
    while (hasMore) {
      const searchUrl = `/orders/search?seller=${meliUserId}&offset=${offset}&limit=${limit}`;
      const data = await meliFetch(accessToken, searchUrl);
      
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
      }
    }
  } catch (error) {
    console.error("Error fetching user orders from Meli:", error);
    throw error;
  }

  return allOrders;
}
