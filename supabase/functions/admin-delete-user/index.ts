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
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Criar cliente Supabase com service role (ignora RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar token do admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-delete-user] Token inválido:', userError)
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'adm') {
      console.error('[admin-delete-user] Acesso negado para usuário:', user.id)
      return new Response('Forbidden - Admin only', { status: 403, headers: corsHeaders })
    }

    // Parse request body
    const { userId, deleteOrders, reason } = await req.json()

    if (!userId || typeof deleteOrders !== 'boolean') {
      return new Response('Invalid request body', { status: 400, headers: corsHeaders })
    }

    // Verificar se não está tentando excluir a si mesmo
    if (userId === user.id) {
      return new Response('Cannot delete yourself', { status: 400, headers: corsHeaders })
    }

    console.log(`[admin-delete-user] Iniciando exclusão do usuário ${userId}. Excluir pedidos: ${deleteOrders}. Motivo: ${reason || 'N/A'}`)

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 1: Limpar loyalty_history do usuário
    // ─────────────────────────────────────────────────────────────────────────
    const { error: loyaltyError } = await supabase
      .from('loyalty_history')
      .delete()
      .eq('user_id', userId)

    if (loyaltyError) {
      console.error('[admin-delete-user] Erro ao excluir loyalty_history:', loyaltyError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir histórico de fidelidade: ' + loyaltyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log(`[admin-delete-user] loyalty_history do usuário ${userId} excluído`)

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 2: Limpar user_coupons do usuário
    // ─────────────────────────────────────────────────────────────────────────
    const { error: couponsError } = await supabase
      .from('user_coupons')
      .delete()
      .eq('user_id', userId)

    if (couponsError) {
      console.error('[admin-delete-user] Erro ao excluir user_coupons:', couponsError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir cupons do usuário: ' + couponsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log(`[admin-delete-user] user_coupons do usuário ${userId} excluídos`)

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 3: Limpar referrals do usuário (como referrer ou referred)
    // ─────────────────────────────────────────────────────────────────────────
    const { error: referralsError } = await supabase
      .from('referrals')
      .delete()
      .or(`referrer_id.eq.${userId},referred_id.eq.${userId}`)

    if (referralsError) {
      console.error('[admin-delete-user] Erro ao excluir referrals:', referralsError)
      // Não bloquear a exclusão por causa de referrals — apenas logar
      console.warn('[admin-delete-user] Continuando mesmo com erro em referrals...')
    } else {
      console.log(`[admin-delete-user] referrals do usuário ${userId} excluídos`)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 3.5: Anonimizar order_history onde changed_by = userId
    // FK: order_history.changed_by → profiles.id (NO ACTION — bloqueia delete)
    // ─────────────────────────────────────────────────────────────────────────
    const { error: orderHistoryChangedByError } = await supabase
      .from('order_history')
      .update({ changed_by: null })
      .eq('changed_by', userId)

    if (orderHistoryChangedByError) {
      console.error('[admin-delete-user] Erro ao anonimizar order_history.changed_by:', orderHistoryChangedByError)
      return new Response(
        JSON.stringify({ error: 'Erro ao anonimizar histórico de pedidos: ' + orderHistoryChangedByError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log(`[admin-delete-user] order_history.changed_by do usuário ${userId} anonimizado`)

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 3.6: Anonimizar data_jobs onde created_by = userId
    // FK: data_jobs.created_by → auth.users (NO ACTION — bloqueia delete)
    // ─────────────────────────────────────────────────────────────────────────
    const { error: dataJobsError } = await supabase
      .from('data_jobs')
      .update({ created_by: null })
      .eq('created_by', userId)

    if (dataJobsError) {
      console.error('[admin-delete-user] Erro ao anonimizar data_jobs.created_by:', dataJobsError)
      // Não bloquear — logar e continuar
      console.warn('[admin-delete-user] Continuando mesmo com erro em data_jobs...')
    } else {
      console.log(`[admin-delete-user] data_jobs.created_by do usuário ${userId} anonimizado`)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 4: Tratar pedidos (excluir ou manter anônimos)
    // ─────────────────────────────────────────────────────────────────────────
    if (deleteOrders) {
      // Buscar IDs dos pedidos para excluir order_items e order_history primeiro
      const { data: userOrders, error: fetchOrdersError } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId)

      if (fetchOrdersError) {
        console.error('[admin-delete-user] Erro ao buscar pedidos:', fetchOrdersError)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar pedidos: ' + fetchOrdersError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (userOrders && userOrders.length > 0) {
        const orderIds = userOrders.map((o: { id: number }) => o.id)
        console.log(`[admin-delete-user] Excluindo ${orderIds.length} pedidos e seus itens...`)

        // Excluir order_history dos pedidos
        const { error: orderHistoryError } = await supabase
          .from('order_history')
          .delete()
          .in('order_id', orderIds)

        if (orderHistoryError) {
          console.error('[admin-delete-user] Erro ao excluir order_history:', orderHistoryError)
          // Não bloquear — continuar
        }

        // Excluir order_items dos pedidos
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

        // Excluir os pedidos
        const { error: ordersError } = await supabase
          .from('orders')
          .delete()
          .eq('user_id', userId)

        if (ordersError) {
          console.error('[admin-delete-user] Erro ao excluir pedidos:', ordersError)
          return new Response(
            JSON.stringify({ error: 'Erro ao excluir pedidos: ' + ordersError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`[admin-delete-user] Pedidos e itens do usuário ${userId} excluídos`)
      }
    } else {
      // Manter pedidos mas anonimizar: user_id → NULL (FK tem ON DELETE SET NULL)
      // Isso já acontece automaticamente quando o auth.user é deletado,
      // mas fazemos explicitamente para garantir
      const { error: anonymizeError } = await supabase
        .from('orders')
        .update({ user_id: null })
        .eq('user_id', userId)

      if (anonymizeError) {
        console.error('[admin-delete-user] Erro ao anonimizar pedidos:', anonymizeError)
        // Não bloquear — a FK ON DELETE SET NULL vai cuidar disso
        console.warn('[admin-delete-user] Continuando — a FK ON DELETE SET NULL vai anonimizar os pedidos')
      } else {
        console.log(`[admin-delete-user] Pedidos do usuário ${userId} anonimizados (user_id = NULL)`)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 5: Excluir o usuário do auth.users (hard delete)
    // Isso libera o email para reuso e pode acionar cascade no profile
    // ─────────────────────────────────────────────────────────────────────────
    const { error: authError } = await supabase.auth.admin.deleteUser(
      userId,
      { shouldSoftDelete: false }
    )

    if (authError) {
      console.error('[admin-delete-user] Erro ao excluir auth.user:', authError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir usuário do sistema de autenticação: ' + authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[admin-delete-user] Usuário ${userId} excluído do auth.users. Email liberado para reuso.`)

    // ─────────────────────────────────────────────────────────────────────────
    // PASSO 6: Excluir o profile (caso o cascade não tenha feito automaticamente)
    // ─────────────────────────────────────────────────────────────────────────
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      // Se o profile já foi deletado em cascade, isso é esperado — não é erro crítico
      console.warn('[admin-delete-user] Aviso ao excluir profile (pode já ter sido deletado em cascade):', profileError.message)
    } else {
      console.log(`[admin-delete-user] Profile do usuário ${userId} excluído`)
    }

    console.log(`[admin-delete-user] ✅ Usuário ${userId} excluído com sucesso`)

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