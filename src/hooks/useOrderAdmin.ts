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
    email: string | null;
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
  profiles?: {
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
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId);

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return null;

    const order = orders[0];

    let profile = null;
    if (order.user_id) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('id', order.user_id)
        .single();

      if (!profilesError && profiles) profile = profiles;
    }

    return { ...order, profiles: profile } as Order;
  };

  // Busca unificada por ID, CPF ou Nome do cliente
  const searchOrdersByQuery = async (query: string): Promise<Order[]> => {
    if (!query || query.trim() === '') return [];

    const trimmedQuery = query.trim();

    // Número → ID do pedido
    const numericQuery = parseInt(trimmedQuery, 10);
    if (!isNaN(numericQuery) && trimmedQuery === numericQuery.toString()) {
      const order = await searchOrderById(numericQuery);
      return order ? [order] : [];
    }

    // Só dígitos → CPF
    const digitsOnly = trimmedQuery.replace(/\D/g, '');
    if (digitsOnly === trimmedQuery) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, cpf_cnpj');

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      const matchingProfiles = profiles.filter(p => {
        if (!p.cpf_cnpj) return false;
        return p.cpf_cnpj.replace(/\D/g, '').includes(digitsOnly);
      });

      if (matchingProfiles.length === 0) return [];

      const userIds = matchingProfiles.map(p => p.id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      if (!orders) return [];

      const profilesMap = new Map(matchingProfiles.map(p => [p.id, p]));
      return orders.map(order => ({ ...order, profiles: profilesMap.get(order.user_id) || null })) as Order[];
    }

    // Nome ou email → usa edge function (service_role) para buscar profiles sem restrição de RLS
    const searchTerm = trimmedQuery.toLowerCase();
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    let matchingProfiles: any[] = [];

    if (token) {
      try {
        const res = await fetch(
          'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/admin-list-users',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ searchTerm: trimmedQuery, page: 0, pageSize: 200 }),
          }
        );
        if (res.ok) {
          const json = await res.json();
          matchingProfiles = json.users ?? [];
        }
      } catch (e) {
        console.error('[useOrderAdmin] Erro ao buscar profiles via edge function:', e);
      }
    }

    // Fallback: busca local via RLS (pode não retornar todos)
    if (matchingProfiles.length === 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, cpf_cnpj, email');

      matchingProfiles = (profiles ?? []).filter(p => {
        const firstName = (p.first_name || '').toLowerCase();
        const lastName = (p.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const email = (p.email || '').toLowerCase();
        return firstName.includes(searchTerm) || lastName.includes(searchTerm) ||
               fullName.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    if (matchingProfiles.length === 0) {
      // Tenta também buscar por guest_email diretamente na tabela orders
      const { data: guestOrders, error: guestError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .ilike('guest_email', `%${trimmedQuery}%`)
        .order('created_at', { ascending: false });

      if (!guestError && guestOrders && guestOrders.length > 0) {
        return guestOrders.map(o => ({ ...o, profiles: null })) as Order[];
      }
      return [];
    }

    const userIds = matchingProfiles.map((p: any) => p.id);
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders) return [];

    const profilesMap = new Map(matchingProfiles.map((p: any) => [p.id, p]));
    return orders.map(order => ({ ...order, profiles: profilesMap.get(order.user_id) || null })) as Order[];
  };

  // Busca avançada de pedidos
  const searchOrdersAdvanced = async (filters: OrderFilters): Promise<Order[]> => {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

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

    const { data: orders, error: ordersError } = await query;

    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return [];
    }

    // Se há filtro de email ou nome, usa edge function para buscar profiles sem RLS
    let profilesFromEdge: any[] | null = null;
    if (filters.email || filters.clientName) {
      const searchTerm = filters.email || filters.clientName;
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (token) {
        try {
          const res = await fetch(
            'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/admin-list-users',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ searchTerm, page: 0, pageSize: 200 }),
            }
          );
          if (res.ok) {
            const json = await res.json();
            profilesFromEdge = json.users ?? [];
          }
        } catch (e) {
          console.error('[useOrderAdmin] Erro ao buscar profiles via edge function:', e);
        }
      }
    }

    // Coleta user_ids únicos dos pedidos
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];

    // Busca profiles separadamente
    let profiles: any[] = [];
    if (profilesFromEdge !== null) {
      // Usa os profiles retornados pela edge function
      profiles = profilesFromEdge;
    } else if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', userIds);

      if (!profilesError && profilesData) {
        profiles = profilesData;
      }
    }

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    let mergedOrders = orders.map(order => ({
      ...order,
      profiles: profilesMap.get(order.user_id) || null,
    }));

    // Aplica filtros que dependem de profiles
    if (filters.clientName) {
      const searchTerm = filters.clientName.toLowerCase();
      mergedOrders = mergedOrders.filter(order => {
        const profile = order.profiles;
        if (!profile) return false;
        const firstName = (profile.first_name || '').toLowerCase();
        const lastName = (profile.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        return firstName.includes(searchTerm) ||
               lastName.includes(searchTerm) ||
               fullName.includes(searchTerm);
      });
    }

    if (filters.email) {
      const searchTerm = filters.email.toLowerCase();
      mergedOrders = mergedOrders.filter(order => {
        const profile = order.profiles;
        if (!profile) return false;
        const email = (profile.email || '').toLowerCase();
        return email.includes(searchTerm);
      });
    }

    if (filters.phone) {
      const searchTerm = filters.phone.replace(/\D/g, '');
      mergedOrders = mergedOrders.filter(order => {
        const profile = order.profiles;
        if (!profile) return false;
        const phone = (profile.phone || '').replace(/\D/g, '');
        return phone.includes(searchTerm);
      });
    }

    return mergedOrders as Order[];
  };

  // Buscar histórico do pedido
  const getOrderHistory = async (orderId: number): Promise<OrderHistoryEntry[]> => {
    const { data, error } = await supabase
      .from('order_history')
      .select('id, order_id, field_name, old_value, new_value, changed_at, change_type, reason, changed_by')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  // Atualizar pedido
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, updates }: { orderId: number; updates: any; reason: string }) => {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrder'] });
      queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
    },
  });

  // Cancelar pedido — UPDATE direto no banco (sem edge function, sem cold start)
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string; returnStock?: boolean }) => {
      // 1. Busca status atual para registrar no histórico
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      const oldStatus = orderData?.status ?? 'Desconhecido';

      // 2. Atualiza o status para Cancelado (a RLS permite adm/gerente_geral/gerente)
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'Cancelado' })
        .eq('id', orderId);

      if (updateError) throw new Error(updateError.message);

      // 3. Registra no histórico (best-effort, não bloqueia em caso de erro)
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_history').insert({
        order_id: orderId,
        field_name: 'status',
        old_value: oldStatus,
        new_value: 'Cancelado',
        changed_by: user?.id ?? null,
        change_type: 'cancel',
        reason: reason,
      });

      return { success: true, orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrder'] });
      queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
    },
  });

  // Excluir pedido — direto no banco, sem edge function (sem cold start)
  const deleteOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      // 1. Verifica se o pedido está Cancelado
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw new Error(fetchError.message);
      if (!order) throw new Error('Pedido não encontrado');
      if (order.status !== 'Cancelado') {
        throw new Error(`Não é possível excluir um pedido com status "${order.status}". Cancele o pedido primeiro.`);
      }

      const { data: { user } } = await supabase.auth.getUser();

      // 2. Salva snapshot no histórico antes de deletar (best-effort)
      await supabase.from('order_history').insert({
        order_id: orderId,
        field_name: 'deleted',
        old_value: JSON.stringify(order),
        new_value: null,
        change_type: 'delete',
        reason: reason,
        changed_by: user?.id ?? null,
      });

      // 3. Deleta registros filhos
      await supabase.from('order_items').delete().eq('order_id', orderId);
      await supabase.from('reviews').delete().eq('order_id', orderId);
      await supabase.from('route_stops').delete().eq('order_id', orderId);
      await supabase.from('primeiros_pedidos').delete().eq('order_id', orderId);
      await supabase.from('user_coupons').update({ order_id: null }).eq('order_id', orderId);
      await supabase.from('loyalty_history').update({ related_order_id: null }).eq('related_order_id', orderId);
      await supabase.from('order_history').delete().eq('order_id', orderId);

      // 4. Deleta o pedido principal
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId);
      if (deleteError) throw new Error(deleteError.message);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrder'] });
      queryClient.invalidateQueries({ queryKey: ['ordersAdmin'] });
    },
  });

  return {
    searchOrderById,
    searchOrdersAdvanced,
    searchOrdersByQuery,
    getOrderHistory,
    updateOrderMutation,
    cancelOrderMutation,
    deleteOrderMutation,
  };
};