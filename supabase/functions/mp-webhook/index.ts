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

    // 🔒 SECURITY: OPTIONAL HMAC SIGNATURE VERIFICATION
    // Se MP_WEBHOOK_SECRET estiver configurado, verifica a assinatura
    // Se NÃO estiver configurado, funciona em modo de compatibilidade (como antes)
    const signature = req.headers.get('x-signature');
    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');

    if (webhookSecret) {
      // Modo SEGURO: Verifica assinatura
      console.log('[mp-webhook] MP_WEBHOOK_SECRET configurado. Verificando assinatura HMAC.');
      
      if (!signature) {
        console.error('[mp-webhook] Assinatura ausente, mas secret está configurado.');
        return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Obter o corpo RAW da requisição para verificação
      const rawBody = await req.clone().text();
      
      // Calcular HMAC-SHA256 usando o secret
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signatureBytes = hexToBytes(signature);
      const keyBytes = new TextEncoder().encode(webhookSecret);
      const bodyBytes = new TextEncoder().encode(rawBody);

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        bodyBytes
      );

      if (!isValid) {
        console.error('[mp-webhook] Assinatura inválida!');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[mp-webhook] Assinatura verificada com sucesso!');
    } else {
      // Modo COMPATIBILIDADE: Não verifica assinatura se secret não estiver configurado
      console.warn('[mp-webhook] MP_WEBHOOK_SECRET não configurado. Operando em modo compatibilidade (sem verificação de assinatura). Configure MP_WEBHOOK_SECRET para proteção completa.');
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
        return new Response(JSON.stringify({ error: `Erro ao consultar pagamento. HTTP ${mpResponse.status}`, body: paymentData }), { status: 200, headers: corsHeaders });
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

            // 5. VERIFICAR SE É A PRIMEIRA COMPRA E LIBERAR CARTÃO AUTOMATICAMENTE
            const { data: order, error: orderFetchError } = await supabaseAdmin
                .from('orders')
                .select('user_id')
                .eq('id', orderId)
                .single();

            if (!orderFetchError && order?.user_id) {
                // Conta quantos pedidos completados/finalizados o usuário tem
                const completedStatuses = ['Pago', 'Finalizada', 'Entregue', 'Concluída'];
                const { count: completedOrdersCount, error: countError } = await supabaseAdmin
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', order.user_id)
                    .in('status', completedStatuses);

                if (!countError && completedOrdersCount === 1) {
                    // É a primeira compra paga! Libera o cartão automaticamente
                    console.log('[mp-webhook] PRIMEIRA COMPRA CONFIRMADA! Liberando cartão para usuário', { userId: order.user_id });
                    
                    const { error: profileUpdateError } = await supabaseAdmin
                        .from('profiles')
                        .update({ force_pix_on_next_purchase: false })
                        .eq('id', order.user_id);

                    if (profileUpdateError) {
                        console.error('[mp-webhook] Erro ao liberar cartão para primeira compra', { userId: order.user_id, error: profileUpdateError });
                    } else {
                        console.log('[mp-webhook] Cartão liberado com sucesso para primeira compra!', { userId: order.user_id });
                    }
                } else if (!countError && completedOrdersCount > 1) {
                    console.log('[mp-webhook] Usuário já tem mais de uma compra. Mantém status atual.', { userId: order.user_id, count: completedOrdersCount });
                } else {
                    console.error('[mp-webhook] Erro ao contar pedidos completados', { userId: order.user_id, error: countError });
                }
            } else {
                console.error('[mp-webhook] Erro ao buscar order_id do pedido', { orderId, error: orderFetchError });
            }
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

// Helper para converter string hex em bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}