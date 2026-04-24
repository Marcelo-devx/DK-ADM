import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, MoreHorizontal, MessageCircle, Package, Truck, CheckCircle2,
  CalendarClock, QrCode, CreditCard, DollarSign, ShieldCheck, ShieldX,
  CheckSquare, Loader2, XCircle, Printer, History, Trash2, AlertCircle
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

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

interface OrderMobileCardProps {
  order: Order;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (order: Order) => void;
  onOpenLabel: (order: Order) => void;
  onOpenClientHistory: (order: Order) => void;
  onValidatePayment: (orderId: number) => void;
  onCancelFraud: (order: Order) => void;
  onUpdateDeliveryStatus: (orderId: number, status: string, info: string) => void;
  onDeleteOrder: (order: Order) => void;
  isValidating: boolean;
  canUseWhatsApp: boolean;
  checkIsNextRoute: (date: string) => boolean;
  formatCurrency: (val: number) => string;
  formatPhone: (phone: string | null) => string;
  getWhatsAppLink: (phone: string | null, message?: string) => string;
}

const getPaymentMethodDetails = (method: string | null | undefined) => {
  if (!method) return { label: "Pix", icon: QrCode, style: "bg-cyan-50 text-cyan-700 border-cyan-200" };
  const lower = method.toLowerCase();
  if (lower.includes("pix")) return { label: "Pix", icon: QrCode, style: "bg-cyan-50 text-cyan-700 border-cyan-200" };
  if (lower.includes("credit") || lower.includes("card") || lower.includes("cart"))
    return { label: "Cartão (MP)", icon: CreditCard, style: "bg-purple-50 text-purple-700 border-purple-200" };
  return { label: method, icon: DollarSign, style: "bg-gray-50 text-gray-700 border-gray-200" };
};

