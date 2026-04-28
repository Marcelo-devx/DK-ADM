// @ts-nocheck
// ATENÇÃO: Só aceita POST. GET requests são ignorados (usados apenas para warm-up).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Só processa POST — GET é usado apenas para warm-up e deve ser ignorado
  if (req.method !== 'POST') {
    console.log(`[resend-batch-emails] Método ${req.method} ignorado (apenas POST é aceito para reenvio)`)
    return new Response(
      JSON.stringify({ message: 'warm-up ok' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { order_ids } = await req.json()
  const results: { id: number; ok: boolean; detail: string }[] = []

  console.log(`[resend-batch-emails] Iniciando reenvio de ${order_ids.length} pedidos`)

  for (const order_id of order_ids) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({ event_type: 'order_paid', order_id }),
      })
      const data = await res.json()
      const ok = res.ok && data.success
      results.push({ id: order_id, ok, detail: ok ? data.to : JSON.stringify(data) })
      console.log(`[resend-batch-emails] Pedido #${order_id} -> ${ok ? 'OK' : 'ERRO'}: ${results.at(-1)?.detail}`)
    } catch (e) {
      results.push({ id: order_id, ok: false, detail: e.message })
      console.error(`[resend-batch-emails] Pedido #${order_id} -> exceção: ${e.message}`)
    }
    // 300ms entre cada envio = ~3 por segundo, abaixo do limite de 5/s do Resend
    await sleep(300)
  }

  const success = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  console.log(`[resend-batch-emails] Concluído: ${success} ok, ${failed.length} falhas`)

  return new Response(
    JSON.stringify({ success, failed_count: failed.length, failed, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})