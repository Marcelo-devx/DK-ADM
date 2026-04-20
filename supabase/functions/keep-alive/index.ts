// @ts-nocheck
// v3 - usa GET para warm-up real (OPTIONS não executa o código da função)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Lista de todas as funções críticas que devem ser mantidas aquecidas
const CRITICAL_FUNCTIONS = [
  'cloudinary-upload',
  'cloudinary-usage',
  'cloudinary-list-images',
  'cloudinary-delete-image',
  'create-mercadopago-pix',
  'create-mercadopago-preference',
  'get-mercadopago-status',
  'mp-webhook',
  'update-order-status',
  'get-order-details',
  'dispatch-webhook',
  'n8n-webhook',
  'n8n-receive-order',
  'catalog-api',
  'get-users',
  'admin-create-user',
  'admin-delete-user',
  'admin-update-order',
  'admin-cancel-order',
  'admin-get-order-history',
  'analytics-bi',
  'actionable-insights',
  'generate-sales-popups',
  'bulk-add-points',
  'bulk-import-clients',
  'reset-user-password',
  'log-integration',
  'forgot-password',
  'validate-token',
  'validate-cep',
  'send-email-via-resend',
  'notify-password-change',
  'admin-delete-order',
  'admin-block-user',
  'admin-list-users',
];

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // GET simples: confirma que o keep-alive está vivo
  if (req.method === 'GET') {
    console.log('[keep-alive] Ping recebido - função está ativa');
    return new Response(
      JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  // POST: faz o warm-up real de todas as funções críticas via GET
  console.log('[keep-alive] Iniciando warm-up de funções críticas...');

  const results: Record<string, string> = {};

  await Promise.allSettled(
    CRITICAL_FUNCTIONS.map(async (fnName) => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/${fnName}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        // 200, 401, 403, 405 = função está deployada e respondendo (warm)
        // 404 = função não existe / não deployada (cold/missing)
        const isWarm = res.status !== 404 && res.status !== 0;
        results[fnName] = isWarm ? `warm(${res.status})` : `COLD/MISSING(${res.status})`;
        console.log(`[keep-alive] ${fnName} -> ${results[fnName]}`);
      } catch (err) {
        results[fnName] = `error: ${err.message}`;
        console.error(`[keep-alive] ${fnName} -> erro: ${err.message}`);
      }
    })
  );

  const cold = Object.entries(results).filter(([, v]) => v.startsWith('COLD'));
  if (cold.length > 0) {
    console.warn('[keep-alive] Funções NÃO deployadas:', cold.map(([k]) => k).join(', '));
  }

  console.log('[keep-alive] Warm-up concluído', results);

  return new Response(
    JSON.stringify({ status: 'done', results, timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
