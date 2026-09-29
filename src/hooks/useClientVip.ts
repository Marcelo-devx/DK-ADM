import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VipSearchResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
  is_vip: boolean;
}

async function searchProfiles(searchTerm: string): Promise<VipSearchResult[]> {
  if (!searchTerm.trim()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, cpf_cnpj, is_vip')
    .or(
      `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%`
    )
    .order('first_name', { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchVipClients(): Promise<VipSearchResult[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, cpf_cnpj, is_vip')
    .eq('is_vip', true)
    .order('first_name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export const useClientVip = (searchTerm: string) => {
  const queryClient = useQueryClient();

  const searchQuery = useQuery({
    queryKey: ['clientVipSearch', searchTerm],
    queryFn: () => searchProfiles(searchTerm),
    enabled: searchTerm.trim().length > 0,
  });

  const vipListQuery = useQuery({
    queryKey: ['clientVipList'],
    queryFn: fetchVipClients,
  });

  const setVipMutation = useMutation({
    mutationFn: async ({ userId, isVip }: { userId: string; isVip: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-set-vip', {
        body: { userId, isVip },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientVipSearch'] });
      queryClient.invalidateQueries({ queryKey: ['clientVipList'] });
    },
  });

  return { searchQuery, vipListQuery, setVipMutation };
};
