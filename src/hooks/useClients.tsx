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
}

const PAGE_SIZE = 10;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// fetch page via Edge Function (fallbacks can be handled outside)
async function fetchClients(page: number, search: string): Promise<Client[]> {
  const body: Record<string, unknown> = { limit: PAGE_SIZE, page };
  if (search) body.search = search;

  // Try Edge Function first (preferred). If it fails or returns unexpected data,
  // fall back to querying the profiles table directly.
  try {
    const { data, error } = await supabase.functions.invoke("get-users", { body });
    if (!error && Array.isArray(data)) {
      return data as Client[];
    }
    // If there was an error, fall through to fallback query
    if (error) console.warn("get-users edge function returned error:", error);
  } catch (e) {
    console.warn("get-users edge function call failed, falling back to direct DB query:", e);
  }

  // FALLBACK: query profiles table directly. This works for authenticated admin sessions
  // and avoids a hard failure when Edge Functions are unreachable or misconfigured.
  const from = (page - 1) * PAGE_SIZE;
  const to = page * PAGE_SIZE - 1;

  try {
    let query = supabase
      .from("profiles")
      .select(
        "id, email, first_name, last_name, created_at, updated_at, role, force_pix_on_next_purchase, order_count, completed_order_count"
      )
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      const term = `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      // Search across email, first_name and last_name
      query = query.or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as Client[];
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      throw new Error(
        "Erro de rede: não foi possível conectar ao Supabase. Verifique sua conexão ou se o serviço está ativo."
      );
    }
    throw e;
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

        if (error) {
          // Map function errors to throw
          throw new Error(error.message || "Erro ao chamar função de criação de usuário");
        }

        return { data, values };
      } catch (e: any) {
        // Provide clearer message when network-level failure occurs
        const msg = String(e?.message || e);
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          throw new Error(
            "Erro de rede: não foi possível conectar às Edge Functions do Supabase. Verifique sua conexão, bloqueadores (adblock/privacidade) ou se o serviço de Functions está ativo."
          );
        }
        throw e;
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