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
import { MoreHorizontal, DollarSign, Eye, Trash2, Package, Printer, RefreshCw, CheckCircle2, AlertCircle, Loader2, Truck, SquareCheck as CheckboxIcon, X, Clock, CalendarClock, QrCode, CreditCard, MessageCircle, Send, History, FileDown, Calendar, FilterX, ShieldCheck, ShieldX, CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/utils/toast";
import { OrderDetailModal } from "@/components/dashboard/OrderDetailModal";
import { ShippingLabelModal } from "@/components/dashboard/ShippingLabelModal";
import { ClientDetailsModal } from "@/components/dashboard/ClientDetailsModal";
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
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  coupon_discount: number;
  donation_amount: number;
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
  order_items: any[];
}

const fetchOrders = async (): Promise<Order[]> => {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*, order_items(item_id, item_type, name_at_purchase, quantity, price_at_purchase)")
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
  const day = orderDate.getDay();

  const cutoff = new Date(orderDate);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  if (day === 0) {
    return true;
  } else if (day === 6) {
    cutoff.setHours(12, 30, 0);
  } else {
    cutoff.setHours(14, 0, 0);
  }

  return orderDate > cutoff;
};

// Helpers de WhatsApp
const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    return phone;
};

const getWhatsAppLink = (phone: string | null, message: string = "") => {
    if (!phone) return "#";
    const cleaned = phone.replace(/\D/g, "");
    const fullNumber = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
};

