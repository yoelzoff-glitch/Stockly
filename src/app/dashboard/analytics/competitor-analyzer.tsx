"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
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
import { OperationalPanel } from "@/components/operational/panel";
import { StatusBadge } from "@/components/ui/status-badge";

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

    const steps = [
      "Extrayendo datos de la publicación...",
      "Obteniendo reputación del vendedor...",
      "Consultando descripción del producto...",
      "Procesando parámetros comerciales...",
      "Estructurando recomendaciones estratégicas..."
    ];

    let currentStep = 0;
    setLoadingStep(steps[currentStep]);

    const interval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setLoadingStep(steps[currentStep]);
      }
    }, 2200);

    try {
      let itemId = "";
      const widMatch = url.match(/[?&#]wid=(ML[A-Z]{0,2}\d{8,12})/i);
      if (widMatch) {
        itemId = widMatch[1].toUpperCase();
      } else {
        const match = url.match(/(ML[A-Z]{1,2})[-_]?(\d{8,12})/i);
        if (!match) {
          throw new Error("URL inválida. Asegúrate de ingresar un enlace válido de una publicación de Mercado Libre.");
        }
        itemId = `${match[1].toUpperCase()}${match[2]}`;
      }

      const hasWid = /[?&]wid=/i.test(url);
      const isCatalogUrl = !hasWid && (itemId.startsWith("MLAU") || url.includes("/p/") || url.includes("/up/"));

      let itemData: any = null;
      let sellerData: any = null;
      let description = "";
      let isCatalogProduct = false;
      let resolvedId = itemId;

      try {
        if (isCatalogUrl) {
          const idsToTry = [itemId];
          if (itemId.startsWith("MLAU")) {
            idsToTry.push("MLA" + itemId.substring(4));
          }

          let productData: any = null;
          for (const idToTry of idsToTry) {
            try {
              const res = await fetch(`https://api.mercadolibre.com/products/${idToTry}`);
              if (res.ok) {
                productData = await res.json();
                break;
              }
            } catch (e) {
              console.warn(`Client-side product fetch failed for ${idToTry}`, e);
            }
          }

          if (productData) {
            const buyBoxItemId = productData.buy_box_winner?.item_id;
            if (buyBoxItemId) {
              resolvedId = buyBoxItemId;
              try {
                const itemRes = await fetch(`https://api.mercadolibre.com/items/${buyBoxItemId}`);
                if (itemRes.ok) {
                  itemData = await itemRes.json();
                }
              } catch (e) {
                console.warn("Client-side buy box item fetch failed", e);
              }
            }
            if (!itemData) {
              itemData = productData;
              isCatalogProduct = true;
            }
          }
        } else {
          const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
          if (itemRes.ok) {
            itemData = await itemRes.json();
            resolvedId = itemId;
          }
        }

        if (itemData) {
          if (!isCatalogProduct) {
            try {
              const descRes = await fetch(`https://api.mercadolibre.com/items/${resolvedId}/description`);
              if (descRes.ok) {
                const descData = await descRes.json();
                description = descData.plain_text || "";
              }
            } catch (e) {
              console.warn("Client-side description fetch failed", e);
            }
          }

          const sellerId = itemData.seller_id || itemData.seller?.id || itemData.buy_box_winner?.seller_id;
          if (sellerId) {
            try {
              const sellerRes = await fetch(`https://api.mercadolibre.com/users/${sellerId}`);
              if (sellerRes.ok) {
                sellerData = await sellerRes.json();
              }
            } catch (e) {
              console.warn("Client-side seller fetch failed", e);
            }
          }
        }
      } catch (clientErr) {
        console.warn("Client-side direct fetch failed, falling back to server", clientErr);
      }

      if (!itemData) {
        const resolveResponse = await fetch("/api/ai/competitor-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "resolve", url }),
        });

        const resolveData = await resolveResponse.json();

        if (!resolveResponse.ok) {
          throw new Error(resolveData.error || "Ocurrió un error al obtener la publicación de Mercado Libre.");
        }

        itemData = resolveData.data.itemData;
        sellerData = resolveData.data.sellerData;
        isCatalogProduct = resolveData.data.isCatalogProduct;
        resolvedId = resolveData.data.id;

        if (resolvedId && !isCatalogProduct && !description) {
          try {
            const descRes = await fetch(`https://api.mercadolibre.com/items/${resolvedId}/description`);
            if (descRes.ok) {
              const descData = await descRes.json();
              description = descData.plain_text || "";
            }
          } catch (e) {
            console.warn("Failed to fetch description after server resolution", e);
          }
        }
      }

      const analyzeResponse = await fetch("/api/ai/competitor-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "analyze",
          itemData,
          sellerData,
          description,
          isCatalogProduct,
          resolvedId,
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        throw new Error(analyzeData.error || "Ocurrió un error al generar el análisis.");
      }

      setResult(analyzeData.data);
    } catch (err: any) {
      setError(err.message || "Error al analizar la publicación.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <OperationalPanel
        title="Benchmarking de Publicaciones de la Competencia"
        description="Pega el enlace de una publicación rival en Mercado Libre para evaluar precio, tipo de listado, envíos y puntos débiles."
      >
        <form onSubmit={handleAnalyze} className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5F6875]" />
              <input
                type="url"
                placeholder="https://articulo.mercadolibre.com.ar/MLA-..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-[#DCDAD4] rounded-md text-[#101828] focus:outline-none focus:border-[#102A56] focus:ring-1 focus:ring-[#102A56] shadow-sm"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold text-xs h-9 px-4 shrink-0 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                  Analizando...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Analizar Publicación
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex gap-2 items-start p-3 bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </OperationalPanel>

      {/* Loading state */}
      {loading && (
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#DCDAD4] border-t-[#102A56] rounded-full animate-spin" />
            <h3 className="text-sm font-semibold text-[#101828]">Analizando publicación de mercado</h3>
            <p className="text-xs text-[#5F6875] font-mono">{loadingStep}</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="grid gap-6 md:grid-cols-12">
          {/* Competitor Listing Widget (Left Column) */}
          <div className="md:col-span-4 space-y-4">
            <OperationalPanel title="Publicación Analizada">
              <div className="flex items-start gap-3 pt-1">
                {result.thumbnail && (
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-16 h-16 object-cover rounded border border-[#DCDAD4] bg-[#FCFCFA] shrink-0"
                  />
                )}
                <div className="space-y-1 min-w-0">
                  <h4 className="font-semibold text-xs text-[#101828] leading-snug truncate-2-lines" title={result.title}>
                    {result.title}
                  </h4>
                  {result.permalink && (
                    <a
                      href={result.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#102A56] hover:underline font-semibold"
                    >
                      Ver en Mercado Libre <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="border-t border-[#DCDAD4] mt-4 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#5F6875]">Precio:</span>
                  <span className="text-base font-bold font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${result.price?.toLocaleString("es-AR")}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#5F6875] flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Tipo de Exposición:</span>
                  <span className="text-xs font-semibold text-[#101828] font-mono">
                    {result.listingType}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#5F6875] flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Envío:</span>
                  <span className="font-medium text-[#101828]">{result.shipping}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#5F6875] flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Vendedor:</span>
                  <span className="font-medium text-[#101828] text-right truncate max-w-[140px]">{result.reputation}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#5F6875]">Ventas estimadas:</span>
                  <span className="font-mono font-semibold text-[#198754]">
                    {result.estimatedSales}
                  </span>
                </div>
              </div>
            </OperationalPanel>
          </div>

          {/* Detailed Strategic Analysis (Right Column) */}
          <div className="md:col-span-8 space-y-6">
            <OperationalPanel
              title="Diagnóstico Comparativo de la Publicación"
              description="Evaluación de ventajas competitivas, puntos débiles y brechas de mercado."
            >
              <div className="space-y-4 pt-1">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Strengths */}
                  <div className="bg-[#FCFCFA] border border-[#DCDAD4] p-3.5 rounded-md space-y-2">
                    <h5 className="font-semibold text-[#198754] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Puntos Fuertes del Rival
                    </h5>
                    <ul className="space-y-1.5 text-xs text-[#101828]">
                      {result.analysis?.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#198754]">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-[#FEF3F2] border border-[#FECDCA] p-3.5 rounded-md space-y-2">
                    <h5 className="font-semibold text-[#B42318] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <XCircle className="w-3.5 h-3.5" />
                      Puntos Débiles Detectados
                    </h5>
                    <ul className="space-y-1.5 text-xs text-[#101828]">
                      {result.analysis?.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#B42318]">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Opportunities */}
                <div className="bg-[#FCFCFA] border border-[#DCDAD4] p-3.5 rounded-md space-y-2">
                  <h5 className="font-semibold text-[#102A56] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Lightbulb className="w-3.5 h-3.5 text-[#102A56]" />
                    Oportunidades de Captura de Demanda
                  </h5>
                  <ul className="space-y-1.5 text-xs text-[#101828]">
                    {result.analysis?.opportunities?.map((o: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#102A56] font-bold font-mono">→</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </OperationalPanel>

            {/* Pricing Strategy & Plan */}
            <OperationalPanel title="Estrategia de Precio y Financiación Sugerida">
              <p className="text-xs text-[#101828] leading-relaxed pt-1">
                {result.pricingStrategy}
              </p>
            </OperationalPanel>

            {/* Action Plan */}
            <OperationalPanel
              title="Plan de Acción Operativo"
              description="Medidas ordenadas para mejorar el posicionamiento respecto a esta publicación."
            >
              <div className="space-y-2.5 pt-1">
                {result.actionPlan?.map((step: string, idx: number) => (
                  <div key={idx} className="flex gap-2.5 items-start bg-[#FCFCFA] border border-[#DCDAD4] p-2.5 rounded text-xs">
                    <div className="w-5 h-5 rounded bg-[#102A56] text-white flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                      {idx + 1}
                    </div>
                    <p className="text-[#101828] font-medium pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </OperationalPanel>

            <div className="text-[11px] text-[#5F6875] text-right">
              Fuente de datos del competidor: API pública de Mercado Libre.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
