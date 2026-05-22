import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    // Si da error PGRST116 es porque el usuario no tiene perfil (ej: se registró antes de implementar la lógica o falló a medias).
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Cuenta</h2>
        <p className="text-muted-foreground">Error al cargar la información del perfil.</p>
      </div>
    );
  }

  // En Supabase, un join 1:1 puede devolver un objeto o un array de 1 elemento dependiendo de la FK
  // Como profile pertenece a UN tenant, suele ser un objeto, o un array (si es one-to-many inverso). 
  // Lo tratamos asumiendo que es un objeto (si devuelve array tomamos el 0).
  const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Cuenta y Plan</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Perfil</CardTitle>
            <CardDescription>
              Tus datos personales como usuario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre Completo</p>
              <p className="text-lg">{profile.full_name || "Sin nombre"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg">{profile.email || user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rol</p>
              <Badge variant="outline" className="mt-1 capitalize">
                {profile.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos del Negocio (Tenant)</CardTitle>
            <CardDescription>
              Información sobre tu tienda y suscripción actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant ? (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nombre del Negocio</p>
                  <p className="text-lg">{tenant.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Slug</p>
                  <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Plan</p>
                    <Badge className="mt-1 capitalize bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                      {tenant.plan}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Estado</p>
                    <Badge 
                      variant={tenant.status === 'active' ? 'default' : 'secondary'} 
                      className="mt-1 capitalize"
                    >
                      {tenant.status}
                    </Badge>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No se encontró un negocio asociado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
