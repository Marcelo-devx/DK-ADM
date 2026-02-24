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
    // Verifica se já existe um log para este mesmo evento e ID nos últimos 20 segundos
    if (event_type === 'order_created' && payload.order_id) {
        const orderIdStr = String(payload.order_id);
        const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();

        const { data: recentLogs } = await supabaseAdmin
            .from('integration_logs')
            .select('id')
            .eq('event_type', event_type)
            // Filtra logs onde o JSON payload contém o mesmo order_id
            .filter('payload->>order_id', 'eq', orderIdStr) 
            .gt('created_at', twentySecondsAgo)
            .limit(1);
        
        if (recentLogs && recentLogs.length > 0) {
            console.log(`[Webhook] Disparo duplicado ignorado para o Pedido #${orderIdStr}`);
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

    // 1. Correção de Timezone (UTC -> São Paulo)
    if (payload.created_at) {
        const dateObj = new Date(payload.created_at);
        enrichedPayload.created_at_br = dateObj.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    // 2. Correção do Valor Total e Frete
    if (payload.total_price !== undefined) {
        const subtotal = Number(payload.total_price || 0);
        const shipping = Number(payload.shipping_cost || 0);
        const discount = Number(payload.coupon_discount || 0);
        
        enrichedPayload.final_total_value = subtotal + shipping;
        
        enrichedPayload.financial_breakdown = {
            products_subtotal: subtotal + discount, 
            discount_applied: discount,
            shipping_cost: shipping,
            total_paid: subtotal + shipping
        };
    }

    // 3. Dados do Cliente
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

    // Buscar webhooks ativos para este evento
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (!webhooks || webhooks.length === 0) {
        console.log(`[Webhook] Nenhum gatilho ativo para: ${event_type}`);
        return new Response(JSON.stringify({ message: "No webhooks configured" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const promises = webhooks.map(async (hook) => {
        let responseCode = 0;
        let responseBody = "";
        let status = "error";

        try {
            console.log(`Disparando ${event_type} para ${hook.target_url}`);
            
            const response = await fetch(hook.target_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    event: event_type, 
                    data: enrichedPayload, 
                    timestamp: new Date().toISOString() 
                })
            });
            
            responseCode = response.status;
            status = response.ok ? "success" : "error";
            
            try {
                responseBody = await response.text();
            } catch (e) {
                responseBody = "(Sem resposta de corpo)";
            }

        } catch (err) {
            console.error(`Falha de rede para ${hook.target_url}:`, err);
            responseBody = err.message;
            responseCode = 500;
        }

        // GRAVAR LOG NO BANCO
        // Importante: Grava com o ID do pedido no payload para a trava funcionar na próxima vez
        await supabaseAdmin.from('integration_logs').insert({
            event_type: event_type,
            status: status,
            response_code: responseCode,
            payload: enrichedPayload, 
            details: `Destino: ${hook.target_url} | Resposta: ${responseBody.substring(0, 500)}`
        });
    });

    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ success: true, dispatched: webhooks.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('[Webhook] Erro fatal:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})