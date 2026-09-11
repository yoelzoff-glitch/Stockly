import { getCustomersList } from "@/services/super-admin/metrics";
import { CustomersClient } from "./CustomersClient";
import { Users } from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminCustomersPage() {
  const customers = await getCustomersList();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Gestión de Clientes / Tenants
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Explora, filtra y administra todas las cuentas registradas en la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[#334155]">
          <Users className="w-4 h-4 text-[#3A86FF]" />
          <span>{customers.length} cuentas registradas</span>
        </div>
      </div>

      {/* Interactive Table with Filters and Search */}
      <CustomersClient initialCustomers={customers} />
    </div>
  );
}
