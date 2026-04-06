import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  delivery_info: string | null;
  payment_method: string | null;
  shipping_address: any;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

interface OrderHistoryEntry {
  id: number;
  order_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  change_type: 'status' | 'value' | 'address' | 'cancel' | 'delete';
  reason: string | null;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export interface OrderFilters {
  clientName: string;
  email: string;
  phone: string;
  status: string;
  dateStart: string;
  dateEnd: string;
}

export const useOrderAdmin = () => {
  const queryClient = useQueryClient();

  // Buscar pedido por ID
  const searchOrder = useQuery<Order, Error>({
    queryKey: ['adminOrder'],
    queryFn: async () => {
      throw new Error('Use searchOrderById instead');
    },
    enabled: false,
  });

  const searchOrderById = async (orderId: number): Promise<Order | null> => {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profiles(first_name, last_name, phone)')
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return order as Order;
  };

  // Busca avançada de pedidos
  const searchOrdersAdvanced = async (filters: OrderFilters): Promise<Order[]> => {
    let query = supabase
      .from('orders')
      .select('*, profiles(first_name, last_name, email, phone)')
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (filters.clientName) {
      query = query.or(`profiles.first_name.ilike.%${filters.clientName}%,profiles.last_name.ilike.%${filters.clientName}%`);
    }

    if (filters.email) {
      query = query.ilike('profiles.email', `%${filters.email}%`);
    }

    if (filters.phone) {
      query = query.ilike('profiles.phone', `%${filters.phone}%`);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.dateStart) {
      query = query.gte('created_at', filters.dateStart);
    }

    if (filters.dateEnd) {
      const endDate = new Date(filters.dateEnd);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as Order[];
  };

  // Buscar histórico do pedido
  const getOrderHistory = async (orderId: number): Promise<OrderHistoryEntry[]> => {
    const { data, error } = await supabase.functions.invoke('admin-get-order-history', {
      body: { orderId }
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Error fetching history');

    return data.history || [];
  };

  // Atualizar pedido
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, updates, reason }: { orderId: number; updates: any; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-update-order', {
        body: { orderId, updates, reason }
      });
      
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrder'] });
      queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
    },
  });

  // Cancelar pedido
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason, returnStock }: { orderId: number; reason: string; returnStock: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-cancel-order', {
        body: { orderId, reason, returnStock }
      });
      
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrder'] });
      queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
    },
  });

  // Excluir pedido
  const deleteOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-order', {
        body: { orderId, reason }
      });
      
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrder'] });
      queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
    },
  });

  return {
    searchOrderById,
    searchOrdersAdvanced,
    getOrderHistory,
    updateOrderMutation,
    cancelOrderMutation,
    deleteOrderMutation,
  };
};