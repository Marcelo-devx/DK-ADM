import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw, Search, CheckCircle2, Package, AlertTriangle,
  StickyNote, Loader2, ShoppingBag, X,
} from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: number;
  name_at_purchase: string;
  quantity: number;
  variant_id: string | null;
  item_id: number | null;
  item_type: string;
  price_at_purchase: number;
}

interface Order {
  id: number;
  status: string;
  total_price: number;
  payment_method: string;
  delivery_info: string | null;
  created_at: string;
  items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  Cancelado: "bg-red-100 text-red-700 border-red-200",
  Pago: "bg-green-100 text-green-700 border-green-200",
  Pendente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Finalizada: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function ReativarPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [reativarDialog, setReativarDialog] = useState<Order | null>(null);
  const [obsDialog, setObsDialog] = useState<Order | null>(null);
  const [obsText, setObsText] = useState("");

  useEffect(() => {
    loadOrders([666, 693]);
  }, []);

  async function loadOrders(ids: number[]) {
    setLoading(true);
    try {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("id, status, total_price, payment_method, delivery_info, created_at")
        .in("id", ids);

      if (error) throw error;
      if (!ordersData || ordersData.length === 0) {
        toast.error("Nenhum pedido encontrado com esses IDs.");
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, name_at_purchase, quantity, variant_id, item_id, item_type, price_at_purchase")
        .in("order_id", ids);

      if (itemsError) throw itemsError;

      const merged: Order[] = ordersData.map((o: any) => ({
        ...o,
        items: (itemsData || []).filter((i: any) => i.order_id === o.id),
      }));

      setOrders((prev) => {
        const existingIds = prev.map((p) => p.id);
        const novos = merged.filter((m) => !existingIds.includes(m.id));
        const atualizados = prev.map((p) => {
          const novo = merged.find((m) => m.id === p.id);
          return novo || p;
        });
        return [...atualizados, ...novos];
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const id = parseInt(searchId.trim());
    if (isNaN(id)) { toast.error("Digite um número de pedido válido"); return; }
    await loadOrders([id]);
    setSearchId("");
  }

  function removeOrder(id: number) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  async function reativarPedido(order: Order) {
    setActionLoading(order.id);
    try {
      const { data, error } = await supabase.rpc("reativar_pedido", { p_order_id: order.id });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || "Erro ao reativar");
      toast.success(`✅ Pedido #${order.id} reativado como "Pago" e estoque deduzido!`);
      await loadOrders([order.id]);
    } catch (err: any) {
      toast.error(err.message || `Erro ao reativar pedido #${order.id}`);
    } finally {
      setActionLoading(null);
      setReativarDialog(null);
    }
  }

  async function salvarObservacao(order: Order) {
    if (!obsText.trim()) { toast.error("Digite uma observação"); return; }
    setActionLoading(order.id);
    try {
      const novaObs = order.delivery_info
        ? `${order.delivery_info} | ${obsText.trim()}`
        : obsText.trim();
      const { error } = await supabase.from("orders").update({ delivery_info: novaObs }).eq("id", order.id);
      if (error) throw error;
      toast.success(`✅ Observação adicionada ao pedido #${order.id}!`);
      await loadOrders([order.id]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar observação");
    } finally {
      setActionLoading(null);
      setObsDialog(null);
      setObsText("");
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <RefreshCw className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
          Reativar Pedidos Cancelados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reative pedidos cancelados, devolva o estoque e marque como Pago para entrar na rota de entrega.
        </p>
      </div>

      {/* Busca */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido por ID..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </div>

      {/* Loading inicial */}
      {loading && orders.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando pedidos...
        </div>
      )}

      {/* Cards dos pedidos */}
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="border shadow-sm overflow-hidden">
            <CardHeader className="pb-3 p-4 sm:p-6">

              {/* Linha 1: número + status + botão fechar */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  <span className="text-lg sm:text-xl font-bold">Pedido #{order.id}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {order.status}
                  </span>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => removeOrder(order.id)}
                  title="Remover da lista"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Linha 2: valor + data */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(Number(order.total_price))}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
              </div>

              {/* Avisos de status */}
              {order.status === "Cancelado" && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Estoque já foi devolvido
                </div>
              )}
              {order.status === "Pago" && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Reativado com sucesso
                </div>
              )}

              {/* Observação */}
              {order.delivery_info && (
                <div className="mt-2 flex items-start gap-2 text-sm bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                  <StickyNote className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <span className="text-yellow-800 break-words min-w-0">{order.delivery_info}</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              {/* Itens do pedido */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                  <Package className="h-4 w-4 shrink-0" />
                  Itens do pedido
                </div>
                <div className="space-y-2">
                  {order.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum item encontrado</p>
                  ) : (
                    order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm bg-slate-50 rounded-md px-3 py-2.5"
                      >
                        {/* Nome do produto */}
                        <div className="flex items-start gap-2 min-w-0">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="font-medium break-words">{item.name_at_purchase}</span>
                        </div>
                        {/* Preço + quantidade */}
                        <div className="flex items-center gap-3 shrink-0 pl-5 sm:pl-0">
                          <span className="text-muted-foreground text-xs sm:text-sm">
                            {formatCurrency(Number(item.price_at_purchase))}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Qtd: {item.quantity}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                {order.status === "Cancelado" && (
                  <Button
                    onClick={() => setReativarDialog(order)}
                    disabled={actionLoading === order.id}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                  >
                    {actionLoading === order.id ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Reativando...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" /> Reativar como Pago + Deduzir Estoque</>
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => { setObsDialog(order); setObsText(""); }}
                  disabled={actionLoading === order.id}
                  className="gap-2 w-full sm:w-auto"
                >
                  <StickyNote className="h-4 w-4" />
                  {order.delivery_info ? "Editar Observação" : "Adicionar Observação"}
                </Button>

                {order.status !== "Cancelado" && (
                  <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium sm:ml-auto">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Pedido ativo — pronto para a rota
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de confirmação de reativação */}
      <AlertDialog open={!!reativarDialog} onOpenChange={() => setReativarDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-600" />
              Reativar Pedido #{reativarDialog?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Esta ação irá:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Mudar o status de <strong>Cancelado</strong> → <strong>Pago</strong></li>
                  <li><strong>Deduzir o estoque</strong> dos {reativarDialog?.items.length} item(s) do pedido</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Confirme que o cliente realmente pagou antes de prosseguir.</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => reativarDialog && reativarPedido(reativarDialog)} className="bg-green-600 hover:bg-green-700">
              Sim, reativar como Pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de observação */}
      <AlertDialog open={!!obsDialog} onOpenChange={() => { setObsDialog(null); setObsText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-yellow-600" />
              Observação — Pedido #{obsDialog?.id}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                {obsDialog?.delivery_info && (
                  <div className="text-sm bg-slate-50 border rounded-md px-3 py-2">
                    <span className="text-muted-foreground">Observação atual: </span>
                    <span className="font-medium">{obsDialog.delivery_info}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="obs-input">Nova observação</Label>
                  <Textarea
                    id="obs-input"
                    placeholder="Ex: Troca, Entrega especial, etc."
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  {obsDialog?.delivery_info && (
                    <p className="text-xs text-muted-foreground">Será adicionado ao final da observação existente.</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => obsDialog && salvarObservacao(obsDialog)} disabled={!obsText.trim()}>
              Salvar Observação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
