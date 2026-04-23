import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProductCombobox, SelectableItem } from "@/components/dashboard/ProductCombobox";
import { Trash2, Plus, Package, Loader2, Save } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient } from "@tanstack/react-query";

interface OrderItem {
  id: number;
  order_id: number;
  item_id: number | null;
  item_type: string;
  quantity: number;
  price_at_purchase: number;
  name_at_purchase: string;
  image_url_at_purchase?: string | null;
  variant_id?: string | null;
}

interface NewItem {
  tempId: string;
  item_id: number | null;
  variant_id: string | null;
  item_type: string;
  quantity: number;
  price_at_purchase: number;
  name_at_purchase: string;
  selectedItem: SelectableItem | null;
  comboValue: string;
}

interface OrderItemsEditorProps {
  orderId: number;
  initialItems: OrderItem[];
  onClose?: () => void;
}

const searchProducts = async (term: string): Promise<SelectableItem[]> => {
  const results: SelectableItem[] = [];

  // Search variants first
  let variantQuery = supabase
    .from("product_variants")
    .select("id, product_id, ohms, size, color, stock_quantity, cost_price, products(name, categories(name), brands(name))")
    .order("stock_quantity", { ascending: false })
    .limit(30);

  if (term) {
    variantQuery = variantQuery.ilike("products.name", `%${term}%`);
  }

  const { data: variants } = await variantQuery;

  if (variants) {
    variants.forEach((v: any) => {
      if (!v.products) return;
      const attrs = [v.ohms, v.size, v.color].filter(Boolean).join(" / ");
      const name = attrs ? `${v.products.name} — ${attrs}` : v.products.name;
      results.push({
        id: v.product_id,
        variant_id: v.id,
        name,
        stock_quantity: v.stock_quantity ?? 0,
        cost_price: v.cost_price ?? null,
        is_variant: true,
        ohms: v.ohms,
        size: v.size,
        color: v.color,
        category: v.products?.categories?.name ?? null,
        brand: v.products?.brands?.name ?? null,
      });
    });
  }

  // If no variants found or no term, also search base products
  if (results.length < 10) {
    let productQuery = supabase
      .from("products")
      .select("id, name, stock_quantity, cost_price, categories(name), brands(name)")
      .order("stock_quantity", { ascending: false })
      .limit(20);

    if (term) {
      productQuery = productQuery.ilike("name", `%${term}%`);
    }

    const { data: products } = await productQuery;
    if (products) {
      products.forEach((p: any) => {
        // Only add base product if it doesn't have variants already in results
        const alreadyHasVariant = results.some((r) => r.id === p.id);
        if (!alreadyHasVariant) {
          results.push({
            id: p.id,
            variant_id: null,
            name: p.name,
            stock_quantity: p.stock_quantity ?? 0,
            cost_price: p.cost_price ?? null,
            is_variant: false,
            category: p.categories?.name ?? null,
            brand: p.brands?.name ?? null,
          });
        }
      });
    }
  }

  return results;
};

