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
    const orderId = payload.id || payload.order_id;

    if (!orderId && ['order_created', 'order_paid', 'order_shipped', 'order_delivered'].includes(event_type)) {
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

    if (['order_created', 'order_paid', 'order_shipped', 'order_delivered'].includes(event_type)) {
        // A. Buscar Pedido + Endereço + Cupom
        // NOTE: avoid PostgREST nested relationship selects which fail if DB FKs aren't configured in the schema cache.
        // Fetch the base order first, then fetch related data separately.
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
        
        if (orderError || !order) throw new Error(`Order ${orderId} not found`);

        // Try to fetch any coupon relation separately (defensive: schema may not expose a direct FK relation)
        let couponName = null;
        try {
            const { data: ucData, error: ucError } = await supabaseAdmin
                .from('user_coupons')
                .select('coupon_id, coupons ( name )')
                .eq('user_id', order.user_id)
                .limit(1);

            if (!ucError && ucData && ucData.length > 0 && ucData[0].coupons) {
                couponName = ucData[0].coupons.name;
            }
        } catch (e) {
            console.warn('[dispatch-webhook] could not fetch user_coupons relation', e?.message || e);
        }

        // B. Buscar Itens
        const { data: items } = await supabaseAdmin
            .from('order_items')
            .select('name_at_purchase, quantity, price_at_purchase')
            .eq('order_id', orderId);

        // C. Buscar Cliente (Profile)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj') 
            .eq('id', order.user_id)
            .maybeSingle();

        // D. Buscar Email do Auth (defensive)
        let userEmail = "";
        if (order.user_id) {
            try {
                const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
                userEmail = userData?.user?.email || "";
            } catch (e) {
                console.warn('[dispatch-webhook] auth.getUserById failed', e?.message || e);
            }
        }
        
        // --- 4. CÁLCULOS ---
        const orderItems = items || [];
        const subtotalCalc = orderItems.reduce((acc: number, item: any) => acc + (item.quantity * item.price_at_purchase), 0);
        
        // If couponName wasn't populated above, try reading from order (backwards-compat)
        if (!couponName) {
            try {
                if (order.user_coupons && order.user_coupons.length > 0 && order.user_coupons[0].coupons) {
                    couponName = order.user_coupons[0].coupons.name;
                }
            } catch (e) {
                // ignore
            }
        }

        const shippingCost = Number(order.shipping_cost || 0);
        const donationAmount = Number(order.donation_amount || 0);
        const couponDiscount = Number(order.coupon_discount || 0);

        const calculatedTotal = subtotalCalc + shippingCost + donationAmount - couponDiscount;

        // Tratamento do Endereço (JSONB no banco)
        const addr = order.shipping_address || {};
        
        // Formatar dados do cliente
        const firstName = profile?.first_name || "";
        const lastName = profile?.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const phone = profile?.phone || "";
        const cpf = profile?.cpf_cnpj || "";

        const customerData = {
            id: order.user_id,
            full_name: fullName,
            phone: phone,
            email: userEmail,
            cpf: cpf
        };

        // --- 5. MONTAGEM DO PAYLOAD NO SCHEMA ESTRITO ---
        finalData = {
            id: order.id,
            total_price: Number(calculatedTotal.toFixed(2)),
            subtotal: Number(subtotalCalc.toFixed(2)),
            shipping_cost: shippingCost,
            coupon_discount: couponDiscount,
            coupon_name: couponName,
            original_subtotal: Number(subtotalCalc.toFixed(2)),
            donation_amount: donationAmount,
            status: order.status,
            payment_method: order.payment_method,
            created_at: order.created_at,
            benefits_used: order.benefits_used || null,
            delivery_info: order.delivery_info || null,
            delivery_status: order.delivery_status || null,
            shipping_address: {
                cep: addr.cep || "",
                city: addr.city || "",
                state: addr.state || "",
                number: addr.number || "",
                street: addr.street || "",
                neighborhood: addr.neighborhood || "",
                complement: addr.complement || "",
                phone: addr.phone || phone, 
                first_name: addr.first_name || firstName,
                last_name: addr.last_name || lastName
            },
            customer: customerData,
            items: orderItems.map((item: any) => ({
                name: item.name_at_purchase,
                quantity: item.quantity,
                price: Number(item.price_at_purchase)
            }))
        };

        // Adicionar informações específicas de mudança de status
        if (event_type !== 'order_created') {
            finalData.status_change = {
                old_status: payload.old_status || null,
                new_status: payload.new_status || order.status,
                changed_at: payload.updated_at || new Date().toISOString()
            };
        }
    } else {
        // Fallback para outros eventos não mapeados
        finalData = payload;
    }

    // --- 6. ENVIO PARA WEBHOOKS ---
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (!webhooks || webhooks.length === 0) {
        console.log(`[dispatch-webhook] No active webhooks for event: ${event_type}`);
        return new Response(JSON.stringify({ message: "No active webhooks" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const uniqueTargets = [...new Set(webhooks.map((w: any) => w.target_url))];
    const finalPayload = {
        event: event_type,
        timestamp: new Date().toISOString(),
        data: finalData
    };

    console.log(`[dispatch-webhook] Dispatching ${event_type} to ${uniqueTargets.length} target(s)`);

    const promises = uniqueTargets.map(async (rawUrl: string) => {
        let responseCode = 0;
        let responseBody = "";
        let status = "error";
        const url = rawUrl.trim().replace(/([^:]\/)\/+/g, "$1");

        try {
            console.log(`[dispatch-webhook] Sending ${event_type} to '${url}'`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload)
            });
            responseCode = response.status;
            try { responseBody = await response.text(); } catch (e) { responseBody = "(No body)"; }
            if (response.ok) status = "success";
        } catch (err: any) {
            responseBody = `Network Error: ${err.message}`;
            responseCode = 500;
        }

        // Log
        await supabaseAdmin.from('integration_logs').insert({
            event_type: event_type,
            status: status,
            response_code: responseCode,
            payload: finalPayload, 
            details: `Target: ${url} | ${responseBody.substring(0, 500)}`
        });
    });

    await Promise.allSettled(promises);

    return new Response(JSON.stringify({ success: true, dispatched: uniqueTargets.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error('[dispatch-webhook] ERROR:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})