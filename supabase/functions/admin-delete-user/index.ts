import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-delete-user] Token inválido:', userError)
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'adm') {
      console.error('[admin-delete-user] Acesso negado para usuário:', user.id)
      return new Response('Forbidden - Admin only', { status: 403, headers: corsHeaders })
    }

    const { userId, email, deleteOrders, reason } = await req.json()
    const targetUserId = userId ?? (email ? (await supabase.auth.admin.listUsers()).data.users.find((u) => u.email === email)?.id : null)

    if (!targetUserId || typeof deleteOrders !== 'boolean') {
      return new Response('Invalid request body', { status: 400, headers: corsHeaders })
    }

    if (targetUserId === user.id) {
      return new Response('Cannot delete yourself', { status: 400, headers: corsHeaders })
    }

    console.log(`[admin-delete-user] Iniciando exclusão do usuário ${targetUserId}. Excluir pedidos: ${deleteOrders}. Motivo: ${reason || 'N/A'}`)

    const { error: loyaltyError } = await supabase
      .from('loyalty_history')
      .delete()
      .eq('user_id', targetUserId)

    if (loyaltyError) {
      console.error('[admin-delete-user] Erro ao excluir loyalty_history:', loyaltyError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir histórico de fidelidade: ' + loyaltyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: couponsError } = await supabase
      .from('user_coupons')
      .delete()
      .eq('user_id', targetUserId)

    if (couponsError) {
      console.error('[admin-delete-user] Erro ao excluir user_coupons:', couponsError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir cupons do usuário: ' + couponsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: referralsError } = await supabase
      .from('referrals')
      .delete()
      .or(`referrer_id.eq.${targetUserId},referred_id.eq.${targetUserId}`)

    if (referralsError) {
      console.error('[admin-delete-user] Erro ao excluir referrals:', referralsError)
    }

    const { error: orderHistoryChangedByError } = await supabase
      .from('order_history')
      .update({ changed_by: null })
      .eq('changed_by', targetUserId)

    if (orderHistoryChangedByError) {
      console.error('[admin-delete-user] Erro ao anonimizar order_history.changed_by:', orderHistoryChangedByError)
      return new Response(
        JSON.stringify({ error: 'Erro ao anonimizar histórico de pedidos: ' + orderHistoryChangedByError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: dataJobsError } = await supabase
      .from('data_jobs')
      .update({ created_by: null })
      .eq('created_by', targetUserId)

    if (dataJobsError) {
      console.error('[admin-delete-user] Erro ao anonimizar data_jobs.created_by:', dataJobsError)
    }

    if (deleteOrders) {
      const { data: userOrders, error: fetchOrdersError } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', targetUserId)

      if (fetchOrdersError) {
        console.error('[admin-delete-user] Erro ao buscar pedidos:', fetchOrdersError)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar pedidos: ' + fetchOrdersError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (userOrders && userOrders.length > 0) {
        const orderIds = userOrders.map((o: { id: number }) => o.id)

        const { error: orderHistoryError } = await supabase
          .from('order_history')
          .delete()
          .in('order_id', orderIds)

        if (orderHistoryError) {
          console.error('[admin-delete-user] Erro ao excluir order_history:', orderHistoryError)
        }

        const { error: orderItemsError } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds)

        if (orderItemsError) {
          console.error('[admin-delete-user] Erro ao excluir order_items:', orderItemsError)
          return new Response(
            JSON.stringify({ error: 'Erro ao excluir itens dos pedidos: ' + orderItemsError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: ordersError } = await supabase
          .from('orders')
          .delete()
          .eq('user_id', targetUserId)

        if (ordersError) {
          console.error('[admin-delete-user] Erro ao excluir pedidos:', ordersError)
          return new Response(
            JSON.stringify({ error: 'Erro ao excluir pedidos: ' + ordersError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } else {
      const { error: anonymizeError } = await supabase
        .from('orders')
        .update({ user_id: null })
        .eq('user_id', targetUserId)

      if (anonymizeError) {
        console.error('[admin-delete-user] Erro ao anonimizar pedidos:', anonymizeError)
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUserId)

    if (profileError) {
      console.warn('[admin-delete-user] Aviso ao excluir profile (pode já ter sido deletado em cascade):', profileError.message)
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId, { shouldSoftDelete: false })

    if (authError) {
      console.error('[admin-delete-user] Erro ao excluir auth.user:', authError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir usuário do sistema de autenticação: ' + authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[admin-delete-user] Usuário ${targetUserId} excluído com sucesso`)

    return new Response(
      JSON.stringify({
        success: true,
        message: deleteOrders
          ? 'Usuário e todos os pedidos excluídos com sucesso'
          : 'Usuário excluído com sucesso (pedidos mantidos e anonimizados)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[admin-delete-user] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})