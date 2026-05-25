"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";
import { registerAction } from "@/actions/auth";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, null);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Stockly Logo" className="w-full max-w-[200px] h-auto" />
          </div>
          <CardTitle className="text-2xl mt-2">Crear Cuenta</CardTitle>
          <CardDescription>
            Ingresa tus datos para registrarte en Stockly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Tu Nombre</Label>
              <Input id="name" name="name" type="text" placeholder="Juan Pérez" required disabled={isPending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="m@ejemplo.com" required disabled={isPending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required disabled={isPending} />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive font-medium">{state.error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Registrando..." : "Registrarse"}
            </Button>
            
            <div className="mt-4 text-center text-sm">
              ¿Ya tienes una cuenta?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Ingresa aquí
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
