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
    const { orderId } = await req.json();

    if (!orderId) throw new Error("Order ID is required");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Buscar Dados do Pedido e Cliente
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('total_price, shipping_cost, profiles(first_name, last_name, email, cpf_cnpj)')
        .eq('id', orderId)
        .single();

    if (orderError || !order) throw new Error("Pedido não encontrado.");

    // 2. Buscar Configurações
    const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['mercadopago_access_token', 'payment_mode']);
    
    const token = settings?.find(s => s.key === 'mercadopago_access_token')?.value;

    if (!token) throw new Error("Token do Mercado Pago não configurado.");

    const totalAmount = Number(order.total_price) + (Number(order.shipping_cost) || 0);
    const payerEmail = order.profiles?.email || "cliente@email.com";
    const payerName = order.profiles?.first_name || "Cliente";

    // 3. Chamada para Mercado Pago API
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `order-${orderId}-${Date.now()}`
        },
        body: JSON.stringify({
            transaction_amount: totalAmount,
            description: `Pedido #${orderId} - Tabacaria`,
            payment_method_id: 'pix',
            payer: {
                email: payerEmail,
                first_name: payerName,
                last_name: order.profiles?.last_name || "",
                identification: order.profiles?.cpf_cnpj ? {
                    type: "CPF",
                    number: order.profiles.cpf_cnpj.replace(/\D/g, "")
                } : undefined
            },
            external_reference: String(orderId), // IMPORTANTE: Vínculo para o Webhook
            notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`
        })
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("Erro MP:", mpData);
        throw new Error(mpData.message || "Erro ao gerar Pix no Mercado Pago.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        payment_id: mpData.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})