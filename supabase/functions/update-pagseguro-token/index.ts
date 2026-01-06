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
    const { email, token, type } = await req.json();
    if (!email || !token) {
      throw new Error("O e-mail e o token são obrigatórios.");
    }
    if (!type || (type !== 'production' && type !== 'test')) {
      throw new Error("O tipo ('production' ou 'test') é obrigatório.");
    }

    // 1. Verificar se as credenciais são válidas
    const pagseguroUrl = type === 'production'
      ? 'https://ws.pagseguro.uol.com.br/v2/sessions'
      : 'https://ws.sandbox.pagseguro.uol.com.br/v2/sessions';

    const response = await fetch(`${pagseguroUrl}?email=${email}&token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml;charset=ISO-8859-1',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PagSeguro validation error:", errorText);
      throw new Error("As credenciais do PagSeguro fornecidas são inválidas.");
    }

    // 2. Se forem válidas, salvar no banco de dados
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const emailKey = type === 'production' ? 'pagseguro_email' : 'pagseguro_test_email';
    const tokenKey = type === 'production' ? 'pagseguro_token' : 'pagseguro_test_token';

    const { error: upsertError } = await supabaseAdmin
      .from('app_settings')
      .upsert([
        { key: emailKey, value: email },
        { key: tokenKey, value: token }
      ], { onConflict: 'key' });

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ message: "Conexão com PagSeguro estabelecida com sucesso!" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro ao atualizar token do PagSeguro:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao salvar as credenciais.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})