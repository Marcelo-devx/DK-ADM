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
    const { type } = await req.json();
    if (!type || (type !== 'production' && type !== 'test')) {
      throw new Error("O tipo de token ('production' ou 'test') é obrigatório.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const settingKey = type === 'production' 
      ? 'mercadopago_access_token' 
      : 'mercadopago_test_access_token';

    const { data: setting, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', settingKey)
      .single();

    if (error || !setting || !setting.value) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: {
        'Authorization': `Bearer ${setting.value}`,
      },
    });

    return new Response(JSON.stringify({ connected: response.ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao verificar status do Mercado Pago:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao verificar status.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})