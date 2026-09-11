import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/services/super-admin/customerDetail";
import { CustomerDetailClient } from "./CustomerDetailClient";

export const revalidate = 0;

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getCustomerDetail(tenantId);

  if (!detail) {
    notFound();
  }

  return <CustomerDetailClient data={detail} />;
}
