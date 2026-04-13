import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROLES = ['adm', 'gerente_geral']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-delete-order] Token inválido:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[admin-delete-order] Erro ao buscar profile:', profileError.message)
    }

    console.log(`[admin-delete-order] Usuário ${user.id} com role: ${profile?.role}`)

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      console.warn(`[admin-delete-order] Acesso negado para role: ${profile?.role}`)
      return new Response(
        JSON.stringify({ error: 'Não autorizado: Acesso restrito a Admin e Gerente Geral' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { orderId, reason } = await req.json()

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ error: 'ID do pedido e motivo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar dados do pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles(first_name, last_name, phone)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ---------------------------------------------------------------
    // SEGURANÇA: só permite deletar pedidos já Cancelados.
    // O cancelamento é quem reverte o estoque (via trigger no banco).
    // Deletar um pedido não-cancelado causaria perda de estoque.
    // ---------------------------------------------------------------
    if (order.status !== 'Cancelado') {
      console.warn(`[admin-delete-order] Tentativa de deletar pedido ${orderId} com status "${order.status}" — bloqueado`)
      return new Response(
        JSON.stringify({
          error: `Não é possível excluir um pedido com status "${order.status}". Cancele o pedido primeiro para que o estoque seja devolvido corretamente.`
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[admin-delete-order] Deletando pedido ${orderId} (já Cancelado) por ${user.id} (${profile.role}). Motivo: ${reason}`)

    // Salvar snapshot do pedido no histórico ANTES de deletar
    const { error: historyInsertError } = await supabase
      .from('order_history')
      .insert({
        order_id: orderId,
        field_name: 'deleted',
        old_value: JSON.stringify(order),
        new_value: null,
        change_type: 'delete',
        reason: reason,
        changed_by: user.id
      })

    if (historyInsertError) {
      console.error('[admin-delete-order] Erro ao inserir histórico pré-delete:', historyInsertError)
      // Não bloqueia a exclusão por causa do histórico
    }

    // Deletar registros filhos (o estoque JÁ foi revertido pelo trigger no cancelamento)

    // 1. order_items
    const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', orderId)
    if (itemsError) {
      console.error('[admin-delete-order] Erro ao deletar order_items:', itemsError.message)
      return new Response(JSON.stringify({ error: 'Erro ao deletar itens: ' + itemsError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. reviews
    const { error: reviewsError } = await supabase.from('reviews').delete().eq('order_id', orderId)
    if (reviewsError) console.warn('[admin-delete-order] Aviso reviews:', reviewsError.message)

    // 3. route_stops
    const { error: routeStopsError } = await supabase.from('route_stops').delete().eq('order_id', orderId)
    if (routeStopsError) console.warn('[admin-delete-order] Aviso route_stops:', routeStopsError.message)

    // 4. primeiros_pedidos
    const { error: primeirosError } = await supabase.from('primeiros_pedidos').delete().eq('order_id', orderId)
    if (primeirosError) console.warn('[admin-delete-order] Aviso primeiros_pedidos:', primeirosError.message)

    // 5. user_coupons — limpa o vínculo (order_id = null), NÃO deleta o cupom
    const { error: couponsError } = await supabase.from('user_coupons').update({ order_id: null }).eq('order_id', orderId)
    if (couponsError) console.warn('[admin-delete-order] Aviso user_coupons:', couponsError.message)

    // 6. loyalty_history — limpa o vínculo (related_order_id = null)
    const { error: loyaltyError } = await supabase.from('loyalty_history').update({ related_order_id: null }).eq('related_order_id', orderId)
    if (loyaltyError) console.warn('[admin-delete-order] Aviso loyalty_history:', loyaltyError.message)

    // 7. order_history — deletar registros de histórico anteriores do pedido
    const { error: historyDeleteError } = await supabase.from('order_history').delete().eq('order_id', orderId)
    if (historyDeleteError) console.warn('[admin-delete-order] Aviso order_history:', historyDeleteError.message)

    // Deletar o pedido principal
    // NOTA: o trigger tr_return_stock_on_order_change no banco também dispara no DELETE,
    // mas como o pedido já está Cancelado (OLD.status = 'Cancelado'), o trigger não
    // reverte o estoque de novo (condição: OLD.status <> 'Cancelado' para UPDATE,
    // e para DELETE ele reverteria — mas os order_items já foram deletados acima,
    // então não há itens para reverter, sem risco de duplicação).
    const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId)

    if (deleteError) {
      console.error('[admin-delete-order] Erro ao deletar pedido:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[admin-delete-order] Pedido ${orderId} deletado com sucesso`)

    return new Response(
      JSON.stringify({ success: true, message: 'Pedido excluído com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-delete-order] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: `Erro ao excluir pedido: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