const OrdersPage = () => {
  const queryClient = useQueryClient();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  // States para Histórico do Cliente
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<any>(null);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [readyToShipOnly, setReadyToShipOnly] = useState(false);
  
  // Filtros de Data
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent' | 'cancel_fraud';
    client: any;
  } | null>(null);

  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["ordersAdmin"],
    queryFn: fetchOrders,
    refetchInterval: 30000, 
  });

  const filteredOrders = useMemo(() => {
    return orders?.filter(order => {
      // Filtro de "Prontos para Envio"
      if (readyToShipOnly) {
          const isPaid = order.status === "Finalizada" || order.status === "Pago";
          const isPendingDelivery = order.delivery_status === "Pendente";
          if (!(isPaid && isPendingDelivery)) return false;
      }

      // Filtro de Data
      if (startDate) {
        const orderDate = new Date(order.created_at);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Início do dia
        if (orderDate < start) return false;
      }

      if (endDate) {
        const orderDate = new Date(order.created_at);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Final do dia
        if (orderDate > end) return false;
      }

      return true;
    }) || [];
  }, [orders, readyToShipOnly, startDate, endDate]);

  const validatePaymentAndSetPendingMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase
        .from("orders")
        .update({ delivery_status: "Pendente" })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      showSuccess("Pagamento validado! Pedido pronto para envio.");
    },
    onError: (err: any) => showError(err.message),
  });

  const cancelOrderForFraudMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "Cancelado", delivery_info: "Cancelado por suspeita de fraude." })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      showSuccess("Pedido cancelado com sucesso.");
      setActionToConfirm(null); // Close the dialog
    },
    onError: (err: any) => showError(err.message),
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

  const userActionMutation = useMutation({
    mutationFn: async ({ action, targetUserId }: { action: string; targetUserId: string }) => {
      let functionName = '';
      let body: any = { targetUserId };

      if (action === 'delete_orders') {
        functionName = 'admin-delete-orders';
      } else if (action === 'mark_as_recurrent') {
        functionName = 'admin-mark-as-recurrent';
      } else {
        functionName = 'admin-user-actions';
        body.action = action;
        body.redirectTo = 'https://dk-l-andpage.vercel.app/login'; 
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });
      
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
            const errorJson = await error.context.json();
            if (errorJson.details) throw new Error(errorJson.details);
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(data.message);
      setActionToConfirm(null);
    },
    onError: (error: Error) => {
      showError(`Erro: ${error.message}`);
    },
  });

  const handleConfirmAction = () => {
    if (actionToConfirm) {
      if (actionToConfirm.action === 'cancel_fraud') {
        cancelOrderForFraudMutation.mutate(actionToConfirm.client.id);
      } else {
        userActionMutation.mutate({
          action: actionToConfirm.action,
          targetUserId: actionToConfirm.client.id,
        });
      }
    }
  };

  const handleBulkValidate = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;
    
    for (const id of Array.from(selectedIds)) {
        const order = orders?.find(o => o.id === id);
        if (order && order.status === 'Pago' && order.delivery_status === 'Aguardando Validação') {
            try {
                await validatePaymentAndSetPendingMutation.mutateAsync(id);
                successCount++;
            } catch (e) {}
        }
    }
    
    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pagamentos validados com sucesso!`);
    else showError("Nenhum pedido apto para validação foi processado.");
  };

  const handleExportExcel = async () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido para exportar.");
      return;
    }

    setIsExporting(true);

    try {
      const ordersToExport = orders?.filter(o => selectedIds.has(o.id)) || [];
      
      // Coletar IDs dos produtos para buscar custo
      const productIds = new Set<number>();
      ordersToExport.forEach(order => {
        order.order_items.forEach((item: any) => {
          if (item.item_type === 'product' && item.item_id) {
            productIds.add(item.item_id);
          }
        });
      });

      // Buscar custo dos produtos
      let costsMap = new Map<number, number>();
      if (productIds.size > 0) {
        const { data: productsData } = await supabase
          .from("products")
          .select("id, cost_price")
          .in("id", Array.from(productIds));
        
        productsData?.forEach((p: any) => {
          costsMap.set(p.id, p.cost_price || 0);
        });
      }

      const rows: any[] = [];

      ordersToExport.forEach(order => {
          order.order_items.forEach((item: any) => {
              const unitCost = (item.item_type === 'product' && item.item_id) ? (costsMap.get(item.item_id) || 0) : 0;
              const totalCost = unitCost * item.quantity;
              const totalSale = item.price_at_purchase * item.quantity;
              const profit = totalSale - totalCost;

              rows.push({
                  "Número do Pedido": order.id,
                  "Cliente": `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim(),
                  "Data": new Date(order.created_at).toLocaleDateString("pt-BR"),
                  "Produto": item.name_at_purchase,
                  "Quantidade": item.quantity,
                  "Custo Unitário": unitCost,
                  "Valor Total Venda": totalSale,
                  "Valor Total Custo": totalCost,
                  "Lucro": profit,
                  "Forma de Pagamento": order.payment_method || "Pix"
              });
          });
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas_Detalhadas");
      XLSX.writeFile(workbook, `Vendas_Exportadas_${new Date().toLocaleDateString("pt-BR").replace(/\//g, '-')}.xlsx`);
      
      showSuccess(`${rows.length} itens exportados!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar o arquivo Excel.");
    } finally {
      setIsExporting(false);
    }
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
            Vendas
          </h1>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className={cn("h-8 w-8", isRefetching && "animate-spin")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border shadow-sm">
          
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden">
            <div className="flex items-center px-3 border-r border-gray-200">
                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                <input 
                    type="date" 
                    className="bg-transparent border-none text-xs text-gray-700 focus:outline-none w-24 font-medium font-sans"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </div>
            <div className="flex items-center px-3 bg-white">
                <span className="text-[10px] uppercase font-bold text-gray-400 mr-2">Até</span>
                <input 
                    type="date" 
                    className="bg-transparent border-none text-xs text-gray-700 focus:outline-none w-24 font-medium font-sans"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </div>
            {(startDate || endDate) && (
                <button 
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="h-full px-2 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors border-l border-gray-200"
                    title="Limpar datas"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
          </div>

          <Button 
            variant={readyToShipOnly ? "default" : "outline"} 
            size="sm" 
            className={cn("h-9 gap-2 text-xs", readyToShipOnly && "bg-blue-600")}
            onClick={() => {
                setReadyToShipOnly(!readyToShipOnly);
                setSelectedIds(new Set()); 
            }}
          >
            <Package className="w-4 h-4" /> Prontos p/ Envio
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
            onClick={handleExportExcel}
            disabled={selectedIds.size === 0 || isExporting}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
            Exportar ({selectedIds.size})
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {/* Container com scroll vertical fixo para a tabela */}
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto relative">
            <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow>
                <TableHead className="w-12 text-center">
                    <Checkbox 
                    checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                    onCheckedChange={toggleSelectAll}
                    />
                </TableHead>
                <TableHead>Pedido ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente & Contato</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ) : filteredOrders.map((order) => {
                    const isPaid = order.status === "Finalizada" || order.status === "Pago";
                    const needsManualValidation = order.status === 'Pago' && order.delivery_status === 'Aguardando Validação';
                    const isInRoute = order.delivery_status === "Despachado";
                    const isSelected = selectedIds.has(order.id);
                    const isNextRoute = checkIsNextRoute(order.created_at);
                    const paymentDetails = getPaymentMethodDetails(order.payment_method);
                    const PaymentIcon = paymentDetails.icon;
                    const finalTotal = order.total_price + (order.shipping_cost || 0);
                    
                    const phone = order.profiles?.phone;
                    const name = order.profiles?.first_name || "Cliente";

                    return (
                    <TableRow key={order.id} className={cn(
                        isSelected ? "bg-primary/5 border-l-4 border-l-primary" : 
                        needsManualValidation ? "bg-orange-50/40" : 
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
                        <TableCell>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900">{order.profiles?.first_name} {order.profiles?.last_name}</span>
                                {phone && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <a 
                                                    href={getWhatsAppLink(phone, `Olá ${name}, sobre seu pedido #${order.id}...`)} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="bg-green-100 p-1 rounded-full text-green-600 hover:bg-green-200 hover:scale-110 transition-all"
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                </a>
                                            </TooltipTrigger>
                                            <TooltipContent>Abrir WhatsApp</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                {/* Botão de Histórico */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-blue-600 hover:bg-blue-50 rounded-full"
                                                onClick={() => {
                                                    setSelectedClientForHistory({
                                                        id: order.user_id,
                                                        first_name: order.profiles?.first_name,
                                                        last_name: order.profiles?.last_name,
                                                        email: "", // Será carregado pelo modal
                                                        created_at: null,
                                                        force_pix_on_next_purchase: false,
                                                        order_count: 0, 
                                                        completed_order_count: 0
                                                    });
                                                    setIsClientHistoryOpen(true);
                                                }}
                                            >
                                                <History className="w-3 h-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Histórico de Pedidos</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">{formatPhone(phone || "")}</span>
                        </div>
                        </TableCell>
                        <TableCell className="font-bold">{formatCurrency(finalTotal)}</TableCell>
                        <TableCell>
                          {needsManualValidation ? (
                              <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Aguardando Validação
                              </Badge>
                          ) : (
                              <Badge variant="secondary" className={cn("text-[10px] w-fit", isPaid && "bg-green-100 text-green-800")}>
                                  {order.status}
                              </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                            {needsManualValidation ? (
                                <Badge variant="outline" className="text-gray-400 border-gray-200">Bloqueado</Badge>
                            ) : (
                                <Badge variant="secondary" className={cn(
                                    "w-fit",
                                    order.delivery_status === 'Entregue' && "bg-green-100 text-green-800",
                                    order.delivery_status === 'Despachado' && "bg-blue-100 text-blue-800 animate-pulse"
                                )}>
                                    {order.delivery_status}
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={cn("gap-1 pr-3 w-fit", paymentDetails.style)}>
                                <PaymentIcon className="w-3 h-3" />
                                {paymentDetails.label}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            {needsManualValidation ? (
                                <>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    size="icon" 
                                                    className="bg-green-600 hover:bg-green-700 h-8 w-8"
                                                    onClick={() => validatePaymentAndSetPendingMutation.mutate(order.id)}
                                                    disabled={validatePaymentAndSetPendingMutation.isPending && validatePaymentAndSetPendingMutation.variables === order.id}
                                                >
                                                    {validatePaymentAndSetPendingMutation.isPending && validatePaymentAndSetPendingMutation.variables === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Validar Comprovante e Liberar para Envio</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    size="icon" 
                                                    variant="destructive" 
                                                    className="h-8 w-8"
                                                    onClick={() => setActionToConfirm({ action: 'cancel_fraud', client: order })}
                                                >
                                                    <ShieldX className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Cancelar Pedido (Suspeita de Fraude)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </>
                            ) : (
                                <>
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
                                            {phone && (
                                                <DropdownMenuItem asChild>
                                                    <a href={getWhatsAppLink(phone, `Olá ${name}, falando sobre o pedido #${order.id}...`)} target="_blank" rel="noreferrer" className="cursor-pointer text-green-600 font-medium">
                                                        <MessageCircle className="w-4 h-4 mr-2" /> Abrir WhatsApp
                                                    </a>
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
                                </>
                            )}
                        </div>
                        </TableCell>
                    </TableRow>
                    );
                })}
            </TableBody>
            </Table>
        </div>
      </div>

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
      
      {/* Modal de Histórico do Cliente */}
      <ClientDetailsModal 
        client={selectedClientForHistory} 
        isOpen={isClientHistoryOpen} 
        onClose={() => setIsClientHistoryOpen(false)} 
      />

      <AlertDialog open={!!actionToConfirm} onOpenChange={() => setActionToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm?.action === 'resend_confirmation'
                ? `Você tem certeza que deseja reenviar o e-mail de confirmação para ${actionToConfirm?.client.email}?`
                : actionToConfirm?.action === 'send_password_reset'
                ? `Você tem certeza que deseja enviar um link de redefinição de senha para ${actionToConfirm?.client.email}?`
                : actionToConfirm?.action === 'mark_as_recurrent'
                ? `Você tem certeza que deseja marcar o cliente ${actionToConfirm?.client.email} como recorrente? Isso removerá a restrição de PIX e permitirá outros métodos de pagamento.`
                : actionToConfirm?.action === 'cancel_fraud'
                ? `Tem certeza que deseja cancelar o pedido #${actionToConfirm?.client.id} por suspeita de fraude? O status será alterado para 'Cancelado'.`
                : `ATENÇÃO: Você está prestes a DELETAR PERMANENTEMENTE TODOS OS PEDIDOS do cliente ${actionToConfirm?.client.email}. Isso redefinirá o status de compra dele para 'Primeira Compra'. Esta ação é irreversível.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={userActionMutation.isPending || cancelOrderForFraudMutation.isPending}
              className={actionToConfirm?.action === 'cancel_fraud' || actionToConfirm?.action === 'delete_orders' ? "bg-red-600" : ""}
            >
              {userActionMutation.isPending || cancelOrderForFraudMutation.isPending ? "Executando..." : "Sim, Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;