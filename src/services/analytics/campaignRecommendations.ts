import { SupabaseClient } from "@supabase/supabase-js";
import { Product } from "@/types/product";

export interface CampaignRecommendation {
  campaignName: string;
  category: string;
  subTheme?: string;
  primaryProduct: {
    sku: string;
    title: string;
    unitsSold: number;
    revenue: number;
  };
  bestPublication: {
    id: string;
    title: string;
    price: number;
    listingType: string;
    permalink?: string;
    unitsSold: number;
  };
  suggestedGroup: {
    sku: string;
    title: string;
    price: number;
    available_quantity: number;
    permalink?: string;
  }[];
  reason: string;
}

export interface TopProductSales {
  sku: string;
  title: string;
  unitsSold: number;
  revenue: number;
  bestPublication: {
    id: string;
    title: string;
    price: number;
    listingType: string;
    permalink?: string;
    unitsSold: number;
  };
}

const PRODUCT_CATEGORIES = [
  { key: "dije", name: "Dijes" },
  { key: "pulsera", name: "Pulseras" },
  { key: "aro", name: "Aros" },
  { key: "aros", name: "Aros" },
  { key: "cadena", name: "Cadenas" },
  { key: "anillo", name: "Anillos" },
  { key: "collar", name: "Collares" },
  { key: "gargantilla", name: "Gargantillas" },
  { key: "rosario", name: "Rosarios" }
];

const SUB_THEMES = [
  { 
    key: "religioso", 
    name: "Religiosos", 
    keywords: ["angelito", "virgen", "cruz", "cristo", "san ", "santo", "milagrosa", "medalla", "fe", "dios", "rezando", "bautismo", "comunion"] 
  },
  { 
    key: "profesion", 
    name: "Profesiones", 
    keywords: ["veterinaria", "medica", "medico", "secretaria", "policia", "enfermera", "abogada", "abogado", "maestra", "profesion", "doctor", "doctora", "odontologo", "odontologa", "arquitecto", "arquitecta", "jeringa", "estetoscopio", "balanza"] 
  },
  { 
    key: "amor_familia", 
    name: "Amor y Familia", 
    keywords: ["amor", "corazon", "pareja", "hijo", "hija", "mama", "papa", "abuela", "abuelo", "familia", "nena", "nene", "madre", "padre"] 
  },
  { 
    key: "animales_naturaleza", 
    name: "Animales y Naturaleza", 
    keywords: ["perro", "gato", "huella", "arbol", "flor", "hoja", "mariposa", "animal", "delfin", "caballo", "arbol de la vida"] 
  }
];

function getListingTypeFriendlyName(listingTypeId?: string): string {
  if (!listingTypeId) return "Clásica (Sin cuotas)";
  const lt = listingTypeId.toLowerCase();
  if (lt.includes("pro") || lt.includes("premium")) return "Premium (Cuotas sin interés)";
  if (lt.includes("special") || lt.includes("classic") || lt.includes("standard")) return "Clásica (Sin cuotas)";
  return `Clásica (${listingTypeId})`;
}

