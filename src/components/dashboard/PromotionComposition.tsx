"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, Lock, Loader2, Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface BreakdownItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPixPrice: number;
  totalPixPrice: number;
}

interface PromotionCompositionProps {
  promotionId: number | undefined;
  onStatsChange?: (maxStock: number, totalBasePrice: number, totalBasePixPrice: number, breakdown: BreakdownItem[]) => void;
  suggestedProducts?: string[];
}

interface ProductOption {
  id: number;
  name: string;
  variants?: {
    id: string;
    flavor_id: number | null;
    flavors?: { name: string } | null;
    volume_ml: number | null;
  }[];
}

interface PromotionItem {
  id: number;
  product_id: number;
  variant_id: string | null;
  quantity: number;
  products: { 
    name: string; 
    price: number;
    pix_price: number | null; 
    stock_quantity: number;
  };
  product_variants?: {
    flavors?: { name: string } | null;
    volume_ml: number | null;
    price: number;
    pix_price: number | null;
    stock_quantity: number;
  } | null;
}

export const PromotionComposition = ({ promotionId, onStatsChange, suggestedProducts = [] }: PromotionCompositionProps) => {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(1);
  const [openProductSearch, setOpenProductSearch] = useState(false);
  const [isProcessingSuggestions, setIsProcessingSuggestions] = useState(false);
  
  const hasProcessedSuggestions = useRef(false);

  // 1. Buscar Produtos Disponíveis
  const { data: products } = useQuery({
    queryKey: ["productsForComposition"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name,
          variants:product_variants(id, flavor_id, volume_ml, flavors(name))
        `)
        .order("name");
      if (error) throw error;
      return data as unknown as ProductOption[];
    },
  });

  // 2. Buscar Itens já no Kit
  const { data: items, isLoading } = useQuery({
    queryKey: ["promotionItems", promotionId],
    queryFn: async () => {
      if (!promotionId) return [];
      const { data, error } = await supabase
        .from("promotion_items")
        .select(`
          id, product_id, variant_id, quantity,
          products(name, price, pix_price, stock_quantity),
          product_variants(volume_ml, flavors(name), price, pix_price, stock_quantity)
        `)
        .eq("promotion_id", promotionId);
      if (error) throw error;
      return data as unknown as PromotionItem[];
    },
    enabled: !!promotionId,
  });

  // Calcular Estatísticas
  useEffect(() => {
    if (!items || !onStatsChange) return;

    let totalBase = 0;
    let totalBasePix = 0;
    let minStockLimit = Number.MAX_SAFE_INTEGER;
    let hasItems = false;
    const currentBreakdown: BreakdownItem[] = [];

    items.forEach(item => {
        hasItems = true;
        
        const entity = item.product_variants || item.products;
        const price = entity.price || 0;
        const pixPrice = entity.pix_price || price; 
        const currentStock = entity.stock_quantity;
        
        const itemName = item.product_variants 
            ? `${item.products.name} - ${item.product_variants.flavors?.name || "Padrão"}`
            : item.products.name;

        totalBase += (price * item.quantity);
        totalBasePix += (pixPrice * item.quantity);

        currentBreakdown.push({
            name: itemName,
            quantity: item.quantity,
            unitPrice: price,
            totalPrice: price * item.quantity,
            unitPixPrice: pixPrice,
            totalPixPrice: pixPrice * item.quantity
        });

        const possibleKitsWithThisItem = Math.floor(currentStock / item.quantity);
        if (possibleKitsWithThisItem < minStockLimit) {
            minStockLimit = possibleKitsWithThisItem;
        }
    });

    if (!hasItems) minStockLimit = 0;
    
    onStatsChange(minStockLimit, totalBase, totalBasePix, currentBreakdown);

  }, [items, onStatsChange]);

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: async ({ prodId, varId, qty }: { prodId: number, varId: string | null, qty: number }) => {
      if (!promotionId) throw new Error("Salve a promoção antes de adicionar itens.");
      
      const { error } = await supabase.rpc("add_item_to_kit_and_lock_stock", {
        p_promotion_id: promotionId,
        p_product_id: prodId,
        p_variant_id: varId,
        p_quantity_per_kit: qty
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionItems", promotionId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setQuantity(1);
    },
    onError: (err: any) => showError(err.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("remove_item_from_kit_and_unlock_stock", {
        p_item_id: id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionItems", promotionId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Item removido e estoque devolvido.");
    },
    onError: (err: any) => showError(err.message),
  });

  // AUTOMAÇÃO: Adicionar Produtos Sugeridos
  useEffect(() => {
    const processSuggestions = async () => {
        if (!promotionId || suggestedProducts.length === 0 || !products || items === undefined || items.length > 0 || hasProcessedSuggestions.current) {
            return;
        }

        hasProcessedSuggestions.current = true;
        setIsProcessingSuggestions(true);
        let addedCount = 0;

        try {
            for (const suggName of suggestedProducts) {
                // Normaliza para comparação (remove acentos, minúsculas, trim)
                const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const target = normalize(suggName);

                const matchedProduct = products.find(p => {
                    const pName = normalize(p.name);
                    return pName.includes(target) || target.includes(pName);
                });
                
                if (matchedProduct) {
                    await addItemMutation.mutateAsync({
                        prodId: matchedProduct.id,
                        varId: null, // Produto base por padrão na automação
                        qty: 1
                    });
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                showSuccess(`${addedCount} produtos sugeridos foram adicionados!`);
            } else {
                console.warn("Nenhum produto correspondente encontrado para as sugestões:", suggestedProducts);
            }
        } catch (e) {
            console.error("Erro ao adicionar sugestões:", e);
        } finally {
            setIsProcessingSuggestions(false);
        }
    };

    processSuggestions();
  }, [suggestedProducts, products, items, promotionId]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (!promotionId) return null;

  const selectedProduct = products?.find(p => String(p.id) === selectedProductId);
  const hasVariants = selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0;

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-blue-50/30 border-blue-100 my-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-blue-800">
            <Package className="w-4 h-4" /> 2. Composição do Kit
        </h3>
        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-white">
            <Lock className="w-3 h-3 mr-1" /> Reserva Automática
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3 rounded-md border shadow-sm">
        <div className="md:col-span-5 space-y-1">
          <Label className="text-xs">Produto</Label>
          
          <Popover open={openProductSearch} onOpenChange={setOpenProductSearch}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openProductSearch}
                className="w-full h-8 justify-between text-xs"
              >
                {selectedProductId
                  ? products?.find((p) => String(p.id) === selectedProductId)?.name
                  : "Buscar produto..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Digite para buscar..." />
                <CommandList>
                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                  <CommandGroup>
                    {products?.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.name}
                        onSelect={() => {
                          setSelectedProductId(String(p.id));
                          setSelectedVariantId("none");
                          setOpenProductSearch(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProductId === String(p.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {p.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="md:col-span-4 space-y-1">
          <Label className="text-xs">Variação (Sabor/Tam)</Label>
          <Select 
            value={selectedVariantId} 
            onValueChange={setSelectedVariantId}
            disabled={!hasVariants}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={!selectedProductId ? "Selecione prod..." : hasVariants ? "Escolha a opção..." : "Sem variações"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Padrão / Qualquer</SelectItem>
              {hasVariants && selectedProduct.variants?.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.flavors?.name || "Padrão"} {v.volume_ml ? `(${v.volume_ml}ml)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Qtd p/ Kit</Label>
          <Input 
            type="number" 
            min={1} 
            className="h-8 text-xs" 
            value={quantity} 
            onChange={(e) => setQuantity(Number(e.target.value))} 
          />
        </div>

        <div className="md:col-span-1">
          <Button 
            type="button"
            size="sm" 
            className="w-full h-8 bg-blue-600 hover:bg-blue-700"
            disabled={!selectedProductId || addItemMutation.isPending}
            onClick={() => {
                addItemMutation.mutate({ 
                    prodId: Number(selectedProductId), 
                    varId: selectedVariantId === "none" ? null : selectedVariantId, 
                    qty: quantity 
                });
                showSuccess("Item adicionado!");
            }}
          >
            {addItemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="border rounded-md bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="h-8">
              <TableHead className="h-8 text-xs">Produto</TableHead>
              <TableHead className="h-8 text-xs">Detalhe</TableHead>
              <TableHead className="h-8 text-xs text-center">Qtd</TableHead>
              <TableHead className="h-8 text-xs text-center">Valor Unit.</TableHead>
              <TableHead className="h-8 text-xs text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isProcessingSuggestions ? (
                <TableRow><TableCell colSpan={5} className="text-center text-xs py-4 flex items-center justify-center gap-2 text-blue-600 font-bold"><Loader2 className="w-4 h-4 animate-spin" /> Adicionando produtos sugeridos...</TableCell></TableRow>
            ) : isLoading ? (
               <TableRow><TableCell colSpan={5} className="text-center text-xs py-4">Carregando...</TableCell></TableRow>
            ) : items?.length === 0 ? (
               <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">Adicione produtos para compor este kit.</TableCell></TableRow>
            ) : (
              items?.map(item => {
                const entity = item.product_variants || item.products;
                const unitPrice = entity.price || 0;
                
                const isAutoAdded = suggestedProducts.some(s => 
                    item.products.name.toLowerCase().includes(s.toLowerCase()) || 
                    s.toLowerCase().includes(item.products.name.toLowerCase())
                );

                return (
                  <TableRow key={item.id} className={cn("h-10", isAutoAdded && "bg-blue-50/30")}>
                    <TableCell className="text-xs font-medium py-1 flex items-center gap-2">
                        {item.products.name}
                        {isAutoAdded && (
                          <div title="Sugerido por IA">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-1">
                      {item.product_variants ? (
                        <span>{item.product_variants.flavors?.name} {item.product_variants.volume_ml ? `(${item.product_variants.volume_ml}ml)` : ""}</span>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">Produto Base</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs py-1">{item.quantity}</TableCell>
                    <TableCell className="text-center text-xs py-1 text-muted-foreground">
                        {formatCurrency(unitPrice)}
                    </TableCell>
                    <TableCell className="text-right py-1">
                      <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-500"
                          onClick={() => removeItemMutation.mutate(item.id)}
                          disabled={removeItemMutation.isPending}
                      >
                          <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};