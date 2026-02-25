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
    const url = new URL(req.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');

    // Se não for notificação de pagamento, ignora
    if (topic !== 'payment' && topic !== 'test') {
        return new Response(JSON.stringify({ message: "Topic ignored" }), { status: 200, headers: corsHeaders });
    }

    let bodyData = {};
    try { bodyData = await req.json(); } catch (e) {}

    const paymentId = id || bodyData?.data?.id;

    if (!paymentId) {
        return new Response(JSON.stringify({ message: "No payment ID found" }), { status: 200, headers: corsHeaders });
    }

    // 1. Inicializa Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Busca Token e Modo
    const { data: settingsData } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['mercadopago_access_token', 'mercadopago_test_access_token', 'payment_mode']);
    
    const settings = {};
    settingsData?.forEach(s => settings[s.key] = s.value);

    // Lógica de Seleção de Token
    const mode = settings['payment_mode'] === 'production' ? 'production' : 'test';
    const mpToken = mode === 'production' 
        ? settings['mercadopago_access_token'] 
        : settings['mercadopago_test_access_token'];

    if (!mpToken) {
        return new Response(JSON.stringify({ error: `Configuração de ${mode} ausente` }), { status: 500, headers: corsHeaders });
    }

    // 3. Consulta MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` }
    });

    if (!mpResponse.ok) {
        // Se falhar na consulta, pode ser que recebemos um webhook de prod mas estamos em test (ou vice-versa).
        console.error(`Erro ao consultar MP (${mode}): ${mpResponse.status}`);
        throw new Error(`Erro ao consultar pagamento.`);
    }

    const paymentData = await mpResponse.json();
    const status = paymentData.status; 
    const externalReference = paymentData.external_reference;
    const paymentTypeId = paymentData.payment_type_id; 

    console.log(`[MP Webhook] PayID: ${paymentId}, Status: ${status}, Type: ${paymentTypeId}, Order: ${externalReference}`);

    if (status === 'approved' && externalReference) {
        const orderId = externalReference.replace(/\D/g, ""); 

        if (orderId) {
            // Mapeia o nome correto para o banco
            let methodLabel = 'Mercado Pago';
            if (paymentTypeId === 'credit_card') methodLabel = 'Cartão de Crédito';
            else if (paymentTypeId === 'debit_card') methodLabel = 'Cartão de Débito';
            else if (paymentTypeId === 'bank_transfer') methodLabel = 'Pix (MP)';
            else if (paymentTypeId === 'account_money') methodLabel = 'Saldo Mercado Pago';

            // 4. Atualiza Pedido
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({ 
                    status: 'Pago', 
                    payment_method: methodLabel,
                    delivery_status: 'Pendente' 
                })
                .eq('id', orderId);

            if (updateError) throw updateError;
        }
    }

    return new Response(JSON.stringify({ success: true, mode: mode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro no Webhook MP:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
})