// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Validação de Segurança
    // Aceita tanto o Token de Integração N8N (configurado no painel) quanto a Service Role Key direta
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let isAuthorized = false;

    // A. Verifica se é a Service Role Key (Supabase Admin padrão)
    if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        isAuthorized = true;
    } 
    // B. Verifica o Token do N8N configurado no banco
    else {
        const { data: setting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'n8n_integration_token')
            .single();
        
        if (setting?.value && token === setting.value) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Use o Token de Integração do N8N ou a Service Key.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Processar Payload
    const { order_id, status, delivery_status, tracking_code, delivery_info } = await req.json();

    if (!order_id) {
        throw new Error("O campo 'order_id' é obrigatório.");
    }

    // Monta objeto de atualização dinamicamente
    const updateData: any = {};
    if (status) updateData.status = status;
    if (delivery_status) updateData.delivery_status = delivery_status;
    
    // Se enviar tracking_code, salva em delivery_info (compatibilidade)
    // Se enviar delivery_info explícito, usa ele.
    if (tracking_code) updateData.delivery_info = `Rastreio: ${tracking_code}`;
    if (delivery_info) updateData.delivery_info = delivery_info;

    if (Object.keys(updateData).length === 0) {
        throw new Error("Nenhum campo para atualizar foi enviado (status, delivery_status, tracking_code).");
    }

    // 3. Executar Atualização
    const { data, error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', order_id)
        .select('id, status, delivery_status, delivery_info')
        .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Pedido atualizado com sucesso.", 
        data 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      }
    )
  }
})