"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Save, Search, QrCode, CreditCard, ChevronDown, ChevronRight, Package, Percent, Zap, Loader2 } from "lucide-react";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const PriceManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
  const [bulkPercent, setBulkPercent] = useState<string>("10");

  const { data: products, isLoading } = useQuery({
    queryKey: ["priceManagementProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, price, pix_price, brand, category,
          product_variants (id, flavor_id, volume_ml, price, pix_price, flavors(name))
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, type, field, value }: { id: any, type: 'product' | 'variant', field: 'price' | 'pix_price', value: number }) => {
      const table = type === 'product' ? 'products' : 'product_variants';
      const { error } = await supabase
        .from(table)
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priceManagementProducts"] });
      showSuccess("Preço atualizado!");
    },
    onError: (err: any) => showError(`Erro: ${err.message}`),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (percent: number) => {
        // Busca todos os produtos e variações para atualizar um por um (para garantir precisão)
        // Em um cenário real com milhares de itens, faríamos via RPC no Postgres.
        const { data: prods } = await supabase.from("products").select("id, price");
        const { data: vars } = await supabase.from("product_variants").select("id, price");

        const factor = 1 - (percent / 100);

        if (prods) {
            for (const p of prods) {
                const newPix = parseFloat((p.price * factor).toFixed(2));
                await supabase.from("products").update({ pix_price: newPix }).eq("id", p.id);
            }
        }

        if (vars) {
            for (const v of vars) {
                const newPix = parseFloat((v.price * factor).toFixed(2));
                await supabase.from("product_variants").update({ pix_price: newPix }).eq("id", v.id);
            }
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["priceManagementProducts"] });
        showSuccess("Desconto aplicado a todo o catálogo!");
    },
    onError: (err: any) => showError(err.message),
  });

  const handleBlur = (id: any, type: 'product' | 'variant', field: 'price' | 'pix_price', originalValue: number, newValue: string) => {
    const value = parseFloat(newValue.replace(',', '.'));
    if (isNaN(value) || value === originalValue) return;
    updatePriceMutation.mutate({ id, type, field, value });
  };

  const handlePercentBlur = (id: any, type: 'product' | 'variant', price: number, currentPixPrice: number, percentValue: string) => {
    const percent = parseFloat(percentValue.replace(',', '.'));
    if (isNaN(percent) || price <= 0) return;
    
    const newPixPrice = price * (1 - (percent / 100));
    if (newPixPrice.toFixed(2) === currentPixPrice?.toFixed(2)) return;

    updatePriceMutation.mutate({ id, type, field: 'pix_price', value: parseFloat(newPixPrice.toFixed(2)) });
  };

  const toggleExpand = (productId: number) => {
    setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const calculatePercent = (price: number, pixPrice: number | null) => {
    if (!price || !pixPrice || price <= 0) return "0";
    const diff = price - pixPrice;
    return ((diff / price) * 100).toFixed(0);
  };

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApplyBulk = () => {
      const p = parseFloat(bulkPercent);
      if (isNaN(p) || p < 0 || p > 100) {
          showError("Porcentagem inválida.");
          return;
      }
      if (confirm(`Isso vai recalcular o preço Pix de TODOS os produtos e variações para ${p}% de desconto sobre o preço normal. Confirmar?`)) {
          bulkUpdateMutation.mutate(p);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-600" /> Gestão de Preços
          </h1>
          <p className="text-muted-foreground text-sm">Ajuste os valores de venda e descontos Pix de todo o catálogo.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar produto ou marca..." 
            className="pl-10" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* Ferramenta de Ajuste em Massa */}
      <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                      <Zap className="h-5 w-5" />
                  </div>
                  <div>
                      <p className="font-bold text-orange-900">Ajuste em Massa</p>
                      <p className="text-xs text-orange-700">Defina o desconto Pix padrão para a loja inteira.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1 shadow-sm">
                      <Percent className="h-4 w-4 text-orange-500" />
                      <Input 
                        type="number" 
                        value={bulkPercent} 
                        onChange={(e) => setBulkPercent(e.target.value)}
                        className="w-16 border-none focus-visible:ring-0 h-8 font-bold p-0 text-center"
                      />
                  </div>
                  <Button 
                    onClick={handleApplyBulk} 
                    disabled={bulkUpdateMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700 font-bold h-10 px-6"
                  >
                      {bulkUpdateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Aplicar em Tudo
                  </Button>
              </div>
          </CardContent>
      </Card>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Produto / Variação</TableHead>
              <TableHead className="w-40">
                <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Preço Normal</div>
              </TableHead>
              <TableHead className="w-32">
                <div className="flex items-center gap-2 text-orange-600"><Percent className="h-4 w-4" /> Desconto %</div>
              </TableHead>
              <TableHead className="w-40">
                <div className="flex items-center gap-2 text-green-600"><QrCode className="h-4 w-4" /> Preço Pix</div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              ))
            ) : filteredProducts?.map((product) => {
              const hasVariants = product.product_variants && product.product_variants.length > 0;
              const isExpanded = expandedProducts[product.id];
              
              return (
                <>
                  <TableRow key={product.id} className={cn(hasVariants && "bg-gray-50/30")}>
                    <TableCell>
                      {hasVariants && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(product.id)}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{product.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{product.brand || 'Sem Marca'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <Input 
                          key={`price-${product.id}-${product.price}`}
                          defaultValue={product.price?.toFixed(2)} 
                          onBlur={(e) => handleBlur(product.id, 'product', 'price', product.price, e.target.value)}
                          className="pl-8 h-8 text-sm font-medium"
                          disabled={hasVariants}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {!hasVariants ? (
                        <div className="relative">
                          <Input 
                            key={`pct-${product.id}-${product.pix_price}`}
                            defaultValue={calculatePercent(product.price, product.pix_price)}
                            onBlur={(e) => handlePercentBlur(product.id, 'product', product.price, product.pix_price || 0, e.target.value)}
                            className="pr-6 h-8 text-sm text-center font-bold text-orange-600"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] w-full justify-center">Variações</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <Input 
                          key={`pix-${product.id}-${product.pix_price}`}
                          defaultValue={product.pix_price?.toFixed(2)} 
                          onBlur={(e) => handleBlur(product.id, 'product', 'pix_price', product.pix_price || 0, e.target.value)}
                          className="pl-8 h-8 text-sm font-bold text-green-700 border-green-200 bg-green-50/30"
                          disabled={hasVariants}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {isExpanded && hasVariants && product.product_variants.map((v: any) => (
                    <TableRow key={v.id} className="bg-white">
                      <TableCell></TableCell>
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          <span>{v.flavors?.name || "Padrão"} {v.volume_ml ? `- ${v.volume_ml}ml` : ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                          <Input 
                            key={`v-price-${v.id}-${v.price}`}
                            defaultValue={v.price?.toFixed(2)} 
                            onBlur={(e) => handleBlur(v.id, 'variant', 'price', v.price, e.target.value)}
                            className="pl-8 h-7 text-xs border-dashed"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input 
                            key={`v-pct-${v.id}-${v.pix_price}`}
                            defaultValue={calculatePercent(v.price, v.pix_price)}
                            onBlur={(e) => handlePercentBlur(v.id, 'variant', v.price, v.pix_price || 0, e.target.value)}
                            className="pr-5 h-7 text-xs text-center border-dashed text-orange-600"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                          <Input 
                            key={`v-pix-${v.id}-${v.pix_price}`}
                            defaultValue={v.pix_price?.toFixed(2)} 
                            onBlur={(e) => handleBlur(v.id, 'variant', 'pix_price', v.pix_price || 0, e.target.value)}
                            className="pl-8 h-7 text-xs font-bold text-green-600 border-dashed border-green-100"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PriceManagementPage;