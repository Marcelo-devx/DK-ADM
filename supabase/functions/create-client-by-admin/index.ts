// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const allowedToken = Deno.env.get('N8N_SECRET_TOKEN') || Deno.env.get('ADMIN_CREATE_TOKEN');

    let isAuthorized = false;

    if (allowedToken && token && token === allowedToken) {
      isAuthorized = true;
    }

    if (!isAuthorized && token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      isAuthorized = true;
    }

    if (!isAuthorized && token) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (!userError && userData && userData.user && userData.user.id) {
          const userId = userData.user.id;
          const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

          if (!profileErr && profile && profile.role === 'adm') {
            isAuthorized = true;
          }
        }
      } catch (e) {
        console.warn('[create-client-by-admin] Failed to validate user token:', String(e));
      }
    }

    if (!isAuthorized) {
      return jsonResponse({
        error: 'Acesso negado. Você não tem permissão para cadastrar clientes.',
        code: 'UNAUTHORIZED',
      }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, cpf_cnpj, phone, gender } = body || {};

    if (!email) {
      return jsonResponse({
        error: 'O e-mail é obrigatório para cadastrar um cliente.',
        code: 'VALIDATION_ERROR',
      }, 400);
    }

    if (!password) {
      return jsonResponse({
        error: 'A senha é obrigatória para cadastrar um cliente.',
        code: 'VALIDATION_ERROR',
      }, 400);
    }

    try {
      const { data: existingId, error: rpcErr } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });
      if (rpcErr) {
        console.error('[create-client-by-admin] RPC get_user_id_by_email error:', rpcErr.message);
      }
      if (existingId) {
        return jsonResponse({
          error: 'Já existe um usuário cadastrado com este e-mail.',
          code: 'EMAIL_ALREADY_EXISTS',
          id: existingId,
        }, 409);
      }
    } catch (e) {
      console.warn('[create-client-by-admin] Failed to check existing user (continuing):', String(e));
    }

    let first_name = null;
    let last_name = null;
    if (full_name && typeof full_name === 'string') {
      const parts = full_name.trim().split(/\s+/);
      first_name = parts.shift() || null;
      last_name = parts.join(' ') || null;
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        phone: phone || null,
        cpf_cnpj: cpf_cnpj || null,
        gender: gender || null,
      }
    });

    if (createError) {
      console.error('[create-client-by-admin] Error creating user:', createError);
      return jsonResponse({
        error: 'Não foi possível criar o usuário no sistema.',
        code: 'AUTH_CREATE_FAILED',
        details: createError.message,
      }, 500);
    }

    const userId = createdUser?.user?.id || createdUser?.id;
    if (!userId) {
      console.error('[create-client-by-admin] Failed to resolve created user id', { createdUser });
      return jsonResponse({
        error: 'O usuário foi criado, mas não foi possível identificar o ID gerado.',
        code: 'USER_ID_NOT_RESOLVED',
      }, 500);
    }

    console.log('[create-client-by-admin] User created successfully, userId:', userId);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        first_name: first_name,
        last_name: last_name,
        cpf_cnpj: cpf_cnpj || null,
        phone: phone || null,
        gender: gender || null,
        role: 'user',
        force_pix_on_next_purchase: true,
        is_credit_card_enabled: false,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('[create-client-by-admin] Error upserting profile:', profileError);
      return jsonResponse({
        success: true,
        id: userId,
        email,
        warning: 'O usuário foi criado, mas a atualização do perfil falhou: ' + profileError.message,
        code: 'PROFILE_UPSERT_FAILED',
      }, 200);
    }

    console.log('[create-client-by-admin] Profile upserted successfully for userId:', userId);

    return jsonResponse({ success: true, id: userId, email }, 200);

  } catch (e) {
    console.error('[create-client-by-admin] Unexpected error:', e);
    return jsonResponse({
      error: 'Ocorreu um erro inesperado ao cadastrar o cliente.',
      code: 'UNEXPECTED_ERROR',
      details: String(e),
    }, 500);
  }
})