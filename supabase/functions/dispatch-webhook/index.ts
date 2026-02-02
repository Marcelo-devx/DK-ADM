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

    // Usa Service Role para ignorar RLS na leitura das configs
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

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
        enrichedPayload.created_at_iso_br = dateObj.toLocaleString('en-CA', {
            timeZone: 'America/Sao_Paulo',
            hour12: false
        }).replace(', ', 'T');
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
            .single();
        
        // Tenta pegar email do Auth se não estiver no profile
        let userEmail = profile?.email;
        if (!userEmail) {
             const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(payload.user_id);
             userEmail = user?.email;
        }

        if (profile || userEmail) {
            enrichedPayload.customer = {
                id: payload.user_id,
                first_name: profile?.first_name || '',
                last_name: profile?.last_name || '',
                full_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
                phone: profile?.phone || '',
                email: userEmail || '',
                cpf: profile?.cpf_cnpj || ''
            };
        }
    }

    // Buscar webhooks ativos para este evento
    const { data: webhooks, error: hookError } = await supabaseAdmin
        .from('webhook_configs')
        .select('target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (hookError) {
        console.error("[Webhook] Erro ao ler configurações:", hookError);
        // Não falha a requisição inteira, apenas loga
    }

    if (!webhooks || webhooks.length === 0) {
        console.log(`[Webhook] Nenhum gatilho ativo encontrado para o evento: ${event_type}`);
        return new Response(JSON.stringify({ message: "No webhooks configured" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const promises = webhooks.map(async (hook) => {
        try {
            console.log(`Disparando webhook ${event_type} para ${hook.target_url}`);
            
            const response = await fetch(hook.target_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                redirect: 'follow', // IMPORTANTE: Segue redirecionamentos (301, 302, 307, 308)
                body: JSON.stringify({ 
                    event: event_type, 
                    data: enrichedPayload, 
                    timestamp: new Date().toISOString() 
                })
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.error(`[Webhook] Erro na resposta do destino (${response.status}): ${text.substring(0, 200)}`);
            } else {
                console.log(`[Webhook] Sucesso: ${hook.target_url} (${response.status})`);
            }
        } catch (err) {
            console.error(`Falha ao disparar webhook para ${hook.target_url}:`, err);
        }
    });

    // Aguarda todos os disparos sem bloquear se um falhar
    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ success: true, dispatched: webhooks.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('[Webhook] Erro interno fatal:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})