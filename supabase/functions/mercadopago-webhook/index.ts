// @ts-nocheck
// Alias/proxy para mp-webhook — mantido para compatibilidade com URLs antigas
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'mercadopago-webhook'

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
    const urlObj = new URL(req.url)
    const topic = urlObj.searchParams.get('topic') || urlObj.searchParams.get('type')

    let idFromQuery: string | null = null
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (key === 'data.id' || key === 'id') {
        idFromQuery = value
        break
      }
    }

    console.log(`[${FN}] Request received`, { topic, idFromQuery, method: req.method })

    let bodyData: any = {}
    let rawBody = ''
    try {
      rawBody = await req.text()
      if (rawBody && rawBody.trim()) bodyData = JSON.parse(rawBody)
    } catch (e) {
      console.log(`[${FN}] Failed to parse body`, { error: String(e) })
    }

    const isPaymentEvent = !topic || topic === 'payment' || topic === 'test'
    if (!isPaymentEvent) {
      return new Response(JSON.stringify({ message: 'Topic ignored', topic }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const paymentId = idFromQuery
      || bodyData?.data?.id
      || bodyData?.id
      || (bodyData?.resource ? String(bodyData.resource).split('/').pop() : null)

    if (!paymentId) {
      return new Response(JSON.stringify({ message: 'No payment ID found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

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
      return new Response(JSON.stringify({ error: `Token MP (${mode}) não configurado` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` }
    })

    const paymentData = await mpResponse.json()
    const status = paymentData?.status
    const externalReference = paymentData?.external_reference || bodyData?.external_reference
    const paymentTypeId = paymentData?.payment_type_id

    console.log(`[${FN}] Payment status`, { paymentId, status, externalReference })

    if ((status === 'approved' || status === 'authorized') && externalReference) {
      const orderId = String(externalReference).replace(/\D/g, '')
      if (orderId) {
        let methodLabel = 'Mercado Pago'
        if (paymentTypeId === 'credit_card') methodLabel = 'Cartão de Crédito'
        else if (paymentTypeId === 'debit_card') methodLabel = 'Cartão de Débito'
        else if (paymentTypeId === 'bank_transfer') methodLabel = 'Pix (MP)'

        await supabaseAdmin
          .from('orders')
          .update({
            status: 'Pago',
            payment_method: methodLabel,
            delivery_status: 'Aguardando Validação',
          })
          .eq('id', orderId)

        console.log(`[${FN}] Pedido atualizado`, { orderId, methodLabel })
      }
    }

    return new Response(JSON.stringify({ success: true, paymentId, status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}] Erro:`, String(error))
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
