// @ts-nocheck
// Alias para create-mercadopago-preference — mantido para compatibilidade com URLs antigas
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'create-mp-preference'

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

    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, total_price')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: settingsData } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['mercadopago_access_token', 'mercadopago_test_access_token', 'payment_mode', 'site_url'])

    const settings: Record<string, string> = {}
    settingsData?.forEach((s: any) => { settings[s.key] = s.value })

    const mode = settings['payment_mode'] === 'production' ? 'production' : 'test'
    const token = mode === 'production'
      ? settings['mercadopago_access_token']
      : settings['mercadopago_test_access_token']

    const siteUrl = settings['site_url'] || 'http://localhost:8080'

    if (!token) {
      return new Response(JSON.stringify({ error: `Token MP (${mode}) não configurado` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const totalAmount = Number(order.total_price)

    const preferenceBody = {
      items: [{
        id: String(orderId),
        title: `Pedido #${orderId}`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(totalAmount.toFixed(2)),
      }],
      back_urls: {
        success: `${siteUrl}/meus-pedidos?status=success`,
        failure: `${siteUrl}/meus-pedidos?status=failure`,
        pending: `${siteUrl}/meus-pedidos?status=pending`,
      },
      auto_return: 'approved',
      external_reference: String(orderId),
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error(`[${FN}] Erro MP`, { status: mpResponse.status, data: mpData })
      return new Response(JSON.stringify({ error: mpData.message || 'Erro ao gerar preferência' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] Preferência criada`, { orderId, preferenceId: mpData.id, mode })

    return new Response(JSON.stringify({
      init_point: mode === 'production' ? mpData.init_point : mpData.sandbox_init_point,
      mode,
      id: mpData.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}] Unexpected error:`, error?.message || String(error))
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
