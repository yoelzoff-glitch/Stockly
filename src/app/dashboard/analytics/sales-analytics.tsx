"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  MapPin, 
  CreditCard, 
  TrendingUp, 
  Sparkles, 
  HelpCircle, 
  Percent 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProvinceSale {
  province: string;
  count: number;
  revenue: number;
}

interface PaymentType {
  name: string;
  count: number;
  revenue: number;
  color: string;
}

interface InstallmentDetail {
  installments: number;
  name: string;
  count: number;
  revenue: number;
}

export default function SalesAnalytics({
  provinceSales,
  paymentTypeData,
  installmentDetails
}: {
  provinceSales: ProvinceSale[];
  paymentTypeData: PaymentType[];
  installmentDetails: InstallmentDetail[];
}) {
  // Take top 8 provinces for the chart to keep it clean
  const topProvinces = provinceSales.slice(0, 8);

  const totalSalesCount = provinceSales.reduce((acc, curr) => acc + curr.count, 0);
  const totalRevenue = provinceSales.reduce((acc, curr) => acc + curr.revenue, 0);

  // Find leading province
  const leadingProvince = provinceSales[0]?.province || "Ninguna";
  const leadingProvinceCount = provinceSales[0]?.count || 0;
  const leadingProvincePercent = totalSalesCount > 0 ? ((leadingProvinceCount / totalSalesCount) * 100).toFixed(1) : 0;

  // Find financing preference
  const installmentSalesCount = paymentTypeData.find(p => p.name === "En cuotas")?.count || 0;
  const installmentPercent = totalSalesCount > 0 ? ((installmentSalesCount / totalSalesCount) * 100) : 0;

  // Dynamic Insight message
  let insightTitle = "Distribución Geográfica Óptima";
  let insightText = "Tus ventas muestran una distribución equilibrada. Considerá reforzar campañas publicitarias locales en las provincias con mayor intención de compra para maximizar el retorno de inversión.";
  
  if (parseFloat(leadingProvincePercent.toString()) > 45) {
    insightTitle = `Concentración en ${leadingProvince}`;
    insightText = `Más del ${leadingProvincePercent}% de tus ventas se concentran en ${leadingProvince}. Considerá establecer promociones de envío gratis exclusivas para esta zona o realizar campañas de marketing súper segmentadas para consolidar tu liderazgo aquí.`;
  }

  let financingInsightTitle = "Estrategia de Financiación";
  let financingInsightText = "Los compradores prefieren abonar en un solo pago. Si vendés productos de ticket alto, considera activar publicaciones Premium (que ofrecen cuotas sin interés) para elevar el ticket promedio.";

  if (installmentPercent > 40) {
    financingInsightTitle = "Alta demanda de financiación";
    financingInsightText = `El ${installmentPercent.toFixed(1)}% de tus clientes elige pagar en cuotas. La financiación es clave para tu negocio. Asegurá la rentabilidad de tus publicaciones Premium y considerá amortizar el costo de la comisión de cuotas sin interés en tu precio de lista.`;
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Zona con mayor demanda</CardTitle>
            <MapPin className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 truncate" title={leadingProvince}>{leadingProvince}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {leadingProvinceCount} ventas ({leadingProvincePercent}% del total)
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Preferencia de Financiación</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {installmentPercent > 50 ? "En Cuotas" : "Un Solo Pago"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {installmentPercent.toFixed(1)}% de compras financiadas en cuotas
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-indigo-50/20 border-indigo-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-indigo-800 uppercase tracking-wider">Insight de Ventas</CardTitle>
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-slate-900 leading-tight">
              {installmentPercent > 40 ? "Priorizar Cuotas sin Interés" : "Foco en envíos rápidos"}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-snug">
              {installmentPercent > 40 
                ? "Tus clientes son sensibles a la financiación. Ofrecer cuotas impulsará tus ventas." 
                : "Tus ventas se concentran en un pago. Priorizá velocidad de entrega sobre cuotas."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 md:grid-cols-12">
        
        {/* Province Sales Chart */}
        <Card className="md:col-span-7 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-400" />
              Distribución por Provincias
            </CardTitle>
            <CardDescription>
              Cantidad de ventas y facturación bruta generada por provincia en el periodo seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[380px]">
            {topProvinces.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProvinces}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis 
                    dataKey="province" 
                    type="category" 
                    tick={{ fontSize: 10, fill: "#64748b" }} 
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === "Facturación") return [`$${value.toLocaleString("es-AR")}`, name];
                      return [`${value} ventas`, name];
                    }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#6366f1" name="Ventas (cant.)" barSize={12} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="revenue" fill="#10b981" name="Facturación" barSize={12} radius={[0, 4, 4, 0]} hide={true} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No hay datos geográficos disponibles.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Financing Pie Chart */}
        <Card className="md:col-span-5 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-400" />
              Preferencia de Pago
            </CardTitle>
            <CardDescription>
              Proporción de ventas cobradas en un pago único frente a ventas en cuotas.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[380px] flex flex-col justify-between">
            {totalSalesCount > 0 ? (
              <>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {paymentTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name: any) => [`${value} ventas (${((value / totalSalesCount) * 100).toFixed(1)}%)`, name]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Micro metrics breakdown */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Facturación Un Pago</span>
                    <p className="text-sm font-semibold text-emerald-600">
                      ${(paymentTypeData.find(p => p.name === "Un solo pago")?.revenue || 0).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Facturación Cuotas</span>
                    <p className="text-sm font-semibold text-blue-600">
                      ${(paymentTypeData.find(p => p.name === "En cuotas")?.revenue || 0).toLocaleString("es-AR")}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No hay datos de pago disponibles.
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Detailed Installments Distribution & Regional Analysis */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Installments detail chart */}
        <Card className="md:col-span-6 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Percent className="w-5 h-5 text-slate-400" />
              Desglose Detallado de Cuotas
            </CardTitle>
            <CardDescription>
              Distribución exacta del número de cuotas seleccionadas por los clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {installmentDetails.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={installmentDetails}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} ventas`, "Cantidad"]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" barSize={25} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No hay detalles de cuotas.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actionable Insights Box */}
        <Card className="md:col-span-6 shadow-sm border-indigo-100 bg-gradient-to-br from-indigo-50/10 to-white flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">Acción Comercial Recomendada</CardTitle>
            </div>
            <CardDescription>Recomendaciones basadas en datos para tus próximas campañas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-l-4 border-indigo-500 pl-4 py-1">
                <h5 className="font-semibold text-slate-800 text-sm">{insightTitle}</h5>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{insightText}</p>
              </div>

              <div className="border-l-4 border-emerald-500 pl-4 py-1">
                <h5 className="font-semibold text-slate-800 text-sm">{financingInsightTitle}</h5>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{financingInsightText}</p>
              </div>
            </div>

            <div className="bg-indigo-50/30 p-3 rounded-lg text-[11px] text-indigo-700 font-medium border border-indigo-100/50 mt-4">
              Tip: Podés cruzar estos datos con la sección de <strong>Impulso de Campañas</strong> para seleccionar el producto ideal para promocionar específicamente en las provincias líderes de tu ranking.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Complete Table of Provinces for exact data reference */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold">Tabla de Ventas por Región</CardTitle>
          <CardDescription>Listado completo de todas las provincias con ventas concretadas en este período.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Provincia</th>
                  <th className="px-4 py-3 text-right">Cantidad de Ventas</th>
                  <th className="px-4 py-3 text-right">Facturación Bruta</th>
                  <th className="px-4 py-3 text-right">% de Ventas</th>
                  <th className="px-4 py-3 text-right">Ticket Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {provinceSales.map((p, index) => {
                  const percent = totalSalesCount > 0 ? ((p.count / totalSalesCount) * 100).toFixed(1) : 0;
                  const ticket = p.count > 0 ? (p.revenue / p.count) : 0;
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.province}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-semibold">{p.count}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">${p.revenue.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{percent}%</td>
                      <td className="px-4 py-3 text-right text-slate-600">${ticket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                    </tr>
                  );
                })}
                {provinceSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No hay datos de ventas para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
