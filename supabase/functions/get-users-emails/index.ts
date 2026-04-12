// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    console.log('[get-users-emails] Iniciando requisição')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('[get-users-emails] Authorization header ausente')
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar se o usuário é admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.log('[get-users-emails] Usuário não autenticado')
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Verificar role admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'adm') {
      console.log('[get-users-emails] Usuário não é admin:', profile?.role)
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Ler lista de user_ids do body
    const body = await req.json().catch(() => ({}))
    const userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : []

    if (userIds.length === 0) {
      console.log('[get-users-emails] Nenhum user_id recebido')
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[get-users-emails] Buscando emails para ${userIds.length} usuários`)

    // Buscar emails direto da tabela profiles (que já sincroniza o email via get-users)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('id', userIds)

    if (profilesError) {
      console.error('[get-users-emails] Erro ao buscar profiles:', profilesError)
    }

    // Montar mapa de id -> email a partir dos profiles
    const emailMap = new Map<string, string>()
    for (const p of profiles ?? []) {
      if (p.email) emailMap.set(p.id, p.email)
    }

    // Para os que ainda não têm email no profiles, buscar direto no auth.users via admin
    const missingIds = userIds.filter(id => !emailMap.has(id))
    if (missingIds.length > 0) {
      console.log(`[get-users-emails] Buscando ${missingIds.length} emails direto no auth.users`)
      // Varrer páginas do auth.users para encontrar os ids faltantes
      let page = 1
      const perPage = 1000
      let hasMore = true

      while (hasMore && missingIds.length > 0) {
        const res = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        const users = res?.data?.users ?? []

        for (const u of users) {
          if (missingIds.includes(u.id) && u.email) {
            emailMap.set(u.id, u.email)
            // Sincronizar no profiles para próximas vezes
            await supabaseAdmin
              .from('profiles')
              .update({ email: u.email })
              .eq('id', u.id)
          }
        }

        hasMore = users.length === perPage
        page += 1
      }
    }

    const result = userIds.map(id => ({ id, email: emailMap.get(id) ?? '' }))

    console.log(`[get-users-emails] Retornando ${result.length} registros, ${result.filter(r => r.email).length} com email`)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[get-users-emails] Erro geral:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
