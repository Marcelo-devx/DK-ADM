"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, DollarSign, Eye, Trash2, Package, Printer, RefreshCw, CheckCircle2, AlertCircle, Loader2, Truck, SquareCheck as CheckboxIcon, X, Clock, CalendarClock, QrCode, CreditCard, MessageCircle, Send, History, FileDown, Calendar, FilterX, ShieldCheck, ShieldX, CheckSquare, Plus, Search, Pencil, ChevronLeft, ChevronRight, XCircle, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';
import { Card } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { OrderMobileCard } from "@/components/dashboard/OrderMobileCard";

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

interface OrdersResult {
  orders: Order[];
  totalCount: number;
}

interface Filters {
  readyToShipOnly: boolean;
  startDate: string;
  endDate: string;
  orderId: string;
  cpf: string;
  clientName: string;
  email: string;
  statusFilter: string[];
  deliveryStatusFilter: string[];
  paymentMethodFilter: string[];
}

const ORDERS_PER_PAGE = 100;

// Busca server-side: só os pedidos da página atual com filtros aplicados no banco
const fetchOrdersPage = async (page: number, filters: Filters): Promise<OrdersResult> => {
  // 1. Resolve user_ids se filtrar por nome, email ou CPF (requer busca em profiles)
  let filteredUserIds: string[] | null = null;

  const needsProfileFilter = filters.clientName || filters.email || filters.cpf;
  if (needsProfileFilter) {
    // Filtra diretamente no banco com ilike — evita o limite de 1000 registros do Supabase
    let profileQuery = supabase.from("profiles").select("id");

    if (filters.email) {
      profileQuery = profileQuery.ilike("email", `%${filters.email}%`);
    }
    if (filters.clientName) {
      const nameParts = filters.clientName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        // Nome completo: busca primeiro nome no first_name E sobrenome no last_name (e vice-versa)
        const first = nameParts[0];
        const rest = nameParts.slice(1).join(" ");
        profileQuery = profileQuery.or(
          `and(first_name.ilike.%${first}%,last_name.ilike.%${rest}%),and(first_name.ilike.%${rest}%,last_name.ilike.%${first}%),first_name.ilike.%${filters.clientName}%,last_name.ilike.%${filters.clientName}%`
        );
      } else {
        profileQuery = profileQuery.or(
          `first_name.ilike.%${filters.clientName}%,last_name.ilike.%${filters.clientName}%`
        );
      }
    }
    if (filters.cpf) {
      const cleanSearch = filters.cpf.replace(/\D/g, "");
      profileQuery = profileQuery.ilike("cpf_cnpj", `%${cleanSearch}%`);
    }

    const { data: matchedProfiles } = await profileQuery;
    if (!matchedProfiles || matchedProfiles.length === 0) return { orders: [], totalCount: 0 };

    filteredUserIds = matchedProfiles.map((p: any) => p.id);
  }

  // 2. Monta a query base com filtros diretos no banco
  const buildQuery = (forCount = false) => {
    let q = supabase.from("orders").select(
      forCount
        ? "id"
        : "id, created_at, total_price, shipping_cost, coupon_discount, donation_amount, status, delivery_status, user_id, delivery_info, payment_method, shipping_address, order_items(id, item_id, item_type, name_at_purchase, quantity, price_at_purchase, product_variants(ohms, size, color, volume_ml, flavors(name)))",
      forCount ? { count: "exact", head: true } : { count: "exact" }
    );

    if (filters.orderId) {
      q = q.eq("id", parseInt(filters.orderId, 10));
    }

    if (filters.statusFilter.length > 0) {
      q = q.in("status", filters.statusFilter);
    }

    if (filters.deliveryStatusFilter.length > 0) {
      q = q.in("delivery_status", filters.deliveryStatusFilter);
    }

    if (filters.paymentMethodFilter.length > 0) {
      // Pix = null ou contém 'pix'; Cartão = contém 'credit'/'card'/'cart'
      if (filters.paymentMethodFilter.includes("Pix") && !filters.paymentMethodFilter.includes("Cartão")) {
        q = q.or("payment_method.is.null,payment_method.ilike.%pix%");
      } else if (filters.paymentMethodFilter.includes("Cartão") && !filters.paymentMethodFilter.includes("Pix")) {
        q = q.or("payment_method.ilike.%credit%,payment_method.ilike.%card%,payment_method.ilike.%cart%");
      }
      // Se ambos selecionados, não filtra (mostra tudo)
    }

    if (filters.startDate) {
      // Converte data local (YYYY-MM-DD) para início do dia em Brasília → UTC
      q = q.gte("created_at", `${filters.startDate}T03:00:00.000Z`);
    }
    if (filters.endDate) {
      // Fim do dia em Brasília (UTC-3): 23:59:59 BRT = 02:59:59 UTC do dia seguinte
      const endDateObj = new Date(`${filters.endDate}T00:00:00`);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const nextDay = endDateObj.toISOString().split("T")[0];
      q = q.lte("created_at", `${nextDay}T02:59:59.999Z`);
    }

    if (filters.readyToShipOnly) {
      q = q.in("status", ["Finalizada", "Pago"]).in("delivery_status", ["Pendente", "Aguardando Coleta"]);
    }

    if (filteredUserIds !== null) {
      q = q.in("user_id", filteredUserIds);
    }

    return q;
  };

  // 3. Conta total (para paginação)
  const countQuery = buildQuery(true);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  const totalCount = count ?? 0;
  if (totalCount === 0) return { orders: [], totalCount: 0 };

  // 4. Busca a página atual
  const from = (page - 1) * ORDERS_PER_PAGE;
  const to = from + ORDERS_PER_PAGE - 1;

  const dataQuery = buildQuery(false)
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data: orders, error: ordersError } = await dataQuery;
  if (ordersError) throw new Error(ordersError.message);
  if (!orders || orders.length === 0) return { orders: [], totalCount };

  // 5. Busca profiles dos pedidos retornados
  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))];
  let profilesMap = new Map<string, any>();

  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, cpf_cnpj")
      .in("id", userIds);

    if (profilesData) {
      profilesMap = new Map(profilesData.map(p => [p.id, p]));
    }
  }

  const result: Order[] = orders.map((order: any) => ({
    ...order,
    profiles: profilesMap.get(order.user_id) || null,
  }));

  return { orders: result, totalCount };
};

// Função para verificar se o pedido caiu na próxima rota
const checkIsNextRoute = (dateString: string) => {
  const orderDate = new Date(dateString);
  const day = orderDate.getDay();
  const cutoff = new Date(orderDate);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);
  if (day === 0) return true;
  else if (day === 6) cutoff.setHours(12, 30, 0);
  else cutoff.setHours(14, 0, 0);
  return orderDate > cutoff;
};

const formatPhone = (phone: string | null) => {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  return phone;
};

