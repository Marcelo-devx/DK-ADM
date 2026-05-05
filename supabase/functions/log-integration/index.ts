// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'log-integration'

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
    const { event_type, status, details, response_code, webhook_url } = body

    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { error } = await supabaseAdmin
      .from('integration_logs')
      .insert({
        event_type,
        status: status || 'info',
        details: typeof details === 'string' ? details : JSON.stringify(details),
        response_code: response_code || null,
        webhook_url: webhook_url || null,
      })

    if (error) {
      console.error(`[${FN}][${reqId}] Erro ao inserir log`, error)
      return new Response(JSON.stringify({ error: 'Erro ao salvar log' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
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
