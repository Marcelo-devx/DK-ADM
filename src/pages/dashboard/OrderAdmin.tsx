"use client";

import { useState } from "react";
import { useOrderAdmin } from "@/hooks/useOrderAdmin";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileEdit, XCircle, History } from "lucide-react";
import { OrderEditForm } from "@/components/dashboard/OrderEditForm";
import { OrderCancelModal } from "@/components/dashboard/OrderCancelModal";
import { OrderHistoryTimeline } from "@/components/dashboard/OrderHistoryTimeline";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderAdminPage() {
  const [orderId, setOrderId] = useState("");
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");

  const { searchOrderById, getOrderHistory, updateOrderMutation, cancelOrderMutation } = useOrderAdmin();

  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const handleSearch = async () => {
    if (!orderId.trim()) return;

    setIsLoading(true);
    setFoundOrder(null);
    setHistory([]);
    try {
      const order = await searchOrderById(parseInt(orderId));
      if (!order) {
        showError(`Pedido #${orderId} não encontrado`);
      } else {
        setFoundOrder(order);
        setActiveTab("edit");
        // Buscar histórico
        loadHistory(order.id);
      }
    } catch (error: any) {
      showError(error.message || "Erro ao buscar pedido");
    } finally {
      setIsLoading(false);
    }
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

  const handleSaveOrder = async (updates: any, reason: string) => {
    setIsEditSaving(true);
    try {
      await updateOrderMutation.mutateAsync({
        orderId: foundOrder.id,
        updates,
        reason,
      });
      showSuccess("Pedido atualizado com sucesso");
      // Recarregar pedido e histórico
      const order = await searchOrderById(foundOrder.id);
      setFoundOrder(order);
      loadHistory(foundOrder.id);
    } catch (error: any) {
      showError(error.message || "Erro ao atualizar pedido");
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleCancelOrder = async (reason: string, returnStock: boolean) => {
    try {
      await cancelOrderMutation.mutateAsync({
        orderId: foundOrder.id,
        reason,
        returnStock,
      });
      showSuccess("Pedido cancelado com sucesso");
      // Recarregar pedido e histórico
      const order = await searchOrderById(foundOrder.id);
      setFoundOrder(order);
      loadHistory(foundOrder.id);
    } catch (error: any) {
      showError(error.message || "Erro ao cancelar pedido");
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileEdit className="h-7 w-7 text-primary" />
          Administração de Pedidos
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Busque e edite pedidos, visualize histórico de alterações
        </p>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido pelo número..."
            type="number"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {/* Resultado */}
      {isLoading ? (
        <div className="bg-white rounded-lg border p-6">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : foundOrder ? (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          {/* Header do pedido */}
          <div className="p-6 border-b bg-slate-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold">Pedido #{foundOrder.id}</h2>
                  <Badge
                    variant={foundOrder.status === "Cancelado" ? "destructive" : "default"}
                    className={
                      foundOrder.status === "Pago" || foundOrder.status === "Finalizada"
                        ? "bg-green-600"
                        : ""
                    }
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
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={foundOrder.status === "Cancelado"}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancelar Pedido
              </Button>
            </div>
          </div>

          {/* Abas */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="w-full mb-6">
                <TabsTrigger value="edit" className="flex-1 gap-2">
                  <FileEdit className="h-4 w-4" />
                  Editar Pedido
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Alterações
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit">
                <OrderEditForm
                  order={foundOrder}
                  onSave={handleSaveOrder}
                  onCancel={() => setFoundOrder(null)}
                  isLoading={isEditSaving}
                />
              </TabsContent>

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
      ) : null}

      {/* Modal de cancelamento */}
      <OrderCancelModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        order={foundOrder}
        onConfirm={handleCancelOrder}
      />
    </div>
  );
}
