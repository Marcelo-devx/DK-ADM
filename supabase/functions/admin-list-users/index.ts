import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET simples para keep-alive / health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", function: "admin-list-users" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verificar autenticação
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cliente com anon key para verificar o role do usuário logado
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Verificar se o usuário é admin
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    console.log("[admin-list-users] Auth error:", userError);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profileError } = await supabaseUser
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.log("[admin-list-users] Profile error:", profileError);
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allowedRoles = ["adm", "gerente_geral", "gerente", "logistica"];
  if (!allowedRoles.includes(profile.role)) {
    console.log("[admin-list-users] Forbidden role:", profile.role);
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cliente com service_role para buscar todos os usuários sem RLS
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Parâmetros da requisição
  const { searchTerm = "", page = 0, pageSize = 50 } = await req.json().catch(() => ({}));

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const term = searchTerm.trim();

  let countResult: { count: number | null; error: any };
  let dataResult: { data: any[] | null; error: any };

  if (term) {
    // Busca com termo: usa SQL direto para suportar nome completo concatenado
    const likeTerm = `%${term}%`;

    const countQuery = await supabaseAdmin.rpc("search_profiles_count", {
      search_term: likeTerm,
    });

    const dataQuery = await supabaseAdmin.rpc("search_profiles_paginated", {
      search_term: likeTerm,
      page_from: from,
      page_to: to,
    });

    countResult = { count: countQuery.data ?? 0, error: countQuery.error };
    dataResult = { data: dataQuery.data ?? [], error: dataQuery.error };
  } else {
    // Sem termo: listagem normal paginada
    const [cRes, dRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select(
          "id, first_name, last_name, cpf_cnpj, email, phone, date_of_birth, gender, " +
          "cep, street, number, complement, neighborhood, city, state, " +
          "force_pix_on_next_purchase, is_credit_card_enabled, " +
          "is_blocked, created_at, role"
        )
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);

    countResult = { count: cRes.count, error: cRes.error };
    dataResult = { data: dRes.data, error: dRes.error };
  }

  if (countResult.error) {
    console.error("[admin-list-users] Count error:", countResult.error);
    return new Response(JSON.stringify({ error: countResult.error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (dataResult.error) {
    console.error("[admin-list-users] Data error:", dataResult.error);
    return new Response(JSON.stringify({ error: dataResult.error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[admin-list-users] term="${term}" page=${page} returning ${dataResult.data?.length} users, total: ${countResult.count}`);

  return new Response(
    JSON.stringify({
      users: dataResult.data ?? [],
      total: countResult.count ?? 0,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
