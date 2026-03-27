// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Authorization: accept either
    // - a preconfigured ADMIN_CREATE_TOKEN / N8N_SECRET_TOKEN (shared secret), or
    // - a Supabase service role key, or
    // - an access token of an authenticated user that has profiles.role = 'adm'
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const allowedToken = Deno.env.get('N8N_SECRET_TOKEN') || Deno.env.get('ADMIN_CREATE_TOKEN');

    let isAuthorized = false;

    // 1) If a management token is configured and provided, allow
    if (allowedToken && token && token === allowedToken) {
      isAuthorized = true;
    }

    // 2) If called using the service role key, allow
    if (!isAuthorized && token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      isAuthorized = true;
    }

    // 3) If a user access token is provided, validate it and ensure the user's profile role is 'adm'
    if (!isAuthorized && token) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (!userError && userData && userData.user && userData.user.id) {
          const userId = userData.user.id;
          // Check profile role using admin client (bypass RLS)
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, cpf_cnpj, phone, gender } = body || {};

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!password) {
      return new Response(JSON.stringify({ error: 'Missing password' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if user already exists using RPC helper
    try {
      const { data: existingId, error: rpcErr } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });
      if (rpcErr) {
        console.error('[create-client-by-admin] RPC get_user_id_by_email error:', rpcErr.message);
      }
      if (existingId) {
        // If RPC returns an id (uuid), respond with conflict
        return new Response(JSON.stringify({ error: 'User already exists', id: existingId }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.warn('[create-client-by-admin] Failed to check existing user (continuing):', String(e));
    }

    // split name
    let first_name = null;
    let last_name = null;
    if (full_name && typeof full_name === 'string') {
      const parts = full_name.trim().split(/\s+/);
      first_name = parts.shift() || null;
      last_name = parts.join(' ') || null;
    }

    // Create user via Admin API
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        phone,
        cpf_cnpj,
        gender
      }
    });

    if (createError) {
      console.error('[create-client-by-admin] Error creating user:', createError);
      // If duplicate email or conflict, createError.message should indicate it — return helpful error
      return new Response(JSON.stringify({ error: 'Database error creating new user', details: createError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = createdUser?.user?.id || createdUser?.id;
    if (!userId) {
      console.error('[create-client-by-admin] Failed to resolve created user id', { createdUser });
      return new Response(JSON.stringify({ error: 'Failed to resolve created user id' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create profile row
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        first_name: first_name,
        last_name: last_name,
        cpf_cnpj: cpf_cnpj || null,
        phone: phone || null,
        gender: gender || null,
        role: 'user'
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('[create-client-by-admin] Error creating profile:', profileError);
      return new Response(JSON.stringify({ error: 'Error creating profile', details: profileError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, id: userId, email }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[create-client-by-admin] Unexpected error:', e);
    return new Response(JSON.stringify({ error: 'Unexpected error', details: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})