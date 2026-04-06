import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  is_blocked: boolean;
  created_at: string;
  role: string;
}

export const useUserAdmin = (searchTerm: string = '') => {
  const queryClient = useQueryClient();

  // Buscar usuários por nome - busca no banco de dados
  const searchUsers = useQuery<User[], Error>({
    queryKey: ['adminUsers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, is_blocked, created_at, role')
        .order('created_at', { ascending: false });

      // Se tiver termo de busca, filtrar no banco
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        query = query.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%`
        );
      }
      // SEM LIMITE - busca todos os usuários

      const { data: profiles, error } = await query;

      if (error) throw error;

      return profiles.map(p => ({
        ...p,
        email: undefined // Email não está disponível na tabela profiles
      })) as User[];
    },
    refetchOnWindowFocus: false,
    enabled: true, // Sempre habilitado
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

  return {
    searchUsers,
    blockUserMutation,
    deleteUserMutation,
  };
};
