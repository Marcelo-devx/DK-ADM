// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const FN = 'health-check'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log(`[${FN}] ping recebido`)

  return new Response(
    JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
