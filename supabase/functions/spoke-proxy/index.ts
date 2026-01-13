// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// URL Oficial da Documentação (v0.2b)
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

    // Se a URL não estiver configurada ou parecer errada, usa a oficial da documentação
    if (!apiUrl || !apiUrl.includes("api.getcircuit.com/public/v0.2b")) {
        console.warn(`URL configurada (${apiUrl}) difere da oficial. Usando: ${OFFICIAL_API_URL}`);
        apiUrl = OFFICIAL_API_URL;
    }

    // Limpeza da URL
    apiUrl = apiUrl.trim().replace(/\/$/, '');
    
    // A API retorna IDs como "plans/abc". Se a action já vier assim, concatenamos direto.
    // Se a action for só "plans", também funciona.
    let finalUrl = `${apiUrl}/${action}`;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      finalUrl += `?${queryString}`;
    }

    console.log(`[spoke-proxy] Requesting: ${method} ${finalUrl}`);

    const response = await fetch(finalUrl, {
        method,
        headers: {
            'Authorization': `Bearer ${apiToken.trim()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const responseText = await response.text();
    let data;
    
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = { message: responseText || `Status ${response.status}` };
    }

    if (!response.ok) {
        console.error("[spoke-proxy] Error:", data);
        // Tratamento específico para Rate Limiting (429) mencionado na doc
        if (response.status === 429) {
            throw new Error("Limite de requisições excedido (Rate Limit). Tente novamente em alguns instantes.");
        }
        throw new Error(data.message || data.error || `Erro ${response.status} na API Spoke`);
    }

    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

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