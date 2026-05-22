import { meliFetch } from "./client";

export async function getProducts(accessToken: string, meliUserId: string) {
  let allItemIds: string[] = [];
  let scrollId: string | undefined = undefined;
  
  // 1. Fetch all item IDs for the user
  try {
    const searchUrl = `/users/${meliUserId}/items/search`;
    const data = await meliFetch(accessToken, searchUrl);
    
    if (data.results && Array.isArray(data.results)) {
      allItemIds = data.results;
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
      // /items endpoint requires an array of items, returned as [{ code: 200, body: {...} }, ...]
      const itemsData = await meliFetch(accessToken, `/items?ids=${idsString}`);
      
      if (Array.isArray(itemsData)) {
        for (const itemResponse of itemsData) {
          if (itemResponse.code === 200 && itemResponse.body) {
            allItems.push(itemResponse.body);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching item details for chunk ${i}:`, error);
      // We continue to the next chunk even if one fails
    }
  }

  return allItems;
}
