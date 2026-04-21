// @ts-nocheck
// v4 - warm-up completo de todas as edge functions do projeto
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CRITICAL_FUNCTIONS = [
  // Pagamentos
  'create-mercadopago-pix',
  'create-mercadopago-preference',
  'get-mercadopago-status',
  'update-mercadopago-token',
  'get-pagseguro-status',
  'update-pagseguro-token',
  'mp-webhook',
  'verify-blockchain-tx',
  // Pedidos
  'update-order-status',
  'get-order-details',
  'admin-update-order',
  'admin-cancel-order',
  'admin-delete-order',
  'admin-delete-orders',
  'admin-get-order-history',
  'cleanup-orders',
  'test-auto-update-orders',
  // Usuários / Admin
  'get-users',
  'get-users-emails',
  'get-user-email',
  'admin-create-user',
  'admin-delete-user',
  'admin-list-users',
  'admin-block-user',
  'admin-user-actions',
  'admin-mark-as-recurrent',
  'create-client-by-admin',
  'bulk-import-clients',
  'n8n-create-client',
  'n8n-list-clients',
  // Webhooks / Integrações
  'dispatch-webhook',
  'n8n-webhook',
  'n8n-receive-order',
  'n8n-list-products',
  'spoke-webhook',
  'spoke-proxy',
  'test-webhook-endpoint',
  'api-config-manager',
  // Cloudinary
  'cloudinary-upload',
  'cloudinary-list-images',
  'cloudinary-delete-image',
  'cloudinary-usage',
  // Analytics / Relatórios
  'analytics-bi',
  'actionable-insights',
  'generate-sales-popups',
  // Pontos / Cupons
  'bulk-add-points',
  'admin-send-campaign',
  // Catálogo
  'catalog-api',
  'bulk-product-upsert',
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
  console.log(`[keep-alive] Iniciando warm-up de ${CRITICAL_FUNCTIONS.length} funções...`);

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
        // 200, 401, 403, 405 = função deployada e respondendo (warm)
        // 404 = função não existe / não deployada
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
    console.warn('[keep-alive] Funções ausentes:', cold.map(([k]) => k).join(', '));
  }

  const warm = Object.entries(results).filter(([, v]) => v.startsWith('warm'));
  console.log(`[keep-alive] Concluído: ${warm.length} warm, ${cold.length} ausentes`);

  return new Response(
    JSON.stringify({ status: 'done', warm: warm.length, cold: cold.length, results, timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
