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
    // 1. Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Check if the caller is an admin
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Authentication failed');

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    if (profileError || profile.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Get payload
    const { email, new_password } = await req.json();
    if (!email || !new_password) {
      throw new Error("Email e nova senha são obrigatórios.");
    }

    // 4. Find user by email using the dedicated admin function
    const { data: { user: targetUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    if (getUserError || !targetUser) {
        throw new Error(`Usuário com email ${email} não encontrado.`);
    }

    // 5. Update password with conditional logic
    if (user.id === targetUser.id) {
      // Admin is changing their OWN password. Use the standard user update method.
      const { error: updateSelfError } = await supabaseClient.auth.updateUser({
        password: new_password
      });
      if (updateSelfError) throw updateSelfError;
    } else {
      // Admin is changing ANOTHER user's password. Use the admin method.
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.id,
        { password: new_password }
      );
      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({ message: `Senha do usuário ${email} atualizada com sucesso.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in admin-set-password:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao alterar a senha.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})