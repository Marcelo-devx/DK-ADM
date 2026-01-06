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
import { Truck, CreditCard, QrCode, Ticket } from "lucide-react";

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

export const OrderDetailModal = ({ order, isOpen, onClose }: OrderDetailModalProps) => {
  const { data: items, isLoading } = useQuery<OrderItem[]>({
    queryKey: ["orderItems", order.id],
    queryFn: () => fetchOrderItems(order.id),
    enabled: isOpen,
  });

  const subtotal = items?.reduce((acc, item) => acc + item.price_at_purchase * item.quantity, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido #{order.id}</DialogTitle>
          <DialogDescription>
            Realizado em {new Date(order.created_at).toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {order.payment_method?.toLowerCase().includes('pix') ? (
                <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 gap-1"><QrCode className="w-3 h-3" /> Pago via Pix</Badge>
            ) : order.payment_method?.toLowerCase().includes('cartão') ? (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><CreditCard className="w-3 h-3" /> Pago via Cartão</Badge>
            ) : null}
            <Badge variant="outline">{order.status}</Badge>
          </div>

          {order.delivery_info && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
              <Truck className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">Informação de Entrega:</p>
                <p className="text-sm text-blue-800">{order.delivery_info}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Itens do Pedido</h3>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-2">
                {items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img src={item.image_url_at_purchase || ''} alt={item.name_at_purchase} className="h-12 w-12 rounded-md object-cover" />
                      <div>
                        <p className="font-medium">{item.name_at_purchase}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} x {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price_at_purchase)}
                        </p>
                      </div>
                    </div>
                    <p className="font-medium">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.quantity * item.price_at_purchase)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
                <span>Subtotal dos Itens:</span>
                <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subtotal)}</span>
            </div>
            <div className="flex justify-between">
                <span>Frete:</span>
                <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.shipping_cost)}</span>
            </div>
            
            {order.coupon_discount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                    <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Desconto do Clube:</span>
                    <span>- {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.coupon_discount)}</span>
                </div>
            )}

            <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                <span>Valor Final Pago:</span>
                <span className="text-primary">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total_price)}</span>
            </div>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Endereço de Entrega</h3>
            <div className="text-sm text-muted-foreground">
              <p>{order.shipping_address.street}, {order.shipping_address.number} {order.shipping_address.complement}</p>
              <p>{order.shipping_address.neighborhood} - {order.shipping_address.city}/{order.shipping_address.state}</p>
              <p>CEP: {order.shipping_address.cep}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};