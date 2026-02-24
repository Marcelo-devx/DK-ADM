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

    // --- LÓGICA ANTI-DUPLICIDADE (DEBOUNCE REFORÇADO) ---
    // Impede que o mesmo pedido dispare o webhook duas vezes em menos de 10 segundos
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
            console.log(`[Webhook] Debounce: Pedido #${orderIdStr} ignorado (Já processado recentemente).`);
            return new Response(JSON.stringify({ 
                success: true, 
                skipped: true, 
                message: "Duplicate event skipped (Debounce)" 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }
    }

    // --- ENRIQUECIMENTO DE DADOS ---
    let enrichedPayload = { ...payload };

    if (payload.created_at) {
        try {
            const dateObj = new Date(payload.created_at);
            enrichedPayload.created_at_br = dateObj.toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) { console.error("Erro data:", e); }
    }

    if (payload.total_price !== undefined) {
        const subtotal = Number(payload.total_price || 0);
        const shipping = Number(payload.shipping_cost || 0);
        const discount = Number(payload.coupon_discount || 0);
        const donation = Number(payload.donation_amount || 0);
        const totalPaid = subtotal + shipping + donation;
        
        enrichedPayload.final_total_value = totalPaid;
    }

    if (event_type === 'order_created' && payload.user_id) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, phone, email, cpf_cnpj') 
            .eq('id', payload.user_id)
            .maybeSingle();
        
        if (profile) {
            enrichedPayload.customer = {
                id: payload.user_id,
                full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                first_name: profile.first_name || '',
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
        
        // CORREÇÃO: Limpeza da URL (Trim)
        const url = rawUrl.trim();

        try {
            console.log(`Disparando ${event_type} para '${url}' (Método POST)`);
            
            const response = await fetch(url, {
                method: 'POST', // IMPORTANTE: O N8N deve esperar um POST
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
            } else {
                // Se der 404, adicionamos uma dica no log
                if (response.status === 404) {
                    responseBody = `ERRO 404: Verifique se o Workflow está ATIVO e se o método no N8N é POST. Resposta: ${responseBody}`;
                }
            }

        } catch (err) {
            console.error(`Falha de rede para ${url}:`, err);
            responseBody = err.message;
            responseCode = 500;
        }

        // Log detalhado
        await supabaseAdmin.from('integration_logs').insert({
            event_type: event_type,
            status: status,
            response_code: responseCode,
            payload: enrichedPayload, 
            details: `Destino: ${url} | ${responseBody.substring(0, 500)}`
        });
    });

    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ success: true, dispatched: uniqueTargets.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})