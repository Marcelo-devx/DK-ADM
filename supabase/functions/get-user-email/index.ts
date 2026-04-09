import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    console.log('[get-user-email] Iniciando requisição');

    // Verificar Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[get-user-email] Authorization header missing');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Criar cliente Supabase admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Criar cliente Supabase para verificar autenticação
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar autenticação do usuário
    let user;
    try {
      const result = await supabaseClient.auth.getUser();
      if (result.error) {
        console.error('[get-user-email] Erro ao buscar usuário:', result.error);
        return new Response(JSON.stringify({ error: 'Erro de autenticação', details: result.error.message }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = result.data?.user;
    } catch (authError) {
      console.error('[get-user-email] Exceção ao buscar usuário:', authError);
      return new Response(JSON.stringify({ error: 'Erro de autenticação', details: String(authError) }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!user) {
      console.log('[get-user-email] Usuário não autenticado');
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[get-user-email] Usuário autenticado:', user.id);

    // Verificar se é admin
    let profile;
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (result.error) {
        console.error('[get-user-email] Erro ao buscar perfil:', result.error);
        return new Response(JSON.stringify({ error: 'Erro ao verificar permissões', details: result.error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      profile = result.data;
    } catch (profileError) {
      console.error('[get-user-email] Exceção ao buscar perfil:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões', details: String(profileError) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!profile || profile.role !== 'adm') {
      console.log('[get-user-email] Usuário não é admin', profile?.role);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[get-user-email] Usuário autorizado como admin');

    // Ler body para obter userId
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId) {
      console.log('[get-user-email] userId não fornecido');
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[get-user-email] Buscando email para userId:', userId);

    // Buscar email do usuário na tabela auth.users usando admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError) {
      console.error('[get-user-email] Erro ao buscar usuário:', userError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuário', details: userError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!userData || !userData.user) {
      console.log('[get-user-email] Usuário não encontrado');
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const email = userData.user.email;

    console.log('[get-user-email] Email encontrado:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: email || null 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[get-user-email] Erro geral não tratado:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao buscar email do usuário.', details: error?.message || String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
