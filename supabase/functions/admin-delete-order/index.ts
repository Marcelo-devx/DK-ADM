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

    // Verificar se tem role permitido (adm ou gerente_geral)
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

    // Buscar dados do pedido antes de deletar (para histórico)
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

    console.log(`[admin-delete-order] Deletando pedido ${orderId} por ${user.id} (${profile.role}). Motivo: ${reason}`)

    // ---------------------------------------------------------------
    // REVERTER ESTOQUE: buscar os itens ANTES de deletar
    // ---------------------------------------------------------------
    const { data: orderItems, error: itemsFetchError } = await supabase
      .from('order_items')
      .select('item_id, variant_id, quantity, item_type, name_at_purchase')
      .eq('order_id', orderId)

    if (itemsFetchError) {
      console.error('[admin-delete-order] Erro ao buscar order_items para reverter estoque:', itemsFetchError.message)
    } else if (orderItems && orderItems.length > 0) {
      console.log(`[admin-delete-order] Revertendo estoque de ${orderItems.length} item(s) do pedido ${orderId}`)

      for (const item of orderItems) {
        try {
          if (item.variant_id) {
            // Item com variante: incrementa stock_quantity na product_variants
            const { data: variant, error: variantFetchErr } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', item.variant_id)
              .single()

            if (variantFetchErr || !variant) {
              console.warn(`[admin-delete-order] Variante ${item.variant_id} não encontrada, pulando reversão`)
              continue
            }

            const newStock = (variant.stock_quantity ?? 0) + item.quantity
            const { error: variantUpdateErr } = await supabase
              .from('product_variants')
              .update({ stock_quantity: newStock })
              .eq('id', item.variant_id)

            if (variantUpdateErr) {
              console.error(`[admin-delete-order] Erro ao reverter estoque da variante ${item.variant_id}:`, variantUpdateErr.message)
            } else {
              console.log(`[admin-delete-order] Variante ${item.variant_id} (${item.name_at_purchase}): ${variant.stock_quantity} → ${newStock} (+${item.quantity})`)
            }

          } else if (item.item_id) {
            // Item sem variante: incrementa stock_quantity na products
            const { data: product, error: productFetchErr } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.item_id)
              .single()

            if (productFetchErr || !product) {
              console.warn(`[admin-delete-order] Produto ${item.item_id} não encontrado, pulando reversão`)
              continue
            }

            const newStock = (product.stock_quantity ?? 0) + item.quantity
            const { error: productUpdateErr } = await supabase
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', item.item_id)

            if (productUpdateErr) {
              console.error(`[admin-delete-order] Erro ao reverter estoque do produto ${item.item_id}:`, productUpdateErr.message)
            } else {
              console.log(`[admin-delete-order] Produto ${item.item_id} (${item.name_at_purchase}): ${product.stock_quantity} → ${newStock} (+${item.quantity})`)
            }
          } else {
            console.warn(`[admin-delete-order] Item sem variant_id nem item_id, pulando reversão:`, item)
          }
        } catch (e) {
          console.error(`[admin-delete-order] Erro inesperado ao reverter item:`, e)
        }
      }

      console.log(`[admin-delete-order] Reversão de estoque concluída para pedido ${orderId}`)
    } else {
      console.log(`[admin-delete-order] Nenhum item encontrado para reverter estoque do pedido ${orderId}`)
    }
    // ---------------------------------------------------------------

    // Deletar todos os registros filhos antes do pedido (evita foreign key constraint)
    // Ordem: filhos que não têm dependências entre si primeiro

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

    // 5. user_coupons — apenas limpa o vínculo (order_id = null), NÃO deleta o cupom
    const { error: couponsError } = await supabase.from('user_coupons').update({ order_id: null }).eq('order_id', orderId)
    if (couponsError) console.warn('[admin-delete-order] Aviso user_coupons:', couponsError.message)

    // 6. loyalty_history — limpa o vínculo (related_order_id = null)
    const { error: loyaltyError } = await supabase.from('loyalty_history').update({ related_order_id: null }).eq('related_order_id', orderId)
    if (loyaltyError) console.warn('[admin-delete-order] Aviso loyalty_history:', loyaltyError.message)

    // 7. order_history — deletar registros de histórico do pedido
    const { error: historyDeleteError } = await supabase.from('order_history').delete().eq('order_id', orderId)
    if (historyDeleteError) console.warn('[admin-delete-order] Aviso order_history:', historyDeleteError.message)

    // Agora deletar o pedido principal
    const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId)

    if (deleteError) {
      console.error('[admin-delete-order] Erro ao deletar pedido:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Registrar histórico de exclusão
    const { error: historyError } = await supabase
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

    if (historyError) {
      console.error('[admin-delete-order] Erro ao inserir histórico:', historyError)
      // Não falhar se o histórico falhar, o pedido já foi deletado
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
