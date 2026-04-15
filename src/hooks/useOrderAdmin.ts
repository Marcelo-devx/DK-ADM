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
    // Busca pedido sem join (evita erro de schema cache)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId);

    if (ordersError) {
      throw ordersError;
    }

    if (!orders || orders.length === 0) {
      return null;
    }

    const order = orders[0];

    // Busca profile separadamente se houver user_id
    let profile = null;
    if (order.user_id) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('id', order.user_id)
        .single();

      if (!profilesError && profiles) {
        profile = profiles;
      }
    }

    // Retorna o pedido com os dados do profile
    return {
      ...order,
      profiles: profile,
    } as Order;
  };

  // Busca unificada por ID, CPF ou Nome do cliente
  const searchOrdersByQuery = async (query: string): Promise<Order[]> => {
    if (!query || query.trim() === '') {
      return [];
    }

    const trimmedQuery = query.trim();
    
    // Verifica se é um número (ID do pedido)
    const numericQuery = parseInt(trimmedQuery, 10);
    if (!isNaN(numericQuery) && trimmedQuery === numericQuery.toString()) {
      const order = await searchOrderById(numericQuery);
      return order ? [order] : [];
    }

    // Verifica se é apenas dígitos (CPF sem formatação)
    const digitsOnly = trimmedQuery.replace(/\D/g, '');
    if (digitsOnly === trimmedQuery) {
      // Busca por CPF
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, cpf_cnpj');

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      // Filtra profiles pelo CPF
      const matchingProfiles = profiles.filter(p => {
        if (!p.cpf_cnpj) return false;
        const cpfDigits = p.cpf_cnpj.replace(/\D/g, '');
        return cpfDigits.includes(digitsOnly);
      });

      if (matchingProfiles.length === 0) return [];

      // Busca pedidos dos profiles encontrados
      const userIds = matchingProfiles.map(p => p.id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      if (!orders) return [];

      const profilesMap = new Map(matchingProfiles.map(p => [p.id, p]));

      return orders.map(order => ({
        ...order,
        profiles: profilesMap.get(order.user_id) || null,
      })) as Order[];
    }

    // Caso contrário, busca por nome do cliente
    const searchTerm = trimmedQuery.toLowerCase();
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, cpf_cnpj');

    if (profilesError) throw profilesError;
    if (!profiles) return [];

    // Filtra profiles pelo nome
    const matchingProfiles = profiles.filter(p => {
      const firstName = (p.first_name || '').toLowerCase();
      const lastName = (p.last_name || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      return firstName.includes(searchTerm) ||
             lastName.includes(searchTerm) ||
             fullName.includes(searchTerm);
    });

    if (matchingProfiles.length === 0) return [];

    // Busca pedidos dos profiles encontrados
    const userIds = matchingProfiles.map(p => p.id);
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders) return [];

    const profilesMap = new Map(matchingProfiles.map(p => [p.id, p]));

    return orders.map(order => ({
      ...order,
      profiles: profilesMap.get(order.user_id) || null,
    })) as Order[];
  };

  // Busca avançada de pedidos
  const searchOrdersAdvanced = async (filters: OrderFilters): Promise<Order[]> => {
    // Busca pedidos sem join (evita erro de schema cache)
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Aplicar filtros por nome
    // Como não podemos usar join no select, vamos buscar todos e filtrar no código
    // ou fazer uma busca separada de profiles por email/telefone
    
    // Aplicar filtros diretos na tabela orders
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

    // Coleta user_ids únicos
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];

    // Busca profiles separadamente
    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', userIds);

      if (!profilesError && profilesData) {
        profiles = profilesData;
      }
    }

    // Cria mapa de profiles
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    // Faz o merge dos dados
    let mergedOrders = orders.map(order => ({
      ...order,
      profiles: profilesMap.get(order.user_id) || null,
    }));

    // Aplica filtros que dependem de profiles (cliente, email, telefone)
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
      const searchTerm = filters.phone.replace(/\D/g, ''); // Remove não-dígitos
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
    const { data, error } = await supabase.functions.invoke('admin-get-order-history', {
      body: { orderId },
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Error fetching history');
    return data.history || [];
  };

  // Atualizar pedido
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, updates, reason }: { orderId: number; updates: any; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-update-order', {
        body: { orderId, updates, reason },
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
        body: { orderId, reason, returnStock },
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
        body: { orderId, reason },
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
    searchOrdersByQuery,
    getOrderHistory,
    updateOrderMutation,
    cancelOrderMutation,
    deleteOrderMutation,
  };
};