export const OrderMobileCard = ({
  order,
  isSelected,
  onToggleSelect,
  onOpenDetail,
  onOpenLabel,
  onOpenClientHistory,
  onValidatePayment,
  onCancelFraud,
  onUpdateDeliveryStatus,
  onDeleteOrder,
  isValidating,
  canUseWhatsApp,
  checkIsNextRoute,
  formatCurrency,
  formatPhone,
  getWhatsAppLink,
}: OrderMobileCardProps) => {
  const isPaid = order.status === "Finalizada" || order.status === "Pago";
  const needsManualValidation = order.status === "Pago" && order.delivery_status === "Aguardando Validação";
  const isInRoute = order.delivery_status === "Despachado";
  const isNextRoute = checkIsNextRoute(order.created_at);
  const isCancelled = order.status === "Cancelado";

  const paymentDetails = getPaymentMethodDetails(order.payment_method);
  const PaymentIcon = paymentDetails.icon;

  const itemsSubtotalRaw = (order.order_items || []).reduce(
    (acc: number, it: any) => acc + (Number(it.price_at_purchase) || 0) * (Number(it.quantity) || 0), 0
  );
  const shipping = Number(order.shipping_cost) || 0;
  const donation = Number(order.donation_amount) || 0;
  const coupon = Number(order.coupon_discount) || 0;
  const finalTotal = (order.order_items && order.order_items.length > 0)
    ? itemsSubtotalRaw + shipping + donation - coupon
    : Number(order.total_price) || 0;

  const phone = order.profiles?.phone;
  const name = order.profiles?.first_name || "Cliente";

  const deliveryStatusLabel = isCancelled
    ? "Cancelado"
    : isPaid && order.delivery_status === "Pendente"
    ? "Aguardando Coleta"
    : order.delivery_status;

  const deliveryBadgeClass = cn(
    "text-[10px] px-2 py-0.5",
    deliveryStatusLabel === "Cancelado" && "bg-red-100 text-red-800",
    deliveryStatusLabel === "Entregue" && "bg-green-100 text-green-800",
    deliveryStatusLabel === "Despachado" && "bg-blue-100 text-blue-800",
    deliveryStatusLabel === "Embalado" && "bg-amber-100 text-amber-800",
    deliveryStatusLabel === "Aguardando Coleta" && "bg-sky-100 text-sky-800"
  );

  const statusBadgeClass = cn(
    "text-[10px] px-2 py-0.5",
    isPaid && !needsManualValidation && "bg-green-100 text-green-800",
    needsManualValidation && "bg-orange-100 text-orange-800",
    isCancelled && "bg-red-100 text-red-800"
  );

  const cardBg = cn(
    "rounded-xl border shadow-sm p-3 mb-2 transition-all active:scale-[0.99]",
    isSelected ? "bg-primary/5 border-primary border-l-4" :
    isCancelled ? "bg-red-50/60 border-l-4 border-l-red-400 bg-white" :
    needsManualValidation ? "bg-orange-50/40 border-orange-200 bg-white" :
    (isNextRoute && order.delivery_status === "Pendente") ? "bg-yellow-50/60 border-l-4 border-l-yellow-400 bg-white" :
    "bg-white"
  );

  return (
    <div className={cardBg}>
      {/* Top row: checkbox + ID + date + actions */}
      <div className="flex items-center gap-2 mb-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(order.id)}
          className="shrink-0"
        />

        {/* Tap area to open detail */}
        <button
          className="flex-1 flex items-center gap-2 text-left"
          onClick={() => onOpenDetail(order)}
        >
          <span className="font-mono font-bold text-sm text-gray-900">#{order.id}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            {" "}
            {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
          </span>
          {isNextRoute && order.delivery_status === "Pendente" && (
            <Badge variant="outline" className="text-[9px] bg-yellow-100 text-yellow-800 border-yellow-300 gap-1 px-1 py-0">
              <CalendarClock className="w-2.5 h-2.5" /> Próx. Dia
            </Badge>
          )}
          {order.delivery_info && (
            <Badge variant="outline" className="text-[9px] bg-orange-100 text-orange-700 border-orange-300 gap-1 px-1 py-0">
              <AlertCircle className="w-2.5 h-2.5" /> obs.
            </Badge>
          )}
        </button>

        {/* Actions menu */}
        <div className="flex items-center gap-1 shrink-0">
          {needsManualValidation ? (
            <>
              <Button
                size="icon"
                className="bg-green-600 hover:bg-green-700 h-8 w-8"
                onClick={() => onValidatePayment(order.id)}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={() => onCancelFraud(order)}
              >
                <ShieldX className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => onOpenDetail(order)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Ações do Pedido #{order.id}</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => onOpenClientHistory(order)}>
                    <History className="w-4 h-4 mr-2" /> Histórico do Cliente
                  </DropdownMenuItem>
                  {phone && canUseWhatsApp && (
                    <DropdownMenuItem asChild>
                      <a
                        href={getWhatsAppLink(phone, `Olá ${name}, falando sobre o pedido #${order.id}...`)}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer text-green-600 font-medium"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" /> Abrir WhatsApp
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onOpenLabel(order)} disabled={!isPaid}>
                    <Printer className="w-4 h-4 mr-2" /> Imprimir Etiqueta
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onUpdateDeliveryStatus(order.id, "Embalado", "Marcado como embalado manualmente")}>
                    <Package className="w-4 h-4 mr-2" /> Marcar como Embalado
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onUpdateDeliveryStatus(order.id, "Despachado", "Despachado manualmente")}>
                    <Truck className="w-4 h-4 mr-2" /> Marcar como Despachado
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onUpdateDeliveryStatus(order.id, "Entregue", "Entregue manualmente")}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como Entregue
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {order.status !== "Cancelado" && (
                    <DropdownMenuItem onSelect={() => onCancelFraud(order)} className="text-orange-600 font-medium">
                      <XCircle className="w-4 h-4 mr-2" /> Cancelar Pedido
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onDeleteOrder(order)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir Pedido
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Main tap area */}
      <button
        className="w-full text-left"
        onClick={() => onOpenDetail(order)}
      >
        {/* Client name + phone */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-semibold text-sm text-gray-900 leading-tight">
              {order.profiles?.first_name} {order.profiles?.last_name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{formatPhone(phone || "")}</p>
          </div>
          <span className="text-lg font-black text-gray-900">{formatCurrency(finalTotal)}</span>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {needsManualValidation ? (
            <Badge className="text-[10px] px-2 py-0.5 bg-orange-500 text-white gap-1">
              <ShieldCheck className="w-3 h-3" /> Aguardando Validação
            </Badge>
          ) : (
            <Badge variant="secondary" className={statusBadgeClass}>
              {order.status}
            </Badge>
          )}

          {needsManualValidation ? (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-gray-400 border-gray-200">
              Bloqueado
            </Badge>
          ) : (
            <Badge variant="secondary" className={deliveryBadgeClass}>
              {deliveryStatusLabel}
            </Badge>
          )}

          <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 gap-1", paymentDetails.style)}>
            <PaymentIcon className="w-3 h-3" />
            {paymentDetails.label}
          </Badge>

          {isInRoute && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100 font-bold h-7 px-2 text-xs ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateDeliveryStatus(order.id, "Entregue", "Confirmado pelo painel");
              }}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Entregue
            </Button>
          )}
        </div>
      </button>

      {/* WhatsApp quick action */}
      {phone && canUseWhatsApp && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <a
            href={getWhatsAppLink(phone, `Olá ${name}, falando sobre o pedido #${order.id}...`)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-green-600 font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {formatPhone(phone)}
          </a>
        </div>
      )}
    </div>
  );
};
