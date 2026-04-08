import { useState, useEffect } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'adm';
}

export const useUser = () => {
  const session = useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Usa o user.id como referência estável em vez do objeto user inteiro
  const userId = user?.id;

  useEffect(() => {
    const fetchUserProfile = async () => {
      // Se não há usuário, limpa o estado
      if (!userId) {
        setLoading(false);
        setProfile(null);
        setIsAdmin(false);
        return;
      }

      // Se há usuário, busca o profile
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('[useUser] Erro ao buscar profile:', error.message);
          setIsAdmin(false);
          setProfile(null);
        } else if (data) {
          setProfile(data as Profile);
          setIsAdmin(data.role === 'adm');
        }
      } catch (e) {
        if (e instanceof Error) {
          console.error('[useUser] Erro inesperado:', e.message);
        } else {
          console.error('[useUser] Erro inesperado:', e);
        }
        setIsAdmin(false);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  return { user, profile, loading, isAdmin };
};