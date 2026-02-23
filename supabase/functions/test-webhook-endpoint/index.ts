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
    const { url, event_type, method = 'POST' } = await req.json();

    if (!url) throw new Error("URL é obrigatória");

    // Codifica a URL para lidar com acentos (ex: testar-conexão)
    const encodedUrl = encodeURI(url);

    let payload = {};
    const timestamp = new Date().toISOString();

    console.log(`Disparando teste (${method}) para: ${encodedUrl}`);

    const fetchOptions: any = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
    };

    // Apenas adiciona corpo se for POST
    if (method === 'POST') {
        // Gera dados falsos baseados no tipo de evento
        if (event_type === 'order_created' || event_type === 'payment_confirmed') {
            payload = {
                event: event_type,
                timestamp: timestamp,
                data: {
                    id: 12345,
                    total_price: 150.00,
                    status: "Pendente",
                    payment_method: "pix",
                    created_at: timestamp,
                    customer: {
                        id: "user-uuid-teste",
                        full_name: "Cliente Teste da Silva",
                        phone: "11999999999",
                        email: "teste@exemplo.com",
                        cpf: "000.000.000-00"
                    },
                    items: [
                        { name: "Produto Teste A", quantity: 1, price: 50.00 },
                        { name: "Produto Teste B", quantity: 2, price: 50.00 }
                    ],
                    shipping_address: {
                        street: "Rua Exemplo",
                        number: "100",
                        neighborhood: "Centro",
                        city: "São Paulo",
                        state: "SP",
                        cep: "01000-000"
                    }
                }
            };
        } else if (event_type && event_type.startsWith('product_')) {
            payload = {
                event: event_type,
                timestamp: timestamp,
                data: {
                    id: 999,
                    name: "Produto de Teste N8N",
                    sku: "TEST-SKU-001",
                    price: 99.90,
                    stock_quantity: 50,
                    is_visible: true,
                    category: "Testes"
                }
            };
        } else if (event_type === 'retention_campaign') {
            payload = {
                event: 'retention_campaign',
                campaign_size: 1,
                recipients: [
                    {
                        client_id: "user-uuid-teste",
                        name: "Cliente Teste",
                        phone: "11999999999",
                        email: "teste@exemplo.com",
                        message_content: "Oi Cliente Teste! Esta é uma mensagem de teste enviada pelo painel."
                    }
                ]
            };
        } else {
            // Genérico
            payload = {
                event: event_type || 'ping',
                timestamp: timestamp,
                message: "Este é um evento de teste genérico.",
                test_data: true
            };
        }
        
        fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(encodedUrl, fetchOptions);

    const responseText = await response.text();
    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch {
        responseData = responseText;
    }

    if (!response.ok) {
        let errorMessage = `O servidor remoto retornou erro ${response.status}`;
        
        // Dica específica para usuários de N8N
        if (response.status === 404 && (url.includes('/webhook/') || url.includes('n8n'))) {
            errorMessage += ". DICA N8N: Se seu Workflow estiver 'Inativo', a URL de produção (/webhook/) retorna 404. Ative o Workflow ou use a URL de teste (/webhook-test/).";
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