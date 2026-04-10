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
  first_name?: string;
  last_name?: string;
  email?: string;
  cpf_cnpj?: string;
  phone?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  force_pix_on_next_purchase?: boolean;
  is_credit_card_enabled?: boolean;
}

export const useUserAdmin = (searchTerm: string = '') => {
  const queryClient = useQueryClient();

  // Buscar usuários — por nome, email ou CPF/CNPJ
  const searchUsers = useQuery<AdminUser[], Error>({
    queryKey: ['adminUsers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(
          'id, first_name, last_name, cpf_cnpj, email, phone, date_of_birth, gender, ' +
          'cep, street, number, complement, neighborhood, city, state, ' +
          'force_pix_on_next_purchase, is_credit_card_enabled, ' +
          'is_blocked, created_at, role'
        )
        .order('created_at', { ascending: false });

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        query = query.or(
          `cpf_cnpj.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AdminUser[];
    },
    refetchOnWindowFocus: false,
    enabled: true,
  });

  // Bloquear/Desbloquear usuário
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

  // Excluir usuário
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

  // Editar dados do usuário (admin pode atualizar qualquer perfil via RLS policy "Admins can update any profile")
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
    blockUserMutation,
    deleteUserMutation,
    updateUserMutation,
  };
};
