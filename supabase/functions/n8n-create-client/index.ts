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

    let userId = null;
    let isNewUser = false;
    let userEmail = email;

    // 1. Tentar criar usuário no Auth
    const tempPassword = password || Math.random().toString(36).slice(-8) + "Aa1!";
    const firstName = name ? name.split(' ')[0] : 'Cliente';
    const lastName = name ? name.split(' ').slice(1).join(' ') : 'WhatsApp';

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName }
    });

    if (createError) {
        // Se já existe, buscamos o ID
        if (createError.message?.includes("already registered") || createError.status === 422) {
             const { data: existingId } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });
             if (existingId) {
                 userId = existingId;
                 console.log(`[n8n-create-client] Usuário já existia: ${userId}`);
             } else {
                 throw new Error("Usuário existe mas não foi possível recuperar ID.");
             }
        } else {
            throw createError;
        }
    } else {
        userId = newUser.user?.id;
        isNewUser = true;
    }

    // 2. Garantir/Atualizar Profile
    if (userId) {
        const updateData: any = {};
        if (phone) updateData.phone = phone;
        if (name && isNewUser) { // Só atualiza nome se for novo, para não sobrescrever dados reais
            updateData.first_name = firstName;
            updateData.last_name = lastName;
        }

        if (Object.keys(updateData).length > 0) {
            await supabaseAdmin.from('profiles').update(updateData).eq('id', userId);
        }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        id: userId, 
        email: userEmail,
        is_new_user: isNewUser,
        message: isNewUser ? "Usuário criado com sucesso." : "Usuário já existia, ID retornado."
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})