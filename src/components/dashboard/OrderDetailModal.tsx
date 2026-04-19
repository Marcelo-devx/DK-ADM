import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Truck, CreditCard, QrCode, Ticket, User, Phone, MapPin, Fingerprint, Package, Heart, Mail } from "lucide-react";

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  coupon_discount: number;
  donation_amount: number;
  status: string;
  user_id: string;
  delivery_info?: string | null;
  payment_method?: string | null;
  shipping_address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
  };
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
  } | null;
}

interface OrderItem {
  id: number;
  name_at_purchase: string;
  quantity: number;
  price_at_purchase: number;
  image_url_at_purchase: string | null;
  variant_id: string | null;
  variant?: {
    flavor_id: number | null;
    volume_ml: number | null;
    color: string | null;
    ohms: string | null;
    size: string | null;
    flavors?: { name: string } | null;
  } | null;
}

interface OrderDetailModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

const fetchOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  const { data, error } = await supabase
    .from("order_items")
    .select("*, product_variants(flavor_id, volume_ml, color, ohms, size, flavors(name))")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  return data.map((item: any) => ({
    ...item,
    variant: item.product_variants ?? null,
  }));
};

const fetchCustomerProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, cpf_cnpj, email")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
};

export const OrderDetailModal = ({ order, isOpen, onClose }: OrderDetailModalProps) => {
  const { data: items, isLoading: isLoadingItems } = useQuery<OrderItem[]>({
    queryKey: ["orderItems", order.id],
    queryFn: () => fetchOrderItems(order.id),
    enabled: isOpen,
  });

  const { data: customer } = useQuery({
    queryKey: ["orderCustomer", order.user_id],
    queryFn: () => fetchCustomerProfile(order.user_id),
    enabled: isOpen && !!order.user_id,
  });

  const subtotal = items?.reduce((acc, item) => acc + (Number(item.price_at_purchase) || 0) * (Number(item.quantity) || 0), 0) || 0;

  // O total composto: subtotal dos itens + frete + doação - desconto de cupom
  const finalPaidTotal = subtotal + (Number(order.shipping_cost) || 0) + (Number(order.donation_amount) || 0) - (Number(order.coupon_discount) || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start pr-8">
            <div>
                <DialogTitle className="text-xl">Detalhes do Pedido #{order.id}</DialogTitle>
                <DialogDescription>
                    Realizado em {new Date(order.created_at).toLocaleString("pt-BR")}
                </DialogDescription>
            </div>
            <div className="flex gap-2">
                {order.payment_method?.toLowerCase().includes('pix') ? (
                    <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 gap-1"><QrCode className="w-3 h-3" /> Pix</Badge>
                ) : order.payment_method?.toLowerCase().includes('cartão') ? (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><CreditCard className="w-3 h-3" /> Cartão</Badge>
                ) : null}
                <Badge variant="outline" className="bg-gray-100">{order.status}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {order.delivery_info && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
              <Truck className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">Rastreamento / Entrega:</p>
                <p className="text-sm text-blue-800">{order.delivery_info}</p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-gray-700">
                    <User className="h-4 w-4" /> Dados do Cliente
                </h4>
                <div className="text-sm space-y-2">
                    <div className="font-medium text-base">
                        {customer?.first_name || order.profiles?.first_name} {customer?.last_name || order.profiles?.last_name}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{customer?.email || order.profiles?.email || "Não informado"}</span>
                    </div>
                    {customer?.cpf_cnpj && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Fingerprint className="h-3 w-3" /> 
                            <span className="font-mono text-xs">{customer.cpf_cnpj}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" /> 
                        <span>{customer?.phone || "Não informado"}</span>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-gray-700">
                    <MapPin className="h-4 w-4" /> Endereço de Entrega
                </h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                    <p className="text-gray-900 font-medium">
                        {order.shipping_address.street}, {order.shipping_address.number}
                    </p>
                    {order.shipping_address.complement && (
                        <p>{order.shipping_address.complement}</p>
                    )}
                    <p>{order.shipping_address.neighborhood}</p>
                    <p>{order.shipping_address.city} - {order.shipping_address.state}</p>
                    <p className="text-xs font-mono">CEP: {order.shipping_address.cep}</p>
                </div>
            </div>
          </div>

          {/* ── Itens do Pedido ── versão mobile-first ── */}
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2 text-sm uppercase text-muted-foreground tracking-wider">
              <Package className="w-4 h-4" />
              Itens do Pedido
              {items && (
                <span className="ml-1 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {items.reduce((acc, i) => acc + i.quantity, 0)} un.
                </span>
              )}
            </h3>

            {isLoadingItems ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-3">
                {items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 bg-white border-2 border-gray-100 rounded-2xl p-3 shadow-sm"
                  >
                    {/* Imagem grande */}
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {item.image_url_at_purchase ? (
                        <img
                          src={item.image_url_at_purchase}
                          alt={item.name_at_purchase}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-10 w-10 text-gray-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
                      {/* Nome */}
                      <p className="font-bold text-base text-gray-900 leading-tight line-clamp-2">
                        {item.name_at_purchase}
                      </p>

                      {/* Variantes em pills */}
                      {item.variant && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {item.variant.flavors?.name && (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              🍃 {item.variant.flavors.name}
                            </span>
                          )}
                          {item.variant.color && (
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              🎨 {item.variant.color}
                            </span>
                          )}
                          {item.variant.volume_ml && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              💧 {item.variant.volume_ml}ml
                            </span>
                          )}
                          {item.variant.ohms && (
                            <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              ⚡ {item.variant.ohms}Ω
                            </span>
                          )}
                          {item.variant.size && (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              📐 {item.variant.size}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quantidade + Preço unitário + Total */}
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <div className="flex items-center gap-2">
                          {/* Badge de quantidade grande */}
                          <span className="bg-primary text-white text-sm font-black px-3 py-1 rounded-full min-w-[2.5rem] text-center">
                            {item.quantity}x
                          </span>
                          <span className="text-sm text-muted-foreground font-medium">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price_at_purchase)}
                          </span>
                        </div>
                        {/* Total do item em destaque */}
                        <span className="text-lg font-black text-gray-900">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.quantity * item.price_at_purchase)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-1/2 space-y-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frete:</span>
                    <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.shipping_cost)}</span>
                </div>
                {order.donation_amount > 0 && (
                    <div className="flex justify-between text-rose-600 text-sm font-bold animate-in fade-in slide-in-from-left-2">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3 fill-rose-600" /> Doação Solidária:</span>
                        <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.donation_amount)}</span>
                    </div>
                )}
                {order.coupon_discount > 0 && (
                    <div className="flex justify-between text-green-600 text-sm font-medium">
                        <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Desconto:</span>
                        <span>- {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.coupon_discount)}</span>
                    </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                    <span className="font-bold text-base">Total Pago:</span>
                    <span className="text-xl font-black text-primary">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(finalPaidTotal)}
                    </span>
                </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};