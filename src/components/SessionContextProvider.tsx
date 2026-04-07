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

  // Função utilitária com timeout para evitar deadlock no getSession
  const getSessionWithTimeout = async (timeoutMs: number = 5000) => {
    return Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session load timeout')), timeoutMs)
      )
    ]);
  };

  // Versão não-bloqueante do checkIfBlocked - executa em background
  const checkIfBlockedNonBlocking = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_blocked')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[SessionContext] Erro ao verificar bloqueio:', error);
        return;
      }

      if (profile?.is_blocked) {
        // Fazer signOut se usuário bloqueado
        await supabase.auth.signOut();
        setSession(null);
        toast.error('Sua conta foi bloqueada. Entre em contato com o suporte.');
        // Redirecionar para login
        setTimeout(() => navigateRef.current('/login'), 100);
      }
    } catch (error) {
      console.error('[SessionContext] Erro ao verificar bloqueio:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    getSessionWithTimeout()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;

        if (error) {
          console.error('[SessionContext] Erro ao obter sessão:', error);

          if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
            toast.error('Sessão expirada. Por favor, faça login novamente.');
            setTimeout(() => navigateRef.current('/login'), 0);
          } else if (error.message?.includes('timeout')) {
            console.error('[SessionContext] Timeout ao carregar sessão - prosseguindo sem sessão');
          }

          setInitializing(false);
          return;
        }

        if (session?.user) {
          // Executar check de bloqueio em background (não-bloqueante)
          checkIfBlockedNonBlocking(session.user.id);
          setSession(session);
        } else {
          setSession(session);
        }

        setInitializing(false);
      })
      .catch((error: Error) => {
        if (!mounted) return;

        console.error('[SessionContext] Erro inesperado ao obter sessão:', error);
        
        if (error?.message?.includes('timeout')) {
          console.error('[SessionContext] Timeout - definindo sessão como null');
          setSession(null);
        }

        setInitializing(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // IMPORTANTE: Removido 'async' e 'await' para evitar deadlock no navigator.locks
      // O callback agora é síncrono, liberando o lock imediatamente
      
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            // Executar check de bloqueio em background (fire-and-forget)
            checkIfBlockedNonBlocking(session.user.id);
          }
          setSession(session);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
        } else if (event === 'INITIAL_SESSION') {
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

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Quando a aba volta ao foco, tenta recuperar a sessão se não houver uma ativa
  // Adicionado flag para evitar múltiplas chamadas concorrentes
  useEffect(() => {
    let isRecoveringSession = false;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !session && !initializing && !isRecoveringSession) {
        console.log('[SessionContext] Aba voltou ao foco, tentando recuperar sessão...');
        
        isRecoveringSession = true;
        
        try {
          const { data, error } = await getSessionWithTimeout();
          
          if (data.session && !error) {
            console.log('[SessionContext] Sessão recuperada com sucesso');
            setSession(data.session);
          } else if (error?.message?.includes('timeout')) {
            console.error('[SessionContext] Timeout ao recuperar sessão na visibilidade');
          }
        } catch (e) {
          console.error('[SessionContext] Erro ao recuperar sessão na visibilidade:', e);
        } finally {
          isRecoveringSession = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      isRecoveringSession = false;
    };
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