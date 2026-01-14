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

// Função auxiliar para delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

    if (!apiUrl || !apiUrl.includes("api.getcircuit.com/public/v0.2b")) {
        // console.warn(`URL configurada (${apiUrl}) difere da oficial. Usando: ${OFFICIAL_API_URL}`);
        apiUrl = OFFICIAL_API_URL;
    }

    apiUrl = apiUrl.trim().replace(/\/$/, '');
    let finalUrl = `${apiUrl}/${action}`;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      finalUrl += `?${queryString}`;
    }

    console.log(`[spoke-proxy] Requesting: ${method} ${finalUrl}`);

    // Lógica de Retry com Exponential Backoff
    let attempt = 0;
    const maxAttempts = 3;
    let response;
    let data;

    while (attempt < maxAttempts) {
      try {
        response = await fetch(finalUrl, {
            method,
            headers: {
                'Authorization': `Bearer ${apiToken.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        if (response.status === 429) {
            attempt++;
            const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500; // 2s, 4s, 8s + jitter
            console.warn(`[spoke-proxy] Rate limit hit (429). Retrying in ${waitTime}ms (Attempt ${attempt}/${maxAttempts})`);
            await delay(waitTime);
            continue;
        }

        const responseText = await response.text();
        
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { message: responseText || `Status ${response.status}` };
        }

        if (!response.ok) {
            console.error("[spoke-proxy] API Error:", data);
            throw new Error(data.message || data.error || `Erro ${response.status} na API Spoke`);
        }

        // Sucesso
        break;

      } catch (err) {
        // Se for erro de rede ou timeout, também pode tentar retry se quiser, 
        // mas aqui estamos focando no 429 ou erros finais.
        if (attempt === maxAttempts - 1 || (response && response.status !== 429)) {
            throw err;
        }
      }
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