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

    // 1. Limpeza rigorosa
    apiUrl = apiUrl.trim().replace(/\s/g, '');
    
    // 2. Garante o protocolo https://
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        apiUrl = 'https://' + apiUrl;
    }

    let cleanUrl = apiUrl.replace(/\/$/, '');
    
    // 3. Garante o /v1
    if (!cleanUrl.toLowerCase().includes('/v1')) {
        cleanUrl += '/v1';
    }
    
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

        const data = await response.json();

        if (!response.ok) {
            // Se a Spoke respondeu com erro, repassamos o erro dela
            throw new Error(data.message || data.error || `Erro ${response.status}`);
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (fetchError) {
        // Erro de rede (DNS, URL inválida, etc)
        throw new Error(`Falha de Rede: ${fetchError.message} (URL: ${finalUrl})`);
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