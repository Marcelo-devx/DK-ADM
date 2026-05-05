// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'get-order-public'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const reqId = crypto.randomUUID()
  const url = new URL(req.url)
  console.log(`[${FN}][${reqId}] ${req.method} ${url.pathname}`, { origin: req.headers.get('origin') })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Health check
  if (url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    // Extrai order_id da URL ou query param
    const pathParts = url.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    const orderId = url.searchParams.get('order_id') || (lastPart && !isNaN(Number(lastPart)) ? lastPart : null)

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, delivery_status, tracking_code, total_price, payment_method, created_at, shipping_address, delivery_info')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase')
      .eq('order_id', orderId)

    return new Response(JSON.stringify({ order, items: items || [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}][${reqId}] Unexpected error:`, error?.message || String(error))
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
