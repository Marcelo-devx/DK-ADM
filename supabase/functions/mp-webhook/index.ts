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
    const urlObj = new URL(req.url);

    // MP envia tanto 'topic' (legado) quanto 'type' (moderno)
    const topic = urlObj.searchParams.get('topic') || urlObj.searchParams.get('type');

    // MP envia o payment ID em ?data.id=PAYMENT_ID (com ponto no nome do param)
    // searchParams.get('data.id') não funciona diretamente — precisa iterar
    let idFromQuery: string | null = null;
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (key === 'data.id' || key === 'id') {
        idFromQuery = value;
        break;
      }
    }

    console.log('[mp-webhook] Request received', { 
      topic, 
      idFromQuery,
      fullUrl: req.url,
      method: req.method,
      allParams: Object.fromEntries(urlObj.searchParams.entries())
    });

    // Lê o body
    let bodyData: any = {};
    let rawBody = '';
    try { 
      rawBody = await req.text();
      if (rawBody && rawBody.trim()) bodyData = JSON.parse(rawBody); 
    } catch (e) { 
      console.log('[mp-webhook] Failed to parse body as JSON', { error: String(e) }); 
    }

    console.log('[mp-webhook] Body received', { bodyData });

    // Aceita: payment, test, e também undefined/null (alguns envios do MP não mandam topic)
    const isPaymentEvent = !topic || topic === 'payment' || topic === 'test';
    
    if (!isPaymentEvent) {
      console.log('[mp-webhook] Ignored topic', { topic });
      return new Response(JSON.stringify({ message: "Topic ignored", topic }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrai o payment ID de todas as fontes possíveis
    const paymentId = idFromQuery 
      || bodyData?.data?.id 
      || bodyData?.id
      || (bodyData?.resource ? String(bodyData.resource).split('/').pop() : null);

    console.log('[mp-webhook] Resolved paymentId', { 
      paymentId, 
      idFromQuery, 
      bodyDataId: bodyData?.data?.id,
      bodyId: bodyData?.id
    });

    if (!paymentId) {
      console.log('[mp-webhook] No payment ID found in request', { url: req.url, bodyData });
      return new Response(JSON.stringify({ message: "No payment ID found" }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🔒 SECURITY: OPTIONAL HMAC SIGNATURE VERIFICATION
    const signature = req.headers.get('x-signature');
    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');

    if (webhookSecret) {
      console.log('[mp-webhook] MP_WEBHOOK_SECRET configurado. Verificando assinatura HMAC.');
      
      if (!signature) {
        console.error('[mp-webhook] Assinatura ausente, mas secret está configurado.');
        return new Response(JSON.stringify({ error: 'Missing signature' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signatureBytes = hexToBytes(signature);
      const bodyBytes = new TextEncoder().encode(rawBody);

      const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, bodyBytes);

      if (!isValid) {
        console.error('[mp-webhook] Assinatura inválida!');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log('[mp-webhook] Assinatura verificada com sucesso!');
    } else {
      console.warn('[mp-webhook] MP_WEBHOOK_SECRET não configurado. Operando em modo compatibilidade.');
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
    
    const settings: Record<string, string> = {};
    settingsData?.forEach((s: any) => settings[s.key] = s.value);

    const mode = settings['payment_mode'] === 'production' ? 'production' : 'test';
    const mpToken = mode === 'production' 
        ? settings['mercadopago_access_token'] 
        : settings['mercadopago_test_access_token'];

    if (!mpToken) {
        console.error('[mp-webhook] Configuração de token ausente', { mode });
        return new Response(JSON.stringify({ error: `Configuração de ${mode} ausente` }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 3. Consulta MP — tenta com o token configurado, se falhar tenta o outro
    console.log('[mp-webhook] Fetching payment from MP', { paymentId, mode });
    let mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` }
    });

    let paymentData: any = null;
    try {
      paymentData = await mpResponse.json();
    } catch (e) {
      console.error('[mp-webhook] Failed parsing MP response JSON', { error: String(e) });
    }

    // Se falhou com o token atual (ex: modo errado), tenta com o token alternativo
    if (!mpResponse.ok) {
      const fallbackToken = mode === 'production'
        ? settings['mercadopago_test_access_token']
        : settings['mercadopago_access_token'];

      if (fallbackToken) {
        console.warn('[mp-webhook] Token principal falhou, tentando token alternativo', { httpStatus: mpResponse.status });
        mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${fallbackToken}` }
        });
        try {
          paymentData = await mpResponse.json();
        } catch (e) {
          console.error('[mp-webhook] Failed parsing fallback MP response JSON', { error: String(e) });
        }
      }
    }

    console.log('[mp-webhook] MP payment response', { 
      httpStatus: mpResponse.status,
      paymentStatus: paymentData?.status,
      externalReference: paymentData?.external_reference,
      paymentTypeId: paymentData?.payment_type_id,
      paymentId
    });

    if (!mpResponse.ok) {
        console.error('[mp-webhook] Erro ao consultar MP', { status: mpResponse.status, body: paymentData });
        return new Response(JSON.stringify({ 
          error: `Erro ao consultar pagamento. HTTP ${mpResponse.status}`, 
          body: paymentData 
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

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

    console.log('[mp-webhook] Resolved external_reference', { 
      externalReference, 
      status,
      paymentTypeId,
      allCandidates: externalReferenceCandidates.filter(Boolean)
    });

    if ((status === 'approved' || status === 'authorized') && externalReference) {
        const orderId = String(externalReference).replace(/\D/g, ""); 

        console.log('[mp-webhook] Extracted orderId', { orderId, externalReference });

        if (orderId) {
            let methodLabel = 'Mercado Pago';
            if (paymentTypeId === 'credit_card') methodLabel = 'Cartão de Crédito';
            else if (paymentTypeId === 'debit_card') methodLabel = 'Cartão de Débito';
            else if (paymentTypeId === 'bank_transfer') methodLabel = 'Pix (MP)';
            else if (paymentTypeId === 'account_money') methodLabel = 'Saldo Mercado Pago';

            const deliveryStatusUpdate = (paymentTypeId === 'credit_card' || paymentTypeId === 'debit_card')
                ? 'Pendente'
                : 'Aguardando Validação';

            console.log('[mp-webhook] Attempting to update order', { orderId, status, methodLabel, deliveryStatusUpdate });

            const { data: updatedOrder, error: updateError } = await supabaseAdmin
                .from('orders')
                .update({ 
                    status: 'Pago', 
                    payment_method: methodLabel,
                    delivery_status: deliveryStatusUpdate
                })
                .eq('id', orderId)
                .select()
                .single();

            if (updateError) {
                console.error('[mp-webhook] Erro ao atualizar pedido no Supabase', { orderId, updateError });
                return new Response(JSON.stringify({ 
                  error: 'Erro ao atualizar pedido', 
                  detail: updateError 
                }), { 
                  status: 200, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                });
            }

            console.log('[mp-webhook] Pedido atualizado com sucesso', { orderId, newStatus: updatedOrder?.status });

            // ── Disparar e-mail de confirmação de pagamento ──────────────────────────
            try {
              const emailRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-order-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                },
                body: JSON.stringify({ event_type: 'order_paid', order_id: Number(orderId) }),
              });
              const emailData = await emailRes.json().catch(() => ({}));
              console.log('[mp-webhook] E-mail order_paid disparado', { status: emailRes.status, emailData });
            } catch (emailErr) {
              console.error('[mp-webhook] Falha ao disparar e-mail order_paid', { error: String(emailErr) });
            }

            // Verificar primeira compra e liberar cartão
            if (updatedOrder?.user_id) {
                const completedStatuses = ['Pago', 'Finalizada', 'Entregue', 'Concluída'];
                const { count: completedOrdersCount, error: countError } = await supabaseAdmin
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', updatedOrder.user_id)
                    .in('status', completedStatuses);

                if (!countError && completedOrdersCount === 1) {
                    console.log('[mp-webhook] PRIMEIRA COMPRA CONFIRMADA! Liberando cartão para usuário', { userId: updatedOrder.user_id });
                    
                    const { error: profileUpdateError } = await supabaseAdmin
                        .from('profiles')
                        .update({ force_pix_on_next_purchase: false })
                        .eq('id', updatedOrder.user_id);

                    if (profileUpdateError) {
                        console.error('[mp-webhook] Erro ao liberar cartão', { userId: updatedOrder.user_id, error: profileUpdateError });
                    } else {
                        console.log('[mp-webhook] Cartão liberado com sucesso!', { userId: updatedOrder.user_id });
                    }
                } else {
                    console.log('[mp-webhook] Contagem de pedidos', { count: completedOrdersCount, countError });
                }
            }
        } else {
            console.warn('[mp-webhook] external_reference encontrada, mas não contém ID válido', { externalReference });
        }
    } else {
        console.log('[mp-webhook] Payment not approved or no external_reference', { 
          paymentId, 
          status, 
          externalReference,
          allCandidates: externalReferenceCandidates.filter(Boolean)
        });
    }

    return new Response(JSON.stringify({ success: true, mode, paymentId, status }), {
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