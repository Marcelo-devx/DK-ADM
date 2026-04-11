import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_ROLES = ['adm', 'gerente_geral']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-get-order-history] Token inválido:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar role do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[admin-get-order-history] Erro ao buscar profile:', profileError.message)
    }

    const isAdminRole = profile && ADMIN_ROLES.includes(profile.role)

    // Parse request body
    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Se não for admin/gerente_geral, verificar se o pedido pertence ao usuário
    if (!isAdminRole) {
      const { data: orderCheck } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single()

      if (!orderCheck || orderCheck.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Buscar histórico com join para mostrar quem fez a alteração
    const { data: history, error: historyError } = await supabase
      .from('order_history')
      .select(`
        *,
        profiles:changed_by (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false })

    if (historyError) {
      console.error('[admin-get-order-history] Erro ao buscar histórico:', historyError)
      return new Response(
        JSON.stringify({ error: historyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[admin-get-order-history] Histórico do pedido ${orderId}: ${history?.length || 0} entradas. Solicitado por ${user.id} (${profile?.role})`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        history: history || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-get-order-history] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
