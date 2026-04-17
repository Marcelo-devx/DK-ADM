"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, DollarSign, Eye, Trash2, Package, Printer, RefreshCw, CheckCircle2, AlertCircle, Loader2, Truck, SquareCheck as CheckboxIcon, X, Clock, CalendarClock, QrCode, CreditCard, MessageCircle, Send, History, FileDown, Calendar, FilterX, ShieldCheck, ShieldX, CheckSquare, Plus, Search, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/utils/toast";
import { OrderDetailModal } from "@/components/dashboard/OrderDetailModal";
import { ShippingLabelModal } from "@/components/dashboard/ShippingLabelModal";
import { ClientDetailsModal } from "@/components/dashboard/ClientDetailsModal";
import { CreateOrderModal } from "@/components/dashboard/CreateOrderModal";
import { OrderEditModal } from "@/components/dashboard/OrderEditModal";
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
import { Card } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";

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
    email: string | null;
    phone: string | null;
    cpf_cnpj: string | null;
  } | null;
  order_items: any[];
}

const fetchOrders = async (): Promise<Order[]> => {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, created_at, total_price, shipping_cost, coupon_discount, donation_amount, status, delivery_status, user_id, delivery_info, payment_method, shipping_address, order_items(item_id, item_type, name_at_purchase, quantity, price_at_purchase)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (ordersError) throw new Error(ordersError.message);
  if (!orders) return [];

  const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, cpf_cnpj")
      .in("id", userIds);

    if (profilesError) throw new Error(profilesError.message);
    profiles = profilesData || [];
  }

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
    const cleanPhone = phone.replace(/\D/g, "");
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

