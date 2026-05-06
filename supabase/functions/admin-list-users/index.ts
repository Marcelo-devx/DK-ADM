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
    return new Response(JSON.stringify({ status: "ok", function: "admin-list-users", version: "2" }), {
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
  const body = await req.json().catch(() => ({}));
  const { searchTerm = "", page = 0, pageSize = 50 } = body;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const term = searchTerm.trim();

  console.log(`[admin-list-users] term="${term}" page=${page} pageSize=${pageSize}`);

  let countResult: { count: number | null; error: any };
  let dataResult: { data: any[] | null; error: any };

  if (term) {
    const likeTerm = `%${term}%`;

    // Primeiro: buscar IDs de usuários pelo email em auth.users (via Admin API)
    // Isso garante que encontramos usuários mesmo que o email não esteja sincronizado no profiles
    let authUserIds: string[] = [];
    try {
      const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (!authErr && authUsers?.users) {
        const lowerTerm = term.toLowerCase();
        authUserIds = authUsers.users
          .filter(u => u.email && u.email.toLowerCase().includes(lowerTerm))
          .map(u => u.id);
        console.log(`[admin-list-users] Found ${authUserIds.length} users by email in auth.users`);
      }
    } catch (e) {
      console.error("[admin-list-users] Error searching auth.users:", e);
    }

    // Buscar profiles que batem com o termo OU cujo ID está nos authUserIds
    let profilesQuery = supabaseAdmin
      .from("profiles")
      .select(
        "id, first_name, last_name, cpf_cnpj, email, phone, date_of_birth, gender, " +
        "cep, street, number, complement, neighborhood, city, state, " +
        "force_pix_on_next_purchase, is_credit_card_enabled, " +
        "is_blocked, created_at, role",
        { count: "exact" }
      );

    if (authUserIds.length > 0) {
      // Busca por campos do profile OU por IDs encontrados no auth.users
      profilesQuery = profilesQuery.or(
        `email.ilike.${likeTerm},cpf_cnpj.ilike.${likeTerm},phone.ilike.${likeTerm},first_name.ilike.${likeTerm},last_name.ilike.${likeTerm},id.in.(${authUserIds.join(",")})`
      );
    } else {
      profilesQuery = profilesQuery.or(
        `email.ilike.${likeTerm},cpf_cnpj.ilike.${likeTerm},phone.ilike.${likeTerm},first_name.ilike.${likeTerm},last_name.ilike.${likeTerm}`
      );
    }

    const { data, error, count } = await profilesQuery
      .order("created_at", { ascending: false })
      .range(from, to);

    console.log(`[admin-list-users] profiles query result: count=${count}, data=${data?.length}, error=${error?.message}`);

    countResult = { count: count ?? 0, error };
    dataResult = { data: data ?? [], error };

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

  // Para usuários encontrados via auth.users mas sem email no profile,
  // enriquecer com o email do auth.users
  const users = dataResult.data ?? [];
  if (users.length > 0) {
    try {
      const missingEmailIds = users.filter(u => !u.email).map(u => u.id);
      if (missingEmailIds.length > 0) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (authUsers?.users) {
          const authEmailMap = new Map(authUsers.users.map(u => [u.id, u.email]));
          for (const u of users) {
            if (!u.email && authEmailMap.has(u.id)) {
              u.email = authEmailMap.get(u.id) || null;
            }
          }
        }
      }
    } catch (e) {
      console.error("[admin-list-users] Error enriching emails:", e);
    }
  }

  console.log(`[admin-list-users] term="${term}" page=${page} returning ${users.length} users, total: ${countResult.count}`);

  return new Response(
    JSON.stringify({
      users,
      total: countResult.count ?? 0,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
