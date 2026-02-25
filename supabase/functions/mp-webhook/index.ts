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

    // 2. Busca Token
    const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'mercadopago_access_token')
        .single();
    
    const mpToken = setting?.value;

    if (!mpToken) {
        return new Response(JSON.stringify({ error: "Configuração ausente" }), { status: 500, headers: corsHeaders });
    }

    // 3. Consulta MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` }
    });

    if (!mpResponse.ok) {
        throw new Error(`Erro ao consultar MP: ${mpResponse.status}`);
    }

    const paymentData = await mpResponse.json();
    const status = paymentData.status; 
    const externalReference = paymentData.external_reference;
    const paymentTypeId = paymentData.payment_type_id; // credit_card, debit_card, account_money, etc.

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

    return new Response(JSON.stringify({ success: true }), {
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