import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  role: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  const resetRoles = () => {
    setIsAdmin(false);
    setIsLogistica(false);
    setIsGerente(false);
    setIsGerenteGeral(false);
    setRole('user');
    setProfile(null);
  };

  const fetchUserProfile = useCallback(async (attempt = 1) => {
    if (!userId) {
      setLoading(false);
      resetRoles();
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
        const isNetworkError =
          error.message?.includes('fetch') ||
          error.message?.includes('network') ||
          error.message?.includes('timeout') ||
          error.message?.includes('Failed to fetch');

        if (isNetworkError && attempt < MAX_RETRIES) {
          console.warn(`[useUser] Erro de rede na tentativa ${attempt}, tentando novamente...`);
          await sleep(RETRY_DELAY_MS);
          return fetchUserProfile(attempt + 1);
        }

        console.error('[useUser] Erro ao buscar profile:', error.message);
        resetRoles();
      } else if (data) {
        setProfile(data as Profile);
        setRole(data.role);
        setIsAdmin(data.role === 'adm');
        setIsGerenteGeral(data.role === 'gerente_geral');
        setIsGerente(data.role === 'gerente' || data.role === 'gerente_geral');
        setIsLogistica(data.role === 'logistica' || data.role === 'gerente' || data.role === 'gerente_geral');
      }
    } catch (e: any) {
      const isNetworkError =
        e?.message?.includes('fetch') ||
        e?.message?.includes('network') ||
        e?.message?.includes('timeout') ||
        e?.message?.includes('Failed to fetch');

      if (isNetworkError && attempt < MAX_RETRIES) {
        console.warn(`[useUser] Erro de rede na tentativa ${attempt}, tentando novamente...`);
        await sleep(RETRY_DELAY_MS);
        return fetchUserProfile(attempt + 1);
      }

      console.error('[useUser] Erro inesperado:', e instanceof Error ? e.message : e);
      resetRoles();
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return { user, profile, loading, isAdmin, isLogistica, isGerente, isGerenteGeral, role };
};
