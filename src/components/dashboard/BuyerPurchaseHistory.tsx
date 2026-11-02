import { useQuery } from "@tanstack/react-query";
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

export default function BuyerPurchaseHistory({ userId, guestEmail, orderId, name }: BuyerPurchaseHistoryProps) {
  const { user, isAdmin, isGerenteGeral } = useUser();
  const history = useQuery({
    queryKey: ["auditoria-produto-historico", user?.id, userId, guestEmail, userId || guestEmail ? null : orderId],
    enabled: isAdmin || isGerenteGeral,
    queryFn: async () => {
      const items: HistoryItem[] = [];
      let offset = 0;
      while (true) {
        let query = supabase.from("order_items")
          .select("id, item_id, variant_id, item_type, name_at_purchase, quantity, order_id, orders!order_items_order_id_fkey!inner(id, user_id, guest_email, status)")
          .not("orders.status", "in", "(Pendente,Cancelado)");
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
      const grouped = new Map<string, { key: string; name: string; quantity: number; orders: Set<number> }>();
      for (const item of items) {
        // Preserve historical names, including variants that no longer exist in the catalog.
        const key = JSON.stringify([item.item_type, item.item_id, item.variant_id, item.name_at_purchase]);
        const product = grouped.get(key) ?? { key, name: item.name_at_purchase, quantity: 0, orders: new Set<number>() };
        product.quantity += item.quantity;
        product.orders.add(item.order_id);
        grouped.set(key, product);
      }
      return {
        products: [...grouped.values()].map(p => ({ key: p.key, name: p.name, quantity: p.quantity, orderCount: p.orders.size })).sort((a, b) => b.quantity - a.quantity),
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
      <p className="mb-3 text-xs text-slate-500">Produtos e kits de todos os pedidos, exceto pendentes e cancelados. Quantidades somadas por item/variação e nome registrado na compra.</p>
      {!userId && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{guestEmail ? "Cliente convidado: histórico dos pedidos de convidado com o mesmo e-mail registrado." : "Sem conta ou e-mail de convidado: apenas os itens deste pedido podem ser identificados com segurança."}</p>}
      {history.isPending ? <p className="flex items-center gap-2 py-4 text-sm text-blue-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando histórico completo...</p> : history.isError ? <div role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico: {history.error.message}<Button className="ml-2" size="sm" variant="outline" onClick={() => void history.refetch()}>Tentar novamente</Button></div> : !history.data.products.length ? <p className="py-4 text-sm text-slate-500">Nenhuma compra confirmada encontrada.</p> : <div className="max-h-80 overflow-y-auto rounded-lg border border-blue-100">
        <Table><TableHeader className="bg-blue-50"><TableRow><TableHead className="text-blue-900">Produto / Variação</TableHead><TableHead className="text-center text-blue-900">Quantidade total</TableHead><TableHead className="text-center text-blue-900">Pedidos</TableHead></TableRow></TableHeader>
          <TableBody>{history.data.products.map(p => <TableRow key={p.key} className="hover:bg-blue-50/60"><TableCell><div className="flex items-center gap-2"><Package className="h-4 w-4 shrink-0 text-blue-400" />{p.name}</div></TableCell><TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{p.quantity}</Badge></TableCell><TableCell className="text-center text-slate-600">{p.orderCount}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>}
    </div>
  );
}
