// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { event_type, payload } = await req.json();

    if (!event_type) return new Response("Missing event_type", { status: 400 });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // --- LÓGICA ANTI-DUPLICIDADE (DEBOUNCE) ---
    if (event_type === 'order_created' && payload.order_id) {
        const orderIdStr = String(payload.order_id);
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

        const { data: recentLogs } = await supabaseAdmin
            .from('integration_logs')
            .select('id, payload')
            .eq('event_type', event_type)
            .gt('created_at', tenSecondsAgo)
            .limit(5); 
        
        const duplicate = recentLogs?.find((log: any) => {
             const logOrderId = log.payload?.order_id || log.payload?.data?.id;
             return String(logOrderId) === orderIdStr;
        });

        if (duplicate) {
            return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
    }

    // --- ENRIQUECIMENTO DE DADOS (Mantém igual) ---
    let enrichedPayload = { ...payload };
    if (payload.created_at) {
        try {
            const dateObj = new Date(payload.created_at);
            enrichedPayload.created_at_br = dateObj.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        } catch (e) {}
    }
    if (event_type === 'order_created' && payload.user_id) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, last_name, phone, email, cpf_cnpj').eq('id', payload.user_id).maybeSingle();
        if (profile) {
            enrichedPayload.customer = {
                id: payload.user_id,
                full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                phone: profile.phone || '',
                email: profile.email || '',
                cpf: profile.cpf_cnpj || ''
            };
        }
    }

    // Buscar webhooks ativos
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (!webhooks || webhooks.length === 0) {
        return new Response(JSON.stringify({ message: "No active webhooks configured" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const uniqueTargets = [...new Set(webhooks.map(w => w.target_url))];

    const promises = uniqueTargets.map(async (rawUrl) => {
        let responseCode = 0;
        let responseBody = "";
        let status = "error";
        const url = rawUrl.trim(); // Limpeza de URL

        try {
            // TENTATIVA 1: POST (Padrão correto)
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    event: event_type, 
                    data: enrichedPayload, 
                    timestamp: new Date().toISOString() 
                })
            });
            
            responseCode = response.status;
            try { responseBody = await response.text(); } catch (e) { responseBody = "(Sem corpo)"; }

            if (response.ok) {
                status = "success";
            } else if (response.status === 404 || response.status === 405) {
                // DIAGNÓSTICO INTELIGENTE SE DER ERRO
                // Se o POST falhou, tenta um GET rápido só para ver se o N8N responde "Active" ou aceita GET.
                try {
                    const checkGet = await fetch(url, { method: 'GET' });
                    if (checkGet.ok) {
                        responseBody = `DIAGNÓSTICO: Seu N8N rejeitou o POST mas aceitou GET. Mude o "HTTP Method" no nó do Webhook para "POST".`;
                    } else {
                        if (url.includes('/webhook-test/')) {
                            responseBody = `URL DE TESTE EXPIRADA: Clique em "Execute Node" no N8N novamente.`;
                        } else {
                            responseBody = `WORKFLOW INATIVO: Ative a chave "Active" no topo direito do N8N ou verifique a URL. (N8N retornou ${response.status})`;
                        }
                    }
                } catch (e) {
                    responseBody = `Erro N8N (${response.status}): ${responseBody.substring(0, 100)}`;
                }
            }

        } catch (err) {
            responseBody = `Erro de Rede: ${err.message}`;
            responseCode = 500;
        }

        // Log detalhado
        await supabaseAdmin.from('integration_logs').insert({
            event_type: event_type,
            status: status,
            response_code: responseCode,
            payload: enrichedPayload, 
            details: `Destino: ${url} | ${responseBody}`
        });
    });

    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})