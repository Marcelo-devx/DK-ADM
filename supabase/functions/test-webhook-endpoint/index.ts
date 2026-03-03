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
    // 1. Auth Check (Security Fix)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Admin Role Check
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Forbidden: Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Process Request
    const { url, event_type, method = 'POST', custom_payload, auth_token } = await req.json();

    if (!url) throw new Error("URL é obrigatória");

    const rawUrl = url.trim();
    
    if (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: "Erro: Supabase na nuvem não acessa 'localhost'. Use a URL pública do N8N." 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const encodedUrl = encodeURI(rawUrl);
    let payload = {};
    const timestamp = new Date().toISOString();

    const fetchOptions: any = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
    };

    // If an auth token was provided (from the dashboard), include it in the request
    if (auth_token) {
        fetchOptions.headers['Authorization'] = `Bearer ${auth_token}`;
    }

    if (method === 'POST') {
        if (custom_payload) {
            payload = custom_payload;
        } else if (event_type === 'order_created') {
            payload = {
                event: event_type,
                timestamp: timestamp,
                data: {
                    id: 12345,
                    total_price: 150.00,
                    status: "Pendente",
                    customer: { name: "Cliente Teste", email: "teste@exemplo.com", phone: "11999999999" }
                }
            };
        } else {
            payload = { event: event_type || 'ping', timestamp: timestamp, message: "Evento de teste" };
        }
        fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(encodedUrl, fetchOptions);

    // DIAGNÓSTICO INTELIGENTE
    if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        let hint = "";

        if (response.status === 404) {
            if (rawUrl.includes('/webhook/')) {
                // Tenta GET para ver se o endpoint existe mas rejeitou POST
                try {
                    const check = await fetch(encodedUrl, { method: 'GET' });
                    if (check.ok) {
                        hint = "O N8N rejeitou o POST. Mude o 'HTTP Method' no nó do N8N para 'POST'.";
                    } else {
                        hint = "WORKFLOW INATIVO. Ative a chave 'Active' (verde) no topo direito do N8N.";
                    }
                } catch (e) {
                    hint = "Verifique se a URL está correta e se o Workflow está ATIVO (Active: Verde).";
                }
            } else if (rawUrl.includes('/webhook-test/')) {
                hint = "URL de teste expirada. Clique em 'Execute Node' no N8N novamente.";
            }
        }

        const fullError = hint ? `${errorMessage}: ${hint}` : errorMessage;

        let remoteText = null;
        try {
            const txt = await response.text();
            remoteText = txt ? txt : null;
        } catch (e) {
            remoteText = null;
        }

        let n8nHint = null;
        try {
            if (remoteText && remoteText.includes('No Respond to Webhook node found')) {
                n8nHint = "O N8N respondeu que não há um nó que responde ao webhook no workflow. Verifique se o Workflow está ativo e se o nó Webhook/Respond to Webhook está presente e configurado corretamente (copie a URL direto do nó Webhook).";
            }
        } catch (e) {
            // ignore
        }

        return new Response(
            JSON.stringify({ 
                success: false, 
                status: response.status, 
                error: n8nHint ? `${fullError}: ${n8nHint}` : fullError,
                remote_response_text: remoteText
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    // Sucesso
    let responseData;
    try { 
        const text = await response.text();
        responseData = text ? JSON.parse(text) : { message: "Sem corpo de resposta" }; 
    } catch { 
        responseData = { message: "Resposta recebida (não JSON)" }; 
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          status: response.status, 
          message: "Conexão estabelecida com sucesso!",
          remote_response: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})