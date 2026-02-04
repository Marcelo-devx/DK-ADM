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
    // Cria um cliente Supabase com a chave de serviço para ignorar o RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Cria um cliente Supabase regular para verificar a autenticação do usuário
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Obtém o usuário a partir do token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verifica se o usuário é um administrador
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Se o usuário for admin, prossegue para buscar todos os clientes
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw usersError;

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at'); // ADICIONADO created_at
    if (profilesError) throw profilesError;

    // Fetch all orders to calculate order count per user
    const { data: allOrders, error: allOrdersError } = await supabaseAdmin
        .from('orders')
        .select('user_id, status');
    if (allOrdersError) throw allOrdersError;

    const orderCountMap = new Map();
    const completedOrderMap = new Map();

    for (const order of allOrders) {
        // Total count
        orderCountMap.set(order.user_id, (orderCountMap.get(order.user_id) || 0) + 1);
        
        // Completed count
        if (order.status === 'Finalizada' || order.status === 'Pago') {
            completedOrderMap.set(order.user_id, (completedOrderMap.get(order.user_id) || 0) + 1);
        }
    }

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const clients = users.map(u => {
      const p = profilesMap.get(u.id) || {};
      const order_count = orderCountMap.get(u.id) || 0;
      const completed_order_count = completedOrderMap.get(u.id) || 0;
      
      return {
        id: u.id,
        email: u.email,
        created_at: p.created_at || u.created_at, // PRIORIDADE para a data do perfil (importada)
        updated_at: p.updated_at || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: p.role || 'user',
        force_pix_on_next_purchase: p.force_pix_on_next_purchase || false,
        order_count: order_count,
        completed_order_count: completed_order_count,
      };
    });

    return new Response(
      JSON.stringify(clients),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao buscar dados dos clientes.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})