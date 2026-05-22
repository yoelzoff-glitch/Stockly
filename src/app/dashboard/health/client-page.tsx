"use client";

import { HealthStatus, HealthIssue } from "@/services/health/calculateHealth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, TrendingUp, Package, RefreshCw, Bot, Target } from "lucide-react";
import Link from "next/link";

export default function HealthClientPage({ healthData }: { healthData: { score: number, status: HealthStatus, issues: HealthIssue[] } }) {
  
  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case "Excelente": return "text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20";
      case "Bueno": return "text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20";
      case "Atención": return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/20";
      case "Crítico": return "text-red-500 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20";
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      
      {/* Left Column: Score */}
      <div className="md:col-span-1 space-y-6">
        <Card className={`border-2 ${getStatusColor(healthData.status).split(' ')[2]}`}>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Health Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* Fake Gauge */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" 
                  strokeDasharray={`${healthData.score * 2.83} 283`}
                  className={getStatusColor(healthData.status).split(' ')[0]} 
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-bold">{healthData.score}</span>
                <span className={`text-sm font-medium uppercase mt-1 ${getStatusColor(healthData.status).split(' ')[0]}`}>
                  {healthData.status}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Puntaje basado en stock, rentabilidad, competencia y ventas recientes.
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-md">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/products"><Package className="w-4 h-4 mr-2" /> Reponer stock</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/products"><TrendingUp className="w-4 h-4 mr-2" /> Recalcular rentabilidad</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/settings"><RefreshCw className="w-4 h-4 mr-2" /> Sincronizar ahora</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/competition"><Target className="w-4 h-4 mr-2" /> Analizar competencia</Link>
            </Button>
            <Button className="w-full justify-start" asChild>
              <Link href="/dashboard/intelligence"><Bot className="w-4 h-4 mr-2" /> Preguntar a Stockly</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Issues */}
      <div className="md:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Problemas Detectados</CardTitle>
            <CardDescription>
              Resuelve estas alertas para mejorar el puntaje de tu negocio y evitar perder ventas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthData.issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg h-[300px]">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
                <h3 className="text-xl font-bold">¡Todo perfecto!</h3>
                <p className="text-muted-foreground">Tu negocio está funcionando de maravilla. No detectamos ningún problema crítico.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {healthData.issues.map((issue, idx) => (
                  <div key={idx} className={`flex items-start p-4 rounded-lg border ${
                    issue.severity === 'critical' ? 'bg-red-50/50 border-red-200 dark:bg-red-500/10' : 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-500/10'
                  }`}>
                    <AlertCircle className={`w-5 h-5 mt-0.5 mr-3 shrink-0 ${
                      issue.severity === 'critical' ? 'text-red-500' : 'text-yellow-600'
                    }`} />
                    <div>
                      <h4 className="font-semibold text-sm">
                        {issue.severity === 'critical' ? 'Crítico' : 'Advertencia'}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
