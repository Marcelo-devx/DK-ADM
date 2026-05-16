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

    // Buscar IDs de usuários pelo email em auth.users (via Admin API) — percorre TODAS as páginas
    let authUserIds: string[] = [];
    try {
      let authPage = 1;
      const perPage = 1000;
      while (true) {
        const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
          page: authPage,
          perPage,
        });
        if (authErr) {
          console.error("[admin-list-users] Error fetching auth.users page", authPage, authErr);
          break;
        }
        if (!authUsers?.users || authUsers.users.length === 0) break;

        const lowerTerm = term.toLowerCase();
        const matched = authUsers.users
          .filter(u => u.email && u.email.toLowerCase().includes(lowerTerm))
          .map(u => u.id);
        authUserIds = authUserIds.concat(matched);

        // Se retornou menos que perPage, chegamos na última página
        if (authUsers.users.length < perPage) break;
        authPage++;
      }
      console.log(`[admin-list-users] Found ${authUserIds.length} users by email in auth.users (all pages)`);
    } catch (e) {
      console.error("[admin-list-users] Error searching auth.users:", e);
    }

    // Buscar profiles que batem com o termo nos campos do profile
    const selectFields =
      "id, first_name, last_name, cpf_cnpj, email, phone, date_of_birth, gender, " +
      "cep, street, number, complement, neighborhood, city, state, " +
      "force_pix_on_next_purchase, is_credit_card_enabled, " +
      "is_blocked, created_at, role";

    // Query 1: busca por campos do profile (sem misturar id.in com ilike no .or())
    const { data: profileData, error: profileSearchError } = await supabaseAdmin
      .from("profiles")
      .select(selectFields)
      .or(
        `email.ilike.${likeTerm},cpf_cnpj.ilike.${likeTerm},phone.ilike.${likeTerm},first_name.ilike.${likeTerm},last_name.ilike.${likeTerm}`
      )
      .order("created_at", { ascending: false });

    if (profileSearchError) {
      console.error("[admin-list-users] Profile fields query error:", profileSearchError);
    }

    // Query 2: busca por IDs encontrados no auth.users (email match), excluindo já encontrados
    let authIdData: any[] = [];
    if (authUserIds.length > 0) {
      const alreadyFoundIds = new Set((profileData ?? []).map((u: any) => u.id));
      const idsToFetch = authUserIds.filter(id => !alreadyFoundIds.has(id));
      if (idsToFetch.length > 0) {
        const { data: idData, error: idError } = await supabaseAdmin
          .from("profiles")
          .select(selectFields)
          .in("id", idsToFetch)
          .order("created_at", { ascending: false });
        if (idError) {
          console.error("[admin-list-users] Auth ID query error:", idError);
        }
        authIdData = idData ?? [];
      }
    }

    // Merge e ordenar por created_at desc
    const allData = [...(profileData ?? []), ...authIdData].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const totalCount = allData.length;
    const data = allData.slice(from, to + 1);
    const count = totalCount;
    const error = profileSearchError;

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
  // enriquecer com o email do auth.users — percorre TODAS as páginas
  const users = dataResult.data ?? [] as any[];
  if (users.length > 0) {
    try {
      const missingEmailIds = users.filter(u => !u.email).map(u => u.id);
      if (missingEmailIds.length > 0) {
        const authEmailMap = new Map<string, string | undefined>();
        let enrichPage = 1;
        const perPage = 1000;
        while (true) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: enrichPage, perPage });
          if (!authUsers?.users || authUsers.users.length === 0) break;
          for (const u of authUsers.users) {
            authEmailMap.set(u.id, u.email);
          }
          if (authUsers.users.length < perPage) break;
          enrichPage++;
        }
        for (const u of users) {
          if (!u.email && authEmailMap.has(u.id)) {
            u.email = authEmailMap.get(u.id) || null;
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