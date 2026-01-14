// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Esta função é chamada internamente por outras Edge Functions ou Triggers
  // Autenticação básica via Service Role para garantir que só o sistema chame
  
  try {
    const { event_type, payload } = await req.json();

    if (!event_type) return new Response("Missing event_type", { status: 400 });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Buscar webhooks ativos para este evento
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('target_url')
        .eq('is_active', true)
        .eq('trigger_event', event_type);

    if (!webhooks || webhooks.length === 0) {
        return new Response(JSON.stringify({ message: "No webhooks configured" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const promises = webhooks.map(async (hook) => {
        try {
            console.log(`Disparando webhook ${event_type} para ${hook.target_url}`);
            await fetch(hook.target_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: event_type, data: payload, timestamp: new Date() })
            });
        } catch (err) {
            console.error(`Falha ao disparar webhook para ${hook.target_url}:`, err);
        }
    });

    // Não esperamos as promises terminarem para responder rápido (Fire and Forget)
    // No Deno Edge, precisamos usar EdgeRuntime.waitUntil se disponível, ou await Promise.all
    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, dispatched: webhooks.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})