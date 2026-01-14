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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Configurações e Segurança
    const { data: settingsData } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['n8n_integration_token', 'mercadopago_access_token', 'payment_mode']);
    
    const settings = {};
    settingsData?.forEach(s => settings[s.key] = s.value);

    const authHeader = req.headers.get('Authorization');
    const secretToken = authHeader?.replace('Bearer ', '');

    if (!settings.n8n_integration_token || secretToken !== settings.n8n_integration_token) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { customer, items, payment_method } = await req.json();

    if (!customer?.email || !items || !Array.isArray(items)) {
      throw new Error("Formato inválido. Necessário: customer.email e items (array).");
    }

    // 2. Gerenciar Cliente
    let userId;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const user = existingUsers.users.find(u => u.email === customer.email);

    if (user) {
      userId = user.id;
      if (customer.phone) {
        await supabaseAdmin.from('profiles').update({ phone: customer.phone }).eq('id', userId);
      }
    } else {
      const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: customer.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: customer.name?.split(' ')[0] || 'Cliente',
          last_name: customer.name?.split(' ').slice(1).join(' ') || 'Whatsapp'
        }
      });
      if (createError) throw createError;
      userId = newUser.user.id;
      
      await supabaseAdmin.from('profiles').update({ 
        phone: customer.phone,
        first_name: customer.name?.split(' ')[0] || 'Cliente',
        last_name: customer.name?.split(' ').slice(1).join(' ') || 'Whatsapp'
      }).eq('id', userId);
    }

    // 3. Processar Itens
    let totalOrderPrice = 0;
    const orderItemsToInsert = [];

    for (const itemRequest of items) {
      let productData;
      let variantData;

      if (itemRequest.sku) {
        const { data: variant } = await supabaseAdmin
            .from('product_variants')
            .select('id, price, product_id, flavors(name), volume_ml')
            .eq('sku', itemRequest.sku)
            .maybeSingle();
        
        if (variant) {
            variantData = variant;
            const { data: prod } = await supabaseAdmin.from('products').select('name, image_url').eq('id', variant.product_id).single();
            productData = prod;
        } else {
            const { data: prod } = await supabaseAdmin.from('products').select('id, price, name, image_url').eq('sku', itemRequest.sku).maybeSingle();
            productData = prod;
        }
      } 
      
      if (!productData && itemRequest.name) {
         const { data: prod } = await supabaseAdmin.from('products').select('id, price, name, image_url').ilike('name', `%${itemRequest.name}%`).maybeSingle();
         productData = prod;
      }

      if (productData) {
        const price = variantData ? variantData.price : productData.price;
        const quantity = itemRequest.quantity || 1;
        const name = variantData 
            ? `${productData.name} - ${variantData.flavors?.name || ''}` 
            : productData.name;

        totalOrderPrice += (price * quantity);

        orderItemsToInsert.push({
            item_id: variantData ? variantData.product_id : productData.id,
            item_type: 'product',
            quantity: quantity,
            price_at_purchase: price,
            name_at_purchase: name,
            image_url_at_purchase: productData.image_url
        });

        if (variantData) {
            await supabaseAdmin.rpc('decrement_variant_stock', { variant_id: variantData.id, quantity });
        } else {
            await supabaseAdmin.rpc('decrement_stock', { table_name: 'products', row_id: productData.id, quantity });
        }
      }
    }

    if (orderItemsToInsert.length === 0) {
        throw new Error("Nenhum produto encontrado.");
    }

    // 4. Criar Pedido
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        total_price: totalOrderPrice,
        shipping_cost: 0,
        status: 'Pendente',
        payment_method: payment_method || 'Pix',
        delivery_status: 'Pendente',
        shipping_address: { 
            street: "Whatsapp Order", 
            number: "S/N", 
            neighborhood: "Whatsapp", 
            city: "Whatsapp", 
            state: "UF", 
            cep: "00000-000" 
        }
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const itemsWithOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
    await supabaseAdmin.from('order_items').insert(itemsWithOrderId);

    // 5. Gerar Pagamento Pix (Mercado Pago)
    let paymentData = null;
    const mpToken = settings.mercadopago_access_token;
    const isPix = (payment_method || '').toLowerCase().includes('pix');

    if (isPix && mpToken && totalOrderPrice > 0) {
        try {
            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mpToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `order-${order.id}`
                },
                body: JSON.stringify({
                    transaction_amount: totalOrderPrice,
                    description: `Pedido #${order.id}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: customer.email,
                        first_name: customer.name?.split(' ')[0] || 'Cliente',
                    },
                    notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook` // Opcional se tiver webhook configurado
                })
            });

            if (mpResponse.ok) {
                const mpJson = await mpResponse.json();
                paymentData = {
                    qr_code: mpJson.point_of_interaction?.transaction_data?.qr_code,
                    qr_code_base64: mpJson.point_of_interaction?.transaction_data?.qr_code_base64,
                    ticket_url: mpJson.point_of_interaction?.transaction_data?.ticket_url,
                    id: mpJson.id
                };
            } else {
                console.error("Erro MP:", await mpResponse.text());
            }
        } catch (e) {
            console.error("Falha ao gerar Pix:", e);
        }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: order.id, 
        total: totalOrderPrice,
        payment_info: paymentData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})