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

    // --- 1. ID DO PEDIDO ---
    // O trigger envia 'id' dentro do payload (que é o NEW record) ou 'order_id' dependendo da versão do trigger.
    // Vamos garantir que pegamos o ID correto.
    const orderId = payload.id || payload.order_id;

    if (!orderId && event_type === 'order_created') {
        return new Response("Missing order ID", { status: 400 });
    }

    // --- 2. ANTI-DUPLICIDADE (DEBOUNCE) ---
    if (event_type === 'order_created') {
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
        const { data: recentLogs } = await supabaseAdmin
            .from('integration_logs')
            .select('payload')
            .eq('event_type', event_type)
            .gt('created_at', tenSecondsAgo)
            .limit(10);
        
        const duplicate = recentLogs?.find((log: any) => {
             const logId = log.payload?.data?.id;
             return String(logId) === String(orderId);
        });

        if (duplicate) {
            return new Response(JSON.stringify({ success: true, skipped: true, message: "Duplicate skipped" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
    }

    // --- 3. COLETAR DADOS COMPLETOS (ENRICHMENT) ---
    let finalData = {};

    if (event_type === 'order_created') {
        // A. Buscar Pedido + Endereço + Cupom
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                user_coupons (
                    coupon_id,
                    coupons ( name )
                )
            `)
            .eq('id', orderId)
            .single();
        
        if (orderError || !order) throw new Error(`Order ${orderId} not found`);

        // B. Buscar Itens
        const { data: items } = await supabaseAdmin
            .from('order_items')
            .select('name_at_purchase, quantity, price_at_purchase')
            .eq('order_id', orderId);

        // C. Buscar Cliente
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, phone, email, cpf_cnpj')
            .eq('id', order.user_id)
            .single();
        
        // --- 4. CÁLCULOS ---
        const orderItems = items || [];
        // Subtotal = Soma (Qtd * Preço Unitário)
        const subtotalCalc = orderItems.reduce((acc: number, item: any) => acc + (item.quantity * item.price_at_purchase), 0);
        
        // Nome do Cupom
        let couponName = null;
        if (order.user_coupons && order.user_coupons.length > 0 && order.user_coupons[0].coupons) {
            couponName = order.user_coupons[0].coupons.name;
        }

        // Tratamento do Endereço (JSONB no banco)
        const addr = order.shipping_address || {};
        
        // Formatar cliente
        const customerData = {
            id: order.user_id,
            full_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
            phone: profile?.phone || '',
            email: profile?.email || '', // O email pode vir do profile se tiver sido salvo lá, ou precisaríamos pegar do auth.users. Assumindo profile.
            cpf: profile?.cpf_cnpj || ''
        };

        // --- 5. MONTAGEM DO PAYLOAD NO SCHEMA ESTRITO ---
        finalData = {
            id: order.id,
            total_price: Number(order.total_price),
            subtotal: subtotalCalc,
            shipping_cost: Number(order.shipping_cost),
            coupon_discount: Number(order.coupon_discount || 0),
            coupon_name: couponName,
            original_subtotal: subtotalCalc, // Geralmente igual ao subtotal se não houver descontos no nível do item
            status: order.status,
            payment_method: order.payment_method,
            created_at: order.created_at,
            benefits_used: order.benefits_used || null,
            shipping_address: {
                cep: addr.cep || "",
                city: addr.city || "",
                phone: customerData.phone, // Telefone geralmente vai no contato, mas schema pede aqui também
                state: addr.state || "",
                number: addr.number || "",
                street: addr.street || "",
                last_name: profile?.last_name || "",
                complement: addr.complement || "",
                first_name: profile?.first_name || "",
                neighborhood: addr.neighborhood || ""
            },
            customer: customerData,
            items: orderItems.map((item: any) => ({
                name: item.name_at_purchase,
                quantity: item.quantity,
                price: Number(item.price_at_purchase)
            }))
        };
    } else {
        // Fallback para outros eventos não mapeados (mantém payload original)
        finalData = payload;
    }

    // --- 6. ENVIO PARA WEBHOOKS ---
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (!webhooks || webhooks.length === 0) {
        return new Response(JSON.stringify({ message: "No active webhooks" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const uniqueTargets = [...new Set(webhooks.map((w: any) => w.target_url))];
    const finalPayload = {
        event: event_type,
        timestamp: new Date().toISOString(),
        data: finalData
    };

    const promises = uniqueTargets.map(async (rawUrl: string) => {
        let responseCode = 0;
        let responseBody = "";
        let status = "error";
        const url = rawUrl.trim().replace(/([^:]\/)\/+/g, "$1");

        try {
            console.log(`Disparando ${event_type} para '${url}'`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload)
            });
            responseCode = response.status;
            try { responseBody = await response.text(); } catch (e) { responseBody = "(Sem corpo)"; }
            if (response.ok) status = "success";
        } catch (err: any) {
            responseBody = `Erro de Rede: ${err.message}`;
            responseCode = 500;
        }

        // Log
        await supabaseAdmin.from('integration_logs').insert({
            event_type: event_type,
            status: status,
            response_code: responseCode,
            payload: finalPayload, 
            details: `Destino: ${url} | ${responseBody.substring(0, 500)}`
        });
    });

    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ success: true, dispatched: uniqueTargets.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})