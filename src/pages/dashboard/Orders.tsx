import { useState } from "react";
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
import { MoreHorizontal, DollarSign, Eye, Trash2, Package, Share2, Printer, RefreshCw } from "lucide-react";
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

const OrdersPage = () => {
  const queryClient = useQueryClient();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [readyToShipOnly, setReadyToShipOnly] = useState(false);

  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["ordersAdmin"],
    queryFn: fetchOrders,
    refetchInterval: 30000, // Atualiza automaticamente a cada 30 segundos
  });

  const sendToSpokeMutation = useMutation({
    mutationFn: async (order: Order) => {
        const { data, error } = await supabase.functions.invoke("spoke-proxy", {
            body: {
                action: "stops",
                method: "POST",
                body: {
                    external_id: `ORDER-${order.id}`,
                    name: `${order.profiles?.first_name} ${order.profiles?.last_name}`.trim(),
                    phone_number: order.profiles?.phone || "",
                    address: `${order.shipping_address.street}, ${order.shipping_address.number}${order.shipping_address.complement ? ` - ${order.shipping_address.complement}` : ""}`,
                    city: order.shipping_address.city,
                    state: order.shipping_address.state,
                    postal_code: order.shipping_address.cep,
                    notes: `Venda #${order.id} | Valor: R$ ${order.total_price}`,
                }
            }
        });

        if (error) throw new Error(error.message || "Erro ao comunicar com a ponte do Spoke.");

        const { error: updateError } = await supabase
            .from('orders')
            .update({ delivery_status: 'Despachado', delivery_info: 'Enviado para Logística Spoke' })
            .eq('id', order.id);
        
        if (updateError) throw updateError;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
        showSuccess("Pedido enviado com sucesso para o Spoke!");
    },
    onError: (err: any) => showError(err.message),
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

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const filteredOrders = orders?.filter(order => {
    if (readyToShipOnly) {
        const isPaid = order.status === "Finalizada" || order.status === "Pago";
        const isPendingDelivery = order.delivery_status === "Pendente";
        return isPaid && isPendingDelivery;
    }
    return true;
  });

  return (
    <div>
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
            onClick={() => setReadyToShipOnly(!readyToShipOnly)}
          >
            <Package className="w-4 h-4" /> Somente Prontos para Envio
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : filteredOrders?.map((order) => {
                const isPaid = order.status === "Finalizada" || order.status === "Pago";
                const isPendingDelivery = order.delivery_status === "Pendente";
                const canSendToSpoke = isPaid && isPendingDelivery;

                return (
                  <TableRow key={order.id} className={cn(canSendToSpoke && "bg-blue-50/10")}>
                    <TableCell className="font-mono text-sm font-bold">#{order.id}</TableCell>
                    <TableCell className="text-xs">{new Date(order.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium text-sm">{order.profiles?.first_name} {order.profiles?.last_name}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(order.total_price)}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn(order.payment_method?.includes('Pix') ? "bg-cyan-50" : "bg-purple-50")}>
                            {order.payment_method || 'Pix'}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary" className={cn(order.delivery_status === 'Entregue' && "bg-green-100 text-green-800")}>
                            {order.delivery_status}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canSendToSpoke && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className="h-8 w-8 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                                            onClick={() => sendToSpokeMutation.mutate(order)}
                                            disabled={sendToSpokeMutation.isPending}
                                        >
                                            {sendToSpokeMutation.isPending ? <Skeleton className="w-4 h-4 rounded-full" /> : <Share2 className="h-4 w-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Enviar p/ Spoke Dispatch</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}><Eye className="h-4 w-4 text-primary" /></Button>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsLabelModalOpen(true); }}>Imprimir Etiqueta</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsDeleteAlertOpen(true); }} className="text-red-600">Excluir Pedido</DropdownMenuItem>
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