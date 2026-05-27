"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionState } from "react";
import { retryPaymentAction } from "@/actions/auth";
import { Loader2, AlertCircle } from "lucide-react";

export default function PaymentPendingScreen({ plan }: { plan: string }) {
  const [state, formAction, isPending] = useActionState(retryPaymentAction, { error: null as string | null });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-orange-200 bg-orange-50/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <AlertCircle className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl text-orange-800">Pago Pendiente</CardTitle>
          <CardDescription className="text-orange-700/80">
            Para continuar configurando tu empresa y acceder al plan <strong>Klyvo {plan.charAt(0).toUpperCase() + plan.slice(1)}</strong>, necesitas completar tu pago en Mercado Pago.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            {state?.error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirigiendo a Mercado Pago...
                </>
              ) : (
                "Continuar al Pago"
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
              onClick={() => window.location.href = "/login"}
            >
              Volver al inicio
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
