// @ts-nocheck
// v7 - lista reduzida para funções críticas do cliente apenas
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Apenas funções críticas para o fluxo do cliente em tempo real
const CRITICAL_FUNCTIONS = [
  'mp-webhook',
  'create-mercadopago-pix',
  'create-mercadopago-preference',
  'update-order-status',
  'dispatch-webhook',
  'get-order-details',
  'n8n-receive-order',
  'n8n-webhook',
  'n8n-list-products',
  'n8n-list-clients',
  'notify-back-in-stock',
];

// send-order-email precisa de POST (não responde a GET)
const EMAIL_FUNCTIONS = [
  'send-order-email',
];

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function pingFunction(fnName: string): Promise<{ status: number; ok: boolean }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  return { status: res.status, ok: res.status !== 404 && res.status !== 0 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    console.log('[keep-alive] Ping recebido - função está ativa');
    return new Response(
      JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  console.log(`[keep-alive] Iniciando warm-up de ${CRITICAL_FUNCTIONS.length + EMAIL_FUNCTIONS.length} funções...`);

  const results: Record<string, string> = {};

  // Ping em todas as funções em paralelo (sem retry)
  await Promise.allSettled(
    CRITICAL_FUNCTIONS.map(async (fnName) => {
      try {
        const { status, ok } = await pingFunction(fnName);
        results[fnName] = ok ? `warm(${status})` : `cold(${status})`;
        console.log(`[keep-alive] ${fnName} -> ${results[fnName]}`);
      } catch (err) {
        results[fnName] = `error: ${err.message}`;
        console.error(`[keep-alive] ${fnName} -> erro: ${err.message}`);
      }
    })
  );

  // Warm-up da send-order-email via POST
  for (const fnName of EMAIL_FUNCTIONS) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ event_type: 'keep_alive_ping', order_id: 0 }),
      });
      results[fnName] = `warm(${res.status})`;
      console.log(`[keep-alive] ${fnName} -> warm(${res.status})`);
    } catch (err) {
      results[fnName] = `error: ${err.message}`;
      console.error(`[keep-alive] ${fnName} -> erro: ${err.message}`);
    }
  }

  const warm = Object.entries(results).filter(([, v]) => v.startsWith('warm')).length;
  const cold = Object.entries(results).filter(([, v]) => v.startsWith('cold')).length;

  console.log(`[keep-alive] Concluído: ${warm} warm, ${cold} cold`);

  return new Response(
    JSON.stringify({ status: 'done', warm, cold, results, timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
