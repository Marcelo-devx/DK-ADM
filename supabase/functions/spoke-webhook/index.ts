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
    const payload = await req.json();
    console.log("Evento Spoke recebido:", payload.event_type);

    const { event_type, data } = payload;
    
    // O Spoke envia o external_id no objeto data
    const externalId = data?.external_id;

    if (!externalId || !externalId.startsWith('ORDER-')) {
      console.log("Ignorando webhook sem ID de pedido válido:", externalId);
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
    let deliveryInfo = data.last_update_message || "";
    let orderStatus = undefined;

    if (event_type === 'stop.allocated') {
        deliveryStatus = 'Aguardando Coleta';
        deliveryInfo = 'Motorista designado para a entrega.';
    } else if (event_type === 'stop.out_for_delivery') {
        deliveryStatus = 'Despachado';
        deliveryInfo = 'O motorista iniciou o trajeto até você.';
    } else if (event_type === 'stop.completed' || data.status === 'completed') {
        deliveryStatus = 'Entregue';
        deliveryInfo = 'Pedido entregue com sucesso!';
        orderStatus = 'Finalizada';
    } else if (event_type === 'stop.attempted_delivery') {
        deliveryStatus = 'Tentativa de Entrega';
        deliveryInfo = 'O motorista tentou entregar, mas houve um imprevisto.';
    }

    const updatePayload: any = { 
        delivery_status: deliveryStatus,
        delivery_info: deliveryInfo
    };

    if (orderStatus) updatePayload.status = orderStatus;

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
    console.error('Erro no processamento do Webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})