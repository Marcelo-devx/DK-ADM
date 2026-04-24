// @ts-nocheck
// Função temporária para reenviar emails dos pedidos que não receberam confirmação
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const ORDER_IDS = [1272,1138,1087,807,806,804,803,802,800,799,798,792,789,787,785,784,783,782,780,778,777,776,775,774,768,765,763,759,756,755,753,752,751,750,749,747,746,745,744,743,742,741,739,737,735,734,732,731,729,727,725,719,693,691,689,687,686,684,682,680,677,675,672,668,667,666,662,661,660,651,648,647,646,632,606,593,583,582,579,573,547,542,536,533,532,527,524,518,517,515,511,504]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log(`[trigger-batch-remail] Iniciando reenvio de ${ORDER_IDS.length} pedidos sem email`)

  const results: { id: number; ok: boolean; detail: string }[] = []

  for (const order_id of ORDER_IDS) {
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
      console.log(`[trigger-batch-remail] Pedido #${order_id} -> ${ok ? 'OK' : 'ERRO'}: ${results.at(-1)?.detail}`)
    } catch (e) {
      results.push({ id: order_id, ok: false, detail: e.message })
      console.error(`[trigger-batch-remail] Pedido #${order_id} -> exceção: ${e.message}`)
    }
    // 300ms entre envios para não estourar limite do Resend (5/s)
    await sleep(300)
  }

  const success = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  console.log(`[trigger-batch-remail] Concluído: ${success} enviados, ${failed.length} falhas`)

  return new Response(
    JSON.stringify({ 
      total: ORDER_IDS.length,
      success, 
      failed_count: failed.length, 
      failed,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
