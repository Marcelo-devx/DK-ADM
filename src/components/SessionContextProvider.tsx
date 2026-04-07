import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const SessionContext = createContext<Session | null>(null);

export const SessionContextProvider = (props: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

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
        // Usuário está bloqueado, fazer logout
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
    // Wrap getSession in try-catch to handle auth errors gracefully
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('[SessionContext] Erro ao obter sessão:', error);
        
        // Se for erro de refresh token, mostrar toast e redirecionar
        if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          navigate('/login');
        }
        setInitializing(false);
        return;
      }
      
      if (session?.user) {
        // Verificar se está bloqueado ao carregar sessão
        const isBlocked = await checkIfBlocked(session.user.id);
        if (!isBlocked) {
          setSession(session);
        }
      } else {
        setSession(session);
      }

      // IMPORTANTE: só marca como não inicializando DEPOIS de tudo resolver
      setInitializing(false);
    }).catch((error) => {
      console.error('[SessionContext] Erro inesperado ao obter sessão:', error);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // Verificar se está bloqueado ao fazer login ou refresh de token
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
        
        // Se for erro de refresh token, mostrar toast e limpar sessão
        if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          setSession(null);
          navigate('/login');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Se estiver inicializando, não renderiza nada até recuperar a sessão
  if (initializing) {
    return null;
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