import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProductCombobox, SelectableItem } from "@/components/dashboard/ProductCombobox";
import { Trash2, Plus, Package, Loader2, Save, RefreshCw, AlertTriangle } from "lucide-react";
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

interface EditableItem extends OrderItem {
  _originalQuantity: number; // to compute stock diff
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
  orderShippingCost: number;
  orderCouponDiscount: number;
  orderDonationAmount: number;
  onSaved: (newTotal: number) => void;
}

// ── Fetch price for a product/variant ──────────────────────────────────────
async function fetchItemPrice(item: SelectableItem): Promise<number> {
  if (item.variant_id) {
    const { data } = await supabase
      .from("product_variants")
      .select("pix_price, price")
      .eq("id", item.variant_id)
      .single();
    if (data) return Number(data.pix_price ?? data.price ?? 0);
  } else {
    const { data } = await supabase
      .from("products")
      .select("pix_price, price")
      .eq("id", item.id)
      .single();
    if (data) return Number(data.pix_price ?? data.price ?? 0);
  }
  return 0;
}

// ── Stock helpers ──────────────────────────────────────────────────────────
async function adjustStock(
  item_id: number | null,
  variant_id: string | null,
  delta: number // positive = add back, negative = deduct
) {
  if (delta === 0) return;
  if (variant_id) {
    const { data: v } = await supabase
      .from("product_variants")
      .select("stock_quantity")
      .eq("id", variant_id)
      .single();
    if (v) {
      await supabase
        .from("product_variants")
        .update({ stock_quantity: Math.max(0, v.stock_quantity + delta) })
        .eq("id", variant_id);
    }
  } else if (item_id) {
    const { data: p } = await supabase
      .from("products")
      .select("stock_quantity")
      .eq("id", item_id)
      .single();
    if (p) {
      await supabase
        .from("products")
        .update({ stock_quantity: Math.max(0, p.stock_quantity + delta) })
        .eq("id", item_id);
    }
  }
}

