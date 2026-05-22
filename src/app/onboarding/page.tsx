"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";
import { submitOnboardingAction } from "@/actions/tenants";

export default function OnboardingPage() {
  const [state, formAction, isPending] = useActionState(submitOnboardingAction, null);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">¡Bienvenido a Stockly!</CardTitle>
          <CardDescription>
            Cuéntanos un poco sobre tu negocio para preparar tu entorno.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Nombre del Negocio</Label>
              <Input id="companyName" name="companyName" type="text" placeholder="Mi Tienda" required disabled={isPending} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <select 
                  id="category" 
                  name="category" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  required
                  disabled={isPending}
                >
                  <option value="">Selecciona...</option>
                  <option value="electronics">Electrónica</option>
                  <option value="clothing">Ropa y Accesorios</option>
                  <option value="home">Hogar y Muebles</option>
                  <option value="toys">Juguetes</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="businessSize">Tamaño del Negocio</Label>
                <select 
                  id="businessSize" 
                  name="businessSize" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  required
                  disabled={isPending}
                >
                  <option value="">Selecciona...</option>
                  <option value="1-5">1 - 5 empleados</option>
                  <option value="6-20">6 - 20 empleados</option>
                  <option value="21-50">21 - 50 empleados</option>
                  <option value="50+">Más de 50</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="country">País</Label>
                <select 
                  id="country" 
                  name="country" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  required
                  disabled={isPending}
                >
                  <option value="AR">Argentina</option>
                  <option value="MX">México</option>
                  <option value="CO">Colombia</option>
                  <option value="CL">Chile</option>
                  <option value="PE">Perú</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="currency">Moneda Base</Label>
                <select 
                  id="currency" 
                  name="currency" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  required
                  disabled={isPending}
                >
                  <option value="ARS">ARS - Peso Argentino</option>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="CLP">CLP - Peso Chileno</option>
                  <option value="USD">USD - Dólar</option>
                </select>
              </div>
            </div>

            {state?.error && (
              <p className="text-sm text-destructive font-medium">{state.error}</p>
            )}

            <Button type="submit" className="w-full mt-2" disabled={isPending}>
              {isPending ? "Configurando entorno..." : "Comenzar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
