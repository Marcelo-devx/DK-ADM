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
        console.log('[mp-webhook] Ignored topic', { topic });
        return new Response(JSON.stringify({ message: "Topic ignored" }), { status: 200, headers: corsHeaders });
    }

    let bodyData = {};
    try { bodyData = await req.json(); } catch (e) { console.log('[mp-webhook] Failed to parse body as JSON', { error: String(e) }); }

    const paymentId = id || bodyData?.data?.id || bodyData?.id;

    if (!paymentId) {
        console.log('[mp-webhook] No payment ID found in request', { url: req.url, bodyData });
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
        console.error('[mp-webhook] Configuração de token ausente', { mode });
        return new Response(JSON.stringify({ error: `Configuração de ${mode} ausente` }), { status: 500, headers: corsHeaders });
    }

    // 3. Consulta MP
    console.log('[mp-webhook] Fetching payment from MP', { paymentId, mode });
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` }
    });

    let paymentData = null;
    try {
      paymentData = await mpResponse.json();
    } catch (e) {
      console.error('[mp-webhook] Failed parsing MP response JSON', { error: String(e) });
    }

    if (!mpResponse.ok) {
        // Se falhar na consulta, pode ser que recebemos um webhook de prod mas estamos em test (ou vice-versa).
        console.error('[mp-webhook] Erro ao consultar MP', { status: mpResponse.status, body: paymentData });
        // Return 200 so MP won't keep retrying too aggressively, but include details for us to inspect
        return new Response(JSON.stringify({ error: `Erro ao consultar pagamento. HTTP ${mpResponse.status}`, body: paymentData }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[mp-webhook] MP payment payload', { paymentId, paymentData });

    const status = paymentData?.status; 
    // Tenta extrair external reference a partir de várias fontes possíveis
    const externalReferenceCandidates = [
      paymentData?.external_reference,
      paymentData?.metadata?.external_reference,
      paymentData?.metadata?.order_id,
      paymentData?.additional_info?.items?.[0]?.id,
      paymentData?.order?.external_reference,
      paymentData?.order?.id,
      bodyData?.external_reference,
      bodyData?.data?.external_reference,
      bodyData?.data?.metadata?.external_reference
    ];

    const externalReference = externalReferenceCandidates.find(Boolean);
    const paymentTypeId = paymentData?.payment_type_id; 

    console.log('[mp-webhook] Resolved external_reference', { externalReference, candidatesCount: externalReferenceCandidates.filter(Boolean).length });

    if ((status === 'approved' || status === 'authorized') && externalReference) {
        const orderId = String(externalReference).replace(/\D/g, ""); 

        if (orderId) {
            // Mapeia o nome correto para o banco
            let methodLabel = 'Mercado Pago';
            if (paymentTypeId === 'credit_card') methodLabel = 'Cartão de Crédito';
            else if (paymentTypeId === 'debit_card') methodLabel = 'Cartão de Débito';
            else if (paymentTypeId === 'bank_transfer') methodLabel = 'Pix (MP)';
            else if (paymentTypeId === 'account_money') methodLabel = 'Saldo Mercado Pago';

            // NOVA LÓGICA DE STATUS DE ENTREGA
            const deliveryStatusUpdate = (paymentTypeId === 'credit_card' || paymentTypeId === 'debit_card')
                ? 'Pendente' // Confiança automática para cartões
                : 'Aguardando Validação'; // Validação manual para Pix e outros

            // 4. Atualiza Pedido
            console.log('[mp-webhook] Attempting to update order', { orderId, status, methodLabel, deliveryStatusUpdate });

            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({ 
                    status: 'Pago', 
                    payment_method: methodLabel,
                    delivery_status: deliveryStatusUpdate // Usa o novo status dinâmico
                })
                .eq('id', orderId);

            if (updateError) {
                console.error('[mp-webhook] Erro ao atualizar pedido no Supabase', { orderId, updateError });
                return new Response(JSON.stringify({ error: 'Erro ao atualizar pedido', detail: updateError }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            console.log('[mp-webhook] Pedido atualizado com sucesso', { orderId });
        } else {
            console.warn('[mp-webhook] external_reference encontrada, mas não contém ID válido', { externalReference });
        }
    } else {
        console.log('[mp-webhook] Payment status not treated as Paid or no external_reference found', { paymentId, status, externalReference });
    }

    return new Response(JSON.stringify({ success: true, mode: mode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[mp-webhook] Erro no Webhook MP:', String(error));
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
})