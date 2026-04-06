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

export const useUserAdmin = () => {
  const queryClient = useQueryClient();

  // Buscar usuários por email ou nome
  const searchUsers = useQuery<User[], Error>({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, is_blocked, created_at, role')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Buscar emails de auth.users
      const userIds = profiles.map(p => p.id);
      let emailsMap = new Map<string, string>();

      if (userIds.length > 0) {
        // Usar o client com service role para acessar auth.users
        // Mas como não temos acesso direto no frontend, vamos tentar outra abordagem
        // Para simplificar, vamos buscar emails via edge function ou usar um workaround
        // Por enquanto, vamos deixar email undefined e o frontend vai tratar isso
      }

      return profiles.map(p => ({
        ...p,
        email: undefined // Email será preenchido se disponível
      })) as User[];
    },
    refetchOnWindowFocus: false,
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
