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
      throw new Error("O tipo ('production' ou 'test') é obrigatório.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const emailKey = type === 'production' ? 'pagseguro_email' : 'pagseguro_test_email';
    const tokenKey = type === 'production' ? 'pagseguro_token' : 'pagseguro_test_token';

    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', [emailKey, tokenKey]);

    if (error) throw error;

    const email = settings.find(s => s.key === emailKey)?.value;
    const token = settings.find(s => s.key === tokenKey)?.value;

    if (!email || !token) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const pagseguroUrl = type === 'production'
      ? 'https://ws.pagseguro.uol.com.br/v2/sessions'
      : 'https://ws.sandbox.pagseguro.uol.com.br/v2/sessions';

    const response = await fetch(`${pagseguroUrl}?email=${email}&token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml;charset=ISO-8859-1',
      }
    });

    return new Response(JSON.stringify({ connected: response.ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao verificar status do PagSeguro:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao verificar status.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})