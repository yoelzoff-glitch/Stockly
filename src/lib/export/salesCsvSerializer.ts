/**
 * Pure serialization utility for sales orders CSV export.
 * Preserves the exact 58211d3 functional contract, column order, comma delimiter, and escaping.
 */

export interface RawOrderItem {
  quantity?: number | string;
  item?: {
    title?: string;
  };
}

export interface ExportableOrder {
  date_created: string;
  meli_order_id?: string | null;
  buyer_nickname?: string | null;
  product_title?: string | null;
  total_amount: number | string;
  status: string;
  raw_data?: {
    order_items?: RawOrderItem[];
    [key: string]: any;
  } | null;
}

export const SALES_CSV_HEADERS = [
  "Fecha",
  "Nº Orden",
  "Comprador",
  "Producto",
  "Cantidad",
  "Total (ARS)",
  "Estado",
];

export function serializeSalesExportCsv(
  orders: ExportableOrder[],
  search?: string | null
): string {
  const searchTerm = search ? search.trim().toLowerCase() : "";

  // Filter in-memory
  const filteredOrders = orders.filter((o) => {
    if (!searchTerm) return true;

    const buyerMatch = o.buyer_nickname?.toLowerCase().includes(searchTerm);
    const orderIdMatch = o.meli_order_id?.toLowerCase().includes(searchTerm);
    const productTitleMatch = o.product_title?.toLowerCase().includes(searchTerm);

    return !!(buyerMatch || orderIdMatch || productTitleMatch);
  });

  const csvRows: string[] = [];
  csvRows.push(SALES_CSV_HEADERS.join(","));

  for (const o of filteredOrders) {
    const date = new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(o.date_created));

    const raw = o.raw_data as any;
    const titleVal = raw?.order_items?.[0]?.item?.title || o.product_title || "Varios productos";
    const title = `"${String(titleVal).replace(/"/g, '""')}"`;
    const buyer = `"${(o.buyer_nickname || "").replace(/"/g, '""')}"`;
    const quantity =
      raw?.order_items?.reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 1),
        0
      ) || 1;

    const row = [
      date,
      o.meli_order_id ?? "",
      buyer,
      title,
      quantity,
      o.total_amount,
      o.status,
    ];
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}
