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
    const { event_type, payload } = await req.json();

    if (!event_type) return new Response("Missing event_type", { status: 400 });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // --- ENRIQUECIMENTO DE DADOS (NOVO) ---
    let enrichedPayload = { ...payload };

    if (event_type === 'order_created' && payload.user_id) {
        // Busca dados do perfil (Telefone, Nome)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, phone, email, cpf_cnpj') // email pode não estar no profile se não foi syncado, mas tentamos
            .eq('id', payload.user_id)
            .single();
        
        // Busca email do Auth se não estiver no profile (opcional, mas bom ter)
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(payload.user_id);

        if (profile || user) {
            enrichedPayload.customer = {
                id: payload.user_id,
                first_name: profile?.first_name || '',
                last_name: profile?.last_name || '',
                full_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
                phone: profile?.phone || '',
                email: user?.email || '',
                cpf: profile?.cpf_cnpj || ''
            };
            console.log(`[Webhook] Dados do cliente anexados para pedido #${payload.id}`);
        }
    }
    // --------------------------------------

    // Buscar webhooks ativos para este evento
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (!webhooks || webhooks.length === 0) {
        console.log(`[Webhook] Nenhum gatilho ativo encontrado para o evento: ${event_type}`);
        return new Response(JSON.stringify({ message: "No webhooks configured" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const promises = webhooks.map(async (hook) => {
        try {
            console.log(`Disparando webhook ${event_type} para ${hook.target_url}`);
            const response = await fetch(hook.target_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    event: event_type, 
                    data: enrichedPayload, 
                    timestamp: new Date().toISOString() 
                })
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.error(`[Webhook] Erro na resposta do destino (${response.status}): ${text}`);
            }
        } catch (err) {
            console.error(`Falha ao disparar webhook para ${hook.target_url}:`, err);
        }
    });

    // Fire and Forget (processa em background para não travar o banco)
    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, dispatched: webhooks.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('[Webhook] Erro interno:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})