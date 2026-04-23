"use client";

import { useState } from "react";
import { useOrderAdmin } from "@/hooks/useOrderAdmin";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileEdit, XCircle, History, Trash2, X, Package } from "lucide-react";
import { OrderEditForm } from "@/components/dashboard/OrderEditForm";
import { OrderItemsEditor } from "@/components/dashboard/OrderItemsEditor";
import { OrderCancelModal } from "@/components/dashboard/OrderCancelModal";
import { OrderDeleteModal } from "@/components/dashboard/OrderDeleteModal";
import { OrderHistoryTimeline } from "@/components/dashboard/OrderHistoryTimeline";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderAdminPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "products" | "history">("edit");

  const { searchOrdersByQuery, getOrderHistory, updateOrderMutation, cancelOrderMutation, deleteOrderMutation } = useOrderAdmin();

  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setFoundOrder(null);
    setHistory([]);
    setSearchResults([]);
    try {
      const results = await searchOrdersByQuery(searchQuery);
      if (!results || results.length === 0) {
        showError(`Nenhum pedido encontrado para "${searchQuery}"`);
        setSearchResults([]);
      } else if (results.length === 1) {
        setFoundOrder(results[0]);
        setActiveTab("edit");
        loadHistory(results[0].id);
      } else {
        setSearchResults(results);
      }
    } catch (error: any) {
      showError(error.message || "Erro ao buscar pedido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOrder = (order: any) => {
    setFoundOrder(order);
    setSearchResults([]);
    setActiveTab("edit");
    loadHistory(order.id);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setFoundOrder(null);
    setHistory([]);
    setSearchResults([]);
  };

  const loadHistory = async (orderNum: number) => {
    setIsHistoryLoading(true);
    try {
      const historyData = await getOrderHistory(orderNum);
      setHistory(historyData);
    } catch (error: any) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const refreshOrder = async () => {
    if (!searchQuery.trim() || !foundOrder) return;
    try {
      const results = await searchOrdersByQuery(searchQuery);
      if (results && results.length > 0) {
        const updated = results.find((o: any) => o.id === foundOrder.id);
        if (updated) {
          setFoundOrder(updated);
          loadHistory(updated.id);
        }
      }
    } catch {}
  };

  const handleSaveOrder = async (updates: any, reason: string) => {
    setIsEditSaving(true);
    try {
      await updateOrderMutation.mutateAsync({ orderId: foundOrder.id, updates, reason });
      showSuccess("Pedido atualizado com sucesso");
      await refreshOrder();
    } catch (error: any) {
      showError(error.message || "Erro ao atualizar pedido");
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleCancelOrder = async (reason: string, returnStock: boolean) => {
    try {
      await cancelOrderMutation.mutateAsync({ orderId: foundOrder.id, reason, returnStock });
      showSuccess("Pedido cancelado com sucesso");
      await refreshOrder();
    } catch (error: any) {
      showError(error.message || "Erro ao cancelar pedido");
    }
  };

  const handleDeleteOrder = async (reason: string) => {
    try {
      await deleteOrderMutation.mutateAsync({ orderId: foundOrder.id, reason });
      showSuccess("Pedido excluído com sucesso");
      setFoundOrder(null);
      setHistory([]);
      setSearchQuery("");
    } catch (error: any) {
      showError(error.message || "Erro ao excluir pedido");
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileEdit className="h-7 w-7 text-primary" />
          Administração de Pedidos
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Busque, edite, cancele ou exclua pedidos, visualize histórico de alterações
        </p>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, CPF, Nome ou Email do cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 pr-10"
          />
          {searchQuery && (
            <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {/* Lista de resultados múltiplos */}
      {searchResults.length > 0 && !foundOrder && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            {searchResults.length} pedido{searchResults.length > 1 ? "s" : ""} encontrado{searchResults.length > 1 ? "s" : ""}. Selecione um para visualizar:
          </div>
          {searchResults.map((order) => (
            <div
              key={order.id}
              onClick={() => handleSelectOrder(order)}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-bold text-lg">#{order.id}</div>
                  <div className="text-sm text-muted-foreground">{formatDate(order.created_at)}</div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <div className="font-medium">{order.profiles?.first_name} {order.profiles?.last_name}</div>
                  <div className="text-sm text-muted-foreground">{order.profiles?.phone || "-"}</div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <Badge variant={order.status === "Cancelado" ? "destructive" : "default"}
                    className={order.status === "Pago" || order.status === "Finalizada" ? "bg-green-600" : ""}>
                    {order.status}
                  </Badge>
                  <Badge variant="outline" className="ml-2">{order.delivery_status}</Badge>
                </div>
              </div>
              <div className="font-bold text-lg">{formatCurrency(Number(order.total_price))}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && !foundOrder && (
        <div className="bg-white rounded-lg border p-6">
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {/* Pedido encontrado */}
      {foundOrder && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          {/* Header do pedido */}
          <div className="p-6 border-b bg-slate-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h2 className="text-xl font-bold">Pedido #{foundOrder.id}</h2>
                  <Badge
                    variant={foundOrder.status === "Cancelado" ? "destructive" : "default"}
                    className={foundOrder.status === "Pago" || foundOrder.status === "Finalizada" ? "bg-green-600" : ""}
                  >
                    {foundOrder.status}
                  </Badge>
                  <Badge variant="outline">{foundOrder.delivery_status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Cliente: {foundOrder.profiles?.first_name} {foundOrder.profiles?.last_name}</p>
                  <p>Data: {formatDate(foundOrder.created_at)}</p>
                  <p>Total: {formatCurrency(Number(foundOrder.total_price))}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="destructive" size="sm" onClick={() => setIsCancelModalOpen(true)}
                  disabled={foundOrder.status === "Cancelado"} className="gap-2">
                  <XCircle className="h-4 w-4" /> Cancelar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setIsDeleteModalOpen(true)}
                  className="gap-2 bg-red-700 hover:bg-red-800">
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="w-full mb-6">
                <TabsTrigger value="edit" className="flex-1 gap-2">
                  <FileEdit className="h-4 w-4" /> Editar Pedido
                </TabsTrigger>
                <TabsTrigger value="products" className="flex-1 gap-2">
                  <Package className="h-4 w-4" /> Produtos
                  {foundOrder.order_items?.length > 0 && (
                    <span className="ml-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">
                      {foundOrder.order_items.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-2">
                  <History className="h-4 w-4" /> Histórico de Alterações
                </TabsTrigger>
              </TabsList>

              {/* Aba: Editar Pedido */}
              <TabsContent value="edit">
                <OrderEditForm
                  order={foundOrder}
                  onSave={handleSaveOrder}
                  onCancel={() => { setFoundOrder(null); setSearchResults([]); }}
                  isLoading={isEditSaving}
                />
              </TabsContent>

              {/* Aba: Produtos */}
              <TabsContent value="products">
                <OrderItemsEditor
                  orderId={foundOrder.id}
                  initialItems={foundOrder.order_items ?? []}
                  orderShippingCost={Number(foundOrder.shipping_cost) || 0}
                  orderCouponDiscount={Number(foundOrder.coupon_discount) || 0}
                  orderDonationAmount={Number(foundOrder.donation_amount) || 0}
                  onSaved={async (newTotal) => {
                    setFoundOrder((prev: any) => ({ ...prev, total_price: newTotal }));
                    await refreshOrder();
                  }}
                />
              </TabsContent>

              {/* Aba: Histórico */}
              <TabsContent value="history">
                {isHistoryLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <OrderHistoryTimeline history={history} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      <OrderCancelModal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)}
        order={foundOrder} onConfirm={handleCancelOrder} />
      <OrderDeleteModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}
        order={foundOrder} onConfirm={handleDeleteOrder} />
    </div>
  );
}