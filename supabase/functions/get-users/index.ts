// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[get-users] Iniciando requisição');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('[get-users] Supabase Admin client criado');

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('[get-users] Erro ao buscar usuário:', userError);
      throw userError;
    }
    
    if (!user) {
      console.log('[get-users] Usuário não autenticado');
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[get-users] Usuário autenticado:', user.id);

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
      console.error('[get-users] Erro ao buscar perfil:', profileError);
      throw profileError;
    }

    if (!profile || profile.role !== 'adm') {
      console.log('[get-users] Usuário não é admin');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[get-users] Usuário autorizado como admin');

    // Buscar todos os usuários com paginação
    let allUsers = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    console.log('[get-users] Iniciando busca de usuários com paginação');

    while (hasMore) {
      const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      });
      
      if (usersError) {
        console.error('[get-users] Erro ao buscar usuários (paginação):', usersError);
        throw usersError;
      }

      if (users && users.length > 0) {
        allUsers = allUsers.concat(users);
        console.log(`[get-users] Página ${page}: ${users.length} usuários`);
      }

      hasMore = users && users.length === perPage;
      page++;
    }

    console.log(`[get-users] Total de usuários encontrados: ${allUsers.length}`);

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at');
      
    if (profilesError) {
      console.error('[get-users] Erro ao buscar perfis:', profilesError);
      throw profilesError;
    }

    console.log(`[get-users] Total de perfis encontrados: ${profiles.length}`);

    const { data: allOrders, error: allOrdersError } = await supabaseAdmin
        .from('orders')
        .select('user_id, status');
        
    if (allOrdersError) {
      console.error('[get-users] Erro ao buscar pedidos:', allOrdersError);
      throw allOrdersError;
    }

    console.log(`[get-users] Total de pedidos encontrados: ${allOrders.length}`);

    const orderCountMap = new Map();
    const completedOrderMap = new Map();

    for (const order of allOrders) {
        orderCountMap.set(order.user_id, (orderCountMap.get(order.user_id) || 0) + 1);
        if (order.status === 'Finalizada' || order.status === 'Pago') {
            completedOrderMap.set(order.user_id, (completedOrderMap.get(order.user_id) || 0) + 1);
        }
    }

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const clients = allUsers.map(u => {
      const p = profilesMap.get(u.id) || {};
      return {
        id: u.id,
        email: u.email,
        created_at: p.created_at || u.created_at, 
        updated_at: p.updated_at || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: p.role || 'user',
        force_pix_on_next_purchase: p.force_pix_on_next_purchase || false,
        order_count: orderCountMap.get(u.id) || 0,
        completed_order_count: completedOrderMap.get(u.id) || 0,
      };
    });

    console.log(`[get-users] Retornando ${clients.length} clientes`);

    return new Response(JSON.stringify(clients), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('[get-users] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao buscar dados dos clientes.', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})