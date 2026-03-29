import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const FN = 'update-order-status'
  console.log(`[${FN}] incoming request`, { method: req.method })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Read envs
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
    console.error(`[${FN}] missing supabase envs`)
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)

  try {
    const authHeader = req.headers.get('authorization') || ''
    const apiKeyHeader = req.headers.get('apikey') || req.headers.get('x-api-key') || ''

    console.log(`[${FN}] headers present`, { hasAuthorization: !!authHeader, hasApikey: !!apiKeyHeader })

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

    // Normalize bearer token (if any)
    let bearer = ''
    if (authHeader) {
      const parts = authHeader.split(' ')
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') bearer = parts[1]
      else bearer = authHeader
    }

    // Accept if any of these match: service role, anon key, configured n8n token, or apikey header equals configured token/service role/anon
    const validKeys = new Set<string>()
    if (SUPABASE_SERVICE_ROLE_KEY) validKeys.add(SUPABASE_SERVICE_ROLE_KEY)
    if (SUPABASE_ANON_KEY) validKeys.add(SUPABASE_ANON_KEY)
    if (configuredToken) validKeys.add(configuredToken)

    const isAuthorized = (bearer && validKeys.has(bearer)) || (apiKeyHeader && validKeys.has(apiKeyHeader))

    if (!isAuthorized) {
      console.warn(`[${FN}] authorization failed`, { bearerPresent: !!bearer, apiKeyPresent: !!apiKeyHeader })
      return new Response(JSON.stringify({ error: 'Authorization failed – Token de autenticação inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Parse body
    const body = await req.json().catch(() => null)
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