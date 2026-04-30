// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mensagens automáticas que o sistema grava — não são obs do admin
const SYSTEM_MESSAGES = [
  'motorista designado para a entrega',
  'motorista iniciou o trajeto',
  'pedido entregue com sucesso',
  'motorista tentou entregar',
  'atualizado automaticamente',
  'despachado manualmente',
]

const isSystemMessage = (val: string | null | undefined): boolean => {
  if (!val) return true
  const lower = val.toLowerCase()
  return SYSTEM_MESSAGES.some((msg) => lower.includes(msg))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    console.log("[spoke-webhook] Evento Spoke recebido:", payload.event_type);

    const { event_type, data } = payload;
    
    const externalId = data?.external_id;

    if (!externalId || !externalId.startsWith('ORDER-')) {
      console.log("[spoke-webhook] Ignorando webhook sem ID de pedido válido:", externalId);
      return new Response(JSON.stringify({ message: 'Ignorado' }), { status: 200 });
    }

    const orderId = externalId.replace('ORDER-', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Mapeamento de Eventos Spoke -> Status da Loja
    let deliveryStatus = 'Pendente';
    let orderStatus = undefined;

    if (event_type === 'stop.allocated') {
        deliveryStatus = 'Aguardando Coleta';
    } else if (event_type === 'stop.out_for_delivery') {
        deliveryStatus = 'Despachado';
    } else if (event_type === 'stop.completed' || data.status === 'completed') {
        deliveryStatus = 'Entregue';
        orderStatus = 'Finalizada';
    } else if (event_type === 'stop.attempted_delivery') {
        deliveryStatus = 'Tentativa de Entrega';
    }

    // Buscar o delivery_info atual para preservar obs do admin
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('delivery_info')
      .eq('id', orderId)
      .single();

    const currentInfo = currentOrder?.delivery_info ?? '';

    // Só atualiza delivery_info se o valor atual for uma msg automática (ou vazio)
    // Se houver obs do admin, preserva ela
    const updatePayload: any = { delivery_status: deliveryStatus };
    if (isSystemMessage(currentInfo)) {
      updatePayload.delivery_info = '';
    }
    // Se tem obs do admin, não toca no delivery_info

    if (orderStatus) updatePayload.status = orderStatus;

    console.log("[spoke-webhook] Atualizando pedido", orderId, updatePayload);

    const { error } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[spoke-webhook] Erro no processamento do Webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
