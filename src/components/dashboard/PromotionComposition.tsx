"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, AlertCircle, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";

interface PromotionCompositionProps {
  promotionId: number | undefined;
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
  products: { name: string };
  product_variants?: {
    flavors?: { name: string } | null;
    volume_ml: number | null;
  } | null;
}

export const PromotionComposition = ({ promotionId }: PromotionCompositionProps) => {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(1);

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
          products(name),
          product_variants(volume_ml, flavors(name))
        `)
        .eq("promotion_id", promotionId);
      if (error) throw error;
      return data as unknown as PromotionItem[];
    },
    enabled: !!promotionId,
  });

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!promotionId) throw new Error("Salve a promoção antes de adicionar itens.");
      
      const { error } = await supabase.from("promotion_items").insert({
        promotion_id: promotionId,
        product_id: Number(selectedProductId),
        variant_id: selectedVariantId === "none" ? null : selectedVariantId,
        quantity: quantity
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionItems", promotionId] });
      showSuccess("Item adicionado ao kit!");
      setQuantity(1);
    },
    onError: (err: any) => showError(err.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("promotion_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionItems", promotionId] });
      showSuccess("Item removido.");
    },
  });

  if (!promotionId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <AlertCircle className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
        <p className="text-sm text-yellow-700 font-medium">
          Salve os dados básicos da promoção primeiro para começar a adicionar os produtos do kit.
        </p>
      </div>
    );
  }

  const selectedProduct = products?.find(p => String(p.id) === selectedProductId);
  const hasVariants = selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0;

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gray-50/50">
      <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-gray-600">
        <Package className="w-4 h-4" /> Composição do Kit
      </h3>

      {/* Formulário de Adição */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3 rounded-md border shadow-sm">
        <div className="md:col-span-5 space-y-1">
          <Label className="text-xs">Produto</Label>
          <Select value={selectedProductId} onValueChange={(val) => { setSelectedProductId(val); setSelectedVariantId("none"); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {products?.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label className="text-xs">Qtd.</Label>
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
            size="sm" 
            className="w-full h-8"
            disabled={!selectedProductId || addItemMutation.isPending}
            onClick={() => addItemMutation.mutate()}
          >
            {addItemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Lista de Itens */}
      <div className="border rounded-md bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="h-8">
              <TableHead className="h-8 text-xs">Produto</TableHead>
              <TableHead className="h-8 text-xs">Detalhe</TableHead>
              <TableHead className="h-8 text-xs text-center">Qtd</TableHead>
              <TableHead className="h-8 text-xs text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={4} className="text-center text-xs py-4">Carregando...</TableCell></TableRow>
            ) : items?.length === 0 ? (
               <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Nenhum item adicionado a este kit.</TableCell></TableRow>
            ) : (
              items?.map(item => (
                <TableRow key={item.id} className="h-10">
                  <TableCell className="text-xs font-medium py-1">{item.products.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1">
                    {item.product_variants ? (
                      <span>{item.product_variants.flavors?.name} {item.product_variants.volume_ml ? `(${item.product_variants.volume_ml}ml)` : ""}</span>
                    ) : (
                      <Badge variant="outline" className="text-[9px] h-4 px-1">Produto Base</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-bold text-xs py-1">{item.quantity}</TableCell>
                  <TableCell className="text-right py-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-red-500"
                        onClick={() => removeItemMutation.mutate(item.id)}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};