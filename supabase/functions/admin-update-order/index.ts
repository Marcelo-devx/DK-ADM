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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente com service role para bypassar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verificar token do usuário
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-update-order] Token inválido:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se tem role permitido (adm ou gerente_geral)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[admin-update-order] Erro ao buscar profile:', profileError.message)
    }

    console.log(`[admin-update-order] Usuário ${user.id} com role: ${profile?.role}`)

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      console.warn(`[admin-update-order] Acesso negado para role: ${profile?.role}`)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Acesso negado. Apenas Admin e Gerente Geral podem editar pedidos.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { orderId, updates, reason } = await req.json()

    if (!orderId || !updates || typeof updates !== 'object') {
      return new Response(
        JSON.stringify({ error: 'orderId e updates são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar pedido atual para comparação (sem restrição de status)
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      console.error('[admin-update-order] Pedido não encontrado:', orderId, fetchError?.message)
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
          // Serializar objetos como JSON string para o histórico
          const oldStr = oldValue !== null && oldValue !== undefined
            ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue))
            : null
          const newStr = newValue !== null && newValue !== undefined
            ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue))
            : null

          historyEntries.push({
            order_id: orderId,
            field_name: field,
            old_value: oldStr,
            new_value: newStr,
            changed_by: user.id,
            change_type: fieldConfig.type,
            reason: reason || null
          })
        }
      }
    }

    // Atualizar pedido (admin pode editar qualquer pedido independente do status)
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (updateError) {
      console.error('[admin-update-order] Erro ao atualizar pedido:', updateError)
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inserir histórico usando service role (bypassa RLS)
    if (historyEntries.length > 0) {
      const { error: historyError } = await supabaseAdmin
        .from('order_history')
        .insert(historyEntries)

      if (historyError) {
        console.error('[admin-update-order] Erro ao inserir histórico:', historyError.message, historyError)
        // Continuar mesmo se falhar inserir histórico
      } else {
        console.log(`[admin-update-order] ${historyEntries.length} entradas de histórico inseridas.`)
      }
    }

    console.log(`[admin-update-order] Pedido ${orderId} atualizado por ${user.id} (${profile.role}). ${historyEntries.length} campos alterados.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pedido atualizado com sucesso',
        changes: historyEntries.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-update-order] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
