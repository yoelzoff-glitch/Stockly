"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState("promotions");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Promociones y Cupones</h1>
          <p className="text-slate-500 mt-2">Gestiona las ofertas, descuentos y cupones de tu tienda.</p>
        </div>
        <Button onClick={() => alert('Para crear promociones, puedes pedirle a Stockly en el chat: "Crear una oferta para..."')}>
          Nueva Promoción con IA
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border-slate-200">
          <TabsTrigger value="promotions" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            Promociones Activas
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            Cupones
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-slate-900">No hay promociones activas</h3>
            <p className="mt-2 text-slate-500">Usa el chat de Inteligencia Artificial para crear tu primera oferta relámpago o descuento por porcentaje.</p>
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={() => alert('Crear cupón manual no implementado en MVP. Usa la IA.')}>
              Crear Cupón Manual
            </Button>
          </div>
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-slate-900">No hay cupones creados</h3>
            <p className="mt-2 text-slate-500">Pídele a Stockly: "Generame un cupón de $5000 off para nuevos compradores".</p>
          </div>
        </TabsContent>

        <TabsContent value="history" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-slate-900">Historial vacío</h3>
            <p className="mt-2 text-slate-500">Aquí aparecerán las promociones finalizadas y fallidas.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
