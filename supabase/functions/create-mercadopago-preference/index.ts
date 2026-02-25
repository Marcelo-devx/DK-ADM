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
        .select(`
            total_price, 
            shipping_cost, 
            donation_amount,
            coupon_discount,
            profiles(first_name, last_name, email, cpf_cnpj, phone)
        `)
        .eq('id', orderId)
        .single();

    if (orderError || !order) throw new Error("Pedido não encontrado.");

    // 2. Buscar Configurações
    const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['mercadopago_access_token', 'site_url']);
    
    const token = settings?.find(s => s.key === 'mercadopago_access_token')?.value;
    const siteUrl = settings?.find(s => s.key === 'site_url')?.value || 'http://localhost:8080';

    if (!token) throw new Error("Token do Mercado Pago não configurado.");

    // Calcula total final
    const totalAmount = 
        Number(order.total_price) + 
        (Number(order.shipping_cost) || 0) + 
        (Number(order.donation_amount) || 0);
        // Nota: total_price no banco já deve considerar o desconto, mas se não, ajuste aqui.

    const payerEmail = order.profiles?.email || "cliente@email.com";
    const payerName = order.profiles?.first_name || "Cliente";
    const payerSurname = order.profiles?.last_name || "";

    // 3. Criar Preferência
    const preferenceBody = {
        items: [
            {
                id: String(orderId),
                title: `Pedido #${orderId} - Tabacaria`,
                description: `Compra realizada na loja. Pedido #${orderId}`,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: Number(totalAmount.toFixed(2))
            }
        ],
        payer: {
            name: payerName,
            surname: payerSurname,
            email: payerEmail,
            date_created: new Date().toISOString(),
            phone: {
                area_code: "55",
                number: order.profiles?.phone?.replace(/\D/g, "") || ""
            },
            identification: order.profiles?.cpf_cnpj ? {
                type: "CPF",
                number: order.profiles.cpf_cnpj.replace(/\D/g, "")
            } : undefined
        },
        payment_methods: {
            excluded_payment_types: [
                { id: "ticket" }, // Exclui Boletos
                { id: "bank_transfer" }, // Exclui Pix (conforme solicitado, pois o Pix é manual)
                { id: "digital_currency" }
            ],
            installments: 12 // Permite parcelamento
        },
        back_urls: {
            success: `${siteUrl}/meus-pedidos?status=success`,
            failure: `${siteUrl}/meus-pedidos?status=failure`,
            pending: `${siteUrl}/meus-pedidos?status=pending`
        },
        auto_return: "approved",
        external_reference: String(orderId), // Vínculo CRÍTICO para o Webhook
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
        statement_descriptor: "TABACARIA"
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceBody)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("Erro MP:", mpData);
        throw new Error(mpData.message || "Erro ao gerar link de pagamento.");
    }

    return new Response(
      JSON.stringify({ 
        init_point: mpData.init_point, // Link para produção
        sandbox_init_point: mpData.sandbox_init_point, // Link para testes
        id: mpData.id
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