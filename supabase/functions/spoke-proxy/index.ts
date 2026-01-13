// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, method = 'GET', body, params } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['logistics_api_url', 'logistics_api_token']);

    let apiUrl = settings?.find(s => s.key === 'logistics_api_url')?.value;
    const apiToken = settings?.find(s => s.key === 'logistics_api_token')?.value;

    if (!apiUrl || !apiToken) {
      throw new Error("API não configurada. Preencha a URL e o Token em Configurações.");
    }

    // 1. Limpeza básica: remove espaços
    apiUrl = apiUrl.trim();
    
    // 2. Garante o protocolo https:// se não houver
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        apiUrl = 'https://' + apiUrl;
    }

    // Remove barra final se existir para evitar duplicação
    let cleanUrl = apiUrl.replace(/\/$/, '');
    
    // NOTA: Removida a imposição forçada de '/v1'. 
    // O sistema agora respeitará a URL base configurada pelo usuário.
    
    let finalUrl = `${cleanUrl}/${action}`;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      finalUrl += `?${queryString}`;
    }

    console.log("Conectando em:", finalUrl);

    try {
        const response = await fetch(finalUrl, {
            method,
            headers: {
                'Authorization': `Bearer ${apiToken.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        // Se a resposta não for JSON (erro de servidor, página HTML, etc)
        const contentType = response.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}...`);
            }
            data = { message: text };
        }

        if (!response.ok) {
            throw new Error(data.message || data.error || `Erro ${response.status} na API Logística`);
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (fetchError) {
        console.error("Erro no fetch:", fetchError);
        // Retorna detalhes úteis para o usuário debugar a URL
        throw new Error(`Falha ao conectar em: ${finalUrl}. Detalhe: ${fetchError.message}`);
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ 
          error: "Erro de Integração", 
          details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})