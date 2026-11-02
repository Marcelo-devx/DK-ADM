import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingBag, Package, Loader2 } from "lucide-react";

interface BuyerPurchaseHistoryProps {
  userId: string | null;
  guestEmail: string | null;
  orderId: number;
  name: string;
  onSelectProduct: (selection: { productId: number; variantId: string | null; name: string; sku: string | null }) => void;
}
interface HistoryItem {
  id: number;
  item_id: number | null;
  variant_id: string | null;
  item_type: string;
  name_at_purchase: string;
  quantity: number;
  order_id: number;
}

export default function BuyerPurchaseHistory({ userId, guestEmail, orderId, name, onSelectProduct }: BuyerPurchaseHistoryProps) {
  const { user, isAdmin, isGerenteGeral } = useUser();
  const selection = useMutation({
    mutationFn: async (item: { productId: number; variantId: string | null; name: string }) => {
      let productId = item.productId;
      let sku: string | null = null;
      if (item.variantId) {
        const variant = await supabase.from("product_variants").select("product_id, sku").eq("id", item.variantId).maybeSingle();
        if (variant.error) throw variant.error;
        if (!variant.data?.product_id) throw new Error("Esta variação não está mais disponível no catálogo.");
        productId = variant.data.product_id;
        sku = variant.data.sku;
      }
      const product = await supabase.from("products").select("id, name, sku").eq("id", productId).maybeSingle();
      if (product.error) throw product.error;
      if (!product.data) throw new Error("Este produto não está mais disponível no catálogo.");
      return { productId, variantId: item.variantId, name: item.variantId ? item.name : product.data.name, sku: item.variantId ? sku : product.data.sku };
    },
    onSuccess: onSelectProduct,
  });
  const history = useQuery({
    queryKey: ["auditoria-produto-historico-navegavel", "finalizada-entregue", user?.id, userId, guestEmail, userId || guestEmail ? null : orderId],
    enabled: isAdmin || isGerenteGeral,
    queryFn: async () => {
      const items: HistoryItem[] = [];
      let offset = 0;
      while (true) {
        let query = supabase.from("order_items")
          .select("id, item_id, variant_id, item_type, name_at_purchase, quantity, order_id, orders!order_items_order_id_fkey!inner(id, user_id, guest_email, status, delivery_status)")
          .eq("orders.status", "Finalizada").eq("orders.delivery_status", "Entregue");
        if (userId) query = query.eq("orders.user_id", userId);
        else if (guestEmail) query = query.is("orders.user_id", null).eq("orders.guest_email", guestEmail);
        else query = query.eq("order_id", orderId);
        const { data, error } = await query.order("id").range(offset, offset + 499);
        if (error) throw error;
        const batch = (data ?? []) as unknown as HistoryItem[];
        items.push(...batch);
        if (batch.length < 500) break;
        offset += 500;
      }
      const grouped = new Map<string, { key: string; name: string; productId: number | null; variantId: string | null; itemType: string; quantity: number; orders: Set<number> }>();
      for (const item of items) {
        // Preserve historical names, including variants that no longer exist in the catalog.
        const key = JSON.stringify([item.item_type, item.item_id, item.variant_id, item.name_at_purchase]);
        const product = grouped.get(key) ?? { key, name: item.name_at_purchase, productId: item.item_id, variantId: item.variant_id, itemType: item.item_type, quantity: 0, orders: new Set<number>() };
        product.quantity += item.quantity;
        product.orders.add(item.order_id);
        grouped.set(key, product);
      }
      return {
        products: [...grouped.values()].map(p => ({ key: p.key, name: p.name, productId: p.productId, variantId: p.variantId, itemType: p.itemType, quantity: p.quantity, orderCount: p.orders.size })).sort((a, b) => b.quantity - a.quantity),
        orderCount: new Set(items.map(i => i.order_id)).size,
        quantity: items.reduce((sum, i) => sum + i.quantity, 0),
      };
    },
  });

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-blue-900"><ShoppingBag className="h-5 w-5 text-blue-600" />Histórico de compras de {name}</h3>
        {history.data && <div className="flex gap-2"><Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{history.data.orderCount} pedidos</Badge><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{history.data.quantity} unidades</Badge></div>}
      </div>
      <p className="mb-3 text-xs text-slate-500">Produtos e kits apenas de pedidos com status Finalizada e entrega Entregue. Quantidades somadas por item/variação e nome registrado na compra.</p>
      <p className="mb-3 text-xs text-blue-700">Clique em um produto ou variação para consultar seus compradores. Itens sem vínculo com uma variação consultam o produto completo; kits não são selecionáveis nesta auditoria.</p>
      {selection.isPending && <p role="status" className="mb-3 flex items-center gap-2 text-sm text-blue-600"><Loader2 className="h-4 w-4 animate-spin" />Selecionando produto...</p>}
      {selection.isError && <p role="alert" className="mb-3 text-sm text-destructive">Não foi possível selecionar: {selection.error.message}</p>}
      {!userId && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{guestEmail ? "Cliente convidado: histórico dos pedidos de convidado com o mesmo e-mail registrado." : "Sem conta ou e-mail de convidado: apenas os itens deste pedido podem ser identificados com segurança."}</p>}
      {history.isPending ? <p className="flex items-center gap-2 py-4 text-sm text-blue-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando histórico completo...</p> : history.isError ? <div role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico: {history.error.message}<Button className="ml-2" size="sm" variant="outline" onClick={() => void history.refetch()}>Tentar novamente</Button></div> : !history.data.products.length ? <p className="py-4 text-sm text-slate-500">Nenhuma compra confirmada encontrada.</p> : <div className="max-h-80 overflow-y-auto rounded-lg border border-blue-100">
        <Table><TableHeader className="bg-blue-50"><TableRow><TableHead className="text-blue-900">Produto / Variação</TableHead><TableHead className="text-center text-blue-900">Quantidade total</TableHead><TableHead className="text-center text-blue-900">Pedidos</TableHead></TableRow></TableHeader>
          <TableBody>{history.data.products.map(p => <TableRow key={p.key} className="hover:bg-blue-50/60"><TableCell>
            {p.itemType === "product" && p.productId != null ? <button type="button" disabled={selection.isPending} className="flex items-center gap-2 rounded-md p-1 text-left font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50" onClick={() => selection.mutate({ productId: p.productId!, variantId: p.variantId, name: p.name })}><Package className="h-4 w-4 shrink-0 text-blue-400" />{p.name}</button> : <div className="flex items-center gap-2 text-slate-600"><Package className="h-4 w-4 shrink-0 text-blue-400" />{p.name}</div>}
          </TableCell><TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{p.quantity}</Badge></TableCell><TableCell className="text-center text-slate-600">{p.orderCount}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>}
    </div>
  );
}
