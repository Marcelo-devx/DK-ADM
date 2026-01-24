"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "../../components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, DollarSign, Eye, Trash2, Package, Printer, RefreshCw, CheckCircle2, AlertCircle, Loader2, Truck, SquareCheck as CheckboxIcon, X, Clock, CalendarClock, QrCode, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/utils/toast";
import { OrderDetailModal } from "@/components/dashboard/OrderDetailModal";
import { ShippingLabelModal } from "@/components/dashboard/ShippingLabelModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  coupon_discount: number;
  status: string;
  delivery_status: string;
  user_id: string;
  delivery_info?: string | null;
  payment_method?: string | null;
  shipping_address: any;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

const fetchOrders = async (): Promise<Order[]> => {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, created_at, total_price, shipping_cost, coupon_discount, status, delivery_status, user_id, shipping_address, delivery_info, payment_method")
    .order("created_at", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);
  if (!orders) return [];

  const userIds = [...new Set(orders.map(o => o.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone")
    .in("id", userIds);

  if (profilesError) throw new Error(profilesError.message);
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  return orders.map(order => ({
    ...order,
    profiles: profilesMap.get(order.user_id) || null,
  })) as Order[];
};

// Função para verificar se o pedido caiu na próxima rota
const checkIsNextRoute = (dateString: string) => {
  const orderDate = new Date(dateString);
  const day = orderDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  // Cria data de corte baseada no dia do pedido
  const cutoff = new Date(orderDate);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  if (day === 0) {
    // Domingo: Tudo vai para próxima rota (Segunda)
    return true;
  } else if (day === 6) {
    // Sábado: Corte às 12:30
    cutoff.setHours(12, 30, 0);
  } else {
    // Segunda a Sexta: Corte às 14:00
    cutoff.setHours(14, 0, 0);
  }

  // Se o pedido foi feito DEPOIS do corte, é próxima rota
  return orderDate > cutoff;
};

const OrdersPage = () => {
  const queryClient = useQueryClient();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [readyToShipOnly, setReadyToShipOnly] = useState(false);
  
  // Estado para seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["ordersAdmin"],
    queryFn: fetchOrders,
    refetchInterval: 30000, 
  });

  const filteredOrders = useMemo(() => {
    return orders?.filter(order => {
      if (readyToShipOnly) {
          const isPaid = order.status === "Finalizada" || order.status === "Pago";
          const isPendingDelivery = order.delivery_status === "Pendente";
          return isPaid && isPendingDelivery;
      }
      return true;
    }) || [];
  }, [orders, readyToShipOnly]);

  const validatePaymentMutation = useMutation({
    mutationFn: async (orderId: number) => {
        const { error } = await supabase.rpc('finalize_order_payment', { p_order_id: orderId });
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
    },
  });

  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, info }: { orderId: number, status: string, info: string }) => {
        const { error } = await supabase
            .from('orders')
            .update({ delivery_status: status, delivery_info: info })
            .eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Venda removida!");
    },
    onError: (err: any) => showError(`Erro ao deletar: ${err.message}`),
  });

  // Funções de Ação em Massa
  const handleBulkValidate = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;
    
    for (const id of Array.from(selectedIds)) {
        const order = orders?.find(o => o.id === id);
        // Só tenta validar se for Pix e não estiver pago
        if (order && order.payment_method?.toLowerCase().includes('pix') && order.status !== "Finalizada" && order.status !== "Pago") {
            try {
                await validatePaymentMutation.mutateAsync(id);
                successCount++;
            } catch (e) {}
        }
    }
    
    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pagamentos validados com sucesso!`);
    else showError("Nenhum pedido apto para validação foi processado.");
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getPaymentMethodDetails = (method: string | null | undefined) => {
    if (!method) return { label: 'Pix', icon: QrCode, style: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    
    const lower = method.toLowerCase();
    if (lower.includes('pix')) {
      return { label: 'Pix', icon: QrCode, style: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    }
    if (lower.includes('credit') || lower.includes('card') || lower.includes('cart')) {
      return { label: 'Cartão (MP)', icon: CreditCard, style: "bg-purple-50 text-purple-700 border-purple-200" };
    }
    return { label: method, icon: DollarSign, style: "bg-gray-50 text-gray-700 border-gray-200" };
  };

  return (
    <div className="relative pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            Vendas (Clientes)
          </h1>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className={cn("h-8 w-8", isRefetching && "animate-spin")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
          <Button 
            variant={readyToShipOnly ? "default" : "outline"} 
            size="sm" 
            className={cn("h-8 gap-2", readyToShipOnly && "bg-blue-600")}
            onClick={() => {
                setReadyToShipOnly(!readyToShipOnly);
                setSelectedIds(new Set()); // Limpa seleção ao trocar filtro
            }}
          >
            <Package className="w-4 h-4" /> Somente Prontos para Envio
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Pedido ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Origem Pagto</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : filteredOrders.map((order) => {
                const isPaid = order.status === "Finalizada" || order.status === "Pago";
                const isPix = order.payment_method?.toLowerCase().includes('pix');
                const needsValidation = isPix && !isPaid;
                const isInRoute = order.delivery_status === "Despachado";
                const isSelected = selectedIds.has(order.id);
                const isNextRoute = checkIsNextRoute(order.created_at);
                const paymentDetails = getPaymentMethodDetails(order.payment_method);
                const PaymentIcon = paymentDetails.icon;
                
                // CÁLCULO CORRIGIDO: Soma o frete ao total do banco
                const finalTotal = order.total_price + (order.shipping_cost || 0);

                return (
                  <TableRow key={order.id} className={cn(
                    // Prioridade de cores: Selecionado > Validação > Próxima Rota > Padrão
                    isSelected ? "bg-primary/5 border-l-4 border-l-primary" : 
                    needsValidation ? "bg-orange-50/40" : 
                    (isNextRoute && order.delivery_status === 'Pendente') ? "bg-yellow-50/60 border-l-4 border-l-yellow-400" : ""
                  )}>
                    <TableCell className="text-center">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOne(order.id)}
                        />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold">#{order.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
                        
                        {isNextRoute && order.delivery_status === 'Pendente' && (
                          <Badge variant="outline" className="mt-1 w-fit text-[9px] bg-yellow-100 text-yellow-800 border-yellow-300 gap-1 px-1">
                            <CalendarClock className="w-3 h-3" /> Próx. Dia
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{order.profiles?.first_name} {order.profiles?.last_name}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(finalTotal)}</TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1">
                            {needsValidation ? (
                                <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-[10px] gap-1">
                                    <AlertCircle className="w-3 h-3" /> Conferir Whats
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className={cn("text-[10px]", isPaid && "bg-green-100 text-green-800")}>
                                    {order.status}
                                </Badge>
                            )}
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary" className={cn(
                            order.delivery_status === 'Entregue' && "bg-green-100 text-green-800",
                            order.delivery_status === 'Despachado' && "bg-blue-100 text-blue-800 animate-pulse"
                        )}>
                            {order.delivery_status}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn("gap-1 pr-3", paymentDetails.style)}>
                            <PaymentIcon className="w-3 h-3" />
                            {paymentDetails.label}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {needsValidation && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700 font-bold h-8 px-3 text-xs"
                                            onClick={() => validatePaymentMutation.mutate(order.id)}
                                            disabled={validatePaymentMutation.isPending}
                                        >
                                            {validatePaymentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                            Validar
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Confirmar recebimento do Pix</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {isInRoute && (
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100 font-bold h-8 px-3 text-xs"
                                            onClick={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: 'Entregue', info: 'Confirmado pelo painel' })}
                                            disabled={updateDeliveryStatusMutation.isPending}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Entregue
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marcar pedido como entregue</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}><Eye className="h-4 w-4 text-primary" /></Button>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações do Pedido</DropdownMenuLabel>
                                {needsValidation && (
                                    <DropdownMenuItem onSelect={() => validatePaymentMutation.mutate(order.id)} className="text-green-600 font-bold">
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Validar Pagamento
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsLabelModalOpen(true); }} disabled={!isPaid}>
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir Etiqueta
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: 'Despachado', info: 'Despachado manualmente' })} disabled={!isPaid || isInRoute || order.delivery_status === 'Entregue'}>
                                    <Truck className="w-4 h-4 mr-2" /> Marcar como Despachado
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: 'Entregue', info: 'Entregue manualmente' })} disabled={order.delivery_status === 'Entregue'}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como Entregue
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsDeleteAlertOpen(true); }} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir Pedido
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
            })}
          </TableBody>
        </Table>
      </div>

      {/* BARRA DE AÇÕES EM MASSA (FIXA NO RODAPÉ) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
            <div className="bg-primary text-white shadow-2xl rounded-2xl p-4 flex items-center gap-6 border-4 border-white">
                <div className="flex items-center gap-3 pr-6 border-r border-white/20">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <CheckboxIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-lg font-black leading-none">{selectedIds.size}</p>
                        <p className="text-[10px] uppercase font-bold opacity-70">Selecionados</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button 
                        onClick={handleBulkValidate} 
                        disabled={isProcessingBulk}
                        className="bg-green-600 hover:bg-green-700 font-black h-12 px-6 rounded-xl shadow-lg"
                    >
                        {isProcessingBulk ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                        Validar Pagamentos
                    </Button>
                    
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setSelectedIds(new Set())}
                        className="h-12 w-12 hover:bg-white/10 text-white rounded-xl"
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>
            </div>
        </div>
      )}

      {selectedOrder && <OrderDetailModal order={selectedOrder} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
      {selectedOrder && <ShippingLabelModal order={selectedOrder} isOpen={isLabelModalOpen} onClose={() => { setIsLabelModalOpen(false); setSelectedOrder(null); }} />}

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Venda?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível e removerá o histórico deste pedido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedOrder && deleteOrderMutation.mutate(selectedOrder.id)} className="bg-red-600">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;