const OrdersPage = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isGerenteGeral } = useUser();
  const canUseWhatsApp = isAdmin || isGerenteGeral;
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  
  // States para Histórico do Cliente
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<any>(null);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [readyToShipOnly, setReadyToShipOnly] = useState(false);
  
  // Estado para busca unificada
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  
  // Estados para busca por campos específicos
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchCPF, setSearchCPF] = useState("");
  const [searchClientName, setSearchClientName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  
  // Estados de debounce para cada campo
  const [debouncedOrderId, setDebouncedOrderId] = useState("");
  const [debouncedCPF, setDebouncedCPF] = useState("");
  const [debouncedClientName, setDebouncedClientName] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  
  // Filtros de Data
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Filtros de Status (NOVOS)
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent' | 'cancel_fraud';
    client: any;
  } | null>(null);

  const { data: orders, isLoading, refetch, isRefetching, error } = useQuery<Order[], Error>( {
    queryKey: ["ordersAdmin"],
    queryFn: fetchOrders,
    refetchInterval: 30000,
    onError: (err: any) => {
      console.error("[ordersAdmin] Erro ao buscar pedidos:", err);
      showError(err?.message || "Erro ao carregar pedidos");
    }
  } as UseQueryOptions<Order[], Error>);

  useEffect(() => {
    if (error) {
      console.error("[ordersAdmin] Erro na tela de pedidos:", error);
    }
  }, [error]);

  // Debounce para busca
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 500); // 500ms de delay

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Debounces para campos de busca específicos
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedOrderId(searchOrderId.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchOrderId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedCPF(searchCPF.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchCPF]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedClientName(searchClientName.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchClientName]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedEmail(searchEmail.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchEmail]);

  // ADDING REALTIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel('orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('[Realtime] Pedido atualizado:', payload);
          // Invalida a query para refrescar a lista
          queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]); // Recria se o queryClient mudar

  const filteredOrders = useMemo(() => {
    return orders?.filter(order => {
      // Filtro de "Prontos para Envio"
      if (readyToShipOnly) {
          const isPaid = order.status === "Finalizada" || order.status === "Pago";
          const isPendingDelivery = order.delivery_status === "Pendente" || order.delivery_status === "Aguardando Coleta";
          if (!(isPaid && isPendingDelivery)) return false;
      }

      // Filtro de Status do Pedido
      if (statusFilter && statusFilter !== "all") {
          if (order.status !== statusFilter) return false;
      }

      // Filtro de Status de Entrega
      if (deliveryStatusFilter && deliveryStatusFilter !== "all") {
          if (order.delivery_status !== deliveryStatusFilter) return false;
      }

      // Filtro de Data — converte para horário de Brasília (America/Sao_Paulo) antes de comparar
      if (startDate || endDate) {
        const orderDateBR = new Date(order.created_at).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        // Converte de DD/MM/YYYY para YYYY-MM-DD para comparação
        const [d, m, y] = orderDateBR.split("/");
        const orderDateStr = `${y}-${m}-${d}`;

        if (startDate && orderDateStr < startDate) return false;
        if (endDate && orderDateStr > endDate) return false;
      }

      // Filtro por ID do Pedido (busca exata)
      if (debouncedOrderId) {
        if (order.id.toString() !== debouncedOrderId) return false;
      }

      // Filtro por CPF (busca parcial, remove formatação)
      if (debouncedCPF) {
        if (!order.profiles?.cpf_cnpj) return false;
        const cleanCPF = order.profiles.cpf_cnpj.replace(/\D/g, "");
        const cleanSearch = debouncedCPF.replace(/\D/g, "");
        if (!cleanCPF.includes(cleanSearch)) return false;
      }

      // Filtro por Nome do Cliente (busca parcial, case-insensitive)
      if (debouncedClientName) {
        if (!order.profiles?.first_name && !order.profiles?.last_name) return false;
        const searchTerm = debouncedClientName.toLowerCase();
        const firstName = (order.profiles.first_name || "").toLowerCase();
        const lastName = (order.profiles.last_name || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        if (!firstName.includes(searchTerm) && !lastName.includes(searchTerm) && !fullName.includes(searchTerm)) {
          return false;
        }
      }

      // Filtro por Email do Cliente (busca parcial, case-insensitive)
      if (debouncedEmail) {
        if (!order.profiles?.email) return false;
        const emailLower = order.profiles.email.toLowerCase();
        const searchTerm = debouncedEmail.toLowerCase();
        if (!emailLower.includes(searchTerm)) return false;
      }

      return true;
    }) || [];
  }, [orders, readyToShipOnly, startDate, endDate, debouncedOrderId, debouncedCPF, debouncedClientName, debouncedEmail, statusFilter, deliveryStatusFilter]);

  const validatePaymentAndSetPendingMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "Pago", delivery_status: "Aguardando Coleta" })
        .eq("id", orderId)
        .in("status", ["Pendente", "Aguardando Pagamento", "Aguardando Validação"]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      showSuccess("Pedido marcado como pago e envio liberado para coleta!");
    },
    onError: (err: any) => showError(err.message),
  });

  const cancelOrderForFraudMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('admin-cancel-order', {
        body: { orderId, reason: "Cancelado por suspeita de fraude.", returnStock: true },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      showSuccess("Pedido cancelado com sucesso.");
      setActionToConfirm(null);
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

  const finalizeOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'Finalizada', delivery_status: 'Entregue', delivery_info: 'Finalizado em massa pelo painel' })
            .eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
    },
  });

  useEffect(() => {
    if (!orders) return;

    const ordersToSync = orders.filter(
      (order) => (order.status === 'Pago' || order.status === 'Finalizada') && order.delivery_status === 'Pendente'
    );

    if (ordersToSync.length === 0) return;

    // Faz uma única atualização em lote em vez de uma mutation por pedido
    const ids = ordersToSync.map((o) => o.id);
    supabase
      .from('orders')
      .update({ delivery_status: 'Aguardando Coleta' })
      .in('id', ids)
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

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
        const isEligible = order && ["Pendente", "Aguardando Pagamento", "Aguardando Validação"].includes(order.status);
        if (isEligible) {
            try {
                await validatePaymentAndSetPendingMutation.mutateAsync(id);
                successCount++;
            } catch (e) {}
        }
    }
    
    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pagamentos validados com sucesso!`);
    else showError("Nenhum pedido elegível para marcação manual como pago foi processado.");
  };

  const handleBulkPackaged = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;
    
    for (const id of Array.from(selectedIds)) {
        const order = orders?.find(o => o.id === id);
        const isPaid = order && (order.status === "Finalizada" || order.status === "Pago");
        if (isPaid && order.delivery_status !== 'Despachado' && order.delivery_status !== 'Entregue' && order.delivery_status !== 'Cancelado') {
            try {
                await updateDeliveryStatusMutation.mutateAsync({ orderId: id, status: 'Embalado', info: '' });
                successCount++;
            } catch (e) {}
        }
    }
    
    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pedidos marcados como embalados!`);
    else showError("Nenhum pedido apto para ser marcado como embalado.");
  };

  const handleBulkDelivered = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;

    for (const id of Array.from(selectedIds)) {
        const order = orders?.find(o => o.id === id);
        const isEligible = order && (order.status === 'Pago' || order.status === 'Finalizada') && order.delivery_status !== 'Entregue' && order.delivery_status !== 'Cancelado';
        if (isEligible) {
            try {
                await finalizeOrderMutation.mutateAsync(id);
                successCount++;
            } catch (e) {}
        }
    }

    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pedidos finalizados como entregues!`);
    else showError("Nenhum pedido apto para ser finalizado (já finalizados ou cancelados).");
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
        // compute breakdown exactly like UI (items + shipping + donation - coupon)
        const itemsSubtotalRawEx = (order.order_items || []).reduce((acc: number, it: any) => acc + (Number(it.price_at_purchase) || 0) * (Number(it.quantity) || 0), 0);
        const shippingEx = Number(order.shipping_cost) || 0;
        const donationEx = Number(order.donation_amount) || 0;
        const couponEx = Number(order.coupon_discount) || 0;
        const authoritativeTotalEx = itemsSubtotalRawEx + shippingEx + donationEx - couponEx;

        order.order_items.forEach((item: any) => {
            const unitCost = (item.item_type === 'product' && item.item_id) ? (costsMap.get(item.item_id) || 0) : 0;
            const totalCost = unitCost * item.quantity;
            const totalSale = (Number(item.price_at_purchase) || 0) * item.quantity;
            const profit = totalSale - totalCost;

            rows.push({
                "Número do Pedido": order.id,
                "Cliente": `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim(),
                "Data": new Date(order.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                "Produto": item.name_at_purchase,
                "Quantidade": item.quantity,
                "Custo Unitário": unitCost,
                "Valor Total Venda": totalSale,
                "Valor Total Custo": totalCost,
                "Lucro": profit,
                "Forma de Pagamento": order.payment_method || "Pix",
                "Frete": shippingEx,
                "Doação": donationEx,
                "Total Pedido": authoritativeTotalEx
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
  const filteredOrdersCount = filteredOrders.length;

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

  if (isLoading) {
    return (
      <div className="relative pb-24">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            Vendas
          </h1>
        </div>
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-24">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            Vendas
          </h1>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className={cn("h-8 w-8", isRefetching && "animate-spin")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Card className="px-4 py-3 bg-white shadow-sm border flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Pedidos</span>
          <span className="text-2xl font-bold text-slate-900">{filteredOrdersCount}</span>
        </Card>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4 space-y-3">
        {/* Row 1: Search fields */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ID do Pedido */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden w-28">
            <span className="absolute left-3 text-xs text-gray-400 font-medium">#</span>
            <input
              type="text"
              placeholder="ID"
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value.replace(/\D/g, ""))}
              className="pl-6 pr-3 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0 font-mono"
            />
            {searchOrderId && (
              <button
                onClick={() => setSearchOrderId("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* CPF */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden w-36">
            <input
              type="text"
              placeholder="CPF"
              value={searchCPF}
              onChange={(e) => setSearchCPF(e.target.value.replace(/\D/g, ""))}
              className="pl-3 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0"
            />
            {searchCPF && (
              <button
                onClick={() => setSearchCPF("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Nome do Cliente */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Nome do cliente"
              value={searchClientName}
              onChange={(e) => setSearchClientName(e.target.value)}
              className="pl-3 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0"
            />
            {searchClientName && (
              <button
                onClick={() => setSearchClientName("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Email */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Email do cliente"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-10 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0"
            />
            {searchEmail && (
              <button
                onClick={() => setSearchEmail("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date + Status filters + Clear */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtros de Data */}
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 w-36 text-xs"
          />
          <span className="text-muted-foreground text-xs">a</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 w-36 text-xs"
          />

          {/* Status do Pedido */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Status Pedido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Aguardando Pagamento">Aguardando Pagamento</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Em preparo">Em preparo</SelectItem>
              <SelectItem value="Finalizada">Finalizada</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {/* Status de Entrega */}
          <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
            <SelectTrigger className="h-9 w-48 text-xs">
              <SelectValue placeholder="Status Entrega" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Aguardando Coleta">Aguardando Coleta</SelectItem>
              <SelectItem value="Aguardando Validação">Aguardando Validação</SelectItem>
              <SelectItem value="Embalado">Embalado</SelectItem>
              <SelectItem value="Despachado">Despachado</SelectItem>
              <SelectItem value="Entregue">Entregue</SelectItem>
            </SelectContent>
          </Select>

          {(startDate || endDate || statusFilter !== "all" || deliveryStatusFilter !== "all" || searchOrderId || searchCPF || searchClientName || searchEmail) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setStatusFilter("all");
                setDeliveryStatusFilter("all");
                setSearchOrderId("");
                setSearchCPF("");
                setSearchClientName("");
                setSearchEmail("");
              }}
            >
              <FilterX className="w-3 h-3 mr-1" />
              Limpar filtros
            </Button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action Buttons */}
          <Button
            onClick={() => setIsCreateOrderOpen(true)}
            className="bg-green-600 hover:bg-green-700 font-bold h-9 px-4 gap-2"
          >
            <Plus className="w-4 h-4" />
            Criar Pedido Manual
          </Button>

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

      {/* Active Filter Chips */}
      {(searchOrderId || searchCPF || searchClientName || searchEmail || startDate || endDate || statusFilter !== "all" || deliveryStatusFilter !== "all" || readyToShipOnly) && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
          <span className="text-xs text-muted-foreground font-medium">Filtros ativos:</span>

          {searchOrderId && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              # ID: {searchOrderId}
              <button onClick={() => setSearchOrderId("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {searchCPF && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              CPF: {searchCPF}
              <button onClick={() => setSearchCPF("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {searchClientName && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              Nome: {searchClientName}
              <button onClick={() => setSearchClientName("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {searchEmail && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              Email: {searchEmail}
              <button onClick={() => setSearchEmail("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {startDate && (
            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              De: {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")}
              <button onClick={() => setStartDate("")} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {endDate && (
            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              Até: {new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")}
              <button onClick={() => setEndDate("")} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {statusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              Status: {statusFilter}
              <button onClick={() => setStatusFilter("all")} className="hover:text-green-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {deliveryStatusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              Entrega: {deliveryStatusFilter}
              <button onClick={() => setDeliveryStatusFilter("all")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {readyToShipOnly && (
            <span className="inline-flex items-center gap-1 bg-blue-600 text-white rounded-full px-2.5 py-0.5 text-xs font-medium">
              Prontos p/ Envio
              <button onClick={() => setReadyToShipOnly(false)} className="hover:opacity-80 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}

          <button
            onClick={() => {
              setSearchOrderId(""); setSearchCPF(""); setSearchClientName(""); setSearchEmail("");
              setStartDate(""); setEndDate(""); setStatusFilter("all"); setDeliveryStatusFilter("all");
              setReadyToShipOnly(false);
            }}
            className="text-xs text-red-500 hover:text-red-700 underline ml-1"
          >
            Limpar tudo
          </button>
        </div>
      )}

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
                    const needsManualValidation = order.status === 'Pago' && order.delivery_status === 'Aguardando Validação'; // Mantém para pedidos antigos
                    const isInRoute = order.delivery_status === "Despachado";
                    const isSelected = selectedIds.has(order.id);
                    const isNextRoute = checkIsNextRoute(order.created_at);
                    const paymentDetails = getPaymentMethodDetails(order.payment_method);
                    const PaymentIcon = paymentDetails.icon;
                    
                    // Compute final total as: items subtotal + shipping + donation - coupon (explicit composition)
                    // Fallback to total_price from DB when order_items is empty (e.g. logista RLS timing)
                    const itemsSubtotalRaw = (order.order_items || []).reduce((acc: number, it: any) => acc + (Number(it.price_at_purchase) || 0) * (Number(it.quantity) || 0), 0);
                    const shipping = Number(order.shipping_cost) || 0;
                    const donation = Number(order.donation_amount) || 0;
                    const coupon = Number(order.coupon_discount) || 0;

                    const finalTotal = (order.order_items && order.order_items.length > 0)
                      ? itemsSubtotalRaw + shipping + donation - coupon
                      : Number(order.total_price) || 0;
                    
                    const phone = order.profiles?.phone;
                    const name = order.profiles?.first_name || "Cliente";

                    // Lógica de badge de status atualizada
                    let statusBadge;
                    if (order.status === 'Pago' && (order.delivery_status === 'Aguardando Coleta' || order.delivery_status === 'Pendente')) {
                        statusBadge = (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Pago
                            </Badge>
                        );
                    } else if (needsManualValidation) {
                        statusBadge = (
                            <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 gap-1">
                                <ShieldCheck className="w-3 h-3" /> Aguardando Validação
                            </Badge>
                        );
                    } else {
                        statusBadge = (
                            <Badge variant="secondary" className={cn("text-[10px] w-fit", isPaid && "bg-green-100 text-green-800")}>
                                {order.status}
                            </Badge>
                        );
                    }

                    // Lógica de badge de entrega
                    let deliveryBadge;
                    const deliveryStatusLabel =
                        order.status === 'Cancelado'
                            ? 'Cancelado'
                            : isPaid && order.delivery_status === 'Pendente'
                                ? 'Aguardando Coleta'
                                : order.delivery_status;

                    if (needsManualValidation) {
                        deliveryBadge = <Badge variant="outline" className="text-gray-400 border-gray-200">Bloqueado</Badge>;
                    } else {
                        deliveryBadge = (
                            <Badge variant="secondary" className={cn(
                                "w-fit",
                                deliveryStatusLabel === 'Cancelado' && "bg-red-100 text-red-800",
                                deliveryStatusLabel === 'Entregue' && "bg-green-100 text-green-800",
                                deliveryStatusLabel === 'Despachado' && "bg-blue-100 text-blue-800 animate-pulse",
                                deliveryStatusLabel === 'Embalado' && "bg-amber-100 text-amber-800",
                                deliveryStatusLabel === 'Aguardando Coleta' && "bg-sky-100 text-sky-800"
                            )}>
                                {deliveryStatusLabel}
                            </Badge>
                        );
                    }

                    return (
                    <TableRow key={order.id} className={cn(
                        isSelected ? "bg-primary/5 border-l-4 border-l-primary" : 
                        order.status === 'Cancelado' ? "bg-red-50/60 border-l-4 border-l-red-400" :
                        needsManualValidation ? "bg-orange-50/40" : 
                        (isNextRoute && order.delivery_status === 'Pendente') ? "bg-yellow-50/60 border-l-4 border-l-yellow-400" : ""
                    )}>
                        <TableCell className="text-center">
                            <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectOne(order.id)}
                            />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-bold">
                         <div className="flex items-center gap-1.5">
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
                                       email: order.profiles?.email || "",
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
                           #{order.id}
                         </div>
                       </TableCell>
                        <TableCell>
                        <div className="flex flex-col">
                            <span className="text-xs">{new Date(order.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', timeZone: "America/Sao_Paulo" })}</span>
                            
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
                                {phone && canUseWhatsApp && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <a 
                                                    href={getWhatsAppLink(phone, `Olá ${name}, falando sobre o pedido #${order.id}...`)} 
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
                                                        email: order.profiles?.email || "", // Será carregado pelo modal
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
                          {statusBadge}
                        </TableCell>
                        <TableCell>
                            {deliveryBadge}
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
                                            {phone && canUseWhatsApp && (
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
                                            <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: 'Embalado', info: 'Marcado como embalado manualmente' })}>
                                                <Package className="w-4 h-4 mr-2" /> Marcar como Embalado
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: 'Despachado', info: 'Despachado manualmente' })}>
                                                <Truck className="w-4 h-4 mr-2" /> Marcar como Despachado
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: 'Entregue', info: 'Entregue manualmente' })}>
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
                        Marcar como Pago
                    </Button>
                    
                    <Button 
                        onClick={handleBulkPackaged} 
                        disabled={isProcessingBulk}
                        className="bg-amber-500 hover:bg-amber-600 font-black h-12 px-6 rounded-xl shadow-lg"
                    >
                        {isProcessingBulk ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Package className="w-5 h-5 mr-2" />}
                        Marcar Embalados
                    </Button>

                    <Button 
                        onClick={handleBulkDelivered} 
                        disabled={isProcessingBulk}
                        className="bg-green-800 hover:bg-green-900 font-black h-12 px-6 rounded-xl shadow-lg"
                    >
                        {isProcessingBulk ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Truck className="w-5 h-5 mr-2" />}
                        Marcar Entregues
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

      {/* Modal de Criação de Pedido Manual */}
      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
      />

      {/* AlertDialog de exclusão de pedido */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido <strong>#{selectedOrder?.id}</strong>? O estoque dos produtos será devolvido automaticamente. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrder && deleteOrderMutation.mutate(selectedOrder.id)}
              disabled={deleteOrderMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteOrderMutation.isPending ? "Excluindo..." : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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