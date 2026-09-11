"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CustomerListItem } from "@/services/super-admin/metrics";
import {
  Search,
  Users,
  Calendar,
  DollarSign,
  ArrowUpDown,
  ExternalLink,
  Shield,
} from "lucide-react";

interface CustomersClientProps {
  initialCustomers: CustomerListItem[];
}

export function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const filtered = useMemo(() => {
    return initialCustomers.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchEmail = item.ownerEmail.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchSlug = item.slug.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchId && !matchSlug) return false;
      }

      // Status
      if (statusFilter !== "all") {
        if (statusFilter === "inactive") {
          if (item.activityHealth !== "INACTIVE" && item.activityHealth !== "DORMANT") {
            return false;
          }
        } else if (statusFilter === "active") {
          if (item.status !== "active") return false;
        } else if (statusFilter === "trial") {
          if (item.status !== "trialing") return false;
        } else if (statusFilter === "past_due") {
          if (item.status !== "past_due") return false;
        } else if (statusFilter === "cancelled") {
          if (item.status !== "cancelled") return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // Plan
      if (planFilter !== "all") {
        if (item.planCode !== planFilter) return false;
      }

      return true;
    });
  }, [initialCustomers, search, statusFilter, planFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]";
      case "trialing":
        return "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]";
      case "past_due":
        return "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]";
      case "cancelled":
        return "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]";
      case "paused":
        return "bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]";
      default:
        return "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]";
    }
  };

  const getActivityBadge = (health: string) => {
    switch (health) {
      case "ACTIVE":
        return { text: "Activo (0-7d)", cls: "bg-[#DCFCE7] text-[#15803D]" };
      case "AT_RISK":
        return { text: "En Riesgo (8-14d)", cls: "bg-[#FEF9C3] text-[#A16207]" };
      case "INACTIVE":
        return { text: "Inactivo (15-30d)", cls: "bg-[#FFEDD5] text-[#C2410C]" };
      case "DORMANT":
        return { text: "Dormido (>30d)", cls: "bg-[#FEE2E2] text-[#B91C1C]" };
      case "UNKNOWN":
      default:
        return { text: "Tracking Pendiente", cls: "bg-[#F1F5F9] text-[#64748B]" };
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o tenant ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#3A86FF] focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <span>Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-[#CBD5E1] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#3A86FF] bg-white text-[#0F172A]"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="trial">En Trial</option>
              <option value="past_due">Past Due</option>
              <option value="cancelled">Cancelados</option>
              <option value="inactive">Inactivos (Salud)</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <span>Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-[#CBD5E1] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#3A86FF] bg-white text-[#0F172A]"
            >
              <option value="all">Todos los planes</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="ultra">Ultra</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] uppercase font-bold text-[#64748B] bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Estado Sub</th>
                <th className="px-4 py-3 text-center">Usuarios</th>
                <th className="px-4 py-3">Salud / Últ. Actividad</th>
                <th className="px-4 py-3">Fecha Alta</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3 text-right">MRR</th>
                <th className="px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748B]">
                    No se encontraron clientes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const actBadge = getActivityBadge(c.activityHealth);

                  return (
                    <tr key={c.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.isDemo && (
                            <span className="text-[9px] font-black px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate max-w-[180px]">
                          {c.ownerEmail || c.slug}
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#1E293B] uppercase tracking-wider text-[11px]">
                          {c.planName}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Usuarios */}
                      <td className="px-4 py-3 text-center font-semibold text-[#475569]">
                        {c.userCount}
                      </td>

                      {/* Salud / Actividad */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${actBadge.cls}`}
                          >
                            {actBadge.text}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]">
                            {c.lastActivityAt
                              ? new Date(c.lastActivityAt).toLocaleDateString("es-AR")
                              : "Sin registros"}
                          </span>
                        </div>
                      </td>

                      {/* Fecha Alta */}
                      <td className="px-4 py-3 text-[#475569]">
                        {new Date(c.createdAt).toLocaleDateString("es-AR")}
                      </td>

                      {/* Vencimiento */}
                      <td className="px-4 py-3 text-[#475569]">
                        {c.currentPeriodEnd
                          ? new Date(c.currentPeriodEnd).toLocaleDateString("es-AR")
                          : "—"}
                      </td>

                      {/* MRR */}
                      <td className="px-4 py-3 text-right font-extrabold text-[#0F172A]">
                        $ {c.mrr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </td>

                      {/* Acción */}
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/super-admin/customers/${c.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#3A86FF] hover:bg-[#EFF6FF] rounded-md transition-colors"
                        >
                          <span>Detalle</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
