// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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

    // Validação do Token
    const authHeader = req.headers.get('Authorization');
    const secretToken = authHeader?.replace('Bearer ', '');
    const { data: setting } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'n8n_integration_token').single();
    if (!setting?.value || secretToken !== setting.value) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { email, phone, name, password } = await req.json();

    if (!email) throw new Error("Email is required");

    // 1. Criar Auth User
    const tempPassword = password || Math.random().toString(36).slice(-8) + "Aa1!";
    const firstName = name ? name.split(' ')[0] : 'Cliente';
    const lastName = name ? name.split(' ').slice(1).join(' ') : 'Novo';

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName }
    });

    if (createError) throw createError;

    // 2. Atualizar Profile
    if (newUser.user) {
        await supabaseAdmin.from('profiles').update({
            phone: phone || null,
            first_name: firstName,
            last_name: lastName
        }).eq('id', newUser.user.id);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        id: newUser.user.id, 
        email: newUser.user.email,
        generated_password: password ? 'provided' : tempPassword 
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})