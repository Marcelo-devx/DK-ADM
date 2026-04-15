import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ROLES = ['adm', 'gerente_geral']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('[admin-cancel-order] Request received')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('[admin-cancel-order] Missing Authorization header')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[admin-cancel-order] Token inválido:', userError?.message)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[admin-cancel-order] Erro ao buscar profile:', profileError.message)
    }

    console.log('[admin-cancel-order] Authenticated user', { userId: user.id, role: profile?.role })

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden - Acesso negado. Apenas Admin e Gerente Geral podem cancelar pedidos.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { orderId, reason } = await req.json()

    if (!orderId || !reason) {
      return new Response(JSON.stringify({ error: 'orderId e reason são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status, delivery_status')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      console.error('[admin-cancel-order] Pedido não encontrado:', orderId, fetchError?.message)
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (currentOrder.status === 'Cancelado') {
      console.log('[admin-cancel-order] Pedido já estava cancelado', { orderId })
      return new Response(JSON.stringify({ success: true, message: 'Pedido já está cancelado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'Cancelado',
        delivery_status: 'Cancelado',
        delivery_info: reason,
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[admin-cancel-order] Erro ao cancelar pedido:', updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: historyError } = await supabase
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

    return new Response(JSON.stringify({ success: true, message: 'Pedido cancelado com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[admin-cancel-order] Erro inesperado:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})