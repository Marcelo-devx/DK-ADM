// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'trigger-integration'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const reqId = crypto.randomUUID()
  console.log(`[${FN}][${reqId}] ${req.method} ${new URL(req.url).pathname}`, { origin: req.headers.get('origin') })

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
    const body = await req.json()
    const { event_type, order_id, payload } = body

    console.log(`[${FN}][${reqId}] received body`, JSON.stringify(body))
    console.log(`[${FN}][${reqId}] processing event_type: ${event_type}`)

    if (event_type === 'keep_alive_ping') {
      return new Response(JSON.stringify({ status: 'ok', event_type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Buscar configurações de webhook ativas para este evento
    const { data: webhookConfigs, error: configError } = await supabaseAdmin
      .from('webhook_configs')
      .select('*')
      .eq('event_type', event_type)
      .eq('is_active', true)

    if (configError) {
      console.error(`[${FN}][${reqId}] erro ao buscar webhook_configs`, configError)
    }

    const activeWebhooks = webhookConfigs || []
    console.log(`[${FN}][${reqId}] found ${activeWebhooks.length} active webhook(s) for event "${event_type}"`)

    if (activeWebhooks.length === 0) {
      console.log(`[${FN}][${reqId}] no active webhook configs for event "${event_type}"`)
      return new Response(JSON.stringify({ status: 'ok', dispatched: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Buscar dados completos do pedido se tiver order_id
    let orderData = payload || {}
    if (order_id && order_id > 0) {
      console.log(`[${FN}][${reqId}] fetching order ${order_id} from DB`)
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', order_id)
        .single()
      if (order) orderData = { ...orderData, ...order }
    }

    // Disparar para cada webhook configurado
    let dispatched = 0
    for (const webhook of activeWebhooks) {
      const maxAttempts = 3
      let lastError = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[${FN}][${reqId}] dispatch attempt ${attempt}/${maxAttempts} to ${webhook.url}`)

          const res = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {}),
            },
            body: JSON.stringify({
              event_type,
              order_id,
              data: orderData,
              timestamp: new Date().toISOString(),
            }),
          })

          const responseText = await res.text()
          console.log(`[${FN}][${reqId}] attempt ${attempt} response: status=${res.status} body=${responseText.slice(0, 200)}`)

          if (res.ok) {
            dispatched++
            lastError = null
            break
          } else {
            lastError = `HTTP ${res.status}: ${responseText.slice(0, 200)}`
          }
        } catch (err) {
          lastError = err?.message || String(err)
          console.error(`[${FN}][${reqId}] attempt ${attempt} error: ${lastError}`)
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }

      if (lastError) {
        console.error(`[${FN}][${reqId}] all attempts failed for webhook ${webhook.url}: ${lastError}`)
      }
    }

    return new Response(JSON.stringify({ status: 'ok', dispatched, total: activeWebhooks.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(`[${FN}][${reqId}] Unexpected error:`, error?.message || String(error))
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
