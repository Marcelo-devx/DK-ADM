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
    const { action, targetUserId, redirectTo } = await req.json();
    if (!action || !targetUserId) {
      throw new Error("Action and targetUserId are required.");
    }

    // 4. Get target user's email
    const { data: { user: targetUser }, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (targetUserError || !targetUser) {
        throw new Error(`User with ID ${targetUserId} not found.`);
    }
    const targetUserEmail = targetUser.email;
    if (!targetUserEmail) {
        throw new Error(`User with ID ${targetUserId} does not have an email.`);
    }

    let responseMessage = '';
    
    // Define as opções de redirecionamento se fornecidas
    const options = redirectTo ? { redirectTo } : undefined;

    // 5. Perform action
    if (action === 'resend_confirmation') {
      const { error } = await supabaseAdmin.auth.resend({
        type: 'signup',
        email: targetUserEmail,
        options: {
            emailRedirectTo: redirectTo
        }
      });
      // Fallback para invite se resend não for o caso exato, mas geralmente inviteUserByEmail é para novos.
      // Vamos manter a lógica original mas usando a API correta de resend ou invite
      if (error) {
          // Tenta reenviar convite se o resend falhar
          const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(targetUserEmail, options);
          if (inviteError) throw error; 
      }
      
      responseMessage = `E-mail de confirmação reenviado para ${targetUserEmail}.`;

    } else if (action === 'send_password_reset') {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(targetUserEmail, options);
      if (error) throw error;
      responseMessage = `Link de redefinição de senha enviado para ${targetUserEmail}.`;

    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    return new Response(
      JSON.stringify({ message: responseMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in admin-user-actions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to perform user action.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})