export function OrderItemsEditor({ orderId, initialItems, onClose }: OrderItemsEditorProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Existing items handlers
  const updateExistingItem = (id: number, field: "quantity" | "price_at_purchase" | "name_at_purchase", value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const markForDeletion = (id: number) => {
    setDeletedIds((prev) => new Set([...prev, id]));
  };

  const unmarkForDeletion = (id: number) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // New items handlers
  const addNewItem = () => {
    setNewItems((prev) => [
      ...prev,
      {
        tempId: `new_${Date.now()}_${Math.random()}`,
        item_id: null,
        variant_id: null,
        item_type: "product",
        quantity: 1,
        price_at_purchase: 0,
        name_at_purchase: "",
        selectedItem: null,
        comboValue: "",
      },
    ]);
  };

  const updateNewItem = (tempId: string, field: string, value: any) => {
    setNewItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, [field]: value } : it))
    );
  };

  const handleNewItemProductSelect = (tempId: string, comboValue: string, item: SelectableItem) => {
    setNewItems((prev) =>
      prev.map((it) =>
        it.tempId === tempId
          ? {
              ...it,
              comboValue,
              selectedItem: item,
              item_id: item.id,
              variant_id: item.variant_id ?? null,
              name_at_purchase: item.name,
              price_at_purchase: 0,
            }
          : it
      )
    );
  };

  const handleNewItemClear = (tempId: string) => {
    setNewItems((prev) =>
      prev.map((it) =>
        it.tempId === tempId
          ? { ...it, comboValue: "", selectedItem: null, item_id: null, variant_id: null, name_at_purchase: "", price_at_purchase: 0 }
          : it
      )
    );
  };

  const removeNewItem = (tempId: string) => {
    setNewItems((prev) => prev.filter((it) => it.tempId !== tempId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Delete marked items
      if (deletedIds.size > 0) {
        const { error } = await supabase
          .from("order_items")
          .delete()
          .in("id", Array.from(deletedIds));
        if (error) throw new Error(`Erro ao remover itens: ${error.message}`);
      }

      // 2. Update existing items (not deleted)
      const itemsToUpdate = items.filter((it) => !deletedIds.has(it.id));
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from("order_items")
          .update({
            quantity: item.quantity,
            price_at_purchase: item.price_at_purchase,
            name_at_purchase: item.name_at_purchase,
          })
          .eq("id", item.id);
        if (error) throw new Error(`Erro ao atualizar item: ${error.message}`);
      }

      // 3. Insert new items
      const validNewItems = newItems.filter((it) => it.item_id !== null && it.name_at_purchase);
      if (validNewItems.length > 0) {
        const toInsert = validNewItems.map((it) => ({
          order_id: orderId,
          item_id: it.item_id,
          variant_id: it.variant_id,
          item_type: it.item_type,
          quantity: it.quantity,
          price_at_purchase: it.price_at_purchase,
          name_at_purchase: it.name_at_purchase,
        }));
        const { error } = await supabase.from("order_items").insert(toInsert);
        if (error) throw new Error(`Erro ao inserir itens: ${error.message}`);
      }

      showSuccess("Itens do pedido atualizados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      onClose?.();
    } catch (err: any) {
      showError(err.message || "Erro ao salvar itens");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    deletedIds.size > 0 ||
    newItems.some((it) => it.item_id !== null) ||
    JSON.stringify(items) !== JSON.stringify(initialItems);

  const activeItems = items.filter((it) => !deletedIds.has(it.id));
  const deletedItems = items.filter((it) => deletedIds.has(it.id));

  return (
    <div className="space-y-4">
      {/* Active existing items */}
      {activeItems.length > 0 && (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_80px_110px_36px] gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="min-w-0">
                <Input
                  value={item.name_at_purchase}
                  onChange={(e) => updateExistingItem(item.id, "name_at_purchase", e.target.value)}
                  className="h-8 text-sm font-medium"
                  placeholder="Nome do produto"
                />
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {item.item_type}
                  </Badge>
                  {item.variant_id && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      var: {String(item.variant_id).slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Qtd</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateExistingItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                  className="h-8 text-sm text-center"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                  Preço unit. {formatCurrency(item.price_at_purchase)}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={item.price_at_purchase}
                  onChange={(e) =>
                    updateExistingItem(item.id, "price_at_purchase", parseFloat(e.target.value) || 0)
                  }
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                onClick={() => markForDeletion(item.id)}
                title="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Deleted items (shown with restore option) */}
      {deletedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Itens marcados para remoção:</p>
          {deletedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-200 opacity-60"
            >
              <span className="text-sm line-through text-red-700">{item.name_at_purchase}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-600 hover:text-red-800"
                onClick={() => unmarkForDeletion(item.id)}
              >
                Desfazer
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* New items */}
      {newItems.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">Novos itens:</p>
          {newItems.map((newItem) => (
            <div
              key={newItem.tempId}
              className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700">Novo item</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-500 hover:bg-red-50"
                  onClick={() => removeNewItem(newItem.tempId)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <ProductCombobox
                value={newItem.comboValue}
                selectedItem={newItem.selectedItem}
                onSearch={searchProducts}
                onChange={(val, item) => handleNewItemProductSelect(newItem.tempId, val, item)}
                onClear={() => handleNewItemClear(newItem.tempId)}
                placeholder="Buscar produto..."
                allowWrap
              />
              {newItem.selectedItem && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) =>
                        updateNewItem(newItem.tempId, "quantity", parseInt(e.target.value) || 1)
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                      Preço unit. {formatCurrency(newItem.price_at_purchase)}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={newItem.price_at_purchase}
                      onChange={(e) =>
                        updateNewItem(newItem.tempId, "price_at_purchase", parseFloat(e.target.value) || 0)
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {activeItems.length === 0 && newItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum item no pedido</p>
        </div>
      )}

      {/* Summary */}
      {(activeItems.length > 0 || newItems.some((it) => it.selectedItem)) && (
        <div className="bg-gray-100 rounded-lg p-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Subtotal dos itens:</span>
            <span className="font-bold">
              {formatCurrency(
                activeItems.reduce(
                  (acc, it) => acc + it.price_at_purchase * it.quantity,
                  0
                ) +
                  newItems
                    .filter((it) => it.selectedItem)
                    .reduce((acc, it) => acc + it.price_at_purchase * it.quantity, 0)
              )}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            * O total do pedido deve ser atualizado manualmente na aba de valores.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
          onClick={addNewItem}
        >
          <Plus className="h-4 w-4" /> Adicionar produto
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="gap-1.5"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Salvar Itens
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
