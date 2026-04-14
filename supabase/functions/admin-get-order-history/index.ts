import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ADMIN_ROLES = ['adm', 'gerente_geral']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-get-order-history] Token inválido:', userError?.message)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[admin-get-order-history] Erro ao buscar profile:', profileError.message)
    }

    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: history, error: historyError } = await supabase
      .from('order_history')
      .select('id, order_id, field_name, old_value, new_value, changed_at, change_type, reason, changed_by')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false })

    if (historyError) {
      console.error('[admin-get-order-history] Erro ao buscar histórico:', historyError)
      return new Response(JSON.stringify({ error: historyError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const changedByIds = [...new Set((history || []).map((entry) => entry.changed_by).filter(Boolean))]
    let profilesMap = new Map<string, { id: string; first_name: string | null; last_name: string | null; email: string | null }>()

    if (changedByIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', changedByIds)

      if (profiles) {
        profilesMap = new Map(profiles.map((profileRow) => [profileRow.id, profileRow]))
      }
    }

    const enrichedHistory = (history || []).map((entry) => ({
      ...entry,
      profiles: entry.changed_by ? profilesMap.get(entry.changed_by) || null : null,
    }))

    console.log(`[admin-get-order-history] Histórico do pedido ${orderId}: ${enrichedHistory.length} entradas. Solicitado por ${user.id} (${profile.role})`)

    return new Response(JSON.stringify({ success: true, history: enrichedHistory }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[admin-get-order-history] Erro inesperado:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
