import { meliFetch } from "./client";

export async function getProducts(tenantId: string, meliUserId: string) {
  let allItemIds: string[] = [];
  
  // 1. Fetch all item IDs for the user
  try {
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const searchUrl = `/users/${meliUserId}/items/search?offset=${offset}&limit=${limit}`;
      const data = await meliFetch({
        tenantId,
        endpoint: searchUrl,
        method: "GET"
      });
      
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        allItemIds = allItemIds.concat(data.results);
        offset += limit;
      } else {
        hasMore = false;
      }

      if (data.paging) {
        if (offset >= data.paging.total) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
  } catch (error) {
    console.error("Error fetching user items from Meli:", error);
    throw error;
  }

  if (allItemIds.length === 0) {
    return [];
  }

  // 2. Fetch full details for all items in batches of 20 (multiget)
  const allItems: any[] = [];
  const chunkSize = 20;
  
  for (let i = 0; i < allItemIds.length; i += chunkSize) {
    const chunk = allItemIds.slice(i, i + chunkSize);
    const idsString = chunk.join(",");
    
    try {
      const itemsData = await meliFetch({
        tenantId,
        endpoint: `/items?ids=${idsString}`,
        method: "GET"
      });
      
      if (Array.isArray(itemsData)) {
        for (const itemResponse of itemsData) {
          if (itemResponse.code === 200 && itemResponse.body) {
            allItems.push(itemResponse.body);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching item details for chunk ${i}:`, error);
    }
  }

  return allItems;
}
