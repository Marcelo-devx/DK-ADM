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
import { Truck, CreditCard, QrCode, Ticket, User, Phone, MapPin, Fingerprint, Package } from "lucide-react";

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  coupon_discount: number;
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
  } | null;
}

interface OrderItem {
  id: number;
  name_at_purchase: string;
  quantity: number;
  price_at_purchase: number;
  image_url_at_purchase: string | null;
}

interface OrderDetailModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

const fetchOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  return data;
};

const fetchCustomerProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, cpf_cnpj, email")
    .eq("id", userId)
    .single();
  // Se der erro (ex: perfil deletado), retornamos null sem quebrar a UI
  if (error) return null;
  return data;
};

export const OrderDetailModal = ({ order, isOpen, onClose }: OrderDetailModalProps) => {
  const { data: items, isLoading: isLoadingItems } = useQuery<OrderItem[]>({
    queryKey: ["orderItems", order.id],
    queryFn: () => fetchOrderItems(order.id),
    enabled: isOpen,
  });

  const { data: customer, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ["orderCustomer", order.user_id],
    queryFn: () => fetchCustomerProfile(order.user_id),
    enabled: isOpen && !!order.user_id,
  });

  const subtotal = items?.reduce((acc, item) => acc + item.price_at_purchase * item.quantity, 0) || 0;

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

          {/* DADOS DO CLIENTE E ENDEREÇO */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-gray-700">
                    <User className="h-4 w-4" /> Dados do Cliente
                </h4>
                {isLoadingCustomer ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ) : (
                    <div className="text-sm space-y-2">
                        <div className="font-medium text-base">
                            {customer?.first_name || order.profiles?.first_name} {customer?.last_name || order.profiles?.last_name}
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
                        {/* Exibir email se disponível (dependendo se sua estrutura permite acesso ao email aqui) */}
                    </div>
                )}
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

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm uppercase text-muted-foreground tracking-wider">
                Itens do Pedido
            </h3>
            {isLoadingItems ? (
              <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {items?.map((item, index) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 bg-white ${index !== items.length - 1 ? 'border-b' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-md border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                          {item.image_url_at_purchase ? (
                              <img src={item.image_url_at_purchase} alt={item.name_at_purchase} className="h-full w-full object-cover" />
                          ) : (
                              <Package className="h-6 w-6 text-gray-300" />
                          )}
                      </div>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{item.name_at_purchase}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} un. x {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price_at_purchase)}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-sm">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.quantity * item.price_at_purchase)}
                    </p>
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
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total_price)}
                    </span>
                </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};