// ── Product search ─────────────────────────────────────────────────────────
const searchProducts = async (term: string): Promise<SelectableItem[]> => {
  const results: SelectableItem[] = [];

  let variantQuery = supabase
    .from("product_variants")
    .select("id, product_id, ohms, size, color, stock_quantity, cost_price, products(name, categories(name), brands(name))")
    .order("stock_quantity", { ascending: false })
    .limit(30);

  if (term) variantQuery = variantQuery.ilike("products.name", `%${term}%`);

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

  if (results.length < 10) {
    let productQuery = supabase
      .from("products")
      .select("id, name, stock_quantity, cost_price, categories(name), brands(name)")
      .order("stock_quantity", { ascending: false })
      .limit(20);
    if (term) productQuery = productQuery.ilike("name", `%${term}%`);
    const { data: products } = await productQuery;
    if (products) {
      products.forEach((p: any) => {
        if (!results.some((r) => r.id === p.id)) {
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

// ── Component ──────────────────────────────────────────────────────────────
export function OrderItemsEditor({
  orderId,
  initialItems,
  orderShippingCost,
  orderCouponDiscount,
  orderDonationAmount,
  onSaved,
}: OrderItemsEditorProps) {
  const queryClient = useQueryClient();

  const [items, setItems] = useState<EditableItem[]>(
    initialItems.map((it) => ({ ...it, _originalQuantity: it.quantity }))
  );
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [loadingPriceTempId, setLoadingPriceTempId] = useState<string | null>(null);

  const fmt = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // ── Existing items ────────────────────────────────────────────────────────
  const updateItem = (id: number, field: "quantity" | "price_at_purchase" | "name_at_purchase", value: any) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const markForDeletion = (id: number) =>
    setDeletedIds((prev) => new Set([...prev, id]));

  const unmarkForDeletion = (id: number) =>
    setDeletedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  // ── New items ─────────────────────────────────────────────────────────────
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

  const updateNewItem = (tempId: string, field: string, value: any) =>
    setNewItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, [field]: value } : it)));

  const handleNewItemSelect = async (tempId: string, comboValue: string, item: SelectableItem) => {
    // Optimistically set name and clear price while fetching
    setNewItems((prev) =>
      prev.map((it) =>
        it.tempId === tempId
          ? { ...it, comboValue, selectedItem: item, item_id: item.id, variant_id: item.variant_id ?? null, name_at_purchase: item.name, price_at_purchase: 0 }
          : it
      )
    );
    setLoadingPriceTempId(tempId);
    try {
      const price = await fetchItemPrice(item);
      setNewItems((prev) =>
        prev.map((it) => (it.tempId === tempId ? { ...it, price_at_purchase: price } : it))
      );
    } finally {
      setLoadingPriceTempId(null);
    }
  };

  const handleNewItemClear = (tempId: string) =>
    setNewItems((prev) =>
      prev.map((it) =>
        it.tempId === tempId
          ? { ...it, comboValue: "", selectedItem: null, item_id: null, variant_id: null, name_at_purchase: "", price_at_purchase: 0 }
          : it
      )
    );

  const removeNewItem = (tempId: string) =>
    setNewItems((prev) => prev.filter((it) => it.tempId !== tempId));

  // ── Computed totals ───────────────────────────────────────────────────────
  const activeItems = items.filter((it) => !deletedIds.has(it.id));
  const deletedItems = items.filter((it) => deletedIds.has(it.id));
  const validNewItems = newItems.filter((it) => it.item_id !== null && it.name_at_purchase);

  const itemsSubtotal =
    activeItems.reduce((acc, it) => acc + it.price_at_purchase * it.quantity, 0) +
    validNewItems.reduce((acc, it) => acc + it.price_at_purchase * it.quantity, 0);

  const newTotal = itemsSubtotal + orderShippingCost + orderDonationAmount - orderCouponDiscount;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Handle deleted items → return stock
      for (const id of Array.from(deletedIds)) {
        const original = items.find((it) => it.id === id);
        if (original) {
          await adjustStock(original.item_id, original.variant_id ?? null, +original._originalQuantity);
          const { error } = await supabase.from("order_items").delete().eq("id", id);
          if (error) throw new Error(`Erro ao remover item: ${error.message}`);
        }
      }

      // 2. Update existing items → adjust stock diff
      for (const item of activeItems) {
        const qtyDiff = item._originalQuantity - item.quantity; // positive = we reduced qty → return stock
        await adjustStock(item.item_id, item.variant_id ?? null, qtyDiff);
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

      // 3. Insert new items → deduct stock
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

        for (const it of validNewItems) {
          await adjustStock(it.item_id, it.variant_id, -it.quantity);
        }
      }

      // 4. Update order total automatically
      const { error: orderError } = await supabase
        .from("orders")
        .update({ total_price: newTotal })
        .eq("id", orderId);
      if (orderError) throw new Error(`Erro ao atualizar total: ${orderError.message}`);

      // 5. Register edit in order_history so client sees the badge
      const { data: { user } } = await supabase.auth.getUser();
      const changesSummary: string[] = [];
      if (deletedIds.size > 0) changesSummary.push(`${deletedIds.size} item(s) removido(s)`);
      if (validNewItems.length > 0) changesSummary.push(`${validNewItems.length} item(s) adicionado(s)`);
      const updatedCount = activeItems.filter((it) => {
        const orig = initialItems.find((o) => o.id === it.id);
        return orig && (it.quantity !== orig.quantity || it.price_at_purchase !== orig.price_at_purchase);
      }).length;
      if (updatedCount > 0) changesSummary.push(`${updatedCount} item(s) alterado(s)`);

      await supabase.from("order_history").insert({
        order_id: orderId,
        field_name: "items",
        old_value: null,
        new_value: changesSummary.join(", "),
        changed_by: user?.id ?? null,
        change_type: "items_edited",
        reason: `Itens editados pelo admin: ${changesSummary.join(", ")}`,
      });

      showSuccess(`Itens e total do pedido #${orderId} atualizados! Novo total: ${fmt(newTotal)}`);
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      onSaved(newTotal);
    } catch (err: any) {
      showError(err.message || "Erro ao salvar itens");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    deletedIds.size > 0 ||
    validNewItems.length > 0 ||
    items.some((it) => {
      const orig = initialItems.find((o) => o.id === it.id);
      return orig && (it.quantity !== orig.quantity || it.price_at_purchase !== orig.price_at_purchase || it.name_at_purchase !== orig.name_at_purchase);
    });

  return (
    <div className="space-y-4">
      {/* Active existing items */}
      {activeItems.length > 0 && (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_76px_106px_34px] gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* Name */}
              <div className="min-w-0 space-y-1">
                <Input
                  value={item.name_at_purchase}
                  onChange={(e) => updateItem(item.id, "name_at_purchase", e.target.value)}
                  className="h-8 text-sm font-medium"
                  placeholder="Nome do produto"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">{item.item_type}</Badge>
                  {item.variant_id && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      var: {String(item.variant_id).slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>

              {/* Qty */}
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground block">Qtd</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                  className="h-8 text-sm text-center"
                />
                {item.quantity !== item._originalQuantity && (
                  <p className="text-[10px] text-amber-600">
                    era {item._originalQuantity}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground block">
                  Preço unit.
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={item.price_at_purchase}
                  onChange={(e) => updateItem(item.id, "price_at_purchase", parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">{fmt(item.price_at_purchase * item.quantity)}</p>
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 mt-4 text-red-500 hover:bg-red-50 hover:text-red-700"
                onClick={() => markForDeletion(item.id)}
                title="Remover item (devolve estoque)"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Deleted items */}
      {deletedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Itens marcados para remoção (estoque será devolvido):
          </p>
          {deletedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-200"
            >
              <div>
                <span className="text-sm line-through text-red-700">{item.name_at_purchase}</span>
                <span className="text-xs text-red-500 ml-2">× {item._originalQuantity}</span>
              </div>
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
                <span className="text-xs font-semibold text-blue-700">Novo produto</span>
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
                onChange={(val, item) => handleNewItemSelect(newItem.tempId, val, item)}
                onClear={() => handleNewItemClear(newItem.tempId)}
                placeholder="Buscar produto..."
                allowWrap
              />

              {newItem.selectedItem && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground block">Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) => updateNewItem(newItem.tempId, "quantity", parseInt(e.target.value) || 1)}
                      className="h-8 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Estoque: {newItem.selectedItem.stock_quantity}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground block flex items-center gap-1">
                      Preço unit.
                      {loadingPriceTempId === newItem.tempId && (
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                      )}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={newItem.price_at_purchase}
                      onChange={(e) => updateNewItem(newItem.tempId, "price_at_purchase", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {fmt(newItem.price_at_purchase * newItem.quantity)}
                    </p>
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
      {(activeItems.length > 0 || validNewItems.length > 0) && (
        <div className="bg-slate-100 rounded-lg p-3 space-y-1.5 text-sm border border-slate-200">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal dos itens</span>
            <span>{fmt(itemsSubtotal)}</span>
          </div>
          {orderShippingCost > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Frete</span>
              <span>+ {fmt(orderShippingCost)}</span>
            </div>
          )}
          {orderDonationAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Doação</span>
              <span>+ {fmt(orderDonationAmount)}</span>
            </div>
          )}
          {orderCouponDiscount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Desconto cupom</span>
              <span>- {fmt(orderCouponDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1.5 mt-1">
            <span>Novo total do pedido</span>
            <span className="text-primary">{fmt(newTotal)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            ✓ Total e estoque serão atualizados automaticamente ao salvar.
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
            <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="h-4 w-4" /> Salvar Itens</>
          )}
        </Button>
      </div>
    </div>
  );
}
