"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, Ruler, Droplets, Pencil, X, Check } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Variant {
  id: string;
  flavor_id: number | null;
  volume_ml: number | null;
  sku: string | null;
  price: number;
  pix_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  flavors?: { name: string } | null;
}

interface ProductVariantManagerProps {
  productId: number | undefined;
}

export const ProductVariantManager = ({ productId }: ProductVariantManagerProps) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Variant>>({});

  const [newVariant, setNewVariant] = useState<Partial<Variant>>({
    flavor_id: null,
    volume_ml: null,
    sku: "",
    price: 0,
    pix_price: 0,
    cost_price: 0,
    stock_quantity: 0,
  });

  const { data: flavors } = useQuery({
    queryKey: ["allFlavors"],
    queryFn: async () => {
      const { data } = await supabase.from("flavors").select("id, name").eq("is_visible", true);
      return data || [];
    },
  });

  const { data: variants, isLoading } = useQuery({
    queryKey: ["productVariants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select(`*, flavors(name)`)
        .eq("product_id", productId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Variant[];
    },
    enabled: !!productId,
  });

  const addMutation = useMutation({
    mutationFn: async (variant: Partial<Variant>) => {
      const { error } = await supabase.from("product_variants").insert({
        ...variant,
        product_id: productId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productVariants", productId] });
      showSuccess("Variação adicionada!");
      setIsAdding(false);
      setNewVariant({ flavor_id: null, volume_ml: null, sku: "", price: 0, pix_price: 0, cost_price: 0, stock_quantity: 0 });
    },
    onError: (err: any) => showError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (variant: Partial<Variant>) => {
      const { id, flavors, ...updateData } = variant as any;
      const { error } = await supabase
        .from("product_variants")
        .update(updateData)
        .eq("id", id);
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
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productVariants", productId] });
      showSuccess("Variação removida.");
    },
  });

  const startEditing = (v: Variant) => {
    setEditingId(v.id);
    setEditValues(v);
  };

  const formatCurrency = (val: number | null) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  if (!productId) {
    return <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">Salve o produto para habilitar variações (Sabores/ML).</div>;
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5" /> Variações de Estoque e Preço
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-1" /> Adicionar Nova Opção</>}
        </Button>
      </div>

      {isAdding && (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3 p-4 border rounded-lg bg-white shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">Sabor</Label>
            <Select onValueChange={(v) => setNewVariant({ ...newVariant, flavor_id: Number(v) })}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {flavors?.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">ML</Label>
            <Input type="number" className="h-8" value={newVariant.volume_ml || ""} onChange={(e) => setNewVariant({ ...newVariant, volume_ml: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">SKU</Label>
            <Input className="h-8" value={newVariant.sku || ""} onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">Custo (R$)</Label>
            <Input type="number" step="0.01" className="h-8" value={newVariant.cost_price || ""} onChange={(e) => setNewVariant({ ...newVariant, cost_price: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">Venda (R$)</Label>
            <Input type="number" step="0.01" className="h-8" value={newVariant.price || ""} onChange={(e) => setNewVariant({ ...newVariant, price: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-green-600">Pix (R$)</Label>
            <Input type="number" step="0.01" className="h-8" value={newVariant.pix_price || ""} onChange={(e) => setNewVariant({ ...newVariant, pix_price: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold">Estoque</Label>
            <Input type="number" className="h-8" value={newVariant.stock_quantity || ""} onChange={(e) => setNewVariant({ ...newVariant, stock_quantity: Number(e.target.value) })} />
          </div>
          <div className="flex items-end pb-0.5">
            <Button type="button" className="w-full h-8" onClick={() => addMutation.mutate(newVariant)} disabled={addMutation.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-md bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Especificação</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="w-24 text-center">Venda</TableHead>
              <TableHead className="w-24 text-center text-green-600">Pix</TableHead>
              <TableHead className="w-20 text-center">Estoque</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow> : 
             variants?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-10">Sem variações cadastradas.</TableCell></TableRow> :
             variants?.map((v) => (
              <TableRow key={v.id} className={editingId === v.id ? "bg-primary/5" : ""}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold flex items-center gap-1 text-gray-800 text-xs"><Droplets className="w-3 h-3 text-primary" /> {v.flavors?.name || "Sem Sabor"}</span>
                    {v.volume_ml && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Ruler className="w-3 h-3" /> {v.volume_ml}ml</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {editingId === v.id ? (
                    <Input className="h-7 text-[10px] font-mono p-1" value={editValues.sku || ""} onChange={(e) => setEditValues({ ...editValues, sku: e.target.value })} />
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground bg-gray-100 px-1 rounded">{v.sku || "-"}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? (
                    <Input type="number" step="0.01" className="h-7 text-xs font-bold p-1 w-full" value={editValues.price || 0} onChange={(e) => setEditValues({ ...editValues, price: Number(e.target.value) })} />
                  ) : (
                    <span className="font-bold text-xs">{formatCurrency(v.price)}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? (
                    <Input type="number" step="0.01" className="h-7 text-xs font-bold p-1 w-full text-green-600" value={editValues.pix_price || 0} onChange={(e) => setEditValues({ ...editValues, pix_price: Number(e.target.value) })} />
                  ) : (
                    <span className="font-bold text-green-600 text-xs">{formatCurrency(v.pix_price)}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === v.id ? (
                    <Input type="number" className="h-7 text-xs font-bold p-1 w-full" value={editValues.stock_quantity || 0} onChange={(e) => setEditValues({ ...editValues, stock_quantity: Number(e.target.value) })} />
                  ) : (
                    <Badge variant={v.stock_quantity <= 5 ? "destructive" : "secondary"} className="font-bold text-[10px] h-5">{v.stock_quantity} un</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {editingId === v.id ? (
                      <>
                        <Button type="button" variant="ghost" size="icon" onClick={() => updateMutation.mutate(editValues)} className="h-7 w-7 text-green-600 hover:bg-green-50">
                            <Check className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setEditingId(null)} className="h-7 w-7 text-gray-500 hover:bg-gray-100">
                            <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="ghost" size="icon" onClick={() => startEditing(v)} className="h-7 w-7 text-primary hover:bg-primary/10">
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)} className="h-7 w-7 text-red-500 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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