"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, Ruler, Droplets, Pencil, X, Check, Loader2, RefreshCcw, Palette, Zap, RefreshCw, Maximize } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { sortVariantsBySpecification } from "@/utils/variantSort";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  flavor_id: number | null;
  volume_ml: number | null;
  color: string | null;
  ohms: string | null;
  size: string | null;
  sku: string | null;
  price: number;
  pix_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  flavors?: { name: string } | null;
}

interface ProductVariantManagerProps {
  productId: number | undefined;
  basePrice: number;
  basePixPrice: number;
  baseCostPrice: number;
}

const generateVariantSku = () => {
  const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `VAR-${randomStr}`;
};

const formatCurrency = (val: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const getSpecLabel = (v: Variant) => {
  const parts: string[] = [];
  if (v.flavors?.name) parts.push(v.flavors.name);
  if (v.color) parts.push(v.color);
  if (v.size) parts.push(v.size);
  if (v.ohms) parts.push(`${v.ohms}Ω`);
  if (v.volume_ml) parts.push(`${v.volume_ml}ml`);
  return parts.length > 0 ? parts.join(" / ") : "Padrão";
};

export const ProductVariantManager = ({
  productId,
  basePrice,
  basePixPrice,
  baseCostPrice,
}: ProductVariantManagerProps) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Variant & { flavor_name?: string }>>({});

  const [newVariant, setNewVariant] = useState<Partial<Variant & { flavor_name: string }>>({
    flavor_name: "",
    volume_ml: null,
    color: "",
    ohms: "",
    size: "",
    sku: "",
    price: basePrice || 0,
    pix_price: basePixPrice || 0,
    cost_price: baseCostPrice || 0,
    stock_quantity: 0,
  });

  useEffect(() => {
    if (!isAdding) {
      setNewVariant((prev) => ({ ...prev, price: basePrice, pix_price: basePixPrice, cost_price: baseCostPrice }));
    }
  }, [basePrice, basePixPrice, baseCostPrice, isAdding]);

  useEffect(() => {
    if (isAdding && !newVariant.sku) {
      setNewVariant((prev) => ({ ...prev, sku: generateVariantSku() }));
    }
  }, [isAdding]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (editingId && !updateMutation.isPending) { updateMutation.mutate(editValues); return; }
    if (isAdding && !addMutation.isPending) { addMutation.mutate(newVariant); return; }
  };

  const { data: variants, isLoading } = useQuery({
    queryKey: ["productVariants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select(`*, flavors(name)`)
        .eq("product_id", productId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Variant[];
    },
    enabled: !!productId,
  });

  const sortedVariants = variants ? sortVariantsBySpecification(variants) : [];

  const isSkuTaken = async (sku: string, currentVariantId?: string): Promise<boolean> => {
    if (!sku || sku.trim() === "") return false;
    const cleanSku = sku.trim();
    const { data: productWithSku } = await supabase.from("products").select("id").eq("sku", cleanSku).maybeSingle();
    if (productWithSku) return true;
    const query = supabase.from("product_variants").select("id").eq("sku", cleanSku);
    if (currentVariantId) query.neq("id", currentVariantId);
    const { data: variantWithSku } = await query.maybeSingle();
    return !!variantWithSku;
  };

  const getOrCreateFlavorId = async (name: string): Promise<number | null> => {
    if (!name || name.trim() === "") return null;
    const cleanName = name.trim();
    const { data: existing } = await supabase.from("flavors").select("id").ilike("name", cleanName).maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase.from("flavors").insert({ name: cleanName, is_visible: true }).select("id").single();
    if (error) throw error;
    return created.id;
  };

  const addMutation = useMutation({
    mutationFn: async (v: typeof newVariant) => {
      if (v.sku && (await isSkuTaken(v.sku))) throw new Error(`O SKU "${v.sku}" já está em uso.`);
      const flavorId = await getOrCreateFlavorId(v.flavor_name || "");
      const { flavor_name, ...variantData } = v;
      const { error } = await supabase.from("product_variants").insert({ ...variantData, flavor_id: flavorId, product_id: productId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productVariants", productId] });
      showSuccess("Variação adicionada!");
      setIsAdding(false);
      setNewVariant({ flavor_name: "", volume_ml: null, color: "", ohms: "", size: "", sku: "", price: basePrice, pix_price: basePixPrice, cost_price: baseCostPrice, stock_quantity: 0 });
    },
    onError: (err: any) => showError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (v: typeof editValues) => {
      if (v.sku && (await isSkuTaken(v.sku, v.id))) throw new Error(`O SKU "${v.sku}" já está em uso.`);
      const flavorId = await getOrCreateFlavorId(v.flavor_name || "");
      const { id, flavors, flavor_name, ...updateData } = v as any;
      const { error } = await supabase.from("product_variants").update({ ...updateData, flavor_id: flavorId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productVariants", productId] });
      showSuccess("Variação atualizada!");
      setEditingId(null);
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_variant", { p_variant_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productVariants", productId] });
      showSuccess("Variação removida.");
    },
    onError: (err: any) => showError(err.message),
  });

  const bulkUpdatePricesMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Produto não identificado.");
      const { error } = await supabase.rpc("bulk_update_variant_prices", {
        p_product_id: productId,
        p_price: basePrice,
        p_pix_price: basePixPrice,
        p_cost_price: baseCostPrice,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productVariants", productId] });
      showSuccess("Preços atualizados em todas as variações!");
    },
    onError: (err: any) => showError(`Erro ao atualizar em massa: ${err.message}`),
  });

  const startEditing = (v: Variant) => {
    setEditingId(v.id);
    setEditValues({ ...v, flavor_name: v.flavors?.name || "" });
  };

  if (!productId) {
    return (
      <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
        Salve o produto para habilitar variações.
      </div>
    );
  }

  return (
    <div className="space-y-4 border rounded-xl p-3 md:p-4 bg-gray-50/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <Package className="w-4 h-4" /> Grade de Variações
          </h3>
          <p className="text-xs text-muted-foreground">Sabores, cores, tamanhos e especificações.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="bg-white border text-orange-600 hover:bg-orange-50 text-xs h-8"
            onClick={() => {
              if (confirm("Deseja aplicar os preços base em TODAS as variações?")) {
                bulkUpdatePricesMutation.mutate();
              }
            }}
            disabled={bulkUpdatePricesMutation.isPending || !sortedVariants || sortedVariants.length === 0}
          >
            {bulkUpdatePricesMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
            Replicar Preços
          </Button>
          <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? "Cancelar" : <><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar</>}
          </Button>
        </div>
      </div>

      {/* ── Formulário de adição ── */}
      {isAdding && (
        <div className="border rounded-xl bg-white shadow-sm p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
          {/* Linha 1: Especificações */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">Sabor</Label>
              <Input placeholder="Menta" className="h-9" value={newVariant.flavor_name} onChange={(e) => setNewVariant({ ...newVariant, flavor_name: e.target.value })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">Cor</Label>
              <Input placeholder="Vermelho" className="h-9" value={newVariant.color || ""} onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">ML</Label>
              <Input type="number" className="h-9" value={newVariant.volume_ml || ""} onChange={(e) => setNewVariant({ ...newVariant, volume_ml: Number(e.target.value) })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">Tamanho</Label>
              <Input placeholder="P/M/G" className="h-9" value={newVariant.size || ""} onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">Ohms</Label>
              <Input placeholder="0.6" className="h-9" value={newVariant.ohms || ""} onChange={(e) => setNewVariant({ ...newVariant, ohms: e.target.value })} onKeyDown={handleKeyDown} />
            </div>
          </div>

          {/* Linha 2: SKU */}
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">SKU</Label>
            <div className="flex gap-2">
              <Input className="h-9 font-mono" placeholder="Auto" value={newVariant.sku || ""} onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value.toUpperCase() })} onKeyDown={handleKeyDown} />
              <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setNewVariant((p) => ({ ...p, sku: generateVariantSku() }))}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Linha 3: Preços + Estoque */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">💳 Venda</Label>
              <Input type="number" step="0.01" className="h-9 font-bold" value={newVariant.price || ""} onChange={(e) => setNewVariant({ ...newVariant, price: Number(e.target.value) })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-green-600">⚡ Pix</Label>
              <Input type="number" step="0.01" className="h-9 font-bold text-green-700" value={newVariant.pix_price || ""} onChange={(e) => setNewVariant({ ...newVariant, pix_price: Number(e.target.value) })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">📦 Custo</Label>
              <Input type="number" step="0.01" className="h-9" value={newVariant.cost_price || ""} onChange={(e) => setNewVariant({ ...newVariant, cost_price: Number(e.target.value) })} onKeyDown={handleKeyDown} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">🏷 Estoque</Label>
              <Input type="number" className="h-9" value={newVariant.stock_quantity || ""} onChange={(e) => setNewVariant({ ...newVariant, stock_quantity: Number(e.target.value) })} onKeyDown={handleKeyDown} />
            </div>
          </div>

          <Button type="button" className="w-full h-10 font-bold" onClick={() => addMutation.mutate(newVariant)} disabled={addMutation.isPending}>
            {addMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</> : "✅ Salvar Variação"}
          </Button>
        </div>
      )}

      {/* ── MOBILE: Cards de variações ── */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : sortedVariants.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8 border-2 border-dashed rounded-xl">
            Sem variações cadastradas.
          </div>
        ) : sortedVariants.map((v) => {
          const isEditing = editingId === v.id;
          return (
            <div key={v.id} className={cn("rounded-xl border bg-white shadow-sm overflow-hidden", isEditing && "border-primary border-2")}>
              {/* Linha principal */}
              <div className="p-3">
                {isEditing ? (
                  /* Modo edição mobile */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Sabor</Label>
                        <Input className="h-9" value={editValues.flavor_name || ""} onChange={(e) => setEditValues({ ...editValues, flavor_name: e.target.value })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Cor</Label>
                        <Input className="h-9" value={editValues.color || ""} onChange={(e) => setEditValues({ ...editValues, color: e.target.value })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">ML</Label>
                        <Input type="number" className="h-9" value={editValues.volume_ml || ""} onChange={(e) => setEditValues({ ...editValues, volume_ml: Number(e.target.value) })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Tamanho</Label>
                        <Input className="h-9" value={editValues.size || ""} onChange={(e) => setEditValues({ ...editValues, size: e.target.value })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Ohms</Label>
                        <Input className="h-9" value={editValues.ohms || ""} onChange={(e) => setEditValues({ ...editValues, ohms: e.target.value })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Estoque</Label>
                        <Input type="number" className="h-9 font-bold" value={editValues.stock_quantity || 0} onChange={(e) => setEditValues({ ...editValues, stock_quantity: Number(e.target.value) })} onKeyDown={handleKeyDown} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">💳 Venda</Label>
                        <Input type="number" step="0.01" className="h-9 font-bold" value={editValues.price || 0} onChange={(e) => setEditValues({ ...editValues, price: Number(e.target.value) })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-green-600">⚡ Pix</Label>
                        <Input type="number" step="0.01" className="h-9 font-bold text-green-700" value={editValues.pix_price || 0} onChange={(e) => setEditValues({ ...editValues, pix_price: Number(e.target.value) })} onKeyDown={handleKeyDown} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">📦 Custo</Label>
                        <Input type="number" step="0.01" className="h-9" value={editValues.cost_price || 0} onChange={(e) => setEditValues({ ...editValues, cost_price: Number(e.target.value) })} onKeyDown={handleKeyDown} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" className="flex-1 h-10 bg-green-600 hover:bg-green-700 font-bold" onClick={() => updateMutation.mutate(editValues)} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Salvar</>}
                      </Button>
                      <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Modo visualização mobile */
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900">{getSpecLabel(v)}</p>
                        {v.sku && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">{v.sku}</span>
                        )}
                      </div>
                      <Badge
                        variant={v.stock_quantity <= 5 ? "destructive" : "secondary"}
                        className={cn("text-xs font-black shrink-0", v.stock_quantity > 5 && "bg-emerald-100 text-emerald-700")}
                      >
                        {v.stock_quantity} un
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      {v.cost_price != null && v.cost_price > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Custo</span>
                          <span className="text-xs font-semibold text-gray-500">{formatCurrency(v.cost_price)}</span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Venda</span>
                        <span className="text-sm font-black text-primary">{formatCurrency(v.price)}</span>
                      </div>
                      {v.pix_price != null && v.pix_price > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase text-green-500 leading-none">Pix</span>
                          <span className="text-xs font-black text-green-700">{formatCurrency(v.pix_price)}</span>
                        </div>
                      )}
                      <div className="ml-auto flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => startEditing(v)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => deleteMutation.mutate(v.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP: Tabela ── */}
      <div className="hidden md:block border rounded-md bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Especificação</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="w-24 text-center">Venda</TableHead>
              <TableHead className="w-24 text-center text-green-600">Pix</TableHead>
              <TableHead className="w-24 text-center">Custo</TableHead>
              <TableHead className="w-20 text-center">Estoque</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ) : sortedVariants.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-10">Sem variações cadastradas.</TableCell></TableRow>
            ) : sortedVariants.map((v) => (
              <TableRow key={v.id} className={editingId === v.id ? "bg-primary/5" : ""}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {editingId === v.id ? (
                      <Input className="h-7 text-xs font-bold" value={editValues.flavor_name || ""} onChange={(e) => setEditValues({ ...editValues, flavor_name: e.target.value })} placeholder="Sabor..." onKeyDown={handleKeyDown} />
                    ) : (
                      <span className="font-bold flex items-center gap-1 text-gray-800 text-xs">
                        <Droplets className="w-3 h-3 text-primary" /> {v.flavors?.name || "Sem Sabor"}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2 items-center">
                      {editingId === v.id ? (
                        <>
                          <div className="flex items-center gap-1"><Palette className="w-3 h-3 text-muted-foreground" /><Input className="h-7 text-[10px] w-14" value={editValues.color || ""} onChange={(e) => setEditValues({ ...editValues, color: e.target.value })} placeholder="Cor..." onKeyDown={handleKeyDown} /></div>
                          <div className="flex items-center gap-1"><Maximize className="w-3 h-3 text-muted-foreground" /><Input className="h-7 text-[10px] w-14" value={editValues.size || ""} onChange={(e) => setEditValues({ ...editValues, size: e.target.value })} placeholder="Tam..." onKeyDown={handleKeyDown} /></div>
                          <div className="flex items-center gap-1"><Ruler className="w-3 h-3 text-muted-foreground" /><Input type="number" className="h-7 text-[10px] w-14" value={editValues.volume_ml || ""} onChange={(e) => setEditValues({ ...editValues, volume_ml: Number(e.target.value) })} placeholder="ML" onKeyDown={handleKeyDown} /></div>
                          <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-muted-foreground" /><Input className="h-7 text-[10px] w-14" value={editValues.ohms || ""} onChange={(e) => setEditValues({ ...editValues, ohms: e.target.value })} placeholder="Ohms" onKeyDown={handleKeyDown} /></div>
                        </>
                      ) : (
                        <>
                          {v.color && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> {v.color}</span>}
                          {v.size && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Maximize className="w-3 h-3" /> {v.size}</span>}
                          {v.volume_ml && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Ruler className="w-3 h-3" /> {v.volume_ml}ml</span>}
                          {v.ohms && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> {v.ohms}</span>}
                        </>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {editingId === v.id ? (
                    <div className="flex gap-1">
                      <Input className="h-7 text-[10px] font-mono p-1 w-24" value={editValues.sku || ""} onChange={(e) => setEditValues({ ...editValues, sku: e.target.value.toUpperCase() })} onKeyDown={handleKeyDown} />
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditValues((p) => ({ ...p, sku: generateVariantSku() }))}><RefreshCw className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground bg-gray-100 px-1 rounded">{v.sku || "-"}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? <Input type="number" step="0.01" className="h-7 text-xs font-bold p-1 w-full" value={editValues.price || 0} onChange={(e) => setEditValues({ ...editValues, price: Number(e.target.value) })} onKeyDown={handleKeyDown} /> : <span className="font-bold text-xs">{formatCurrency(v.price)}</span>}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? <Input type="number" step="0.01" className="h-7 text-xs font-bold p-1 w-full text-green-600" value={editValues.pix_price || 0} onChange={(e) => setEditValues({ ...editValues, pix_price: Number(e.target.value) })} onKeyDown={handleKeyDown} /> : <span className="font-bold text-green-600 text-xs">{formatCurrency(v.pix_price)}</span>}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? <Input type="number" step="0.01" className="h-7 text-xs font-bold p-1 w-full" value={editValues.cost_price || 0} onChange={(e) => setEditValues({ ...editValues, cost_price: Number(e.target.value) })} onKeyDown={handleKeyDown} /> : <span className="font-bold text-xs">{formatCurrency(v.cost_price)}</span>}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? <Input type="number" className="h-7 text-xs font-bold p-1 w-full" value={editValues.stock_quantity || 0} onChange={(e) => setEditValues({ ...editValues, stock_quantity: Number(e.target.value) })} onKeyDown={handleKeyDown} /> : <Badge variant={v.stock_quantity <= 5 ? "destructive" : "secondary"} className="font-bold text-[10px] h-5">{v.stock_quantity} un</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {editingId === v.id ? (
                      <>
                        <Button type="button" variant="ghost" size="icon" onClick={() => updateMutation.mutate(editValues)} className="h-7 w-7 text-green-600 hover:bg-green-50" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setEditingId(null)} className="h-7 w-7 text-gray-500 hover:bg-gray-100"><X className="w-4 h-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="ghost" size="icon" onClick={() => startEditing(v)} className="h-7 w-7 text-primary hover:bg-primary/10"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
