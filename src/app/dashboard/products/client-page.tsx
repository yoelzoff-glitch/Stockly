"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Todavía no sincronizaste productos</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Conecta tu cuenta de Mercado Libre y sincroniza tu catálogo para verlo aquí.
              </p>
              <Link href="/dashboard/integrations">
                <Button variant="outline">Ir a Integraciones</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b bg-muted/50 font-medium">
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
                      <tr key={product.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium min-w-[250px]">
                          <div className="flex items-center gap-3">
                            {product.thumbnail_url && (
                              <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                            )}
                            <div className="flex flex-col">
                              <span className="line-clamp-2">{product.title}</span>
                              <span className="text-xs text-muted-foreground mt-1">SKU: {product.sku || 'N/A'} | Stock: {product.available_quantity}</span>
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
                            <Badge variant="outline" className="text-muted-foreground border-dashed">Sin costo</Badge>
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
                          <Badge variant={
                            product.profitability_status === 'complete' ? 'default' :
                            product.profitability_status === 'missing_cost' ? 'destructive' : 'secondary'
                          }>
                            {product.profitability_status || 'unknown'}
                          </Badge>
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
