// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '') || '';
    
    let isAuthorized = false;

    if (token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        isAuthorized = true;
    } else {
        const { data: setting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'n8n_integration_token')
            .single();
        
        if (setting?.value && token && token === setting.value) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Obter ID do Pedido
    const url = new URL(req.url);
    const orderId = url.searchParams.get('id');

    if (!orderId) {
        throw new Error("O parâmetro 'id' é obrigatório na URL (ex: ?id=123).");
    }

    // 3. Buscar Dados do Pedido + Itens (Sem JOIN com profiles para evitar erro de schema)
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
            )
        `)
        .eq('id', orderId)
        .single();

    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");

    // 4. Buscar Perfil Manualmente (Resolve o erro de relacionamento)
    let profileData = null;
    if (order.user_id) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj')
            .eq('id', order.user_id)
            .maybeSingle();
        
        profileData = profile;
    }

    // 5. Buscar E-mail do Usuário no Auth
    let userEmail = null;
    if (order.user_id) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
        userEmail = userData?.user?.email;
    }

    // 6. PREPARAR RESPOSTA DE TOTAL
    // Calculamos o subtotal para breakdown, mas usamos o valor salvo no banco como oficial
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const subtotal = items.reduce((acc, it) => {
        const price = Number(it?.price_at_purchase ?? 0);
        const qty = Number(it?.quantity ?? 0);
        return acc + (price * qty);
    }, 0);

    const shippingCost = Number(order.shipping_cost ?? 0);
    const donationAmount = Number(order.donation_amount ?? 0);
    const couponDiscount = Number(order.coupon_discount ?? 0);

    const calculatedTotal = Number((subtotal + shippingCost + donationAmount - couponDiscount).toFixed(2));
    const storedTotal = Number(order.total_price ?? 0);

    // Montar resposta final
    const responseData = {
        ...order,
        // Retorna o valor salvo no banco (o que o site mostra)
        total_price: storedTotal,
        // Breakdown explícito para auditoria (N8N, Financeiro, etc)
        price_breakdown: {
            products_total: Number(subtotal.toFixed(2)),
            shipping_cost: shippingCost,
            donation_amount: donationAmount,
            coupon_discount: couponDiscount,
            formula: `Produtos (${Number(subtotal.toFixed(2))}) + Frete (${shippingCost}) + Doação (${donationAmount}) - Desconto (${couponDiscount}) = ${storedTotal}`,
            matches_stored_total: storedTotal === calculatedTotal
        },
        // Guarda o valor recalculado apenas no breakdown para comparação
        totals_breakdown: {
          stored_total: storedTotal,
          calculated_total: calculatedTotal,
          subtotal: Number(subtotal.toFixed(2)),
          shipping_cost: shippingCost,
          donation_amount: donationAmount,
          coupon_discount: couponDiscount,
          note: storedTotal === calculatedTotal ? "Valores conferem" : "Divergência detectada: valor salvo difere do calculado pelos itens"
        },
        customer_email: userEmail,
        profiles: {
            ...(profileData || {}),
            email: userEmail
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