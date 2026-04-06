import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    const { orderId, reason } = await req.json()

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ error: 'orderId and reason are required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Verificar permissões do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'adm') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Buscar dados do pedido antes de deletar (para histórico)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles(first_name, last_name, email, phone)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log(`[admin-delete-order] Deletando pedido ${orderId}. Motivo: ${reason}`)

    // Deletar o pedido (o trigger trigger_return_stock_on_delete vai devolver o estoque)
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)

    if (deleteError) {
      console.error('[admin-delete-order] Erro ao deletar pedido:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: corsHeaders }
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
      JSON.stringify({ success: true, message: 'Order deleted successfully' }),
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error('[admin-delete-order] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
