import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const SessionContext = createContext<Session | null>(null);

export const SessionContextProvider = (props: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Verificar se está bloqueado ao carregar sessão
        checkIfBlocked(session.user.id).then((isBlocked) => {
          if (!isBlocked) {
            setSession(session);
          }
        });
      } else {
        setSession(session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
    });

    return () => subscription.unsubscribe();
  }, []);

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