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

  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const getSessionWithTimeout = async (timeoutMs: number = 5000) => {
    return Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session load timeout')), timeoutMs)
      )
    ]);
  };

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
        await supabase.auth.signOut();
        setSession(null);
        toast.error('Sua conta foi bloqueada. Entre em contato com o suporte.');
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
      try {
        if (event === 'TOKEN_REFRESHED') {
          // Só atualiza se o access_token realmente mudou — evita re-render desnecessário ao trocar de aba
          setSession(prev => {
            if (prev?.access_token === session?.access_token) return prev;
            return session;
          });
        } else if (event === 'SIGNED_IN') {
          // Também evita re-render se a sessão não mudou de verdade
          setSession(prev => {
            if (prev?.access_token === session?.access_token) return prev;
            if (session?.user) {
              checkIfBlockedNonBlocking(session.user.id);
            }
            return session;
          });
        } else if (event === 'SIGNED_OUT') {
          setSession(prev => {
            if (prev !== null) {
              // Havia sessão ativa — foi desconectado (ex: token expirado), redireciona para login
              setTimeout(() => navigateRef.current('/login'), 0);
            }
            return null;
          });
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