import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";

export const SessionContext = createContext<Session | null>(null);

export const SessionContextProvider = (props: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  // Usar ref para evitar stale closure do navigate dentro dos useEffects
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const checkIfBlocked = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_blocked')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[SessionContext] Erro ao verificar bloqueio:', error);
        return false;
      }

      if (profile?.is_blocked) {
        await supabase.auth.signOut();
        toast.error('Sua conta foi bloqueada. Entre em contato com o suporte.');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[SessionContext] Erro ao verificar bloqueio:', error);
      return false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('[SessionContext] Erro ao obter sessão:', error);

        if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          setTimeout(() => navigateRef.current('/login'), 0);
        }

        setInitializing(false);
        return;
      }

      if (session?.user) {
        const isBlocked = await checkIfBlocked(session.user.id);
        if (!isBlocked) {
          setSession(session);
        }
      } else {
        setSession(session);
      }

      setInitializing(false);
    }).catch((error: Error) => {
      console.error('[SessionContext] Erro inesperado ao obter sessão:', error);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          const isBlocked = await checkIfBlocked(session.user.id);
          if (!isBlocked) {
            setSession(session);
          } else {
            setSession(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (error: any) {
        console.error('[SessionContext] Erro no tratamento de estado de autenticação:', error);

        if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          setSession(null);
          setTimeout(() => navigateRef.current('/login'), 0);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Quando a aba volta ao foco, tenta recuperar a sessão se não houver uma ativa
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !session && !initializing) {
        console.log('[SessionContext] Aba voltou ao foco, tentando recuperar sessão...');
        try {
          const { data, error } = await supabase.auth.getSession();
          if (data.session && !error) {
            console.log('[SessionContext] Sessão recuperada com sucesso');
            setSession(data.session);
          }
        } catch (e) {
          console.error('[SessionContext] Erro ao recuperar sessão na visibilidade:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, initializing]);

  if (initializing) {
    return <LoadingScreen message="Carregando sua sessão..." />;
  }

  return (
    <SessionContext.Provider value={session}>
      {props.children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  return context;
};
