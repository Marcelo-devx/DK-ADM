import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";

export const SessionContext = createContext<Session | null>(null);

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000; // 15 segundos (era 5s)
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const SessionContextProvider = (props: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const navigate = useNavigate();

  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const getSessionWithTimeout = async (timeoutMs: number = TIMEOUT_MS) => {
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

  const loadSession = useCallback(async (attempt = 1) => {
    try {
      console.log(`[SessionContext] Tentativa ${attempt} de carregar sessão...`);
      setNetworkError(false);

      const { data: { session }, error } = await getSessionWithTimeout();

      if (error) {
        console.error('[SessionContext] Erro ao obter sessão:', error);

        if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          setTimeout(() => navigateRef.current('/login'), 0);
          setInitializing(false);
          return;
        }

        if (error.message?.includes('timeout') || error.message?.includes('network') || error.message?.includes('fetch')) {
          if (attempt < MAX_RETRIES) {
            console.warn(`[SessionContext] Timeout/rede na tentativa ${attempt}, tentando novamente em ${RETRY_DELAY_MS}ms...`);
            await sleep(RETRY_DELAY_MS);
            return loadSession(attempt + 1);
          } else {
            console.error('[SessionContext] Todas as tentativas falharam. Exibindo erro de rede.');
            setNetworkError(true);
            setInitializing(false);
            return;
          }
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
    } catch (error: any) {
      console.error('[SessionContext] Erro inesperado ao obter sessão:', error);

      const isNetworkIssue =
        error?.message?.includes('timeout') ||
        error?.message?.includes('network') ||
        error?.message?.includes('fetch') ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError');

      if (isNetworkIssue && attempt < MAX_RETRIES) {
        console.warn(`[SessionContext] Problema de rede na tentativa ${attempt}, tentando novamente em ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        return loadSession(attempt + 1);
      }

      if (isNetworkIssue) {
        console.error('[SessionContext] Todas as tentativas falharam. Exibindo erro de rede.');
        setNetworkError(true);
      } else {
        setSession(null);
      }

      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await loadSession();
    };

    run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (event === 'TOKEN_REFRESHED') {
          setSession(prev => {
            if (prev?.access_token === session?.access_token) return prev;
            return session;
          });
        } else if (event === 'SIGNED_IN') {
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
  }, [loadSession]);

  if (initializing) {
    return <LoadingScreen message="Carregando sua sessão..." />;
  }

  if (networkError) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Problema de conexão</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Se estiver no WiFi, tente desconectar e reconectar, ou use dados móveis.
            </p>
          </div>
          <button
            onClick={() => {
              setNetworkError(false);
              setInitializing(true);
              loadSession();
            }}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
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
