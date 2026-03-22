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

// Timeout helper for fetch
const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

const mask = (value?: string | null) => {
  if (!value) return value;
  if (value.length <= 6) return '*****';
  return value.slice(0, 3) + '...' + value.slice(-3);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[spoke-proxy] Iniciando requisição da edge function');

    // 1. Check for Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('[spoke-proxy] Falta Authorization header no request');
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
      console.warn('[spoke-proxy] Token inválido ou usuário não encontrado', userError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Initialize Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 4. Check Admin Role
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'adm') {
        console.warn('[spoke-proxy] Acesso negado - usuário não é admin', user.id);
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
      console.error('[spoke-proxy] Token da API não configurado');
      return new Response(JSON.stringify({ error: 'Token da API não configurado. Vá em Configurações > Integração Spoke.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!apiUrl || !apiUrl.includes("api.getcircuit.com/public/v0.2b")) {
        apiUrl = OFFICIAL_API_URL;
    }

    apiUrl = apiUrl.trim().replace(/\/$/, '');
    let finalUrl = `${apiUrl}/${action}`;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      finalUrl += `?${queryString}`;
    }

    console.log(`[spoke-proxy] Preparando chamada para API externa: ${method} ${finalUrl} (token=${mask(apiToken)})`);

    // Lógica de Retry com Exponential Backoff e timeout por tentativa
    let attempt = 0;
    const maxAttempts = 3;
    let response;
    let data;
    let lastError = null;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[spoke-proxy] Tentativa ${attempt}/${maxAttempts} -> ${method} ${finalUrl}`);

        response = await fetchWithTimeout(finalUrl, {
            method,
            headers: {
                'Authorization': `Bearer ${apiToken.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        }, 8000);

        console.log(`[spoke-proxy] Resposta recebida (status=${response.status}) na tentativa ${attempt}`);

        if (response.status === 429) {
            const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500; // 2s, 4s, 8s + jitter
            console.warn(`[spoke-proxy] Rate limit (429). Aguardando ${waitTime}ms antes de tentar novamente`);
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
            console.error("[spoke-proxy] Erro retornado pela API externa:", { status: response.status, data });
            // Para erros 5xx podemos tentar novamente (já feito pelo loop), mas se for final, lançar
            if (response.status >= 500 && attempt < maxAttempts) {
              const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
              await delay(waitTime);
              continue;
            }
            // Não é retriable / ou última tentativa
            throw new Error(data.message || data.error || `Erro ${response.status} na API Spoke`);
        }

        // Sucesso
        console.log('[spoke-proxy] Sucesso na chamada externa');
        break;

      } catch (err) {
        lastError = err;
        console.warn(`[spoke-proxy] Erro na tentativa ${attempt}:`, err?.message || err);
        if (attempt < maxAttempts) {
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[spoke-proxy] Aguardando ${waitTime}ms antes da próxima tentativa`);
          await delay(waitTime);
          continue;
        }
        // última tentativa falhou
        console.error('[spoke-proxy] Todas as tentativas falharam. Último erro:', lastError);
        throw lastError;
      }
    }

    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('[spoke-proxy] Erro geral na função:', error);
    // Retornar 502 para indicar falha na integração externa
    return new Response(
      JSON.stringify({ 
          error: "Falha na Integração",
          details: error.message || String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
    )
  }
})