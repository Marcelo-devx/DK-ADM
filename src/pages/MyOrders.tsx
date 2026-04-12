import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Package } from 'lucide-react';
import { formatBRL as formatCurrency } from '@/utils/currency';
import { SalesPopupDisplay } from '@/components/SalesPopupDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OrderItem {
  id: number;
  quantity: number;
  price_at_purchase: number;
  name_at_purchase: string;
  image_url_at_purchase: string | null;
  item_id: number;
}

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  shipping_cost: number;
  donation_amount: number;
  order_items: OrderItem[];
}

interface Review {
  product_id: number;
  order_id: number;
  rating: number;
}

const fetchOrders = async (userId: string) => {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (ordersError) throw new Error(ordersError.message);
  if (!orders || orders.length === 0) return { orders: [], reviews: [] };

  const orderIds = orders.map(o => o.id);
  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('product_id, order_id, rating')
    .in('order_id', orderIds)
    .eq('user_id', userId);

  if (reviewsError) console.error('Error fetching reviews:', reviewsError.message);

  return { orders, reviews: reviews || [] };
};

// Componente isolado para o botão de avaliação — evita estado compartilhado
function ReviewButton({ item, orderId }: { item: OrderItem; orderId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Avaliar Produto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar: {item.name_at_purchase}</DialogTitle>
        </DialogHeader>
        <ReviewForm
          productId={item.item_id}
          orderId={orderId}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

const MyOrdersPage = () => {
  const { user, loading: userLoading } = useUser();
  const [viewFilter, setViewFilter] = useState<'all' | 'paid' | 'canceled'>('all');

  const { data, isLoading, error } = useQuery<{ orders: Order[]; reviews: Review[] }>({
    queryKey: ['orders', user?.id],
    queryFn: () => fetchOrders(user!.id),
    enabled: !!user,
  });

  const filteredOrders = useMemo(() => {
    const orders = data?.orders || [];
    if (viewFilter === 'paid') {
      return orders.filter(order => order.status === 'Pago' || order.status === 'Finalizada');
    }
    if (viewFilter === 'canceled') {
      return orders.filter(order => order.status === 'Cancelado');
    }
    return orders;
  }, [data?.orders, viewFilter]);

  const hasReview = (productId: number, orderId: number) =>
    data?.reviews.some(r => r.product_id === productId && r.order_id === orderId);

  const getReviewRating = (productId: number, orderId: number) =>
    data?.reviews.find(r => r.product_id === productId && r.order_id === orderId)?.rating;

  const isCanceledOrder = (status: string) => status === 'Cancelado';

  if (userLoading || isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-8">
        Erro ao carregar pedidos: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Meus Pedidos</h1>
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as 'all' | 'paid' | 'canceled')}>
          <SelectTrigger className="w-full md:w-[240px]">
            <SelectValue placeholder="Filtrar pedidos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pedidos</SelectItem>
            <SelectItem value="paid">Pagos e finalizados</SelectItem>
            <SelectItem value="canceled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {filteredOrders.length === 0 ? (
          <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
        ) : (
          filteredOrders.map(order => {
            const canceled = isCanceledOrder(order.status);
            return (
              <Card
                key={order.id}
                className={canceled ? 'border-red-300 bg-red-50/70 shadow-sm' : ''}
              >
                <CardHeader className={canceled ? 'border-b border-red-200 bg-red-50/80' : ''}>
                  <CardTitle className={canceled ? 'text-red-700' : ''}>Pedido #{order.id}</CardTitle>
                  <CardDescription className={canceled ? 'text-red-700/80' : ''}>
                    Realizado em {new Date(order.created_at).toLocaleDateString('pt-BR')} — Status: {order.status}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Produtos</span>
                      <span>{formatCurrency(order.total_price)}</span>
                    </div>

                    {order.shipping_cost > 0 ? (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Frete</span>
                        <span>{formatCurrency(order.shipping_cost)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs text-green-600 font-medium">
                        <span>Frete</span>
                        <span>Grátis</span>
                      </div>
                    )}

                    {order.donation_amount > 0 && (
                      <div className="flex justify-between text-xs text-rose-600 font-bold">
                        <span>Doação Solidária</span>
                        <span>{formatCurrency(order.donation_amount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-dashed">
                      <span className="text-sm font-bold">Total Pago</span>
                      <span className="text-sm font-bold">
                        {formatCurrency(order.total_price + (order.shipping_cost || 0) + (order.donation_amount || 0))}
                      </span>
                    </div>
                  </div>

                  <ul className="divide-y">
                    {order.order_items.map(item => (
                      <li key={item.id} className="py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {item.image_url_at_purchase ? (
                            <img
                              src={item.image_url_at_purchase}
                              alt={item.name_at_purchase}
                              className="h-16 w-16 rounded-md object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                              <Package className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link to={`/produto/${item.item_id}`} className="font-semibold hover:underline line-clamp-2">
                              {item.name_at_purchase}
                            </Link>
                            <p className="text-sm text-muted-foreground">Quantidade: {item.quantity}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {hasReview(item.item_id, order.id) ? (
                            <div className="flex items-center gap-1 text-yellow-500">
                              {[...Array(getReviewRating(item.item_id, order.id))].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-current" />
                              ))}
                              <span className="text-xs text-muted-foreground ml-1">(Avaliado)</span>
                            </div>
                          ) : (
                            <ReviewButton item={item} orderId={order.id} />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <SalesPopupDisplay />
    </div>
  );
};

export default MyOrdersPage;
