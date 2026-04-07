"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  email: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "user" | "adm";
  force_pix_on_next_purchase: boolean;
  order_count: number;
  completed_order_count: number;
  cpf_cnpj: string | null;
}

const PAGE_SIZE = 10;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// fetch page via Edge Function (fallbacks can be handled outside)
async function fetchClients(page: number, search: string): Promise<Client[]> {
  const body: Record<string, unknown> = { limit: PAGE_SIZE, page };
  if (search) body.search = search;
  const { data, error } = await supabase.functions.invoke("get-users", { body });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Resposta inválida da Edge Function.");
  return data as Client[];
}

async function fetchTotal(): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "user");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export function useClients(initialPage = 1) {
  const qc = useQueryClient();

  const [page, setPage] = useState<number>(initialPage);
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>(""); // debounced value

  // debounce logic
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearchDebounced = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 600);
  }, []);
  // immediate search helper (bypasses debounce)
  const searchNow = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchInput(value);
    setSearch(value.trim());
    setPage(1);
  }, []);
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const { data: total = 0, isLoading: isLoadingTotal } = useQuery<number>({
    queryKey: ["clientsTotal"],
    queryFn: fetchTotal,
    staleTime: 60_000,
  });

  const {
    data: clients = [],
    isLoading: isLoadingClients,
    isFetching,
    error,
    refetch,
  } = useQuery<Client[]>({
    queryKey: ["clients", page, search],
    queryFn: () => fetchClients(page, search),
    staleTime: 30_000,
  });

  // Create client
  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      // Get current session token to authenticate the request to the edge function
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      try {
        // Call edge function and forward Authorization header + anon key
        const { data, error } = await supabase.functions.invoke("admin-create-user", {
          body: values,
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: ANON_KEY,
          },
        });

        // If supabase returned an error object, include details
        if (error) {
          console.error("[useClients] Edge function returned error:", error);
          const statusPart = (error?.status ? `status=${error.status} ` : "");
          throw new Error(`${statusPart}${error?.message || 'Edge Function error'}`);
        }

        // If function responded with an error payload in data, surface it
        if (data && typeof data === 'object' && (data.error || data.details)) {
          console.error('[useClients] Edge function response had error payload:', data);
          const payloadMsg = data.error || data.details || JSON.stringify(data);
          throw new Error(`Edge Function: ${payloadMsg}`);
        }

        return { data, values };
      } catch (e: any) {
        // Provide clearer message when network-level failure occurs
        console.error('[useClients] Error calling admin-create-user:', e);
        const msg = String(e?.message || e);

        // If Supabase Functions client returned non-2xx, attempt a direct fetch to capture body/status
        const isFunctionsHttpError = e?.name === 'FunctionsHttpError' || msg.includes('non-2xx');
        if (isFunctionsHttpError) {
          try {
            const fallbackRes = await fetch(
              'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/admin-create-user',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  apikey: ANON_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
              }
            );

            const text = await fallbackRes.text();
            // Try parse JSON when possible
            let parsed: any = text;
            try { parsed = JSON.parse(text); } catch (_) { /* keep as text */ }

            const detailMsg = `Status ${fallbackRes.status}: ${
              typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
            }`;
            console.error('[useClients] Fallback fetch details:', detailMsg);
            throw new Error(detailMsg);
          } catch (fallbackErr: any) {
            console.error('[useClients] Fallback fetch also failed:', fallbackErr);
            // If fallback failed due to network, surface that; otherwise, surface original message
            const fbMsg = String(fallbackErr?.message || fallbackErr);
            if (fbMsg.includes('Failed to fetch') || fbMsg.includes('NetworkError')) {
              throw new Error(
                'Erro de rede: não foi possível conectar às Edge Functions do Supabase. Verifique sua conexão, bloqueadores (adblock/privacidade) ou se o serviço de Functions está ativo.'
              );
            }
            throw new Error(fbMsg);
          }
        }

        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          throw new Error(
            "Erro de rede: não foi possível conectar às Edge Functions do Supabase. Verifique sua conexão, bloqueadores (adblock/privacidade) ou se o serviço de Functions está ativo."
          );
        }

        // Generic fallback: include the raw error message so the UI can display more context
        throw new Error(msg);
      }
    },
    onSuccess: ({ data, values }) => {
      const created = data?.user || data;
      const nameParts = (values?.full_name || "").split(" ");
      const newClient: Client = {
        id: created?.id || `tmp-${Date.now()}`,
        email: created?.email || values?.email || "",
        first_name: nameParts[0] || null,
        last_name: nameParts.slice(1).join(" ") || null,
        created_at: created?.created_at || new Date().toISOString(),
        updated_at: null,
        role: "user",
        force_pix_on_next_purchase: true,
        order_count: 0,
        completed_order_count: 0,
        cpf_cnpj: null, // Será preenchido quando o cliente cadastrar ou admin atualizar
      };

      // Optimistically update small caches
      qc.setQueryData<number>(["clientsTotal"], (prev = 0) => prev + 1);
      qc.setQueryData<Client[]>(["clients", 1, ""], (prev = []) =>
        [newClient, ...prev].slice(0, PAGE_SIZE)
      );
    },
  });

  // toggle pix
  const togglePixMutation = useMutation({
    mutationFn: async ({ userId, forcePix }: { userId: string; forcePix: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ force_pix_on_next_purchase: forcePix })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return { userId, forcePix };
    },
    onMutate: async ({ userId, forcePix }) => {
      // optimistic update for current page
      qc.setQueryData<Client[]>(["clients", page, search], (prev = []) =>
        prev.map((c) => (c.id === userId ? { ...c, force_pix_on_next_purchase: forcePix } : c))
      );
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["clients", page, search], exact: true });
    },
  });

  // admin actions
  const actionMutation = useMutation({
    mutationFn: async ({ action, targetUserId }: { action: string; targetUserId: string }) => {
      let fnName = "admin-user-actions";
      const body: any = { targetUserId };
      if (action === "delete_orders") fnName = "admin-delete-orders";
      else if (action === "mark_as_recurrent") fnName = "admin-mark-as-recurrent";
      else {
        body.action = action;
        body.redirectTo = "https://dk-l-andpage.vercel.app/login";
      }
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients", page, search], exact: true });
    },
  });

  // helpers exposed
  return {
    // state
    page,
    setPage,
    total,
    clients,
    visibleClients: clients,
    isLoading: isLoadingClients || isLoadingTotal,
    isFetching,
    error,
    refetch,

    // search
    searchInput,
    setSearchInput: setSearchDebounced,
    searchNow,
    search,

    // mutations
    create: createMutation.mutate,
    createStatus: {
      isIdle: createMutation.isIdle,
      isPending: createMutation.isPending,
    },
    togglePix: togglePixMutation.mutate,
    togglePixStatus: {
      isIdle: togglePixMutation.isIdle,
      isPending: togglePixMutation.isPending,
    },
    action: actionMutation.mutate,
    actionStatus: {
      isPending: actionMutation.isPending,
    },
  };
}