"use client";

import { ActivationStep, markStepCompletedAction } from "@/actions/activation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function GetStartedClient({ data }: { data: { steps: ActivationStep[], percentage: number, completedSteps: number, totalSteps: number } }) {
  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  const handleManualComplete = async (stepId: string) => {
    setLoadingStep(stepId);
    try {
      await markStepCompletedAction(stepId);
    } catch (e) {
      console.error(e);
    }
    setLoadingStep(null);
  };

  return (
    <div className="max-w-3xl mx-auto mt-8 space-y-6">
      
      <Card>
        <CardHeader>
          <CardTitle>Tu Progreso: {data.percentage}%</CardTitle>
          <CardDescription>
            Has completado {data.completedSteps} de {data.totalSteps} pasos recomendados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-4 overflow-hidden border">
            <div 
              className="bg-primary h-4 transition-all duration-500 ease-in-out" 
              style={{ width: `${data.percentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {data.steps.map((step) => {
          const isManual = step.id === "connect_whatsapp" || step.id === "first_ai_query";
          return (
            <Card key={step.id} className={step.completed ? "border-green-500/50 bg-green-50/10" : ""}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  {step.completed ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : (
                    <Circle className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className={`text-lg font-medium ${step.completed ? "text-green-700 dark:text-green-400" : ""}`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.completed ? "¡Completado!" : "Pendiente de configuración"}
                    </p>
                  </div>
                </div>

                {!step.completed && (
                  <div className="flex gap-2">
                    {isManual && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleManualComplete(step.id)}
                        disabled={loadingStep === step.id}
                      >
                        {loadingStep === step.id ? "Marcando..." : "Marcar listo"}
                      </Button>
                    )}
                    {step.actionUrl && (
                      <Button asChild>
                        <Link href={step.actionUrl}>
                          Ir a configurar <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
