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
    // 1. Auth Validation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { orderId } = await req.json();

    if (!orderId) throw new Error("Order ID is required");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Fetch Order Details (including user_id for security check)
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select(`
            user_id,
            total_price, 
            shipping_cost, 
            donation_amount,
            coupon_discount,
            profiles(first_name, last_name, email, cpf_cnpj, phone, force_pix_on_next_purchase)
        `)
        .eq('id', orderId)
        .single();

    if (orderError || !order) throw new Error("Pedido não encontrado.");

    // 3. Security Check: Ownership or Admin
    if (order.user_id !== user.id) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (profile?.role !== 'adm') {
            return new Response(JSON.stringify({ error: 'Forbidden: Acesso negado a este pedido.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // 4. Fetch Settings and Determine Mode (Test vs Production)
    const { data: settingsData } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['mercadopago_access_token', 'mercadopago_test_access_token', 'payment_mode', 'site_url']);
    
    const settings = {};
    settingsData?.forEach(s => settings[s.key] = s.value);

    // Lógica de Seleção de Token
    const mode = settings['payment_mode'] === 'production' ? 'production' : 'test';
    const token = mode === 'production' 
        ? settings['mercadopago_access_token'] 
        : settings['mercadopago_test_access_token'];

    const siteUrl = settings['site_url'] || 'http://localhost:8080';

    if (!token) throw new Error(`Token do Mercado Pago (${mode}) não configurado.`);

    // Calcula total final
    const totalAmount = 
        Number(order.total_price) + 
        (Number(order.shipping_cost) || 0) + 
        (Number(order.donation_amount) || 0);

    const payerEmail = order.profiles?.email || "cliente@email.com";
    const payerName = order.profiles?.first_name || "Cliente";
    const payerSurname = order.profiles?.last_name || "";

    // Determine forcePix flag. Prefer latest profile value from profiles table if available.
    let forcePix = false;
    if (order.profiles && typeof order.profiles.force_pix_on_next_purchase !== 'undefined') {
        forcePix = !!order.profiles.force_pix_on_next_purchase;
    } else if (order.user_id) {
        const { data: p } = await supabaseAdmin.from('profiles').select('force_pix_on_next_purchase').eq('id', order.user_id).maybeSingle();
        forcePix = !!p?.force_pix_on_next_purchase;
    }

    // 5. Create Preference
    // Default excluded payment types (keep excluding non-card digital methods)
    const excludedPaymentTypes: any[] = [
        { id: "ticket" }, // Exclui Boletos
        { id: "digital_currency" }
    ];

    // If user's profile requires PIX only, also exclude card payments
    if (forcePix) {
        excludedPaymentTypes.push({ id: "credit_card" });
        excludedPaymentTypes.push({ id: "debit_card" });
        // Keep bank_transfer excluded as well (if desired)
        excludedPaymentTypes.push({ id: "bank_transfer" });
    } else {
        // If user DOES NOT require PIX, ensure we do not exclude card payments
        excludedPaymentTypes.push({ id: "bank_transfer" });
    }

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
            excluded_payment_types: excludedPaymentTypes,
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
        // Retorna o link correto baseado no modo
        init_point: mode === 'production' ? mpData.init_point : mpData.sandbox_init_point,
        mode: mode,
        id: mpData.id,
        excluded_payment_types: excludedPaymentTypes
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