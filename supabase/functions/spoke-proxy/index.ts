// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// URL Oficial da Circuit/Spoke conforme documentação
const OFFICIAL_API_URL = "https://api.getcircuit.com/public/v0.2b";

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

    if (!apiToken) {
      throw new Error("Token da API não configurado. Vá em Configurações > Integração Spoke.");
    }

    // AUTO-CORREÇÃO: Se a URL estiver vazia ou for antiga/incorreta, usa a oficial
    if (!apiUrl || apiUrl.includes("spoke.services") || apiUrl.includes("use-spoke") || !apiUrl.includes("getcircuit.com")) {
        console.warn(`URL configurada (${apiUrl}) parece incorreta/antiga. Usando URL oficial: ${OFFICIAL_API_URL}`);
        apiUrl = OFFICIAL_API_URL;
    }

    // Limpeza e formatação da URL
    apiUrl = apiUrl.trim();
    if (!apiUrl.startsWith('http')) {
        apiUrl = 'https://' + apiUrl;
    }
    // Remove barra final
    let cleanUrl = apiUrl.replace(/\/$/, '');
    
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
                'Authorization': `Bearer ${apiToken.trim()}`, // Basic auth is implied by just token in Spoke sometimes, but docs say Bearer or Basic. Using Bearer as per updated docs.
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        // Tenta ler o corpo da resposta independentemente do status
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // Se não for JSON, retorna o texto como mensagem
            data = { message: responseText || `Erro ${response.status}` };
        }

        if (!response.ok) {
            // Repassa o erro da API para o frontend
            console.error("Erro na API Spoke:", data);
            throw new Error(data.message || data.error || `Erro ${response.status} na API Externa`);
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (fetchError) {
        console.error("Erro de conexão:", fetchError);
        // Retorna erro amigável se for problema de DNS/Rede
        if (fetchError.message.includes("dns error") || fetchError.message.includes("Name or service not known")) {
             throw new Error(`Não foi possível encontrar o servidor em: ${finalUrl}. Verifique a URL.`);
        }
        throw fetchError;
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ 
          error: "Falha na Integração", 
          details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})