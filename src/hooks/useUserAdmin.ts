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

const SELECT_FIELDS =
  "id, first_name, last_name, cpf_cnpj, email, phone, date_of_birth, gender, " +
  "cep, street, number, complement, neighborhood, city, state, " +
  "force_pix_on_next_purchase, is_credit_card_enabled, " +
  "is_blocked, created_at, role";

async function fetchUsers(searchTerm: string, page: number): Promise<{ users: AdminUser[]; total: number }> {
  const term = searchTerm.trim();
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from('profiles').select(SELECT_FIELDS, { count: 'exact' });

  if (term) {
    const likeTerm = `%${term}%`;
    query = query.or(
      `email.ilike.${likeTerm},cpf_cnpj.ilike.${likeTerm},phone.ilike.${likeTerm},first_name.ilike.${likeTerm},last_name.ilike.${likeTerm}`
    );
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  return { users: (data as unknown as AdminUser[]) ?? [], total: count ?? 0 };
}

export const useUserAdmin = (searchTerm: string = '', page: number = 0) => {
  const queryClient = useQueryClient();

  // ── Query principal: busca usuários + total via edge function (service_role) ──
  const usersQuery = useQuery<{ users: AdminUser[]; total: number }, Error>({
    queryKey: ['adminUsers', searchTerm, page],
    queryFn: () => fetchUsers(searchTerm, page),
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    staleTime: 30_000,   // considera dados frescos por 30s, evita refetch desnecessário
    retry: 1,
  });

  // isFetching = true só quando está buscando novos dados (não bloqueia UI com placeholder)
  const isLoadingFirst = usersQuery.isLoading; // sem dados ainda
  const isFetching = usersQuery.isFetching;    // buscando em background

  const searchUsers = {
    data: usersQuery.data?.users,
    isLoading: isLoadingFirst,  // skeleton só na primeira carga
    isFetching,                 // indicador sutil nas trocas de página/busca
    error: usersQuery.error,
  };

  const countQuery = {
    data: usersQuery.data?.total,
    isLoading: isLoadingFirst,
  };

  const totalPages = Math.ceil((usersQuery.data?.total ?? 0) / PAGE_SIZE);

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
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // ── Editar dados ──
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

  return {
    searchUsers,
    countQuery,
    totalPages,
    blockUserMutation,
    deleteUserMutation,
    updateUserMutation,
  };
};