const getWhatsAppLink = (phone: string | null, message: string = "") => {
  if (!phone) return "#";
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length <= 11) cleanPhone = "55" + cleanPhone;
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
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filtros com inputs separados (com debounce)
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchCPF, setSearchCPF] = useState("");
  const [searchClientName, setSearchClientName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string[]>([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([]);
  const [readyToShipOnly, setReadyToShipOnly] = useState(false);

  // Desktop text input local state (only applied on Enter or button click)
  const [desktopOrderId, setDesktopOrderId] = useState("");
  const [desktopCPF, setDesktopCPF] = useState("");
  const [desktopClientName, setDesktopClientName] = useState("");
  const [desktopEmail, setDesktopEmail] = useState("");

  // Filtros debounced (aplicados na query)
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>({
    readyToShipOnly: false,
    startDate: "",
    endDate: "",
    orderId: "",
    cpf: "",
    clientName: "",
    email: "",
    statusFilter: [],
    deliveryStatusFilter: [],
    paymentMethodFilter: [],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [exportByDayOpen, setExportByDayOpen] = useState(false);
  const [exportByDayOpenMobile, setExportByDayOpenMobile] = useState(false);
  const [exportByDayDate, setExportByDayDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent' | 'cancel_fraud';
    client: any;
  } | null>(null);

  // Debounce: aplica filtros após 400ms de inatividade
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        readyToShipOnly,
        startDate,
        endDate,
        orderId: searchOrderId.trim(),
        cpf: searchCPF.trim(),
        clientName: searchClientName.trim(),
        email: searchEmail.trim(),
        statusFilter,
        deliveryStatusFilter,
        paymentMethodFilter,
      });
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [readyToShipOnly, startDate, endDate, searchOrderId, searchCPF, searchClientName, searchEmail, statusFilter, deliveryStatusFilter, paymentMethodFilter]);

  const queryKey = ["ordersAdmin", currentPage, debouncedFilters];

  const { data, isLoading, refetch, isRefetching, error } = useQuery<OrdersResult, Error>({
    queryKey,
    queryFn: () => fetchOrdersPage(currentPage, debouncedFilters),
    refetchInterval: 60000, // Reduzido para 60s (era 30s) — menos pressão no banco
    keepPreviousData: true,
  } as any);

  const orders = data?.orders ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / ORDERS_PER_PAGE);

  // Busca quais pedidos da página atual tiveram itens editados
  const orderIds = orders.map(o => o.id);
  const { data: editedOrderIds } = useQuery<Set<number>>({
    queryKey: ["editedOrderIds", orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return new Set<number>();
      const { data } = await supabase
        .from("order_history")
        .select("order_id")
        .in("order_id", orderIds)
        .eq("change_type", "items_edited");
      return new Set<number>((data || []).map((r: any) => r.order_id));
    },
    enabled: orderIds.length > 0,
    staleTime: 30000,
  });

  useEffect(() => {
    if (error) console.error("[ordersAdmin] Erro na tela de pedidos:", error);
  }, [error]);

  // Realtime: só invalida a página atual (não rebusca tudo)
  useEffect(() => {
    const channel = supabase
      .channel("orders-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Sincronização de delivery_status (só roda uma vez por sessão)
  const hasSyncedDeliveryStatus = useRef(false);
  useEffect(() => {
    if (!orders.length || hasSyncedDeliveryStatus.current) return;
    const toSync = orders.filter(o => (o.status === "Pago" || o.status === "Finalizada") && o.delivery_status === "Pendente");
    if (toSync.length === 0) { hasSyncedDeliveryStatus.current = true; return; }
    hasSyncedDeliveryStatus.current = true;
    supabase.from("orders").update({ delivery_status: "Aguardando Coleta" })
      .in("id", toSync.map(o => o.id))
      .then(({ error }) => { if (!error) queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] }); });
  }, [orders]);

  const toggleStatusFilter = (v: string) => setStatusFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleDeliveryStatusFilter = (v: string) => setDeliveryStatusFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const togglePaymentMethodFilter = (v: string) => setPaymentMethodFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const clearAllFilters = () => {
    setStartDate(""); setEndDate(""); setStatusFilter([]); setDeliveryStatusFilter([]);
    setPaymentMethodFilter([]); setSearchOrderId(""); setSearchCPF("");
    setSearchClientName(""); setSearchEmail(""); setReadyToShipOnly(false);
    setDesktopOrderId(""); setDesktopCPF(""); setDesktopClientName(""); setDesktopEmail("");
  };

  const hasActiveFilters = startDate || endDate || statusFilter.length > 0 || deliveryStatusFilter.length > 0 ||
    paymentMethodFilter.length > 0 || searchOrderId || searchCPF || searchClientName || searchEmail || readyToShipOnly;

  // Local state for mobile filters — only applied when user taps "Ver pedidos"
  const [mobileSearchOrderId, setMobileSearchOrderId] = useState("");
  const [mobileSearchCPF, setMobileSearchCPF] = useState("");
  const [mobileSearchClientName, setMobileSearchClientName] = useState("");
  const [mobileSearchEmail, setMobileSearchEmail] = useState("");
  const [mobileStartDate, setMobileStartDate] = useState("");
  const [mobileEndDate, setMobileEndDate] = useState("");
  const [mobileStatusFilter, setMobileStatusFilter] = useState<string[]>([]);
  const [mobileDeliveryStatusFilter, setMobileDeliveryStatusFilter] = useState<string[]>([]);
  const [mobilePaymentMethodFilter, setMobilePaymentMethodFilter] = useState<string[]>([]);
  const [mobileReadyToShipOnly, setMobileReadyToShipOnly] = useState(false);

  // Sync mobile state when sheet opens
  const handleOpenMobileFilters = (open: boolean) => {
    if (open) {
      setMobileSearchOrderId(searchOrderId);
      setMobileSearchCPF(searchCPF);
      setMobileSearchClientName(searchClientName);
      setMobileSearchEmail(searchEmail);
      setMobileStartDate(startDate);
      setMobileEndDate(endDate);
      setMobileStatusFilter([...statusFilter]);
      setMobileDeliveryStatusFilter([...deliveryStatusFilter]);
      setMobilePaymentMethodFilter([...paymentMethodFilter]);
      setMobileReadyToShipOnly(readyToShipOnly);
    }
    setMobileFiltersOpen(open);
  };

  const applyMobileFilters = () => {
    setSearchOrderId(mobileSearchOrderId);
    setSearchCPF(mobileSearchCPF);
    setSearchClientName(mobileSearchClientName);
    setSearchEmail(mobileSearchEmail);
    setStartDate(mobileStartDate);
    setEndDate(mobileEndDate);
    setStatusFilter(mobileStatusFilter);
    setDeliveryStatusFilter(mobileDeliveryStatusFilter);
    setPaymentMethodFilter(mobilePaymentMethodFilter);
    setReadyToShipOnly(mobileReadyToShipOnly);
    setMobileFiltersOpen(false);
  };

  const clearMobileFilters = () => {
    setMobileSearchOrderId(""); setMobileSearchCPF(""); setMobileSearchClientName("");
    setMobileSearchEmail(""); setMobileStartDate(""); setMobileEndDate("");
    setMobileStatusFilter([]); setMobileDeliveryStatusFilter([]);
    setMobilePaymentMethodFilter([]); setMobileReadyToShipOnly(false);
  };

  const toggleMobileStatusFilter = (v: string) => setMobileStatusFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleMobileDeliveryStatusFilter = (v: string) => setMobileDeliveryStatusFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleMobilePaymentMethodFilter = (v: string) => setMobilePaymentMethodFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasMobileActiveFilters = mobileSearchOrderId || mobileSearchCPF || mobileSearchClientName || mobileSearchEmail ||
    mobileStartDate || mobileEndDate || mobileStatusFilter.length > 0 || mobileDeliveryStatusFilter.length > 0 ||
    mobilePaymentMethodFilter.length > 0 || mobileReadyToShipOnly;

  const mobileFilterCount = [mobileSearchOrderId, mobileSearchCPF, mobileSearchClientName, mobileSearchEmail, mobileStartDate, mobileEndDate, mobileReadyToShipOnly ? "1" : ""].filter(Boolean).length
    + mobileStatusFilter.length + mobileDeliveryStatusFilter.length + mobilePaymentMethodFilter.length;

  // Mutations
  const validatePaymentAndSetPendingMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.from("orders")
        .update({ status: "Pago", delivery_status: "Aguardando Coleta" })
        .eq("id", orderId).in("status", ["Pendente", "Aguardando Pagamento", "Aguardando Validação"]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] }); showSuccess("Pedido marcado como pago!"); },
    onError: (err: any) => showError(err.message),
  });

  const cancelOrderForFraudMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { data: orderData, error: fetchError } = await supabase.from("orders").select("status").eq("id", orderId).single();
      if (fetchError) throw new Error(fetchError.message);
      const { error: updateError } = await supabase.from("orders").update({ status: "Cancelado" }).eq("id", orderId);
      if (updateError) throw new Error(updateError.message);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("order_history").insert({ order_id: orderId, field_name: "status", old_value: orderData?.status ?? "Desconhecido", new_value: "Cancelado", changed_by: user?.id ?? null, change_type: "cancel", reason: "Cancelado por suspeita de fraude." });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] }); showSuccess("Pedido cancelado."); setActionToConfirm(null); },
    onError: (err: any) => showError(err.message),
  });

  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string; info?: string }) => {
      const { error } = await supabase.from("orders").update({ delivery_status: status }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] }),
  });

  const finalizeOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.from("orders").update({ status: "Finalizada", delivery_status: "Entregue" }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] }),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // Limpa FK de user_coupons (NO ACTION) antes de deletar o pedido
      await supabase.from("user_coupons").update({ order_id: null }).eq("order_id", orderId);
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] }); setIsDeleteAlertOpen(false); showSuccess("Venda removida!"); },
    onError: (err: any) => showError(`Erro ao deletar: ${err.message}`),
  });

  const userActionMutation = useMutation({
    mutationFn: async ({ action, targetUserId }: { action: string; targetUserId: string }) => {
      let functionName = "";
      let body: any = { targetUserId };
      if (action === "delete_orders") functionName = "admin-delete-orders";
      else if (action === "mark_as_recurrent") functionName = "admin-mark-as-recurrent";
      else { functionName = "admin-user-actions"; body.action = action; body.redirectTo = "https://dk-l-andpage.vercel.app/login"; }
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["clients"] }); showSuccess(data.message); setActionToConfirm(null); },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  const handleConfirmAction = () => {
    if (!actionToConfirm) return;
    if (actionToConfirm.action === "cancel_fraud") cancelOrderForFraudMutation.mutate(actionToConfirm.client.id);
    else userActionMutation.mutate({ action: actionToConfirm.action, targetUserId: actionToConfirm.client.id });
  };

  const handleBulkValidate = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;
    for (const id of Array.from(selectedIds)) {
      const order = orders.find(o => o.id === id);
      if (order && ["Pendente", "Aguardando Pagamento", "Aguardando Validação"].includes(order.status)) {
        try { await validatePaymentAndSetPendingMutation.mutateAsync(id); successCount++; } catch {}
      }
    }
    setIsProcessingBulk(false); setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pagamentos validados!`);
    else showError("Nenhum pedido elegível.");
  };

  const handleBulkPackaged = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;
    for (const id of Array.from(selectedIds)) {
      const order = orders.find(o => o.id === id);
      if (order && (order.status === "Finalizada" || order.status === "Pago") && !["Despachado", "Entregue", "Cancelado"].includes(order.delivery_status)) {
        try { await updateDeliveryStatusMutation.mutateAsync({ orderId: id, status: "Embalado" }); successCount++; } catch {}
      }
    }
    setIsProcessingBulk(false); setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pedidos marcados como embalados!`);
    else showError("Nenhum pedido apto.");
  };

  const handleBulkDelivered = async () => {
    setIsProcessingBulk(true);
    let successCount = 0;
    for (const id of Array.from(selectedIds)) {
      const order = orders.find(o => o.id === id);
      if (order && (order.status === "Pago" || order.status === "Finalizada") && !["Entregue", "Cancelado"].includes(order.delivery_status)) {
        try { await finalizeOrderMutation.mutateAsync(id); successCount++; } catch {}
      }
    }
    setIsProcessingBulk(false); setSelectedIds(new Set());
    if (successCount > 0) showSuccess(`${successCount} pedidos finalizados!`);
    else showError("Nenhum pedido apto.");
  };

  const handleExportExcel = async () => {
    if (selectedIds.size === 0) { showError("Selecione pelo menos um pedido."); return; }
    setIsExporting(true);
    try {
      const ordersToExport = orders.filter(o => selectedIds.has(o.id));
      const productIds = new Set<number>();
      const promotionIds = new Set<number>();
      ordersToExport.forEach(order => order.order_items.forEach((item: any) => {
        if (item.item_type === "product" && item.item_id) productIds.add(item.item_id);
        if (item.item_type === "promotion" && item.item_id) promotionIds.add(item.item_id);
      }));

      let costsMap = new Map<number, number>();
      if (productIds.size > 0) {
        const { data: productsData } = await supabase.from("products").select("id, cost_price").in("id", Array.from(productIds));
        productsData?.forEach((p: any) => costsMap.set(p.id, p.cost_price || 0));
      }

      // Fetch promotion costs: sum of (product cost × quantity) for each promotion item
      let promotionCostsMap = new Map<number, number>();
      if (promotionIds.size > 0) {
        const { data: promoItems } = await supabase
          .from("promotion_items")
          .select("promotion_id, product_id, variant_id, quantity")
          .in("promotion_id", Array.from(promotionIds));

        if (promoItems && promoItems.length > 0) {
          const promoProductIds = [...new Set(promoItems.map((pi: any) => pi.product_id).filter(Boolean))];
          const promoVariantIds = [...new Set(promoItems.map((pi: any) => pi.variant_id).filter(Boolean))];

          let promoProductCosts = new Map<number, number>();
          if (promoProductIds.length > 0) {
            const { data: ppData } = await supabase.from("products").select("id, cost_price").in("id", promoProductIds);
            ppData?.forEach((p: any) => promoProductCosts.set(p.id, p.cost_price || 0));
          }

          let promoVariantCosts = new Map<string, number>();
          if (promoVariantIds.length > 0) {
            const { data: pvData } = await supabase.from("product_variants").select("id, cost_price").in("id", promoVariantIds);
            pvData?.forEach((v: any) => promoVariantCosts.set(v.id, v.cost_price || 0));
          }

          // Group by promotion_id and sum costs
          promoItems.forEach((pi: any) => {
            const unitCost = pi.variant_id
              ? (promoVariantCosts.get(pi.variant_id) || promoProductCosts.get(pi.product_id) || 0)
              : promoProductCosts.get(pi.product_id) || 0;
            const prev = promotionCostsMap.get(pi.promotion_id) || 0;
            promotionCostsMap.set(pi.promotion_id, prev + unitCost * (pi.quantity || 1));
          });
        }
      }

      const rows: any[] = [];
      ordersToExport.forEach(order => {
        const itemsSubtotal = (order.order_items || []).reduce((acc: number, it: any) => acc + (Number(it.price_at_purchase) || 0) * (Number(it.quantity) || 0), 0);
        const shipping = Number(order.shipping_cost) || 0;
        const donation = Number(order.donation_amount) || 0;
        const coupon = Number(order.coupon_discount) || 0;
        const total = itemsSubtotal + shipping + donation - coupon;
        order.order_items.forEach((item: any) => {
          let unitCost = 0;
          if (item.item_type === "product" && item.item_id) {
            unitCost = costsMap.get(item.item_id) || 0;
          } else if (item.item_type === "promotion" && item.item_id) {
            unitCost = promotionCostsMap.get(item.item_id) || 0;
          }
          rows.push({
            "Número do Pedido": order.id,
            "Cliente": `${order.profiles?.first_name || ""} ${order.profiles?.last_name || ""}`.trim(),
            "Data": new Date(order.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            "Produto": item.name_at_purchase,
            "Quantidade": item.quantity,
            "Custo Unitário": unitCost,
            "Valor Total Venda": (Number(item.price_at_purchase) || 0) * item.quantity,
            "Valor Total Custo": unitCost * item.quantity,
            "Lucro": ((Number(item.price_at_purchase) || 0) * item.quantity) - (unitCost * item.quantity),
            "Forma de Pagamento": order.payment_method || "Pix",
            "Frete": shipping,
            "Doação": donation,
            "Total Pedido": total,
          });
        });
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas_Detalhadas");
      XLSX.writeFile(workbook, `Vendas_Exportadas_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`);
      showSuccess(`${rows.length} itens exportados!`);
    } catch (err) {
      console.error(err); showError("Erro ao gerar o arquivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportByDay = async () => {
    if (!exportByDayDate) { showError("Selecione uma data."); return; }
    setIsExporting(true);
    setExportByDayOpen(false);
    setExportByDayOpenMobile(false);
    try {
      // Fetch all orders for the selected day (Brasília timezone UTC-3)
      // Dia selecionado começa às 00:00 BRT = 03:00 UTC
      // Dia selecionado termina às 23:59:59 BRT = 02:59:59 UTC do dia seguinte
      const [year, month, day] = exportByDayDate.split("-").map(Number);
      const startUTC = `${exportByDayDate}T03:00:00.000Z`;
      const nextDayDate = new Date(Date.UTC(year, month - 1, day + 1));
      const nextDay = nextDayDate.toISOString().split("T")[0];
      const endUTC = `${nextDay}T02:59:59.999Z`;

      const { data: dayOrders, error: dayError } = await supabase
        .from("orders")
        .select("id, created_at, total_price, shipping_cost, coupon_discount, donation_amount, status, delivery_status, user_id, delivery_info, payment_method, shipping_address, order_items(item_id, item_type, name_at_purchase, quantity, price_at_purchase)")
        .gte("created_at", startUTC)
        .lte("created_at", endUTC)
        .neq("status", "Cancelado")
        .order("created_at", { ascending: false });

      if (dayError) throw new Error(dayError.message);
      if (!dayOrders || dayOrders.length === 0) { showError("Nenhum pedido encontrado nesta data."); return; }

      // Fetch profiles
      const userIds = [...new Set(dayOrders.map((o: any) => o.user_id).filter(Boolean))];
      let profilesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("id, first_name, last_name, email, phone, cpf_cnpj").in("id", userIds);
        if (profilesData) profilesMap = new Map(profilesData.map(p => [p.id, p]));
      }

      const ordersWithProfiles = dayOrders.map((o: any) => ({ ...o, profiles: profilesMap.get(o.user_id) || null }));

      // Fetch product costs
      const productIds = new Set<number>();
      const promotionIds = new Set<number>();
      ordersWithProfiles.forEach((order: any) => order.order_items.forEach((item: any) => {
        if (item.item_type === "product" && item.item_id) productIds.add(item.item_id);
        if (item.item_type === "promotion" && item.item_id) promotionIds.add(item.item_id);
      }));

      let costsMap = new Map<number, number>();
      if (productIds.size > 0) {
        const { data: productsData } = await supabase.from("products").select("id, cost_price").in("id", Array.from(productIds));
        productsData?.forEach((p: any) => costsMap.set(p.id, p.cost_price || 0));
      }

      // Fetch promotion costs: sum of (product cost × quantity) for each promotion item
      let promotionCostsMap = new Map<number, number>();
      if (promotionIds.size > 0) {
        const { data: promoItems } = await supabase
          .from("promotion_items")
          .select("promotion_id, product_id, variant_id, quantity")
          .in("promotion_id", Array.from(promotionIds));

        if (promoItems && promoItems.length > 0) {
          const promoProductIds = [...new Set(promoItems.map((pi: any) => pi.product_id).filter(Boolean))];
          const promoVariantIds = [...new Set(promoItems.map((pi: any) => pi.variant_id).filter(Boolean))];

          let promoProductCosts = new Map<number, number>();
          if (promoProductIds.length > 0) {
            const { data: ppData } = await supabase.from("products").select("id, cost_price").in("id", promoProductIds);
            ppData?.forEach((p: any) => promoProductCosts.set(p.id, p.cost_price || 0));
          }

          let promoVariantCosts = new Map<string, number>();
          if (promoVariantIds.length > 0) {
            const { data: pvData } = await supabase.from("product_variants").select("id, cost_price").in("id", promoVariantIds);
            pvData?.forEach((v: any) => promoVariantCosts.set(v.id, v.cost_price || 0));
          }

          promoItems.forEach((pi: any) => {
            const unitCost = pi.variant_id
              ? (promoVariantCosts.get(pi.variant_id) || promoProductCosts.get(pi.product_id) || 0)
              : promoProductCosts.get(pi.product_id) || 0;
            const prev = promotionCostsMap.get(pi.promotion_id) || 0;
            promotionCostsMap.set(pi.promotion_id, prev + unitCost * (pi.quantity || 1));
          });
        }
      }

      const rows: any[] = [];
      ordersWithProfiles.forEach((order: any) => {
        const itemsSubtotal = (order.order_items || []).reduce((acc: number, it: any) => acc + (Number(it.price_at_purchase) || 0) * (Number(it.quantity) || 0), 0);
        const shipping = Number(order.shipping_cost) || 0;
        const donation = Number(order.donation_amount) || 0;
        const coupon = Number(order.coupon_discount) || 0;
        const total = itemsSubtotal + shipping + donation - coupon;
        order.order_items.forEach((item: any) => {
          let unitCost = 0;
          if (item.item_type === "product" && item.item_id) {
            unitCost = costsMap.get(item.item_id) || 0;
          } else if (item.item_type === "promotion" && item.item_id) {
            unitCost = promotionCostsMap.get(item.item_id) || 0;
          }
          rows.push({
            "Número do Pedido": order.id,
            "Cliente": `${order.profiles?.first_name || ""} ${order.profiles?.last_name || ""}`.trim(),
            "Data": new Date(order.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            "Produto": item.name_at_purchase,
            "Quantidade": item.quantity,
            "Custo Unitário": unitCost,
            "Valor Total Venda": (Number(item.price_at_purchase) || 0) * item.quantity,
            "Valor Total Custo": unitCost * item.quantity,
            "Lucro": ((Number(item.price_at_purchase) || 0) * item.quantity) - (unitCost * item.quantity),
            "Forma de Pagamento": order.payment_method || "Pix",
            "Frete": shipping,
            "Doação": donation,
            "Total Pedido": total,
          });
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas_Detalhadas");
      const dateLabel = new Date(exportByDayDate + "T00:00:00").toLocaleDateString("pt-BR").replace(/\//g, "-");
      XLSX.writeFile(workbook, `Vendas_${dateLabel}.xlsx`);
      showSuccess(`${ordersWithProfiles.length} pedidos exportados do dia ${dateLabel}!`);
    } catch (err) {
      console.error(err); showError("Erro ao gerar o arquivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map(o => o.id)));
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getPaymentMethodDetails = (method: string | null | undefined) => {
    if (!method) return { label: "Pix", icon: QrCode, style: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    const lower = method.toLowerCase();
    if (lower.includes("pix")) return { label: "Pix", icon: QrCode, style: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    if (lower.includes("credit") || lower.includes("card") || lower.includes("cart")) return { label: "Cartão (MP)", icon: CreditCard, style: "bg-purple-50 text-purple-700 border-purple-200" };
    return { label: method, icon: DollarSign, style: "bg-gray-50 text-gray-700 border-gray-200" };
  };

  const applyDesktopTextFilters = () => {
    setSearchOrderId(desktopOrderId);
    setSearchCPF(desktopCPF);
    setSearchClientName(desktopClientName);
    setSearchEmail(desktopEmail);
  };

  const handleDesktopTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyDesktopTextFilters();
  };

  if (isLoading && !data) {
    return (
      <div className="relative pb-24">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" /> Vendas
          </h1>
        </div>
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" /> Vendas
          </h1>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className={cn("h-8 w-8", isRefetching && "animate-spin")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Card className="px-4 py-3 bg-white shadow-sm border flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Pedidos</span>
          <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
        </Card>
      </div>

      {/* ── MOBILE: compact action bar + filter sheet ── */}
      <div className="md:hidden flex items-center gap-2 mb-3">
        {/* Botão Prontos p/ Envio — fora do filtro para acesso rápido */}
        <Button
          variant="outline"
          onClick={() => {
            const next = !readyToShipOnly;
            setReadyToShipOnly(next);
            setMobileReadyToShipOnly(next);
          }}
          className={cn(
            "h-10 gap-1.5 font-semibold text-sm px-3 shrink-0",
            readyToShipOnly
              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              : "border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-700"
          )}
        >
          <Package className="w-4 h-4" />
          Envio
        </Button>

        <Sheet open={mobileFiltersOpen} onOpenChange={handleOpenMobileFilters}>
          <SheetTrigger asChild>
            <Button variant="outline" className={cn("flex-1 h-10 gap-2 font-semibold", hasActiveFilters && "border-blue-400 text-blue-700 bg-blue-50")}>
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {[searchOrderId, searchCPF, searchClientName, searchEmail, startDate, endDate, readyToShipOnly ? "1" : ""].filter(Boolean).length
                    + statusFilter.length + deliveryStatusFilter.length + paymentMethodFilter.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5" /> Filtros
                {hasMobileActiveFilters && (
                  <button onClick={clearMobileFilters} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                    <FilterX className="w-3.5 h-3.5" /> Limpar tudo
                  </button>
                )}
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-4">
              {/* ID + CPF */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Pedido ID</label>
                  <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-10 overflow-hidden">
                    <span className="absolute left-3 text-xs text-gray-400 font-medium">#</span>
                    <input type="text" placeholder="ID" value={mobileSearchOrderId}
                      onChange={(e) => setMobileSearchOrderId(e.target.value.replace(/\D/g, ""))}
                      className="pl-6 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0 font-mono" />
                    {mobileSearchOrderId && <button onClick={() => setMobileSearchOrderId("")} className="absolute right-2 text-gray-400"><X className="w-3 h-3" /></button>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">CPF</label>
                  <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-10 overflow-hidden">
                    <input type="text" placeholder="CPF" value={mobileSearchCPF}
                      onChange={(e) => setMobileSearchCPF(e.target.value.replace(/\D/g, ""))}
                      className="pl-3 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0" />
                    {mobileSearchCPF && <button onClick={() => setMobileSearchCPF("")} className="absolute right-2 text-gray-400"><X className="w-3 h-3" /></button>}
                  </div>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome do cliente</label>
                <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-10 overflow-hidden">
                  <input type="text" placeholder="Nome do cliente" value={mobileSearchClientName}
                    onChange={(e) => setMobileSearchClientName(e.target.value)}
                    className="pl-3 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0" />
                  {mobileSearchClientName && <button onClick={() => setMobileSearchClientName("")} className="absolute right-2 text-gray-400"><X className="w-3 h-3" /></button>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-10 overflow-hidden">
                  <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Email do cliente" value={mobileSearchEmail}
                    onChange={(e) => setMobileSearchEmail(e.target.value)}
                    className="pl-10 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0" />
                  {mobileSearchEmail && <button onClick={() => setMobileSearchEmail("")} className="absolute right-2 text-gray-400"><X className="w-3 h-3" /></button>}
                </div>
              </div>

              {/* Datas */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Período</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={mobileStartDate} onChange={(e) => setMobileStartDate(e.target.value)} className="h-10 text-sm" />
                  <Input type="date" value={mobileEndDate} onChange={(e) => setMobileEndDate(e.target.value)} className="h-10 text-sm" />
                </div>
              </div>

              {/* Status Pedido */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Status do Pedido</label>
                <div className="flex flex-wrap gap-2">
                  {["Pendente", "Aguardando Pagamento", "Pago", "Em preparo", "Finalizada", "Cancelado"].map(s => (
                    <button key={s} onClick={() => toggleMobileStatusFilter(s)}
                      className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        mobileStatusFilter.includes(s) ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:border-green-400")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Entrega */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Status de Entrega</label>
                <div className="flex flex-wrap gap-2">
                  {["Pendente", "Aguardando Coleta", "Aguardando Validação", "Embalado", "Despachado", "Entregue"].map(s => (
                    <button key={s} onClick={() => toggleMobileDeliveryStatusFilter(s)}
                      className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        mobileDeliveryStatusFilter.includes(s) ? "bg-sky-600 text-white border-sky-600" : "bg-white text-gray-600 border-gray-200 hover:border-sky-400")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pagamento */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Forma de Pagamento</label>
                <div className="flex gap-2">
                  {[{ value: "Pix", icon: QrCode }, { value: "Cartão", icon: CreditCard }].map(({ value, icon: Icon }) => (
                    <button key={value} onClick={() => toggleMobilePaymentMethodFilter(value)}
                      className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                        mobilePaymentMethodFilter.includes(value) ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-purple-400")}>
                      <Icon className="w-4 h-4" />{value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prontos p/ Envio */}
              <div>
                <button onClick={() => setMobileReadyToShipOnly(!mobileReadyToShipOnly)}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-medium text-sm transition-colors",
                    mobileReadyToShipOnly ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-blue-400")}>
                  <Package className="w-4 h-4" /> Prontos p/ Envio
                </button>
              </div>

              {/* Apply button */}
              <Button className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 mt-2"
                onClick={applyMobileFilters}>
                Ver pedidos
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Button onClick={() => setIsCreateOrderOpen(true)} className="bg-green-600 hover:bg-green-700 font-bold h-10 px-4 gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Criar
        </Button>

        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 text-green-700 border-green-200 hover:bg-green-50"
          onClick={handleExportExcel} disabled={selectedIds.size === 0 || isExporting}>
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        </Button>

        <Popover open={exportByDayOpenMobile} onOpenChange={setExportByDayOpenMobile}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 text-green-700 border-green-200 hover:bg-green-50" disabled={isExporting}>
              <Calendar className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-4"
            align="end"
            onInteractOutside={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
          >
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-green-600" /> Exportar por dia
                </p>
                <p className="text-xs text-muted-foreground">Escolha o dia e exporte todos os pedidos automaticamente.</p>
              </div>
              <input
                type="date"
                value={exportByDayDate}
                onChange={(e) => setExportByDayDate(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => setExportByDayOpenMobile(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm font-bold gap-1"
                  onClick={handleExportByDay}
                  disabled={!exportByDayDate || isExporting}>
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Exportar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile active filter chips */}
      {hasActiveFilters && (
        <div className="md:hidden flex flex-wrap items-center gap-1.5 mb-3">
          {searchOrderId && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs"># {searchOrderId}<button onClick={() => setSearchOrderId("")}><X className="w-3 h-3 ml-0.5" /></button></span>}
          {searchCPF && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs">CPF<button onClick={() => setSearchCPF("")}><X className="w-3 h-3 ml-0.5" /></button></span>}
          {searchClientName && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs">{searchClientName}<button onClick={() => setSearchClientName("")}><X className="w-3 h-3 ml-0.5" /></button></span>}
          {searchEmail && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs">Email<button onClick={() => setSearchEmail("")}><X className="w-3 h-3 ml-0.5" /></button></span>}
          {startDate && <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5 text-xs">De: {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")}<button onClick={() => setStartDate("")}><X className="w-3 h-3 ml-0.5" /></button></span>}
          {endDate && <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5 text-xs">Até: {new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")}<button onClick={() => setEndDate("")}><X className="w-3 h-3 ml-0.5" /></button></span>}
          {statusFilter.map(s => <span key={s} className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs">{s}<button onClick={() => toggleStatusFilter(s)}><X className="w-3 h-3 ml-0.5" /></button></span>)}
          {deliveryStatusFilter.map(s => <span key={s} className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5 text-xs">{s}<button onClick={() => toggleDeliveryStatusFilter(s)}><X className="w-3 h-3 ml-0.5" /></button></span>)}
          {paymentMethodFilter.map(s => <span key={s} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5 text-xs">{s}<button onClick={() => togglePaymentMethodFilter(s)}><X className="w-3 h-3 ml-0.5" /></button></span>)}
          {readyToShipOnly && <span className="inline-flex items-center gap-1 bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">Prontos p/ Envio<button onClick={() => setReadyToShipOnly(false)}><X className="w-3 h-3 ml-0.5" /></button></span>}
        </div>
      )}

      {/* ── DESKTOP: Filter Panel ── */}
      <div className="hidden md:block bg-white rounded-xl border shadow-sm p-4 mb-4 space-y-3">
        {/* Row 1: Search fields */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ID */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden w-28">
            <span className="absolute left-3 text-xs text-gray-400 font-medium">#</span>
            <input type="text" placeholder="ID" value={desktopOrderId}
              onChange={(e) => setDesktopOrderId(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleDesktopTextKeyDown}
              className="pl-6 pr-3 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0 font-mono" />
            {desktopOrderId && <button onClick={() => { setDesktopOrderId(""); setSearchOrderId(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
          </div>

          {/* CPF */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden w-36">
            <input type="text" placeholder="CPF" value={desktopCPF}
              onChange={(e) => setDesktopCPF(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleDesktopTextKeyDown}
              className="pl-3 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0" />
            {desktopCPF && <button onClick={() => { setDesktopCPF(""); setSearchCPF(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
          </div>

          {/* Nome */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden flex-1 min-w-[200px]">
            <input type="text" placeholder="Nome do cliente" value={desktopClientName}
              onChange={(e) => setDesktopClientName(e.target.value)}
              onKeyDown={handleDesktopTextKeyDown}
              className="pl-3 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0" />
            {desktopClientName && <button onClick={() => { setDesktopClientName(""); setSearchClientName(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
          </div>

          {/* Email */}
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 overflow-hidden flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Email do cliente" value={desktopEmail}
              onChange={(e) => setDesktopEmail(e.target.value)}
              onKeyDown={handleDesktopTextKeyDown}
              className="pl-10 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0" />
            {desktopEmail && <button onClick={() => { setDesktopEmail(""); setSearchEmail(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
          </div>

          {/* Filtrar button */}
          <Button
            size="sm"
            className="h-9 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            onClick={applyDesktopTextFilters}
          >
            <Search className="w-3.5 h-3.5" /> Filtrar
          </Button>
        </div>

        {/* Row 2: Date + Status + Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-36 text-xs" />
          <span className="text-muted-foreground text-xs">a</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-36 text-xs" />

          {/* Status Pedido */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("h-9 px-3 text-xs border rounded-md flex items-center gap-2 bg-white hover:bg-gray-50 transition-colors", statusFilter.length > 0 ? "border-green-400 text-green-700 bg-green-50" : "border-gray-200 text-gray-600")}>
                <span>{statusFilter.length === 0 ? "Status Pedido" : statusFilter.length === 1 ? statusFilter[0] : `${statusFilter.length} status`}</span>
                {statusFilter.length > 0 && <span className="bg-green-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{statusFilter.length}</span>}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <div className="space-y-1">
                {["Pendente", "Aguardando Pagamento", "Pago", "Em preparo", "Finalizada", "Cancelado"].map(s => (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <Checkbox checked={statusFilter.includes(s)} onCheckedChange={() => toggleStatusFilter(s)} />{s}
                  </label>
                ))}
                {statusFilter.length > 0 && <button onClick={() => setStatusFilter([])} className="w-full text-xs text-red-500 hover:text-red-700 pt-1 border-t mt-1 text-left px-2">Limpar seleção</button>}
              </div>
            </PopoverContent>
          </Popover>

          {/* Status Entrega */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("h-9 px-3 text-xs border rounded-md flex items-center gap-2 bg-white hover:bg-gray-50 transition-colors", deliveryStatusFilter.length > 0 ? "border-sky-400 text-sky-700 bg-sky-50" : "border-gray-200 text-gray-600")}>
                <span>{deliveryStatusFilter.length === 0 ? "Status Entrega" : deliveryStatusFilter.length === 1 ? deliveryStatusFilter[0] : `${deliveryStatusFilter.length} status`}</span>
                {deliveryStatusFilter.length > 0 && <span className="bg-sky-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{deliveryStatusFilter.length}</span>}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <div className="space-y-1">
                {["Pendente", "Aguardando Coleta", "Aguardando Validação", "Embalado", "Despachado", "Entregue"].map(s => (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <Checkbox checked={deliveryStatusFilter.includes(s)} onCheckedChange={() => toggleDeliveryStatusFilter(s)} />{s}
                  </label>
                ))}
                {deliveryStatusFilter.length > 0 && <button onClick={() => setDeliveryStatusFilter([])} className="w-full text-xs text-red-500 hover:text-red-700 pt-1 border-t mt-1 text-left px-2">Limpar seleção</button>}
              </div>
            </PopoverContent>
          </Popover>

          {/* Pagamento */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("h-9 px-3 text-xs border rounded-md flex items-center gap-2 bg-white hover:bg-gray-50 transition-colors", paymentMethodFilter.length > 0 ? "border-purple-400 text-purple-700 bg-purple-50" : "border-gray-200 text-gray-600")}>
                <span>{paymentMethodFilter.length === 0 ? "Pagamento" : paymentMethodFilter.length === 1 ? paymentMethodFilter[0] : `${paymentMethodFilter.length} métodos`}</span>
                {paymentMethodFilter.length > 0 && <span className="bg-purple-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{paymentMethodFilter.length}</span>}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start">
              <div className="space-y-1">
                {[{ value: "Pix", icon: QrCode }, { value: "Cartão", icon: CreditCard }].map(({ value, icon: Icon }) => (
                  <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <Checkbox checked={paymentMethodFilter.includes(value)} onCheckedChange={() => togglePaymentMethodFilter(value)} />
                    <Icon className="w-3.5 h-3.5 text-gray-500" />{value}
                  </label>
                ))}
                {paymentMethodFilter.length > 0 && <button onClick={() => setPaymentMethodFilter([])} className="w-full text-xs text-red-500 hover:text-red-700 pt-1 border-t mt-1 text-left px-2">Limpar seleção</button>}
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={clearAllFilters}>
              <FilterX className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}

          <div className="flex-1" />

          <Button onClick={() => setIsCreateOrderOpen(true)} className="bg-green-600 hover:bg-green-700 font-bold h-9 px-4 gap-2">
            <Plus className="w-4 h-4" /> Criar Pedido Manual
          </Button>

          <Button variant={readyToShipOnly ? "default" : "outline"} size="sm"
            className={cn("h-9 gap-2 text-xs", readyToShipOnly && "bg-blue-600")}
            onClick={() => { setReadyToShipOnly(!readyToShipOnly); setSelectedIds(new Set()); }}>
            <Package className="w-4 h-4" /> Prontos p/ Envio
          </Button>

          {/* Split export button: left = export selected, right = export by day */}
          <div className="flex items-center">
            <Button variant="outline" size="sm"
              className="h-9 gap-2 text-xs text-green-700 border-green-200 hover:bg-green-50 rounded-r-none border-r-0"
              onClick={handleExportExcel} disabled={selectedIds.size === 0 || isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Exportar ({selectedIds.size})
            </Button>
            <Popover open={exportByDayOpen} onOpenChange={setExportByDayOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"
                  className="h-9 px-2 text-green-700 border-green-200 hover:bg-green-50 rounded-l-none"
                  disabled={isExporting}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-4"
                align="end"
                onInteractOutside={(e) => e.preventDefault()}
                onFocusOutside={(e) => e.preventDefault()}
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-green-600" /> Exportar por dia
                    </p>
                    <p className="text-xs text-muted-foreground">Escolha o dia e exporte todos os pedidos automaticamente.</p>
                  </div>
                  <input
                    type="date"
                    value={exportByDayDate}
                    onChange={(e) => setExportByDayDate(e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs"
                      onClick={() => setExportByDayOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm font-bold gap-1"
                      onClick={handleExportByDay}
                      disabled={!exportByDayDate || isExporting}>
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                      Exportar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
          <span className="text-xs text-muted-foreground font-medium">Filtros ativos:</span>
          {searchOrderId && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium"># ID: {searchOrderId}<button onClick={() => setSearchOrderId("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button></span>}
          {searchCPF && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">CPF: {searchCPF}<button onClick={() => setSearchCPF("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button></span>}
          {searchClientName && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">Nome: {searchClientName}<button onClick={() => setSearchClientName("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button></span>}
          {searchEmail && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium">Email: {searchEmail}<button onClick={() => setSearchEmail("")} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button></span>}
          {startDate && <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-medium">De: {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")}<button onClick={() => setStartDate("")} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button></span>}
          {endDate && <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-medium">Até: {new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")}<button onClick={() => setEndDate("")} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button></span>}
          {statusFilter.map(s => <span key={s} className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium">Status: {s}<button onClick={() => toggleStatusFilter(s)} className="hover:text-green-900 ml-0.5"><X className="w-3 h-3" /></button></span>)}
          {deliveryStatusFilter.map(s => <span key={s} className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2.5 py-0.5 text-xs font-medium">Entrega: {s}<button onClick={() => toggleDeliveryStatusFilter(s)} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button></span>)}
          {paymentMethodFilter.map(s => <span key={s} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-medium">Pagamento: {s}<button onClick={() => togglePaymentMethodFilter(s)} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button></span>)}
          {readyToShipOnly && <span className="inline-flex items-center gap-1 bg-blue-600 text-white rounded-full px-2.5 py-0.5 text-xs font-medium">Prontos p/ Envio<button onClick={() => setReadyToShipOnly(false)} className="hover:opacity-80 ml-0.5"><X className="w-3 h-3" /></button></span>}
          <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 underline ml-1">Limpar tudo</button>
        </div>
      )}

      {/* ── MOBILE: Card list (visible only on small screens) ── */}
      <div className={cn("md:hidden space-y-0", isRefetching && "opacity-80 transition-opacity")}>
        {/* Select all bar */}
        {orders.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-2 mb-1">
            <Checkbox checked={orders.length > 0 && selectedIds.size === orders.length} onCheckedChange={toggleSelectAll} />
            <span className="text-xs text-muted-foreground">Selecionar todos ({orders.length})</span>
          </div>
        )}
        {orders.length === 0 && !isLoading ? (
          <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-muted-foreground text-sm">
            Nenhum pedido encontrado com os filtros aplicados.
          </div>
        ) : orders.map((order) => (
          <OrderMobileCard
            key={order.id}
            order={order}
            isSelected={selectedIds.has(order.id)}
            onToggleSelect={toggleSelectOne}
            onOpenDetail={(o) => { setSelectedOrder(o); setIsDetailModalOpen(true); }}
            onOpenLabel={(o) => { setSelectedOrder(o); setIsLabelModalOpen(true); }}
            onOpenClientHistory={(o) => {
              setSelectedClientForHistory({
                id: o.user_id,
                first_name: o.profiles?.first_name,
                last_name: o.profiles?.last_name,
                email: o.profiles?.email || "",
                created_at: null,
                force_pix_on_next_purchase: false,
                order_count: 0,
                completed_order_count: 0,
              });
              setIsClientHistoryOpen(true);
            }}
            onValidatePayment={(id) => validatePaymentAndSetPendingMutation.mutate(id)}
            onCancelFraud={(o) => setActionToConfirm({ action: "cancel_fraud", client: o })}
            onUpdateDeliveryStatus={(id, status) => updateDeliveryStatusMutation.mutate({ orderId: id, status })}
            onDeleteOrder={(o) => { setSelectedOrder(o); setIsDeleteAlertOpen(true); }}
            isValidating={validatePaymentAndSetPendingMutation.isPending}
            canUseWhatsApp={canUseWhatsApp}
            checkIsNextRoute={checkIsNextRoute}
            formatCurrency={formatCurrency}
            formatPhone={formatPhone}
            getWhatsAppLink={getWhatsAppLink}
          />
        ))}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1 py-3 mt-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── DESKTOP: Table (hidden on small screens) ── */}
      <div className={cn("hidden md:block bg-white rounded-lg border shadow-sm overflow-hidden", isRefetching && "opacity-80 transition-opacity")}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox checked={orders.length > 0 && selectedIds.size === orders.length} onCheckedChange={toggleSelectAll} />
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
              {orders.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Nenhum pedido encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : orders.map((order) => {
                const isPaid = order.status === "Finalizada" || order.status === "Pago";
                const needsManualValidation = order.status === "Pago" && order.delivery_status === "Aguardando Validação";
                const isInRoute = order.delivery_status === "Despachado";
                const isSelected = selectedIds.has(order.id);
                const isNextRoute = checkIsNextRoute(order.created_at);
                const paymentDetails = getPaymentMethodDetails(order.payment_method);
                const PaymentIcon = paymentDetails.icon;

                const itemsSubtotalRaw = (order.order_items || []).reduce((acc: number, it: any) => acc + (Number(it.price_at_purchase) || 0) * (Number(it.quantity) || 0), 0);
                const shipping = Number(order.shipping_cost) || 0;
                const donation = Number(order.donation_amount) || 0;
                const coupon = Number(order.coupon_discount) || 0;
                const finalTotal = (order.order_items && order.order_items.length > 0) ? itemsSubtotalRaw + shipping + donation - coupon : Number(order.total_price) || 0;

                const phone = order.profiles?.phone;
                const name = order.profiles?.first_name || "Cliente";

                let statusBadge;
                if (order.status === "Pago" && (order.delivery_status === "Aguardando Coleta" || order.delivery_status === "Pendente")) {
                  statusBadge = <Badge variant="secondary" className="bg-green-100 text-green-800">Pago</Badge>;
                } else if (needsManualValidation) {
                  statusBadge = <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 gap-1"><ShieldCheck className="w-3 h-3" /> Aguardando Validação</Badge>;
                } else {
                  statusBadge = <Badge variant="secondary" className={cn("text-[10px] w-fit", isPaid && "bg-green-100 text-green-800")}>{order.status}</Badge>;
                }

                const deliveryStatusLabel = order.status === "Cancelado" ? "Cancelado" : isPaid && order.delivery_status === "Pendente" ? "Aguardando Coleta" : order.delivery_status;
                let deliveryBadge;
                if (needsManualValidation) {
                  deliveryBadge = <Badge variant="outline" className="text-gray-400 border-gray-200">Bloqueado</Badge>;
                } else {
                  deliveryBadge = (
                    <Badge variant="secondary" className={cn("w-fit",
                      deliveryStatusLabel === "Cancelado" && "bg-red-100 text-red-800",
                      deliveryStatusLabel === "Entregue" && "bg-green-100 text-green-800",
                      deliveryStatusLabel === "Despachado" && "bg-blue-100 text-blue-800 animate-pulse",
                      deliveryStatusLabel === "Embalado" && "bg-amber-100 text-amber-800",
                      deliveryStatusLabel === "Aguardando Coleta" && "bg-sky-100 text-sky-800"
                    )}>{deliveryStatusLabel}</Badge>
                  );
                }

                return (
                  <TableRow key={order.id} className={cn(
                    isSelected ? "bg-primary/5 border-l-4 border-l-primary" :
                    order.status === "Cancelado" ? "bg-red-50/60 border-l-4 border-l-red-400" :
                    needsManualValidation ? "bg-orange-50/40" :
                    (isNextRoute && order.delivery_status === "Pendente") ? "bg-yellow-50/60 border-l-4 border-l-yellow-400" : ""
                  )}>
                    <TableCell className="text-center">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectOne(order.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold">
                      <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-50 rounded-full"
                                onClick={() => { setSelectedClientForHistory({ id: order.user_id, first_name: order.profiles?.first_name, last_name: order.profiles?.last_name, email: order.profiles?.email || "", created_at: null, force_pix_on_next_purchase: false, order_count: 0, completed_order_count: 0 }); setIsClientHistoryOpen(true); }}>
                                <History className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Histórico de Pedidos</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="flex flex-col gap-0.5">
                        <span>#{order.id}</span>
                        {editedOrderIds?.has(order.id) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-1.5 py-0.5 text-[10px] font-semibold w-fit whitespace-nowrap cursor-default">
                                  <Pencil className="w-2.5 h-2.5 shrink-0" /> editado
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Itens do pedido foram editados pelo admin</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {order.delivery_info && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-1.5 py-0.5 text-[10px] font-semibold w-fit whitespace-nowrap cursor-default">
                                  <AlertCircle className="w-2.5 h-2.5 shrink-0" /> obs.
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{order.delivery_info}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs">{new Date(order.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                        {isNextRoute && order.delivery_status === "Pendente" && (
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
                                  <a href={getWhatsAppLink(phone, `Olá ${name}, falando sobre o pedido #${order.id}...`)} target="_blank" rel="noreferrer" className="bg-green-100 p-1 rounded-full text-green-600 hover:bg-green-200 hover:scale-110 transition-all">
                                    <MessageCircle className="w-3 h-3" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Abrir WhatsApp</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-50 rounded-full"
                                  onClick={() => { setSelectedClientForHistory({ id: order.user_id, first_name: order.profiles?.first_name, last_name: order.profiles?.last_name, email: order.profiles?.email || "", created_at: null, force_pix_on_next_purchase: false, order_count: 0, completed_order_count: 0 }); setIsClientHistoryOpen(true); }}>
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
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell>{deliveryBadge}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1 pr-3 w-fit", paymentDetails.style)}>
                        <PaymentIcon className="w-3 h-3" />{paymentDetails.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {needsManualValidation ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" className="bg-green-600 hover:bg-green-700 h-8 w-8"
                                    onClick={() => validatePaymentAndSetPendingMutation.mutate(order.id)}
                                    disabled={validatePaymentAndSetPendingMutation.isPending}>
                                    {validatePaymentAndSetPendingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Validar Comprovante e Liberar para Envio</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setActionToConfirm({ action: "cancel_fraud", client: order })}>
                                    <ShieldX className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Cancelar Pedido (Suspeita de Fraude)</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        ) : (
                          <>
                            {isInRoute && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100 font-bold h-8 px-3 text-xs"
                                      onClick={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: "Entregue" })}
                                      disabled={updateDeliveryStatusMutation.isPending}>
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
                                {(isAdmin || isGerenteGeral) && (
                                  <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsEditOrderOpen(true); }} className="text-blue-600 font-medium">
                                    <Pencil className="w-4 h-4 mr-2" /> Editar Pedido
                                  </DropdownMenuItem>
                                )}
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
                                <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: "Embalado" })}>
                                  <Package className="w-4 h-4 mr-2" /> Marcar como Embalado
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: "Despachado" })}>
                                  <Truck className="w-4 h-4 mr-2" /> Marcar como Despachado
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => updateDeliveryStatusMutation.mutate({ orderId: order.id, status: "Entregue" })}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como Entregue
                                </DropdownMenuItem>
                                {(isAdmin || isGerenteGeral) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {order.status !== "Cancelado" && (
                                      <DropdownMenuItem onSelect={() => setActionToConfirm({ action: "cancel_fraud", client: order })} className="text-orange-600 font-medium">
                                        <XCircle className="w-4 h-4 mr-2" /> Cancelar Pedido
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsDeleteAlertOpen(true); }} className="text-red-600">
                                      <Trash2 className="w-4 h-4 mr-2" /> Excluir Pedido
                                    </DropdownMenuItem>
                                  </>
                                )}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ORDERS_PER_PAGE) + 1}–{Math.min(currentPage * ORDERS_PER_PAGE, totalCount)} de {totalCount} pedidos
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`e-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                  ) : (
                    <Button key={item} variant={currentPage === item ? "default" : "outline"} size="sm" className="w-9" onClick={() => setCurrentPage(item as number)}>
                      {item}
                    </Button>
                  )
                )}
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300 px-0 md:px-0">
          {/* Mobile layout */}
          <div className="md:hidden bg-primary text-white shadow-2xl border-t-4 border-white p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg"><CheckboxIcon className="w-4 h-4" /></div>
                <span className="font-black text-sm">{selectedIds.size} selecionados</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="h-8 w-8 hover:bg-white/10 text-white rounded-lg">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={handleBulkValidate} disabled={isProcessingBulk} className="bg-green-600 hover:bg-green-700 font-bold h-10 rounded-xl text-xs px-2">
                {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Pago
              </Button>
              <Button onClick={handleBulkPackaged} disabled={isProcessingBulk} className="bg-amber-500 hover:bg-amber-600 font-bold h-10 rounded-xl text-xs px-2">
                {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4 mr-1" />} Embalado
              </Button>
              <Button onClick={handleBulkDelivered} disabled={isProcessingBulk} className="bg-green-800 hover:bg-green-900 font-bold h-10 rounded-xl text-xs px-2">
                {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4 mr-1" />} Entregue
              </Button>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden md:flex bg-primary text-white shadow-2xl rounded-2xl p-4 items-center gap-6 border-4 border-white">
            <div className="flex items-center gap-3 pr-6 border-r border-white/20">
              <div className="bg-white/20 p-2 rounded-lg"><CheckboxIcon className="w-6 h-6" /></div>
              <div>
                <p className="text-lg font-black leading-none">{selectedIds.size}</p>
                <p className="text-[10px] uppercase font-bold opacity-70">Selecionados</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBulkValidate} disabled={isProcessingBulk} className="bg-green-600 hover:bg-green-700 font-black h-12 px-6 rounded-xl shadow-lg">
                {isProcessingBulk ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />} Marcar como Pago
              </Button>
              <Button onClick={handleBulkPackaged} disabled={isProcessingBulk} className="bg-amber-500 hover:bg-amber-600 font-black h-12 px-6 rounded-xl shadow-lg">
                {isProcessingBulk ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Package className="w-5 h-5 mr-2" />} Marcar Embalados
              </Button>
              <Button onClick={handleBulkDelivered} disabled={isProcessingBulk} className="bg-green-800 hover:bg-green-900 font-black h-12 px-6 rounded-xl shadow-lg">
                {isProcessingBulk ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Truck className="w-5 h-5 mr-2" />} Marcar Entregues
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="h-12 w-12 hover:bg-white/10 text-white rounded-xl">
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && <OrderDetailModal order={selectedOrder} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
      {selectedOrder && <ShippingLabelModal order={selectedOrder} isOpen={isLabelModalOpen} onClose={() => { setIsLabelModalOpen(false); setSelectedOrder(null); }} />}
      {selectedOrder && <OrderEditModal order={selectedOrder} isOpen={isEditOrderOpen} onClose={() => { setIsEditOrderOpen(false); setSelectedOrder(null); }} />}
      <ClientDetailsModal client={selectedClientForHistory} isOpen={isClientHistoryOpen} onClose={() => setIsClientHistoryOpen(false)} />
      <CreateOrderModal isOpen={isCreateOrderOpen} onClose={() => setIsCreateOrderOpen(false)} />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir o pedido <strong>#{selectedOrder?.id}</strong>? Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedOrder && deleteOrderMutation.mutate(selectedOrder.id)} disabled={deleteOrderMutation.isPending} className="bg-red-600 hover:bg-red-700">
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
              {actionToConfirm?.action === "resend_confirmation" ? `Reenviar e-mail de confirmação para ${actionToConfirm?.client.email}?`
                : actionToConfirm?.action === "send_password_reset" ? `Enviar link de redefinição de senha para ${actionToConfirm?.client.email}?`
                : actionToConfirm?.action === "mark_as_recurrent" ? `Marcar o cliente ${actionToConfirm?.client.email} como recorrente?`
                : actionToConfirm?.action === "cancel_fraud" ? `Tem certeza que deseja cancelar o pedido #${actionToConfirm?.client.id}?`
                : `ATENÇÃO: Deletar TODOS OS PEDIDOS do cliente ${actionToConfirm?.client.email}. Irreversível.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={userActionMutation.isPending || cancelOrderForFraudMutation.isPending}
              className={actionToConfirm?.action === "cancel_fraud" || actionToConfirm?.action === "delete_orders" ? "bg-red-600" : ""}>
              {userActionMutation.isPending || cancelOrderForFraudMutation.isPending ? "Executando..." : "Sim, Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;