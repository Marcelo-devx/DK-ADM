// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'process-mercadopago-payment'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const body = await req.json()
    const { payment_id, order_id } = body

    console.log(`[${FN}] Processando pagamento`, { payment_id, order_id, userId: user.id })

    if (!payment_id || !order_id) {
      return new Response(JSON.stringify({ error: 'payment_id e order_id são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar configurações do MP
    const { data: settingsData } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['mercadopago_access_token', 'mercadopago_test_access_token', 'payment_mode'])

    const settings: Record<string, string> = {}
    settingsData?.forEach((s: any) => { settings[s.key] = s.value })

    const mode = settings['payment_mode'] === 'production' ? 'production' : 'test'
    const mpToken = mode === 'production'
      ? settings['mercadopago_access_token']
      : settings['mercadopago_test_access_token']

    if (!mpToken) {
      console.error(`[${FN}] Token MP não configurado`, { mode })
      return new Response(JSON.stringify({ error: `Token MP (${mode}) não configurado` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Consultar status do pagamento no MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` }
    })

    const paymentData = await mpResponse.json()
    console.log(`[${FN}] Status MP`, { status: paymentData?.status, payment_id })

    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: 'Erro ao consultar MP', details: paymentData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const paymentStatus = paymentData?.status
    const paymentTypeId = paymentData?.payment_type_id

    if (paymentStatus === 'approved') {
      let methodLabel = 'Mercado Pago'
      if (paymentTypeId === 'credit_card') methodLabel = 'Cartão de Crédito'
      else if (paymentTypeId === 'debit_card') methodLabel = 'Cartão de Débito'
      else if (paymentTypeId === 'bank_transfer') methodLabel = 'Pix (MP)'

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'Pago',
          payment_method: methodLabel,
          delivery_status: 'Aguardando Validação',
        })
        .eq('id', order_id)
        .eq('user_id', user.id)

      if (updateError) {
        console.error(`[${FN}] Erro ao atualizar pedido`, updateError)
        return new Response(JSON.stringify({ error: 'Erro ao atualizar pedido' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`[${FN}] Pedido atualizado para Pago`, { order_id })
    }

    return new Response(JSON.stringify({ success: true, payment_status: paymentStatus, mode }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}] Unexpected error:`, error?.message || String(error))
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
