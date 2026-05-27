"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, { error: null as string | null });

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Panel - Branding & Motivation */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-slate-900 p-12 text-white relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900 opacity-80" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-16">
            <img src="/logo.png" alt="Klyvo Logo" className="w-40 brightness-0 invert" />
          </div>
          
          <div className="mt-20 max-w-lg">
            <h1 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
              Toma el control absoluto de tu negocio en Mercado Libre.
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              "Klyvo se ha convertido en el socio ideal para escalar nuestras ventas. Su inteligencia artificial y sincronización automática nos ahorran horas de trabajo manual todos los días."
            </p>
            <div className="mt-8 flex items-center space-x-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                S
              </div>
              <div>
                <p className="font-medium">El equipo de Klyvo</p>
                <p className="text-sm text-slate-400">Automatizando el E-Commerce</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-500">
          © {new Date().getFullYear()} Klyvo. Todos los derechos reservados.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            {/* Mobile Logo */}
            <div className="flex lg:hidden justify-center mb-8">
              <img src="/logo.png" alt="Klyvo Logo" className="w-48" />
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
              Bienvenido de nuevo
            </h2>
            <p className="text-slate-500">
              Ingresa tus credenciales para acceder a tu panel de control.
            </p>
          </div>

          <form action={formAction} className="space-y-6 mt-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">Email corporativo</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="m@ejemplo.com" 
                  required 
                  disabled={isPending}
                  className="h-11 px-4 bg-slate-50 border-slate-200 focus-visible:ring-indigo-600"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Contraseña</Label>
                  <Link href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  disabled={isPending} 
                  className="h-11 px-4 bg-slate-50 border-slate-200 focus-visible:ring-indigo-600"
                />
              </div>
            </div>

            {state?.error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600 font-medium text-center">{state.error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-base font-medium transition-all shadow-sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar a mi cuenta"
              )}
            </Button>

            <div className="text-center text-sm text-slate-600 mt-6">
              ¿Aún no tienes una cuenta?{" "}
              <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
                Regístrate y comienza gratis
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
