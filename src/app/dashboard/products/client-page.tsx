"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw, Edit2, Upload } from "lucide-react";
import Link from "next/link";
import { ProductCommandCenter } from "@/components/dashboard/product-command-center";
import { ImportCostsModal } from "@/components/dashboard/import-costs-modal";
import { SearchInput } from "@/components/ui/search-input";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Product {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  cost: number | null;
  available_quantity: number;
  sold_quantity: number;
  status: string;
  thumbnail_url: string | null;
  last_synced_at: string;
}

export function ProductsClient({ 
  initialProducts, 
  totalCount = 0, 
  currentPage = 1, 
  searchQuery = "" 
}: { 
  initialProducts: any[], 
  totalCount?: number,
  currentPage?: number,
  searchQuery?: string
}) {
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleSuccess = () => {
    window.location.reload();
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch("/api/profitability/recalculate", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Productos</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRecalculate} disabled={isRecalculating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            Recalcular Rentabilidad
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Costos
          </Button>
          <Link href="/dashboard/integrations">
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
          </Link>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>
              Tus productos sincronizados desde Mercado Libre.
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto">
            <SearchInput placeholder="Buscar por título, SKU..." />
          </div>
        </CardHeader>
        <CardContent>
          {!initialProducts || initialProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-5">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Todavía no sincronizaste productos</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                Conecta tu cuenta de Mercado Libre y sincroniza tu catálogo para verlo aquí y empezar a operar.
              </p>
              <Link href="/dashboard/integrations">
                <Button className="rounded-full shadow-sm">Ir a Integraciones</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="border-b bg-slate-50 font-medium text-slate-600">
                    <tr>
                      <th className="h-10 px-4 align-middle">Producto</th>
                      <th className="h-10 px-4 align-middle text-right">Precio</th>
                      <th className="h-10 px-4 align-middle text-right">Costo</th>
                      <th className="h-10 px-4 align-middle text-right">Comisión</th>
                      <th className="h-10 px-4 align-middle text-right">Envío</th>
                      <th className="h-10 px-4 align-middle text-right">Margen Neto</th>
                      <th className="h-10 px-4 align-middle text-center">Estado Rentab.</th>
                      <th className="h-10 px-4 align-middle text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialProducts.map((product) => {
                      return (
                        <tr key={product.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 data-[state=selected]:bg-slate-50">
                          <td className="p-4 align-middle font-medium min-w-[250px]">
                            <div className="flex items-center gap-3">
                              {product.thumbnail_url && (
                                <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                              )}
                              <div className="flex flex-col">
                                <span className="line-clamp-2">{product.title}</span>
                                <div className="flex flex-col gap-1 mt-1">
                                  <span className="text-xs text-muted-foreground">SKU: {product.sku || 'N/A'} | Stock: {product.available_quantity}</span>
                                  {product.product_sku_components && product.product_sku_components.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {product.product_sku_components.map((c: any, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                          {c.component_normalized}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle text-right whitespace-nowrap">
                            ${product.price?.toLocaleString()}
                          </td>
                          <td className="p-4 align-middle text-right whitespace-nowrap">
                            {product.cost ? (
                              `$${product.cost.toLocaleString()}`
                            ) : (
                              <StatusBadge variant="neutral">Sin costo</StatusBadge>
                            )}
                          </td>
                          <td className="p-4 align-middle text-right whitespace-nowrap text-muted-foreground">
                            {product.estimated_fee ? (
                              <div className="flex flex-col items-end">
                                <span>${((product.estimated_fee || 0) + (product.extra_fee_amount || 0)).toLocaleString()}</span>
                                {product.extra_fee_amount > 0 && (
                                  <span className="text-[10px] text-amber-600 font-medium">Incl. cuotas</span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="p-4 align-middle text-right whitespace-nowrap text-muted-foreground">
                            {product.estimated_shipping_cost !== null && product.estimated_shipping_cost !== undefined ? `$${product.estimated_shipping_cost.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-4 align-middle text-right whitespace-nowrap">
                            {product.profit_real_margin !== null && product.profit_real_margin !== undefined ? (
                              <div className="flex flex-col items-end">
                                <span className={product.profit_real_margin <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                  {product.profit_real_margin.toFixed(1)}%
                                </span>
                                <span className="text-xs text-muted-foreground">${product.profit_real_estimated?.toLocaleString()}</span>
                              </div>
                            ) : product.margin_percent !== null && product.margin_percent !== undefined ? (
                              <div className="flex flex-col items-end">
                                <span className={product.margin_percent <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                  {product.margin_percent.toFixed(1)}%
                                </span>
                                <span className="text-xs text-muted-foreground">${product.margin_amount?.toLocaleString()}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                          <td className="p-4 align-middle text-center">
                            <StatusBadge variant={
                              product.profitability_status === 'complete' ? 'success' :
                              product.profitability_status === 'missing_cost' ? 'danger' : 'warning'
                            }>
                              {product.profitability_status || 'unknown'}
                            </StatusBadge>
                          </td>
                          <td className="p-4 align-middle text-right">
                            <Button variant="ghost" size="sm" onClick={() => setEditingProduct(product)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {initialProducts.map((product) => (
                  <div key={product.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      {product.thumbnail_url && (
                        <img src={product.thumbnail_url} alt="" className="w-14 h-14 rounded-md object-cover border border-slate-100 shrink-0" />
                      )}
                      <div>
                        <h4 className="font-medium text-sm line-clamp-2 text-slate-900">{product.title}</h4>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span>SKU: {product.sku || 'N/A'}</span>
                          <span>Stock: {product.available_quantity}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm border-t border-slate-100 pt-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase">Precio</span>
                        <span className="font-medium">${product.price?.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase">Costo</span>
                        <span>{product.cost ? `$${product.cost.toLocaleString()}` : 'N/A'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase">Margen</span>
                        <span>
                          {product.profit_real_margin !== null && product.profit_real_margin !== undefined ? (
                            <span className={product.profit_real_margin <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                              {product.profit_real_margin.toFixed(1)}%
                            </span>
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex flex-col items-start justify-center">
                        <StatusBadge variant={
                          product.profitability_status === 'complete' ? 'success' :
                          product.profitability_status === 'missing_cost' ? 'danger' : 'warning'
                        }>
                          {product.profitability_status || 'unknown'}
                        </StatusBadge>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button variant="outline" className="w-full" onClick={() => setEditingProduct(product)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Ver Detalles / Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {totalCount > 50 && (
            <div className="flex items-center justify-between px-2 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {initialProducts.length} de {totalCount} productos
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("page", (currentPage - 1).toString());
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                >
                  Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage * 50 >= totalCount}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("page", (currentPage + 1).toString());
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editingProduct && (
        <ProductCommandCenter 
          product={editingProduct} 
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            handleSuccess(); 
          }} 
        />
      )}

      {isImportModalOpen && (
        <ImportCostsModal 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={() => {
            setIsImportModalOpen(false);
            handleSuccess();
          }}
        />
      )}
    </div>
  );
}
