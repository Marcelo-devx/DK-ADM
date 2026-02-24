// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, event_type, method = 'POST', custom_payload } = await req.json();

    if (!url) throw new Error("URL é obrigatória");

    // 1. Limpeza de URL (Espaços invisíveis quebram o N8N)
    const rawUrl = url.trim();
    
    // Verificação de Localhost (Erro comum)
    if (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: "Erro de Rede: O Supabase (Nuvem) não consegue acessar 'localhost'. Use o Tunnel (ngrok) ou a URL de Produção do N8N." 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const encodedUrl = encodeURI(rawUrl);
    let payload = {};
    const timestamp = new Date().toISOString();

    console.log(`[Diagnostic] Testando ${method} em: ${encodedUrl}`);

    const fetchOptions: any = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
    };

    // Monta payload
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

    // 2. Tentativa Principal
    const response = await fetch(encodedUrl, fetchOptions);

    // 3. Diagnóstico Inteligente em caso de Falha (404/405)
    if (!response.ok && (response.status === 404 || response.status === 405) && method === 'POST') {
        console.log("POST falhou. Tentando GET para diagnóstico...");
        try {
            // Tenta um GET simples para ver se a URL existe mas o método está errado
            const getResponse = await fetch(encodedUrl, { method: 'GET' });
            
            if (getResponse.ok) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    status: response.status,
                    error: `ERRO DE MÉTODO: Seu N8N aceitou uma conexão GET, mas rejeitou o POST. Altere o "HTTP Method" no nó do Webhook para "POST".` 
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }
        } catch (e) { /* Ignora erro no fallback */ }
    }

    const responseText = await response.text();
    let responseData;
    try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

    if (!response.ok) {
        let errorMessage = `O servidor remoto retornou erro ${response.status}`;
        
        // Dicas específicas baseadas na URL
        if (response.status === 404) {
            if (rawUrl.includes('/webhook-test/')) {
                errorMessage += ". DICA: URLs de teste do N8N expiram. Clique em 'Execute Node' no N8N novamente antes de testar aqui.";
            } else if (rawUrl.includes('/webhook/')) {
                errorMessage += ". DICA: Workflow INATIVO. Ative a chave 'Active' no topo direito do N8N para usar URLs de produção.";
            }
        }

        return new Response(
            JSON.stringify({ 
                success: false, 
                status: response.status, 
                error: errorMessage, 
                remote_response: responseData 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
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