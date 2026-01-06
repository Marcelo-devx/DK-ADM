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
    const { token, type } = await req.json();
    if (!token) {
      throw new Error("O Access Token é obrigatório.");
    }
    if (!type || (type !== 'production' && type !== 'test')) {
      throw new Error("O tipo de token ('production' ou 'test') é obrigatório.");
    }

    // 1. Verificar se o token é válido
    const mpResponse = await fetch('https://api.mercadopago.com/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!mpResponse.ok) {
      throw new Error("O Access Token fornecido é inválido ou expirou.");
    }

    // 2. Se for válido, salvar no banco de dados
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const settingKey = type === 'production' 
      ? 'mercadopago_access_token' 
      : 'mercadopago_test_access_token';

    const { error: upsertError } = await supabaseAdmin
      .from('app_settings')
      .upsert({ key: settingKey, value: token }, { onConflict: 'key' });

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ message: "Conexão com Mercado Pago estabelecida com sucesso!" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro ao atualizar token do Mercado Pago:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao salvar o token.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})