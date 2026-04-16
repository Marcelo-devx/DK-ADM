import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {
    // Verify the calling user's token
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.log("[get-users] Auth failed", { userError });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // Use service role for admin queries
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const page = Math.max(1, parseInt(body.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(body.limit ?? String(PAGE_SIZE), 10)));
    const search = (body.search ?? "").toString().trim();

    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const isCPF = search && /^[0-9]+$/.test(search);
    const isEmail = search && search.includes("@");

    // Build query against profiles table (much faster than auth.admin.listUsers)
    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj")
      .order("created_at", { ascending: false })
      .range(start, end);

    if (search) {
      if (isCPF) {
        query = query.ilike("cpf_cnpj", `%${search}%`);
      } else if (isEmail) {
        query = query.ilike("email", `%${search}%`);
      } else {
        // Search by name or email
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,cpf_cnpj.ilike.%${search}%`
        );
      }
    } else {
      // Default: only regular users
      query = query.eq("role", "user");
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error("[get-users] Error querying profiles", { error: profilesError.message });
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order counts for these users in a single query
    const userIds = (profiles ?? []).map((p: any) => p.id);
    let orderCountMap = new Map<string, number>();
    let completedOrderMap = new Map<string, number>();

    if (userIds.length > 0) {
      const { data: orderCounts, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select("user_id, status")
        .in("user_id", userIds);

      if (!ordersError && orderCounts) {
        const completedStatuses = ["Finalizada", "Pago", "Entregue", "Concluída"];
        for (const order of orderCounts) {
          orderCountMap.set(order.user_id, (orderCountMap.get(order.user_id) ?? 0) + 1);
          if (completedStatuses.includes(order.status)) {
            completedOrderMap.set(order.user_id, (completedOrderMap.get(order.user_id) ?? 0) + 1);
          }
        }
      }
    }

    const result = (profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email ?? "",
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      role: p.role ?? "user",
      force_pix_on_next_purchase: p.force_pix_on_next_purchase === true,
      created_at: p.created_at ?? new Date().toISOString(),
      updated_at: p.updated_at ?? null,
      cpf_cnpj: p.cpf_cnpj ?? null,
      order_count: orderCountMap.get(p.id) ?? 0,
      completed_order_count: completedOrderMap.get(p.id) ?? 0,
    }));

    console.log("[get-users] Returning profiles count", { count: result.length, page, search: search || "(none)" });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-users] Unexpected error", { err });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
