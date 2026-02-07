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

    // Se for notificação de teste ou tipo irrelevante, ignora com sucesso (200)
    if (topic !== 'payment' && topic !== 'test') {
        return new Response(JSON.stringify({ message: "Topic ignored" }), { status: 200, headers: corsHeaders });
    }

    // Parse do corpo se necessário (alguns eventos vêm no body)
    let bodyData = {};
    try {
        bodyData = await req.json();
    } catch (e) {}

    const paymentId = id || bodyData?.data?.id;

    if (!paymentId) {
        return new Response(JSON.stringify({ message: "No payment ID found" }), { status: 200, headers: corsHeaders });
    }

    // 1. Inicializa Admin do Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Busca o Token de Acesso do Mercado Pago no Banco
    const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value, key')
        .in('key', ['mercadopago_access_token', 'payment_mode']);
    
    // Define qual token usar (Produção ou Teste) com base no payment_mode
    const mode = setting?.find(s => s.key === 'payment_mode')?.value || 'test';
    // Nota: Em um cenário real complexo, você usaria o token correspondente. 
    // Aqui assumimos que se o webhook chegou, usamos o token principal configurado.
    const mpToken = setting?.find(s => s.key === 'mercadopago_access_token')?.value;

    if (!mpToken) {
        console.error("Token do Mercado Pago não configurado.");
        return new Response(JSON.stringify({ error: "Configuração ausente" }), { status: 500, headers: corsHeaders });
    }

    // 3. Consulta o Status Real na API do Mercado Pago (Segurança)
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
            'Authorization': `Bearer ${mpToken}`
        }
    });

    if (!mpResponse.ok) {
        throw new Error(`Erro ao consultar MP: ${mpResponse.status}`);
    }

    const paymentData = await mpResponse.json();
    const status = paymentData.status; // approved, pending, rejected
    const externalReference = paymentData.external_reference; // Deve conter o ID do pedido (ex: "order-123")

    // 4. Log para Debug (Opcional)
    console.log(`[MP Webhook] Pagamento ${paymentId}: ${status}. Ref: ${externalReference}`);

    if (status === 'approved' && externalReference) {
        // Extrai o ID do pedido (pode vir como "123" ou "order-123")
        const orderId = externalReference.replace(/\D/g, ""); 

        if (orderId) {
            // 5. Atualiza o Pedido
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({ 
                    status: 'Pago', 
                    payment_method: 'Pix (Mercado Pago)',
                    delivery_status: 'Pendente' // Garante que volta para pendente de envio
                })
                .eq('id', orderId);

            if (updateError) {
                console.error("Erro ao atualizar pedido:", updateError);
                throw updateError;
            }
            console.log(`Pedido #${orderId} atualizado para PAGO.`);
        }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro no Webhook MP:', error);
    // Retorna 200 mesmo com erro interno para o MP não ficar reenviando infinitamente se for erro de lógica nossa
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
})