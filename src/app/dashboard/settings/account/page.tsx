import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { Button } from "@/components/ui/button";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Fetch profile and nested tenant data
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      is_active,
      tenants (
        id,
        name,
        slug,
        plan,
        status
      )
    `)
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return (
      <div className="flex-1 p-6 md:p-8 space-y-4">
        <h2 className="text-xl font-bold text-[#101828]">Cuenta</h2>
        <p className="text-xs text-[#5F6875]">Error al cargar la información del perfil.</p>
      </div>
    );
  }

  const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Cuenta y Negocio"
        description="Identidad del usuario operador, permisos de acceso y datos del tenant registrado."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-4">
          <div className="border-b border-[#DCDAD4] pb-3">
            <h3 className="text-sm font-semibold text-[#101828]">Información Personal</h3>
            <p className="text-xs text-[#5F6875]">Credenciales de acceso y contacto del operador.</p>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#5F6875] block font-medium">Nombre Completo:</span>
              <span className="text-sm font-semibold text-[#101828]">{profile.full_name || "Sin nombre registrado"}</span>
            </div>
            <div>
              <span className="text-[#5F6875] block font-medium">Correo Electrónico:</span>
              <span className="text-sm font-mono text-[#101828]">{profile.email || user.email}</span>
            </div>
            <div>
              <span className="text-[#5F6875] block font-medium mb-1">Rol en la Plataforma:</span>
              <StatusBadge variant="neutral">
                {profile.role ? profile.role.toUpperCase() : "ADMIN"}
              </StatusBadge>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-4">
          <div className="border-b border-[#DCDAD4] pb-3">
            <h3 className="text-sm font-semibold text-[#101828]">Datos de la Empresa (Tenant)</h3>
            <p className="text-xs text-[#5F6875]">Información del comercio y plan contratado.</p>
          </div>
          <div className="space-y-3 text-xs">
            {tenant ? (
              <>
                <div>
                  <span className="text-[#5F6875] block font-medium">Razón Social / Nombre:</span>
                  <span className="text-sm font-semibold text-[#101828]">{tenant.name}</span>
                </div>
                <div>
                  <span className="text-[#5F6875] block font-medium">Identificador Slug:</span>
                  <span className="text-xs font-mono text-[#5F6875]">{tenant.slug}</span>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <div>
                    <span className="text-[#5F6875] block font-medium mb-1">Plan Activo:</span>
                    <StatusBadge variant="info">
                      {tenant.plan ? tenant.plan.toUpperCase() : "STARTER"}
                    </StatusBadge>
                  </div>
                  <div>
                    <span className="text-[#5F6875] block font-medium mb-1">Estado:</span>
                    <StatusBadge variant={tenant.status === "active" ? "success" : "neutral"}>
                      {tenant.status === "active" ? "Vigente" : tenant.status}
                    </StatusBadge>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#5F6875]">No se encontró un negocio asociado.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#DCDAD4] bg-[#FCFCFA] p-6 space-y-3 max-w-2xl">
        <h3 className="text-sm font-semibold text-[#101828]">Exportación de Respaldo</h3>
        <p className="text-xs text-[#5F6875] leading-relaxed">
          Descarga un archivo Excel (.xlsx) con la totalidad de tus publicaciones, pedidos, ventas históricas y comisiones procesadas en Klyvo.
        </p>
        <div className="pt-2">
          <a href="/api/export" download="klyvo_backup.xlsx">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
            >
              Exportar datos empresa (.xlsx)
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
