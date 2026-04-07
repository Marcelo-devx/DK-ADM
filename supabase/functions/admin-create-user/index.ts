// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // Return HTTP 200 OK for preflight to match other functions and avoid CORS failures in some environments
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    console.log("[admin-create-user] Incoming request. Authorization header present:", !!authHeader);
    console.log("[admin-create-user] Token length:", token ? token.length : 0);

    if (!token) {
      console.warn("[admin-create-user] No token provided - rejecting");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar token e checar se é admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.error("[admin-create-user] Token inválido ou getUser falhou:", userError?.message || userData);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    console.log("[admin-create-user] Token belongs to userId:", callerId);

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", callerId)
      .maybeSingle();

    if (profileErr) {
      console.error("[admin-create-user] Erro ao buscar profile:", profileErr.message);
    } else {
      console.log("[admin-create-user] Caller profile:", profile);
    }

    if (profile?.role !== "adm") {
      console.warn("[admin-create-user] Caller is not admin. Role:", profile?.role);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ler body
    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, cpf_cnpj, phone, gender } = body || {};

    // Log sanitized body for debugging (do NOT log password value)
    console.log('[admin-create-user] Payload received:', {
      email: email || null,
      has_password: !!password,
      full_name: full_name || null,
      cpf_cnpj: cpf_cnpj || null,
      phone: phone || null,
      gender: gender || null,
    });

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Separar nome
    let first_name = null;
    let last_name = null;
    if (full_name && typeof full_name === "string") {
      const parts = full_name.trim().split(/\s+/);
      first_name = parts.shift() || null;
      last_name = parts.join(" ") || null;
    }

    console.log("[admin-create-user] Criando usuário:", email);

    // Criar usuário
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, phone, cpf_cnpj, gender },
    });

    if (createError) {
      // Log full error object for debugging
      console.error('[admin-create-user] Erro ao criar usuário (createError):', createError);

      // Return richer error info so the client can display specific reason during debugging
      const responseBody = {
        error: 'Database error creating new user',
        message: createError?.message || null,
        details: createError?.details || null,
        hint: createError?.hint || null,
        code: createError?.code || null,
      };

      // Use 400 to match previous behavior when createError indicates client-side input issues
      return new Response(JSON.stringify(responseBody), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = createdUser?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Falha ao obter ID do usuário criado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Criar perfil
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        first_name,
        last_name,
        cpf_cnpj: cpf_cnpj || null,
        phone: phone || null,
        gender: gender || null,
        role: "user",
        force_pix_on_next_purchase: true,
        is_credit_card_enabled: false,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("[admin-create-user] Erro ao criar perfil:", profileError.message, profileError);
      return new Response(JSON.stringify({ error: "Erro ao criar perfil: " + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[admin-create-user] Usuário criado com sucesso:", userId);

    return new Response(JSON.stringify({ success: true, id: userId, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[admin-create-user] Erro inesperado:", String(e));
    return new Response(JSON.stringify({ error: "Erro inesperado: " + String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});