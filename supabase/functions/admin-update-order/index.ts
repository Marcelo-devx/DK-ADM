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
    const { orderId, updates, reason } = await req.json()

    if (!orderId || !updates || typeof updates !== 'object') {
      return new Response('Invalid request body', { status: 400, headers: corsHeaders })
    }

    // Buscar pedido atual para comparação
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      return new Response('Order not found', { status: 404, headers: corsHeaders })
    }

    // Processar alterações e registrar histórico
    const historyEntries = []
    const fieldsToTrack = {
      status: { type: 'status' },
      delivery_status: { type: 'status' },
      payment_method: { type: 'status' },
      total_price: { type: 'value' },
      shipping_cost: { type: 'value' },
      coupon_discount: { type: 'value' },
      donation_amount: { type: 'value' },
      shipping_address: { type: 'address' },
      delivery_info: { type: 'status' }
    }

    for (const [field, value] of Object.entries(updates)) {
      if (fieldsToTrack[field]) {
        const oldValue = currentOrder[field]
        const newValue = value

        // Só registrar se realmente mudou
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const fieldConfig = fieldsToTrack[field]
          historyEntries.push({
            order_id: orderId,
            field_name: field,
            old_value: oldValue !== null ? String(oldValue) : null,
            new_value: newValue !== null ? String(newValue) : null,
            changed_by: user.id,
            change_type: fieldConfig.type,
            reason: reason || null
          })
        }
      }
    }

    // Atualizar pedido
    const { error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (updateError) {
      console.error('[admin-update-order] Erro ao atualizar pedido:', updateError)
      return new Response(updateError.message, { status: 500, headers: corsHeaders })
    }

    // Inserir histórico
    if (historyEntries.length > 0) {
      const { error: historyError } = await supabase
        .from('order_history')
        .insert(historyEntries)

      if (historyError) {
        console.error('[admin-update-order] Erro ao inserir histórico:', historyError)
        // Continuar mesmo se falhar inserir histórico
      }
    }

    console.log(`[admin-update-order] Pedido ${orderId} atualizado. ${historyEntries.length} campos alterados.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pedido atualizado com sucesso',
        changes: historyEntries.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-update-order] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})