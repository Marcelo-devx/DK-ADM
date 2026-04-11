import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  force_pix_on_next_purchase: boolean | null;
  is_credit_card_enabled: boolean | null;
  is_blocked: boolean;
  created_at: string;
  role: string;
}

export interface UpdateUserPayload {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  role?: string;
  force_pix_on_next_purchase?: boolean;
  is_credit_card_enabled?: boolean;
}

export const PAGE_SIZE = 50;

const SELECTED_FIELDS =
  'id, first_name, last_name, cpf_cnpj, email, phone, date_of_birth, gender, ' +
  'cep, street, number, complement, neighborhood, city, state, ' +
  'force_pix_on_next_purchase, is_credit_card_enabled, ' +
  'is_blocked, created_at, role';

export const useUserAdmin = (searchTerm: string = '', page: number = 0) => {
  const queryClient = useQueryClient();

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // ── Contagem total (para calcular número de páginas) ──
  const countQuery = useQuery<number, Error>({
    queryKey: ['adminUsersCount', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(
          `cpf_cnpj.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`
        );
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    refetchOnWindowFocus: false,
  });

  // ── Página atual de usuários ──
  const searchUsers = useQuery<AdminUser[], Error>({
    queryKey: ['adminUsers', searchTerm, page],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(SELECTED_FIELDS)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(
          `cpf_cnpj.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AdminUser[];
    },
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // mantém dados anteriores enquanto carrega próxima página
  });

  // ── Bloquear / Desbloquear ──
  const blockUserMutation = useMutation({
    mutationFn: async ({ userId, isBlocked, reason }: { userId: string; isBlocked: boolean; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-block-user', {
        body: { userId, isBlocked, reason }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsersCount'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // ── Excluir ──
  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, deleteOrders, reason }: { userId: string; deleteOrders: boolean; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId, deleteOrders, reason }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsersCount'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // ── Editar dados (RLS: "Admins can update any profile") ──
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const totalPages = Math.ceil((countQuery.data ?? 0) / PAGE_SIZE);

  return {
    searchUsers,
    countQuery,
    totalPages,
    blockUserMutation,
    deleteUserMutation,
    updateUserMutation,
  };
};