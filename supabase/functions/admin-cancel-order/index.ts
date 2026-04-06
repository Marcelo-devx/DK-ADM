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
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'adm') {
      return new Response('Forbidden - Admin only', { status: 403, headers: corsHeaders })
    }

    // Parse request body
    const { orderId, reason, returnStock } = await req.json()

    if (!orderId || !reason) {
      return new Response('Invalid request body: orderId and reason are required', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Buscar pedido atual
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status, delivery_status')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      return new Response('Order not found', { status: 404, headers: corsHeaders })
    }

    // Se o pedido já estiver cancelado, não faz nada
    if (currentOrder.status === 'Cancelado') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pedido já está cancelado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar status para Cancelado
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'Cancelado',
        delivery_status: 'Cancelado',
        delivery_info: reason
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[admin-cancel-order] Erro ao cancelar pedido:', updateError)
      return new Response(updateError.message, { status: 500, headers: corsHeaders })
    }

    // Se returnStock for true, devolver estoque
    // O trigger return_order_stock_on_cancel já fará isso automaticamente quando status mudar para Cancelado
    // Não precisamos fazer nada adicional aqui

    // Registrar histórico
    const historyEntry = {
      order_id: orderId,
      field_name: 'status',
      old_value: currentOrder.status,
      new_value: 'Cancelado',
      changed_by: user.id,
      change_type: 'cancel',
      reason
    }

    const { error: historyError } = await supabase
      .from('order_history')
      .insert(historyEntry)

    if (historyError) {
      console.error('[admin-cancel-order] Erro ao inserir histórico:', historyError)
    }

    console.log(`[admin-cancel-order] Pedido ${orderId} cancelado. Devolver estoque: ${returnStock}. Motivo: ${reason}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pedido cancelado com sucesso',
        stockReturned: returnStock
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-cancel-order] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
