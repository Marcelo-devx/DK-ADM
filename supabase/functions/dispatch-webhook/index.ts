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

    // --- ENRIQUECIMENTO DE DADOS ---
    let enrichedPayload = { ...payload };

    // 1. Correção de Timezone (UTC -> São Paulo)
    if (payload.created_at) {
        const dateObj = new Date(payload.created_at);
        // Formato legível: DD/MM/YYYY HH:mm:ss
        enrichedPayload.created_at_br = dateObj.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        // Formato ISO com offset correto (útil para sistemas)
        // Como o Deno Deploy roda em UTC, a conversão manual simples é mais segura para exibição
        enrichedPayload.created_at_iso_br = dateObj.toLocaleString('en-CA', {
            timeZone: 'America/Sao_Paulo',
            hour12: false
        }).replace(', ', 'T');
    }

    // 2. Correção do Valor Total (Soma Frete)
    // No banco: total_price = (produtos - desconto). O frete fica separado.
    if (payload.total_price !== undefined) {
        const subtotal = Number(payload.total_price || 0);
        const shipping = Number(payload.shipping_cost || 0);
        const discount = Number(payload.coupon_discount || 0);
        
        // Cria um campo explícito para o valor final que o cliente pagou
        enrichedPayload.final_total_value = subtotal + shipping;
        
        // Adiciona detalhes para clareza no N8N
        enrichedPayload.financial_breakdown = {
            products_subtotal: subtotal + discount, // Valor original dos produtos
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
        
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(payload.user_id);

        if (profile || user) {
            enrichedPayload.customer = {
                id: payload.user_id,
                first_name: profile?.first_name || '',
                last_name: profile?.last_name || '',
                full_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
                phone: profile?.phone || '',
                email: user?.email || '',
                cpf: profile?.cpf_cnpj || ''
            };
            console.log(`[Webhook] Dados do cliente anexados para pedido #${payload.id}`);
        }
    }

    // Buscar webhooks ativos para este evento
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

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
                body: JSON.stringify({ 
                    event: event_type, 
                    data: enrichedPayload, 
                    timestamp: new Date().toISOString() 
                })
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.error(`[Webhook] Erro na resposta do destino (${response.status}): ${text}`);
            }
        } catch (err) {
            console.error(`Falha ao disparar webhook para ${hook.target_url}:`, err);
        }
    });

    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, dispatched: webhooks.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('[Webhook] Erro interno:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})