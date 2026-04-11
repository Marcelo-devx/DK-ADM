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

    // Validate Authorization header exists
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[get-users] Authorization header missing');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('[get-users] Supabase Admin client criado');

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user authentication with proper error handling
    let user;
    try {
      const result = await supabaseClient.auth.getUser();
      if (result.error) {
        console.error('[get-users] Erro ao buscar usuário:', result.error);
        return new Response(JSON.stringify({ error: 'Erro de autenticação', details: result.error.message }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = result.data?.user;
    } catch (authError) {
      console.error('[get-users] Exceção ao buscar usuário:', authError);
      return new Response(JSON.stringify({ error: 'Erro de autenticação', details: String(authError) }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!user) {
      console.log('[get-users] Usuário não autenticado');
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[get-users] Usuário autenticado:', user.id);

    // Verify admin role with proper error handling
    let profile;
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (result.error) {
        console.error('[get-users] Erro ao buscar perfil:', result.error);
        return new Response(JSON.stringify({ error: 'Erro ao verificar permissões', details: result.error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      profile = result.data;
    } catch (profileError) {
      console.error('[get-users] Exceção ao buscar perfil:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões', details: String(profileError) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!profile || profile.role !== 'adm') {
      console.log('[get-users] Usuário não é admin', profile?.role);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    try {
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
          throw new Error(`Erro ao buscar CPF: ${cpfSearchError.message}`);
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
    } catch (listError) {
      console.error('[get-users] Erro ao listar usuários:', listError);
      return new Response(
        JSON.stringify({ error: 'Erro ao listar usuários', details: String(listError) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // If no users for the requested page, return empty list
    if (!usersForPage || usersForPage.length === 0) {
      return new Response(JSON.stringify([]), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userIds = usersForPage.map(u => u.id);

    // Fetch only profiles for these users with error handling
    let profiles;
    let orders;
    
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, role, force_pix_on_next_purchase, updated_at, created_at, cpf_cnpj, email')
        .in('id', userIds);

      if (result.error) {
        console.error('[get-users] Erro ao buscar perfis:', result.error);
        throw new Error(`Erro ao buscar perfis: ${result.error.message}`);
      }
      profiles = result.data;
    } catch (profilesError) {
      console.error('[get-users] Erro ao buscar perfis:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar dados de perfil', details: String(profilesError) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Fetch orders only for these userIds to compute counts with error handling
    try {
      const result = await supabaseAdmin
        .from('orders')
        .select('user_id, status')
        .in('user_id', userIds);

      if (result.error) {
        console.error('[get-users] Erro ao buscar pedidos:', result.error);
        throw new Error(`Erro ao buscar pedidos: ${result.error.message}`);
      }
      orders = result.data;
    } catch (ordersError) {
      console.error('[get-users] Erro ao buscar pedidos:', ordersError);
      // Don't fail the whole request if orders fail, just return empty orders
      orders = [];
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

    // Sync email into profiles for any user where profiles.email is missing
    const profilesToSync = usersForPage.filter(u => {
      const p = profilesMap.get(u.id);
      return u.email && (!p?.email || p.email !== u.email);
    });

    if (profilesToSync.length > 0) {
      console.log(`[get-users] Sincronizando email em ${profilesToSync.length} perfis`);
      for (const u of profilesToSync) {
        await supabaseAdmin
          .from('profiles')
          .update({ email: u.email })
          .eq('id', u.id);
        // Update local map so the response is consistent
        const p = profilesMap.get(u.id);
        if (p) p.email = u.email;
      }
    }

    const clients = usersForPage.map(u => {
      const p = profilesMap.get(u.id) || {};
      return {
        id: u.id,
        email: p.email || u.email,
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

    try {
      return new Response(JSON.stringify(clients), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (jsonError) {
      console.error('[get-users] Erro ao serializar JSON:', jsonError);
      return new Response(
        JSON.stringify({ error: 'Erro ao formatar dados dos clientes', details: String(jsonError) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  } catch (error) {
    console.error('[get-users] Erro geral não tratado:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao buscar dados dos clientes.', details: error?.message || String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})