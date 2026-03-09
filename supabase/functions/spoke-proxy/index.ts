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
    // 1. Check for Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Validate User
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Initialize Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 4. Check Admin Role
    const { data: profile, error: profileErr } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profileErr) {
      console.error("[spoke-proxy] error fetching profile:", profileErr);
      return new Response(JSON.stringify({ error: 'Failed to validate profile' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (profile?.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Forbidden: Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Parse Body (only after auth check)
    const { action, method = 'GET', body, params } = await req.json();

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
        // Use the official API URL if the configured value is missing/incorrect
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
    let responseText;
    let parsedData;

    while (attempt < maxAttempts) {
      try {
        const fetchOptions: any = {
          method,
          headers: {
            'Authorization': `Bearer ${apiToken.trim()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
        };

        // Do not attach a body for GET/HEAD requests (some servers reject a body on GET)
        if (body && !['GET', 'HEAD'].includes(String(method).toUpperCase())) {
          fetchOptions.body = JSON.stringify(body);
        }

        response = await fetch(finalUrl, fetchOptions);

        responseText = await response.text();

        try {
          parsedData = responseText ? JSON.parse(responseText) : null;
        } catch (e) {
          parsedData = { message: responseText };
        }

        if (response.status === 429) {
          attempt++;
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500; // 2s, 4s, 8s + jitter
          console.warn(`[spoke-proxy] Rate limit hit (429). Retrying in ${waitTime}ms (Attempt ${attempt}/${maxAttempts})`);
          await delay(waitTime);
          continue;
        }

        // If external API returned non-2xx, forward the exact status & body to the client
        if (!response.ok) {
          console.error("[spoke-proxy] External API returned non-OK status", { status: response.status, url: finalUrl, body: parsedData });
          // Return the external API body and status so frontend can inspect the real error
          const forwarded = typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData || { message: `Status ${response.status}` });
          return new Response(forwarded, {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Sucesso: parsedData contém o body parseado (ou mensagem textual)
        break;

      } catch (err) {
        console.error("[spoke-proxy] fetch attempt error:", { attempt, err: err?.message || err });
        attempt++;
        if (attempt >= maxAttempts) {
          throw err;
        }
        const waitTime = Math.pow(2, attempt) * 500 + Math.random() * 300;
        await delay(waitTime);
      }
    }

    // Se chegamos aqui, response foi ok e parsedData preenchido
    return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error("[spoke-proxy] handler error:", error);
    return new Response(
      JSON.stringify({
          error: "Falha na Integração",
          details: error?.message || String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})