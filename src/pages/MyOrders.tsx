import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

interface OrderItem {
  id: number;
  quantity: number;
  price_at_purchase: number;
  name_at_purchase: string;
  image_url_at_purchase: string | null;
  item_id: number; // product id
}

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
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

  const orderIds = orders.map(o => o.id);
  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('product_id, order_id, rating')
    .in('order_id', orderIds)
    .eq('user_id', userId);
  
  if (reviewsError) console.error("Error fetching reviews:", reviewsError.message);

  return { orders, reviews: reviews || [] };
};

const MyOrdersPage = () => {
  const { user, loading: userLoading } = useUser();
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{ orders: Order[], reviews: Review[] }>({
    queryKey: ['orders', user?.id],
    queryFn: () => fetchOrders(user!.id),
    enabled: !!user,
  });

  const hasReview = (productId: number, orderId: number) => {
    return data?.reviews.some(r => r.product_id === productId && r.order_id === orderId);
  };

  const getReviewRating = (productId: number, orderId: number) => {
    return data?.reviews.find(r => r.product_id === productId && r.order_id === orderId)?.rating;
  }

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
    return <div className="text-center text-red-500">Erro ao carregar pedidos: {(error as Error).message}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Meus Pedidos</h1>
        <Button asChild>
            <Link to="/checkout">Fazer um Novo Pedido (Teste)</Link>
        </Button>
      </div>
      <div className="space-y-6">
        {data?.orders.length === 0 ? (
          <p>Você ainda não fez nenhum pedido.</p>
        ) : (
          data?.orders.map(order => (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle>Pedido #{order.id}</CardTitle>
                <CardDescription>
                  Realizado em {new Date(order.created_at).toLocaleDateString('pt-BR')} - Status: {order.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {order.order_items.map(item => (
                    <li key={item.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <img src={item.image_url_at_purchase || ''} alt={item.name_at_purchase} className="h-16 w-16 rounded-md object-cover" />
                        <div>
                          <Link to={`/produto/${item.item_id}`} className="font-semibold hover:underline">
                            {item.name_at_purchase}
                          </Link>
                          <p className="text-sm text-muted-foreground">Quantidade: {item.quantity}</p>
                        </div>
                      </div>
                      <div>
                        {hasReview(item.item_id, order.id) ? (
                           <div className="flex items-center gap-1 text-yellow-500">
                             {[...Array(getReviewRating(item.item_id, order.id))].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
                             <span className="text-sm text-muted-foreground ml-1">(Avaliado)</span>
                           </div>
                        ) : (
                          <Dialog open={isReviewModalOpen} onOpenChange={setReviewModalOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline">Avaliar Produto</Button>
                            </DialogTrigger>
                            <DialogContent>
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
          ))
        )}
      </div>
    </div>
  );
};

export default MyOrdersPage;