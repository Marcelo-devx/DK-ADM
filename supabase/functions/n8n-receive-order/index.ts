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

    // 1. Buscar token de segurança no banco de dados
    const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'n8n_integration_token')
        .single();
    
    const configuredSecret = setting?.value;

    // 2. Verificação de Segurança
    const authHeader = req.headers.get('Authorization');
    const secretToken = authHeader?.replace('Bearer ', '');

    if (!configuredSecret || secretToken !== configuredSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Token inválido ou não configurado no painel.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { customer, items, payment_method } = await req.json();

    if (!customer?.email || !items || !Array.isArray(items)) {
      throw new Error("Formato inválido. Necessário: customer.email e items (array).");
    }

    // 3. Gerenciar Cliente (Busca ou Cria)
    let userId;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const user = existingUsers.users.find(u => u.email === customer.email);

    if (user) {
      userId = user.id;
      // Atualiza telefone se enviado e não existente
      if (customer.phone) {
        await supabaseAdmin.from('profiles').update({ phone: customer.phone }).eq('id', userId);
      }
    } else {
      // Cria novo usuário com senha aleatória
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
      
      // Atualiza perfil imediatamente
      await supabaseAdmin.from('profiles').update({ 
        phone: customer.phone,
        first_name: customer.name?.split(' ')[0] || 'Cliente',
        last_name: customer.name?.split(' ').slice(1).join(' ') || 'Whatsapp'
      }).eq('id', userId);
    }

    // 4. Processar Itens e Calcular Totais
    let totalOrderPrice = 0;
    const orderItemsToInsert = [];

    for (const itemRequest of items) {
      let productData;
      let variantData;

      // Tenta achar por SKU
      if (itemRequest.sku) {
        // Tenta achar variação primeiro
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
            // Tenta achar produto base
            const { data: prod } = await supabaseAdmin
                .from('products')
                .select('id, price, name, image_url')
                .eq('sku', itemRequest.sku)
                .maybeSingle();
            productData = prod;
        }
      } 
      
      // Se não achou por SKU ou não tem SKU, tenta por Nome
      if (!productData && itemRequest.name) {
         const { data: prod } = await supabaseAdmin
            .from('products')
            .select('id, price, name, image_url')
            .ilike('name', itemRequest.name)
            .maybeSingle();
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
            item_type: 'product', // Assumindo produto por enquanto
            quantity: quantity,
            price_at_purchase: price,
            name_at_purchase: name,
            image_url_at_purchase: productData.image_url
        });

        // Deduz Estoque
        if (variantData) {
            await supabaseAdmin.rpc('decrement_variant_stock', { variant_id: variantData.id, quantity });
        } else {
            await supabaseAdmin.rpc('decrement_stock', { table_name: 'products', row_id: productData.id, quantity });
        }
      }
    }

    if (orderItemsToInsert.length === 0) {
        throw new Error("Nenhum produto encontrado com os SKUs ou Nomes fornecidos.");
    }

    // 5. Criar Pedido
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
            street: "Endereço via WhatsApp", 
            number: "S/N", 
            neighborhood: "A verificar", 
            city: "A verificar", 
            state: "UF", 
            cep: "00000-000" 
        }
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 6. Inserir Itens do Pedido
    const itemsWithOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(itemsWithOrderId);
    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: order.id, 
        message: `Pedido #${order.id} criado com sucesso via n8n!`,
        total: totalOrderPrice
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro no n8n-receive-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})