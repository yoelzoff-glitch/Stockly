import { meliFetch } from "./client";

export async function getShipment(tenantId: string, shipment_id: string) {
  try {
    return await meliFetch({
      tenantId,
      endpoint: `/shipments/${shipment_id}`,
      method: "GET"
    });
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}
