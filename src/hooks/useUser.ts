import { useState, useEffect } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  role: string;
}

export const useUser = () => {
  const session = useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!user?.id);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLogistica, setIsLogistica] = useState(false);
  const [isGerente, setIsGerente] = useState(false);
  const [isGerenteGeral, setIsGerenteGeral] = useState(false);
  const [role, setRole] = useState<string>('user');

  const userId = user?.id;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setLoading(false);
        setProfile(null);
        setIsAdmin(false);
        setIsLogistica(false);
        setIsGerente(false);
        setIsGerenteGeral(false);
        setRole('user');
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, first_name, last_name')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('[useUser] Erro ao buscar profile:', error.message);
          setIsAdmin(false);
          setIsLogistica(false);
          setIsGerente(false);
          setIsGerenteGeral(false);
          setRole('user');
          setProfile(null);
        } else if (data) {
          setProfile(data as Profile);
          setRole(data.role);
          setIsAdmin(data.role === 'adm');
          setIsGerenteGeral(data.role === 'gerente_geral');
          setIsGerente(data.role === 'gerente' || data.role === 'gerente_geral');
          setIsLogistica(data.role === 'logistica' || data.role === 'gerente' || data.role === 'gerente_geral');
        }
      } catch (e) {
        if (e instanceof Error) {
          console.error('[useUser] Erro inesperado:', e.message);
        } else {
          console.error('[useUser] Erro inesperado:', e);
        }
        setIsAdmin(false);
        setIsLogistica(false);
        setIsGerente(false);
        setIsGerenteGeral(false);
        setRole('user');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  return { user, profile, loading, isAdmin, isLogistica, isGerente, isGerenteGeral, role };
};