// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
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

    // Ler body (esperamos POST com JSON contendo limit, page, search)
    const body = await req.json().catch(() => ({}));
    const requestedLimit = Math.max(1, Math.min(100, Number(body.limit) || 10));
    const requestedPage = Math.max(1, Number(body.page) || 1);
    const search = (body.search || '').toString().trim().toLowerCase();

    console.log('[get-users] Params', { requestedLimit, requestedPage, search });

    // If search is provided, we will scan pages to find matches.
    // Detect if search is CPF (digits only) or email (contains @)
    const isCPF = /^[0-9]+$/.test(search);
    const isEmail = search.includes('@');

    // For normal listing (no search), we use admin.listUsers with pagination directly.
    let usersForPage = [];

    if (!search) {
      // Directly request page from admin.listUsers
      const perPage = requestedLimit;
      const page = requestedPage;
      console.log('[get-users] Listing users page', page, 'perPage', perPage);

      const res = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      const users = res?.data?.users || [];
      usersForPage = users;
    } else if (isCPF) {
      // Search by CPF in profiles table
      console.log('[get-users] Searching by CPF in profiles table');

      const { data: profiles, error: cpfSearchError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('cpf_cnpj', `%${search}%`);

      if (cpfSearchError) {
        console.error('[get-users] Erro ao buscar por CPF:', cpfSearchError);
        throw cpfSearchError;
      }

      // If no profiles found with this CPF, return empty list
      if (!profiles || profiles.length === 0) {
        console.log(`[get-users] CPF "${search}" não encontrado`);
        return new Response(JSON.stringify([]), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get user IDs from profiles
      const userIdsFromCPF = profiles.map(p => p.id);

      // Now fetch the actual users from auth.users
      const perPage = 1000;
      let page = 1;
      const matches: any[] = [];
      let hasMore = true;

      // Scan all pages of auth.users to find matches by ID
      while (hasMore) {
        const res = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        const users = res?.data?.users || [];
        if (!users || users.length === 0) {
          hasMore = false;
          break;
        }

        // Check if any of these users have an ID in our CPF matches
        for (const u of users) {
          if (userIdsFromCPF.includes(u.id)) {
            matches.push(u);
          }
        }

        hasMore = users.length === perPage;
        page += 1;
      }

      console.log(`[get-users] CPF search "${search}" found ${matches.length} matches`);

      // Paginate matches
      const start = (requestedPage - 1) * requestedLimit;
      usersForPage = matches.slice(start, start + requestedLimit);
    } else {
      // Search by email (case-insensitive). Scan ALL pages to find matches.
      const perPage = 1000; // chunk size for scanning
      let page = 1;
      const matches: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const res = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        const users = res?.data?.users || [];
        if (!users || users.length === 0) {
          hasMore = false;
          break;
        }

        for (const u of users) {
          const email = (u.email || '').toString().toLowerCase();
          if (email.includes(search)) matches.push(u);
        }

        hasMore = users.length === perPage;
        page += 1;
      }

      console.log(`[get-users] Search "${search}" found ${matches.length} matches after scanning ${page - 1} pages`);

      // slice matches to requested page
      const start = (requestedPage - 1) * requestedLimit;
      usersForPage = matches.slice(start, start + requestedLimit);
    }

    // If no users for the requested page, return empty list
    if (!usersForPage || usersForPage.length === 0) {
      return new Response(JSON.stringify([]), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userIds = usersForPage.map(u => u.id);

    // Fetch only profiles for these users
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj')
      .in('id', userIds);

    if (profilesError) {
      console.error('[get-users] Erro ao buscar perfis:', profilesError);
      throw profilesError;
    }

    // Fetch orders only for these userIds to compute counts
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('user_id, status')
      .in('user_id', userIds);

    if (ordersError) {
      console.error('[get-users] Erro ao buscar pedidos:', ordersError);
      throw ordersError;
    }

    const orderCountMap = new Map();
    const completedOrderMap = new Map();
    const completedStatuses = ['Finalizada', 'Pago', 'Entregue', 'Concluída'];

    for (const order of orders || []) {
      orderCountMap.set(order.user_id, (orderCountMap.get(order.user_id) || 0) + 1);
      if (completedStatuses.includes(order.status)) {
        completedOrderMap.set(order.user_id, (completedOrderMap.get(order.user_id) || 0) + 1);
      }
    }

    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

    const clients = usersForPage.map(u => {
      const p = profilesMap.get(u.id) || {};
      return {
        id: u.id,
        email: u.email,
        created_at: p.created_at || u.created_at,
        updated_at: p.updated_at || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: p.role || 'user',
        force_pix_on_next_purchase: p.force_pix_on_next_purchase === true,
        order_count: orderCountMap.get(u.id) || 0,
        completed_order_count: completedOrderMap.get(u.id) || 0,
        cpf_cnpj: p.cpf_cnpj || null,
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
