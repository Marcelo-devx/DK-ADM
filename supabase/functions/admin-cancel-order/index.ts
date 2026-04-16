// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ROLES = ['adm', 'gerente_geral']

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    console.log('[admin-cancel-order] Request received')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('[admin-cancel-order] Missing Authorization header')
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-cancel-order] Token inválido:', userError?.message)
      return jsonResponse({ error: 'Invalid token' }, 401)
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[admin-cancel-order] Erro ao buscar profile:', profileError.message)
    }

    console.log('[admin-cancel-order] Authenticated user', { userId: user.id, role: profile?.role })

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return jsonResponse({ error: 'Forbidden - Acesso negado. Apenas Admin e Gerente Geral podem cancelar pedidos.' }, 403)
    }

    // Parse body após validação de auth
    let body: any
    try {
      body = await req.json()
    } catch (e) {
      return jsonResponse({ error: 'Body inválido ou ausente.' }, 400)
    }

    const { orderId, reason } = body

    if (!orderId || !reason) {
      return jsonResponse({ error: 'orderId e reason são obrigatórios' }, 400)
    }

    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('status, delivery_status')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      console.error('[admin-cancel-order] Pedido não encontrado:', orderId, fetchError?.message)
      return jsonResponse({ error: 'Pedido não encontrado' }, 404)
    }

    if (currentOrder.status === 'Cancelado') {
      console.log('[admin-cancel-order] Pedido já estava cancelado', { orderId })
      return jsonResponse({ success: true, message: 'Pedido já está cancelado' })
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'Cancelado',
        delivery_status: 'Cancelado',
        delivery_info: reason,
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[admin-cancel-order] Erro ao cancelar pedido:', updateError)
      return jsonResponse({ error: updateError.message }, 500)
    }

    const { error: historyError } = await supabaseAdmin
      .from('order_history')
      .insert({
        order_id: orderId,
        field_name: 'status',
        old_value: currentOrder.status,
        new_value: 'Cancelado',
        changed_by: user.id,
        change_type: 'cancel',
        reason,
      })

    if (historyError) {
      console.error('[admin-cancel-order] Erro ao inserir histórico:', historyError.message)
    }

    console.log('[admin-cancel-order] Pedido cancelado com sucesso', { orderId, userId: user.id, role: profile.role })

    return jsonResponse({ success: true, message: 'Pedido cancelado com sucesso' })

  } catch (error: any) {
    console.error('[admin-cancel-order] Erro inesperado:', error.message)
    return jsonResponse({ error: error.message || 'Erro interno' }, 500)
  }
})