export async function getCampaignRecommendations(
  supabase: SupabaseClient,
  tenantId: string,
  dateFrom: Date
): Promise<{
  topProducts: TopProductSales[];
  recommendations: CampaignRecommendation[];
}> {
  // 1. Fetch all products (publications) in catalog
  const { data: allProducts, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId);

  if (productsError || !allProducts) {
    console.error("Error fetching products for campaign recommendations:", productsError);
    return { topProducts: [], recommendations: [] };
  }

  // 2. Fetch all orders in the selected period
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", dateFrom.toISOString());

  const orderIds = orders?.map(o => o.id) || [];
  if (orderIds.length === 0) {
    return { topProducts: [], recommendations: [] };
  }

  // 3. Fetch order items for these orders
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, quantity, unit_price, title, sku")
    .in("order_id", orderIds);

  if (itemsError || !items) {
    console.error("Error fetching order items for campaign recommendations:", itemsError);
    return { topProducts: [], recommendations: [] };
  }

  // 4. Aggregate sales by SKU
  const skuSales: Record<string, { unitsSold: number, revenue: number, title: string, productSales: Record<string, number> }> = {};

  items.forEach(item => {
    const sku = item.sku?.trim();
    if (!sku) return;
    const qty = Number(item.quantity) || 0;
    const rev = (Number(item.unit_price) || 0) * qty;

    if (!skuSales[sku]) {
      skuSales[sku] = {
        unitsSold: 0,
        revenue: 0,
        title: item.title || sku,
        productSales: {}
      };
    }
    skuSales[sku].unitsSold += qty;
    skuSales[sku].revenue += rev;
    skuSales[sku].productSales[item.product_id] = (skuSales[sku].productSales[item.product_id] || 0) + qty;
  });

  const sortedSkuSales = Object.entries(skuSales)
    .map(([sku, data]) => ({ sku, ...data }))
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const topProducts: TopProductSales[] = [];
  const recommendations: CampaignRecommendation[] = [];

  // Helper to find the best performing publication for a given SKU
  const findBestPublication = (sku: string, productSales: Record<string, number>) => {
    const matchingPubs = allProducts.filter(p => p.sku?.trim().toLowerCase() === sku.toLowerCase());
    if (matchingPubs.length === 0) return null;

    // Sort product IDs by units sold in the period
    const bestPubId = Object.keys(productSales).sort((a, b) => productSales[b] - productSales[a])[0];
    let bestPub = matchingPubs.find(p => p.id === bestPubId);

    if (!bestPub) {
      // Fallback: publication with highest stock
      bestPub = [...matchingPubs].sort((a, b) => (b.available_quantity || 0) - (a.available_quantity || 0))[0];
    }

    const unitsSold = bestPubId ? (productSales[bestPub.id] || 0) : 0;

    return {
      id: bestPub.id,
      title: bestPub.title,
      price: bestPub.price,
      listingType: getListingTypeFriendlyName(bestPub.listing_type_id),
      permalink: bestPub.permalink,
      unitsSold
    };
  };

  // Process top selling products (up to 10)
  for (const item of sortedSkuSales.slice(0, 10)) {
    const bestPub = findBestPublication(item.sku, item.productSales);
    if (!bestPub) continue;

    topProducts.push({
      sku: item.sku,
      title: item.title,
      unitsSold: item.unitsSold,
      revenue: item.revenue,
      bestPublication: bestPub
    });

    // 5. Generate Campaign Recommendation for this SKU
    const titleLower = item.title.toLowerCase();
    const detectedCategory = PRODUCT_CATEGORIES.find(c => titleLower.includes(c.key));
    const detectedSubTheme = SUB_THEMES.find(theme => 
      theme.keywords.some(keyword => titleLower.includes(keyword))
    );

    // Look for other active/stocked products in the catalog that match category or theme, excluding this SKU
    const candidates = allProducts
      .filter(p => 
        p.status === "active" && 
        (p.available_quantity || 0) > 0 && 
        p.sku?.trim().toLowerCase() !== item.sku.toLowerCase()
      )
      .map(p => {
        let score = 0;
        const pTitleLower = p.title.toLowerCase();

        // category match
        const categoryMatch = detectedCategory && pTitleLower.includes(detectedCategory.key);
        if (categoryMatch) score += 10;

        // sub-theme match
        const subThemeMatch = detectedSubTheme && detectedSubTheme.keywords.some(k => pTitleLower.includes(k));
        if (subThemeMatch) score += 20;

        return { product: p, score };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score || (b.product.sold_quantity || 0) - (a.product.sold_quantity || 0));

    // Only recommend if we can find related publications in the user's actual catalog
    if (candidates.length > 0) {
      // Deduplicate candidates by SKU key to prevent repeating SKUs
      const seenSkus = new Set<string>();
      const uniqueCandidates: typeof candidates = [];

      for (const c of candidates) {
        const rawSku = c.product.sku?.trim().toLowerCase() || "";
        const skuKey = rawSku !== "" ? rawSku.replace(/\s+/g, "") : `no_sku_${c.product.id}`;

        if (!seenSkus.has(skuKey)) {
          seenSkus.add(skuKey);
          uniqueCandidates.push(c);
        }
      }

      if (uniqueCandidates.length === 0) continue;

      const suggestedGroup = uniqueCandidates.slice(0, 4).map(c => ({
        sku: c.product.sku || "",
        title: c.product.title,
        price: c.product.price,
        available_quantity: c.product.available_quantity,
        permalink: c.product.permalink
      }));

      let campaignName = "";
      let reason = "";

      if (detectedSubTheme && detectedCategory) {
        campaignName = `Campamento de ${detectedCategory.name} ${detectedSubTheme.name}`;
        reason = `Impulsá tus ventas promocionando tu producto estrella "${item.title}" en una misma campaña junto a otros ${detectedCategory.name.toLowerCase()} de la temática "${detectedSubTheme.name.toLowerCase()}" de tu catálogo.`;
      } else if (detectedSubTheme) {
        campaignName = `Campaña Temática de ${detectedSubTheme.name}`;
        reason = `Agrupá productos con el mismo concepto de diseño o regalo (${detectedSubTheme.name.toLowerCase()}) para incentivar la compra cruzada en publicidad.`;
      } else if (detectedCategory) {
        campaignName = `Campaña de ${detectedCategory.name}`;
        reason = `Agrupá tu ${detectedCategory.name.toLowerCase()} líder en ventas con otros modelos similares para dar variedad de elección a tus clientes.`;
      } else {
        campaignName = `Campaña de Impulso para ${item.title}`;
        reason = `Crea una campaña publicitaria enfocada en este producto de alta rotación para potenciar su visibilidad.`;
      }

      recommendations.push({
        campaignName,
        category: detectedCategory?.name || "General",
        subTheme: detectedSubTheme?.name,
        primaryProduct: {
          sku: item.sku,
          title: item.title,
          unitsSold: item.unitsSold,
          revenue: item.revenue
        },
        bestPublication: bestPub,
        suggestedGroup,
        reason
      });
    }
  }

  return {
    topProducts,
    recommendations
  };
}
