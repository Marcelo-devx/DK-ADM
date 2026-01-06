"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Save, Search, QrCode, CreditCard, ChevronDown, ChevronRight, Package, Percent } from "lucide-react";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PriceManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});

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

  const handleBlur = (id: any, type: 'product' | 'variant', field: 'price' | 'pix_price', originalValue: number, newValue: string) => {
    const value = parseFloat(newValue.replace(',', '.'));
    if (isNaN(value) || value === originalValue) return;
    updatePriceMutation.mutate({ id, type, field, value });
  };

  const handlePercentBlur = (id: any, type: 'product' | 'variant', price: number, currentPixPrice: number, percentValue: string) => {
    const percent = parseFloat(percentValue.replace(',', '.'));
    if (isNaN(percent) || price <= 0) return;
    
    // Calcula o novo valor Pix baseado na porcentagem: Preço * (1 - %/100)
    const newPixPrice = price * (1 - (percent / 100));
    
    // Evita salvar se o valor for o mesmo (considerando arredondamento)
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
                            defaultValue={v.price?.toFixed(2)} 
                            onBlur={(e) => handleBlur(v.id, 'variant', 'price', v.price, e.target.value)}
                            className="pl-8 h-7 text-xs border-dashed"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input 
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