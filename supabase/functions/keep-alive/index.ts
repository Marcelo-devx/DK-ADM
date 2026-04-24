// @ts-nocheck
// v6 - warm-up com retry automático para funções COLD
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CRITICAL_FUNCTIONS = [
  'update-order-status',
  'get-order-details',
  'admin-update-order',
  'admin-cancel-order',
  'admin-delete-order',
  'admin-get-order-history',
  'admin-send-campaign',
  'admin-user-actions',
  'admin-mark-as-recurrent',
  'admin-delete-orders',
  'admin-create-user',
  'admin-delete-user',
  'admin-block-user',
  'admin-list-users',
  'create-client-by-admin',
  'get-users',
  'get-users-emails',
  'get-user-email',
  'bulk-import-clients',
  'cleanup-orders',
  'dispatch-webhook',
  'mp-webhook',
  'api-config-manager',
  'create-mercadopago-pix',
  'create-mercadopago-preference',
  'get-mercadopago-status',
  'update-mercadopago-token',
  'get-pagseguro-status',
  'update-pagseguro-token',
  'analytics-bi',
  'bulk-add-points',
  'bulk-product-upsert',
  'catalog-api',
  'resend-batch-emails',
];

// Funções críticas que precisam de teste via POST (não respondem a GET)
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

  // 1ª rodada: ping em todas as funções em paralelo
  await Promise.allSettled(
    CRITICAL_FUNCTIONS.map(async (fnName) => {
      try {
        const { status, ok } = await pingFunction(fnName);
        results[fnName] = ok ? `warm(${status})` : `COLD/MISSING(${status})`;
        console.log(`[keep-alive] ${fnName} -> ${results[fnName]}`);
      } catch (err) {
        results[fnName] = `error: ${err.message}`;
        console.error(`[keep-alive] ${fnName} -> erro: ${err.message}`);
      }
    })
  );

  // 2ª rodada: retry nas funções que ficaram COLD — aguarda 2s e tenta novamente
  const coldFunctions = CRITICAL_FUNCTIONS.filter(fn => results[fn]?.startsWith('COLD'));

  if (coldFunctions.length > 0) {
    console.warn(`[keep-alive] ⚠️ ${coldFunctions.length} funções COLD, tentando reativar: ${coldFunctions.join(', ')}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    await Promise.allSettled(
      coldFunctions.map(async (fnName) => {
        try {
          const { status, ok } = await pingFunction(fnName);
          const prev = results[fnName];
          results[fnName] = ok ? `warm(${status})` : `COLD/MISSING(${status})`;
          console.log(`[keep-alive] RETRY ${fnName}: ${prev} → ${results[fnName]}`);
        } catch (err) {
          console.error(`[keep-alive] RETRY ${fnName} -> erro: ${err.message}`);
        }
      })
    );
  }

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

      if (res.status === 404) {
        results[fnName] = `COLD/MISSING(404)`;
        console.error(`[keep-alive] ⚠️ CRÍTICO: ${fnName} está OFF (404) — emails não serão enviados!`);
      } else {
        results[fnName] = `warm(${res.status})`;
        console.log(`[keep-alive] ${fnName} -> warm(${res.status}) ✅`);
      }
    } catch (err) {
      results[fnName] = `error: ${err.message}`;
      console.error(`[keep-alive] ${fnName} -> erro: ${err.message}`);
    }
  }

  const cold = Object.entries(results).filter(([, v]) => v.startsWith('COLD'));
  const warm = Object.entries(results).filter(([, v]) => v.startsWith('warm'));

  if (cold.length > 0) {
    console.warn(`[keep-alive] ⚠️ ${cold.length} funções ainda COLD após retry: ${cold.map(([k]) => k).join(', ')}`);
  }

  console.log(`[keep-alive] Concluído: ${warm.length} warm, ${cold.length} ausentes`);

  return new Response(
    JSON.stringify({ status: 'done', warm: warm.length, cold: cold.length, results, timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
