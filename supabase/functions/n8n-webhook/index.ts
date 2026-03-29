import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lida com a requisição CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verifica o token secreto no cabeçalho de autorização
    const authToken = req.headers.get('Authorization')?.replace('Bearer ', '');
    const n8nSecret = Deno.env.get('N8N_SECRET_TOKEN');

    if (!n8nSecret) {
        console.error('O segredo N8N_SECRET_TOKEN não está configurado no Supabase.');
        return new Response(JSON.stringify({ error: 'Erro de configuração no servidor.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (authToken !== n8nSecret) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Se autorizado, cria um cliente admin para interagir com o banco de dados
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 3. Exemplo: Busca todos os produtos do banco de dados
    // Você pode me pedir para alterar esta consulta para o que precisar no n8n
    const { data, error } = await supabaseAdmin.from('products').select('*');

    if (error) {
      throw error;
    }

    // 4. Retorna os dados
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao processar a requisição.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})