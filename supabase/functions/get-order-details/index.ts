// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Validação de Segurança
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let isAuthorized = false;

    // Aceita Service Key ou Token N8N
    if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        isAuthorized = true;
    } else {
        const { data: setting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'n8n_integration_token')
            .single();
        
        if (setting?.value && token === setting.value) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Obter ID do Pedido (Query Param)
    const url = new URL(req.url);
    const orderId = url.searchParams.get('id');

    if (!orderId) {
        throw new Error("O parâmetro 'id' é obrigatório na URL (ex: ?id=123).");
    }

    // 3. Buscar Dados do Pedido e Perfil (Sem email aqui)
    const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select(`
            *,
            order_items (
                id,
                item_id,
                name_at_purchase,
                quantity,
                price_at_purchase,
                item_type
            ),
            profiles (
                first_name,
                last_name,
                phone,
                cpf_cnpj
            )
        `)
        .eq('id', orderId)
        .single();

    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");

    // 4. Buscar E-mail do Usuário no Auth (separado por segurança)
    let userEmail = null;
    if (order.user_id) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
        userEmail = userData?.user?.email;
    }

    // Montar resposta final
    const responseData = {
        ...order,
        customer_email: userEmail, // Adiciona o e-mail no nível superior para facilitar
        profiles: {
            ...order.profiles,
            email: userEmail // Adiciona também dentro do perfil para compatibilidade
        }
    };

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})