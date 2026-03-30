import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
}

serve(async (req) => {
  const FN = 'update-order-status'
  console.log(`[${FN}] incoming request`, { method: req.method })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Read envs
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`[${FN}] missing supabase envs`)
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Support GET with query params for quick testing: ?order_id=..&status=..
    const url = new URL(req.url)
    const params = url.searchParams

    // Read auth header (case-insensitive)
    const authHeaderRaw = (req.headers.get('authorization') || req.headers.get('Authorization') || '').toString();

    console.log(`[${FN}] headers present`, { authHeaderRawPresent: !!authHeaderRaw })

    // Fetch the configured integration token from app_settings (if exists)
    let configuredToken: string | null = null
    try {
      const r = await supabase.from('app_settings').select('value').eq('key', 'n8n_integration_token').single()
      if (r.error) {
        // not fatal — continue
        console.log(`[${FN}] could not fetch app_settings:`, r.error.message)
      } else if (r.data && r.data.value) {
        configuredToken = r.data.value
        console.log(`[${FN}] loaded configured token from app_settings`)
      }
    } catch (e) {
      console.log(`[${FN}] error reading app_settings`, e.message)
    }

    // Normalize and be tolerant: remove repeated 'Bearer' words and extract last token-like segment.
    let bearer = ''
    if (authHeaderRaw) {
      // remove all occurrences of the word 'bearer' (case-insensitive), then trim
      const cleaned = authHeaderRaw.replace(/bearer/ig, ' ').replace(/[:]/g, ' ').trim()
      // split by whitespace and take the last chunk — handles cases like 'Bearer Bearer <token>' or 'Bearer: <token>'
      const parts = cleaned.split(/\s+/).filter(Boolean)
      if (parts.length > 0) bearer = parts[parts.length - 1]
    }

    // Only accept Authorization that matches service role key or configured token
    const validKeys = new Set<string>()
    if (SUPABASE_SERVICE_ROLE_KEY) validKeys.add(SUPABASE_SERVICE_ROLE_KEY)
    if (configuredToken) validKeys.add(configuredToken)

    // Also accept if the raw header contains the configured token (tolerant for doubled headers)
    const isAuthorized = (!!bearer && validKeys.has(bearer)) || (authHeaderRaw && configuredToken && authHeaderRaw.includes(configuredToken))

    if (!isAuthorized) {
      console.warn(`[${FN}] authorization failed`, { bearerPresent: !!bearer, authHeaderRawSample: authHeaderRaw && authHeaderRaw.slice(0,50) })
      return new Response(JSON.stringify({ error: 'Authorization failed – Token de autenticação inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Parse body for POST or query params for GET
    let body: any = null
    if (req.method === 'GET') {
      const order_id = params.get('order_id')
      const status = params.get('status')
      body = order_id ? { order_id: Number(order_id), status } : null
    } else {
      body = await req.json().catch(() => null)
    }

    if (!body || typeof body.order_id === 'undefined') {
      return new Response(JSON.stringify({ error: 'Bad Request - order_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const orderId = body.order_id
    const updates: any = {}
    if (body.status) updates.status = body.status
    if (body.delivery_status) updates.delivery_status = body.delivery_status
    if (body.tracking_code) updates.tracking_code = body.tracking_code
    if (body.delivery_info) updates.delivery_info = body.delivery_info

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Perform update using service role key (supabase client already created with it)
    console.log(`[${FN}] updating order`, { orderId, updates })
    const { data, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single()
    if (error) {
      console.error(`[${FN}] db update error`, error.message)
      return new Response(JSON.stringify({ error: 'DB update failed', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[${FN}] order updated`, { id: data?.id })

    return new Response(JSON.stringify({ success: true, order: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error(`[${FN}] unexpected error`, err?.message || err)
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err?.message || String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})