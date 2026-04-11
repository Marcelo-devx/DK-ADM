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
      console.error('[admin-cancel-order] Token inválido:', userError?.message)
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
      console.error('[admin-cancel-order] Erro ao buscar profile:', profileError.message)
    }

    console.log(`[admin-cancel-order] Usuário ${user.id} com role: ${profile?.role}`)

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      console.warn(`[admin-cancel-order] Acesso negado para role: ${profile?.role}`)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Acesso negado. Apenas Admin e Gerente Geral podem cancelar pedidos.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { orderId, reason, returnStock } = await req.json()

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ error: 'orderId e reason são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar pedido atual
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status, delivery_status')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      console.error('[admin-cancel-order] Pedido não encontrado:', orderId, fetchError?.message)
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Se o pedido já estiver cancelado, retorna sucesso sem fazer nada
    if (currentOrder.status === 'Cancelado') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pedido já está cancelado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar status para Cancelado (sem excluir o pedido)
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
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // O trigger return_order_stock_on_cancel devolve o estoque automaticamente
    // quando status muda para 'Cancelado'

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
      // Não falha o cancelamento por causa do histórico
    }

    console.log(`[admin-cancel-order] Pedido ${orderId} cancelado por ${user.id} (${profile.role}). Devolver estoque: ${returnStock}. Motivo: ${reason}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pedido cancelado com sucesso',
        stockReturned: returnStock
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-cancel-order] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
