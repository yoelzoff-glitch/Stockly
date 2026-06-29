"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Link2, 
  Search, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Lightbulb, 
  ListChecks, 
  ExternalLink, 
  AlertCircle,
  Truck,
  CreditCard,
  UserCheck
} from "lucide-react";

export default function CompetitorAnalyzer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    // Dynamic loading messages
    const steps = [
      "Extrayendo datos de la publicación...",
      "Obteniendo reputación del vendedor...",
      "Consultando ficha técnica...",
      "Enviando datos a Gemini para el análisis...",
      "Estructurando recomendaciones estratégicas..."
    ];

    let currentStep = 0;
    setLoadingStep(steps[currentStep]);
    
    const interval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setLoadingStep(steps[currentStep]);
      }
    }, 2500);

    try {
      const response = await fetch("/api/ai/competitor-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error al analizar la publicación.");
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message || "Error de conexión. Inténtalo de nuevo.");
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form Card */}
      <Card className="shadow-md border-indigo-100 bg-gradient-to-br from-indigo-50/5 to-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <CardTitle>Analizador de Competencia Inteligente</CardTitle>
          </div>
          <CardDescription>
            Ingresá el enlace de cualquier publicación de tu competencia en Mercado Libre. La IA de Gemini analizará sus precios, financiación, envío, reputación y te dará una estrategia para superarla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="url"
                  placeholder="https://articulo.mercadolibre.com.ar/MLA-..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading || !url.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shrink-0 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Analizar Publicación
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="flex gap-2 items-start p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-lg animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card className="p-12 text-center border-slate-200 shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <Sparkles className="absolute w-6 h-6 text-indigo-500 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Analizando con Gemini 1.5 Flash</h3>
            <p className="text-sm text-slate-500 animate-pulse">{loadingStep}</p>
          </div>
        </Card>
      )}

      {/* Results View */}
      {result && (
        <div className="grid gap-6 md:grid-cols-12 animate-fade-in">
          {/* Competitor Listing Widget (Left Column) */}
          <Card className="md:col-span-4 shadow-sm border-slate-200 h-fit">
            <CardHeader className="pb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Publicación Analizada</span>
              <div className="mt-2 flex items-start gap-3">
                {result.thumbnail && (
                  <img 
                    src={result.thumbnail} 
                    alt={result.title} 
                    className="w-16 h-16 object-cover rounded-lg border bg-slate-50 shrink-0"
                  />
                )}
                <div className="space-y-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-800 leading-snug truncate-2-lines" title={result.title}>
                    {result.title}
                  </h4>
                  <a 
                    href={result.permalink} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-medium"
                  >
                    Ver en Mercado Libre <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardHeader>
            <CardContent className="border-t pt-4 space-y-4 text-xs">
              <div className="space-y-3">
                {/* Price */}
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500">Precio actual:</span>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-slate-900">${result.price?.toLocaleString("es-AR")}</span>
                  </div>
                </div>

                {/* Listing Type / Cuotas */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-slate-400" /> Financiación:</span>
                  <Badge variant="outline" className={result.listingType?.includes("Premium") ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700"}>
                    {result.listingType}
                  </Badge>
                </div>

                {/* Shipping */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-slate-400" /> Envío:</span>
                  <span className="font-semibold text-slate-700">{result.shipping}</span>
                </div>

                {/* Reputation */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-slate-400" /> Vendedor:</span>
                  <span className="font-semibold text-slate-700 text-right">{result.reputation}</span>
                </div>

                {/* Estimated Sales */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ventas estimadas:</span>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold">
                    {result.estimatedSales}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Strategic Analysis (Right Column) */}
          <div className="md:col-span-8 space-y-6">
            
            {/* SWOT / Strengths, Weaknesses, Opportunities */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Análisis DAFO del Competidor
                </CardTitle>
                <CardDescription>Puntos críticos identificados en la publicación del rival.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Strengths */}
                  <div className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-xl space-y-2">
                    <h5 className="font-bold text-emerald-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Puntos Fuertes
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {result.analysis?.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-rose-50/20 border border-rose-100 p-4 rounded-xl space-y-2">
                    <h5 className="font-bold text-rose-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Puntos Débiles
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {result.analysis?.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-rose-500">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Opportunities */}
                <div className="bg-amber-50/20 border border-amber-100 p-4 rounded-xl space-y-2">
                  <h5 className="font-bold text-amber-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4 text-amber-600 animate-pulse" />
                    Tus Oportunidades para Competir
                  </h5>
                  <ul className="space-y-2 text-xs text-slate-700 font-medium">
                    {result.analysis?.opportunities?.map((o: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500">⭐</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Strategy & Plan */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-indigo-500" />
                  Estrategia de Precio y Financiación
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                {result.pricingStrategy}
              </CardContent>
            </Card>

            {/* Action Plan */}
            <Card className="shadow-sm border-slate-200 bg-slate-50/40">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-emerald-600" />
                  Plan de Acción Sugerido por la IA
                </CardTitle>
                <CardDescription>Pasos ordenados para ganar relevancia frente a esta publicación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {result.actionPlan?.map((step: string, idx: number) => (
                  <div key={idx} className="flex gap-3 items-start bg-white border p-3 rounded-lg shadow-sm">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-slate-700 font-medium pt-0.5">{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Footnote */}
            <p className="text-[10px] text-slate-400 text-right italic">
              Análisis dinámico generado mediante modelos de inteligencia artificial de Google Gemini 1.5. Los datos de la publicación son provistos en tiempo real por la API de Mercado Libre.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
