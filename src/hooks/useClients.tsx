"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

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

const PAGE_SIZE = 20;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// fetch page via Edge Function (fallbacks can be handled outside)
async function fetchClients(page: number, search: string): Promise<Client[]> {
  const body: Record<string, unknown> = { limit: PAGE_SIZE, page };
  if (search) body.search = search;

  // Try to include the current access token so the Edge Function can verify admin
  try {
    const { data: sd } = await supabase.auth.getSession();
    const token = sd?.session?.access_token;
    const invokeOptions: any = { body };
    if (token) {
      invokeOptions.headers = {
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
      };
    }

    const { data, error } = await supabase.functions.invoke("get-users", invokeOptions);
    if (error) throw new Error(error.message || 'Erro na Edge Function');
    if (!Array.isArray(data)) throw new Error("Resposta inválida da Edge Function.");
    return data as Client[];
  } catch (e: any) {
    // If edge function fails (network or other), fallback to direct Supabase queries from the client
    console.warn('[useClients] get-users Edge Function failed, falling back to direct DB query:', e.message || e);

    // Build fallback query against profiles table
    try {
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      const searchTrim = (search || '').toString().trim();
      const isCPF = /^[0-9]+$/.test(searchTrim);
      const isEmail = searchTrim.includes('@');

      let query = supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj')
        .eq('role', 'user')
        .range(start, end);

      if (searchTrim) {
        if (isCPF) {
          query = supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj')
            .ilike('cpf_cnpj', `%${searchTrim}%`)
            .range(start, end);
        } else if (isEmail) {
          query = supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj')
            .ilike('email', `%${searchTrim}%`)
            .range(start, end);
        } else {
          // generic search across email and cpf_cnpj
          query = supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj')
            .or(`ilike(email,%${searchTrim}%),ilike(cpf_cnpj,%${searchTrim}%)`)
            .range(start, end);
        }
      }

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) {
        console.error('[useClients] profiles fallback query error:', profilesError.message || profilesError);
        throw profilesError;
      }

      const userIds = (profiles || []).map((p: any) => p.id);

      // Fetch orders to compute counts
      let orders: any[] = [];
      if (userIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('user_id, status')
          .in('user_id', userIds as string[]);
        if (ordersError) {
          console.error('[useClients] orders fallback query error:', ordersError.message || ordersError);
          orders = [];
        } else {
          orders = ordersData || [];
        }
      }

      const orderCountMap = new Map();
      const completedOrderMap = new Map();
      const completedStatuses = ['Finalizada', 'Pago', 'Entregue', 'Concluída'];

      for (const order of orders || []) {
        orderCountMap.set(order.user_id, (orderCountMap.get(order.user_id) || 0) + 1);
        if (completedStatuses.includes(order.status)) {
          completedOrderMap.set(order.user_id, (completedOrderMap.get(order.user_id) || 0) + 1);
        }
      }

      const clients = (profiles || []).map((p: any) => ({
        id: p.id,
        email: p.email || '',
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: p.role || 'user',
        force_pix_on_next_purchase: p.force_pix_on_next_purchase === true,
        order_count: orderCountMap.get(p.id) || 0,
        completed_order_count: completedOrderMap.get(p.id) || 0,
        cpf_cnpj: p.cpf_cnpj || null,
      })) as Client[];

      return clients;
    } catch (fallbackErr: any) {
      console.error('[useClients] Fallback failed too:', fallbackErr);
      throw fallbackErr;
    }
  }
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
  const session = useSession();

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

  const sessionReady = session !== undefined; // SessionContextProvider only renders children after init
  const hasSessionUser = !!session?.user?.id;

  const { data: total = 0, isLoading: isLoadingTotal } = useQuery<number>({
    queryKey: ["clientsTotal"],
    queryFn: fetchTotal,
    staleTime: 60_000,
    enabled: sessionReady && hasSessionUser,
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
    enabled: sessionReady && hasSessionUser,
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
        const { data, error } = await supabase.functions.invoke("create-client-by-admin", {
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
        console.error('[useClients] Error calling create-client-by-admin:', e);
        const msg = String(e?.message || e);

        // If Supabase Functions client returned non-2xx, attempt a direct fetch to capture body/status
        const isFunctionsHttpError = e?.name === 'FunctionsHttpError' || msg.includes('non-2xx');
        if (isFunctionsHttpError) {
          try {
            const fallbackRes = await fetch(
              'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/create-client-by-admin',
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

    // pagination config
    pageSize: PAGE_SIZE,
  };
}