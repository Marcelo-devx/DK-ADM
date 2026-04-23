import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
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

const ITEMS_PER_PAGE = 10;

const fetchOrders = async (userId: string) => {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (ordersError) throw new Error(ordersError.message);

  const orderIds = (orders || []).map(o => o.id);
  
  let reviews: Review[] = [];
  let editedOrderIds = new Set<number>();

  if (orderIds.length > 0) {
    const [reviewsResult, historyResult] = await Promise.all([
      supabase
        .from('reviews')
        .select('product_id, order_id, rating')
        .in('order_id', orderIds)
        .eq('user_id', userId),
      supabase
        .from('order_history')
        .select('order_id')
        .in('order_id', orderIds)
        .eq('change_type', 'items_edited'),
    ]);

    if (reviewsResult.error) console.error("Error fetching reviews:", reviewsResult.error.message);
    reviews = reviewsResult.data || [];

    if (historyResult.data) {
      historyResult.data.forEach((h: any) => editedOrderIds.add(h.order_id));
    }
  }

  return { orders: orders || [], reviews, editedOrderIds };
};

const MyOrdersPage = () => {
  const { user } = useUser();
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState<"all" | "paid" | "canceled">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error } = useQuery<{ orders: Order[], reviews: Review[], editedOrderIds: Set<number> }>({
    queryKey: ['orders', user?.id],
    queryFn: () => fetchOrders(user!.id),
    enabled: !!user,
  });

  const filteredOrders = useMemo(() => {
    const orders = data?.orders || [];
    if (viewFilter === "paid") {
      return orders.filter(order => order.status === "Pago" || order.status === "Finalizada");
    }
    if (viewFilter === "canceled") {
      return orders.filter(order => order.status === "Cancelado");
    }
    return orders;
  }, [data?.orders, viewFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleFilterChange = (value: "all" | "paid" | "canceled") => {
    setViewFilter(value);
    setCurrentPage(1);
  };

  const hasReview = (productId: number, orderId: number) => {
    return data?.reviews.some(r => r.product_id === productId && r.order_id === orderId);
  };

  const getReviewRating = (productId: number, orderId: number) => {
    return data?.reviews.find(r => r.product_id === productId && r.order_id === orderId)?.rating;
  };

  const isCanceledOrder = (status: string) => status === 'Cancelado';

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-4 md:px-8 md:py-8">
        <Skeleton className="h-8 w-40 mb-4" />
        <div className="space-y-4 md:space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 px-4 py-8">Erro ao carregar pedidos: {(error as Error).message}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-4 md:px-8 md:py-8">
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Meus Pedidos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus pedidos e avaliações.</p>
        </div>
        <Select value={viewFilter} onValueChange={handleFilterChange}>
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

      <div className="space-y-4 md:space-y-6">
        {filteredOrders.length === 0 ? (
          <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
        ) : (
          paginatedOrders.map(order => {
            const canceled = isCanceledOrder(order.status);
            const wasEdited = data?.editedOrderIds.has(order.id);
            return (
              <Card
                key={order.id}
                className={canceled ? 'border-red-300 bg-red-50/70 shadow-sm' : 'shadow-sm'}
              >
                <CardHeader className={canceled ? 'border-b border-red-200 bg-red-50/80 p-4 md:p-6' : 'p-4 md:p-6'}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <CardTitle className={canceled ? 'text-red-700 text-lg md:text-xl' : 'text-lg md:text-xl'}>
                      Pedido #{order.id}
                    </CardTitle>
                    {wasEdited && (
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 border-amber-400 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 shrink-0"
                      >
                        <Pencil className="h-3 w-3" />
                        Pedido atualizado pela loja
                      </Badge>
                    )}
                  </div>
                  <CardDescription className={canceled ? 'text-red-700/80 text-sm' : 'text-sm'}>
                    Realizado em {new Date(order.created_at).toLocaleDateString('pt-BR')} - Status: {order.status}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                    <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>Produtos</span>
                      <span className="text-right">{formatCurrency(order.total_price)}</span>
                    </div>
                    
                    {order.shipping_cost > 0 ? (
                      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                        <span>Frete</span>
                        <span className="text-right">{formatCurrency(order.shipping_cost)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-3 text-xs text-green-600 font-medium">
                        <span>Frete</span>
                        <span>Grátis</span>
                      </div>
                    )}

                    {order.donation_amount > 0 && (
                      <div className="flex justify-between gap-3 text-xs text-rose-600 font-bold">
                        <span>Doação Solidária</span>
                        <span className="text-right">{formatCurrency(order.donation_amount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-2 border-t border-dashed">
                      <span className="text-sm font-bold">Total Pago</span>
                      <span className="text-sm font-bold text-right">{formatCurrency(order.total_price + (order.shipping_cost || 0) + (order.donation_amount || 0))}</span>
                    </div>
                  </div>
                  <ul className="divide-y mt-4">
                    {order.order_items.map(item => (
                      <li key={item.id} className="py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={item.image_url_at_purchase || ''} alt={item.name_at_purchase} className="h-14 w-14 rounded-md object-cover shrink-0" />
                          <div className="min-w-0">
                            <Link to={`/produto/${item.item_id}`} className="font-semibold hover:underline line-clamp-2">
                              {item.name_at_purchase}
                            </Link>
                            <p className="text-sm text-muted-foreground">Quantidade: {item.quantity}</p>
                          </div>
                        </div>
                        <div className="self-start sm:self-center">
                          {hasReview(item.item_id, order.id) ? (
                             <div className="flex items-center gap-1 text-yellow-500 flex-wrap">
                               {[...Array(getReviewRating(item.item_id, order.id))].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
                               <span className="text-sm text-muted-foreground ml-1">(Avaliado)</span>
                             </div>
                          ) : (
                            <Dialog open={isReviewModalOpen} onOpenChange={setReviewModalOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-auto">Avaliar Produto</Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Avaliar: {item.name_at_purchase}</DialogTitle>
                                </DialogHeader>
                                <ReviewForm
                                  productId={item.item_id}
                                  orderId={order.id}
                                  onSuccess={() => setReviewModalOpen(false)}
                                />
                              </DialogContent>
                            </Dialog>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 gap-2">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} &mdash; {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={item}
                    variant={currentPage === item ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setCurrentPage(item as number)}
                  >
                    {item}
                  </Button>
                )
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      <SalesPopupDisplay />
    </div>
  );
};

export default MyOrdersPage;