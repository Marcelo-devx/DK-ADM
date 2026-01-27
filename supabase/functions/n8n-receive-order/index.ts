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

    // --- 1. SEGURANÇA E CONFIG ---
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

    const { customer, items, payment_method, shipping_address } = await req.json();

    if (!items || !Array.isArray(items)) {
      throw new Error("Formato inválido. Necessário enviar 'items' (array).");
    }

    // --- 2. IDENTIFICAÇÃO DO CLIENTE (PRIORIDADE: ZAP) ---
    let userId = null;
    
    // Limpa o telefone para garantir busca correta
    const phoneRaw = customer.phone ? String(customer.phone) : "";
    const phoneClean = phoneRaw.replace(/\D/g, ""); 

    // A. Tenta achar pelo Telefone na tabela de perfis
    if (phoneClean.length >= 8) {
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, phone')
            .or(`phone.eq.${phoneClean},phone.eq.${phoneRaw},phone.ilike.%${phoneClean}%`)
            .limit(1);
        
        if (profiles && profiles.length > 0) {
            userId = profiles[0].id;
        }
    }

    // B. Se não achou pelo telefone, tenta pelo E-mail
    if (!userId && customer.email) {
        const { data: uid } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: customer.email });
        if (uid) {
            userId = uid;
            if (phoneClean) {
                await supabaseAdmin.from('profiles').update({ phone: phoneClean }).eq('id', userId);
            }
        }
    }

    // C. Se não achou de jeito nenhum, CRIA UM NOVO
    if (!userId) {
        const emailToUse = customer.email || `${phoneClean || Math.floor(Math.random()*1000000)}@whatsapp.loja`;
        const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: emailToUse,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                first_name: customer.name?.split(' ')[0] || 'Cliente',
                last_name: customer.name?.split(' ').slice(1).join(' ') || 'Whatsapp'
            }
        });

        if (createError) {
            if (createError.message.includes("registered")) {
                 const { data: retryUid } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: emailToUse });
                 userId = retryUid;
            } else {
                throw createError;
            }
        } else {
            userId = newUser.user.id;
        }

        if (userId) {
            await supabaseAdmin.from('profiles').upsert({ 
                id: userId,
                phone: phoneClean || phoneRaw,
                first_name: customer.name?.split(' ')[0] || 'Cliente',
                last_name: customer.name?.split(' ').slice(1).join(' ') || 'Whatsapp'
            });
        }
    }

    if (!userId) throw new Error("Falha crítica ao identificar ou criar usuário.");

    // --- 3. PROCESSAR ITENS E ESTOQUE ---
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
         const { data: prod } = await supabaseAdmin.from('products').select('id, price, name, image_url').ilike('name', `%${itemRequest.name}%`).limit(1).maybeSingle();
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
        throw new Error("Nenhum produto encontrado. Verifique SKUs ou Nomes.");
    }

    // --- 4. CALCULAR FRETE (ATUALIZADO) ---
    let shippingCost = 0;
    const addr = shipping_address || {};
    
    // Busca dados de endereço enviados
    const customerNeighborhood = (addr.neighborhood || "").toLowerCase().trim();
    const customerCity = (addr.city || "Curitiba").toLowerCase().trim();

    if (customerNeighborhood) {
        // Busca na tabela de taxas por cidade e bairro
        const { data: rates } = await supabaseAdmin
            .from('shipping_rates')
            .select('price, neighborhood, city')
            .eq('is_active', true);
        
        if (rates && rates.length > 0) {
            // Tenta encontrar match exato de Bairro E Cidade
            let match = rates.find(r => 
                r.neighborhood.toLowerCase().trim() === customerNeighborhood && 
                r.city.toLowerCase().trim() === customerCity
            );

            // Se não achar exato, tenta match parcial no Bairro (dentro da mesma cidade)
            if (!match) {
                match = rates.find(r => 
                    r.city.toLowerCase().trim() === customerCity &&
                    (r.neighborhood.toLowerCase().includes(customerNeighborhood) || customerNeighborhood.includes(r.neighborhood.toLowerCase()))
                );
            }

            if (match) {
                shippingCost = Number(match.price);
                console.log(`[Frete] Taxa encontrada: ${match.neighborhood} (${match.city}) - R$ ${shippingCost}`);
            }
        }
    }

    // --- 5. CRIAR PEDIDO ---
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        total_price: totalOrderPrice, 
        shipping_cost: shippingCost,
        status: 'Pendente',
        payment_method: payment_method || 'Pix',
        delivery_status: 'Pendente',
        shipping_address: shipping_address || { 
            street: "Whatsapp Order", 
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

    const itemsWithOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
    await supabaseAdmin.from('order_items').insert(itemsWithOrderId);

    // --- 6. GERAR PIX (MERCADO PAGO) ---
    const totalToCharge = totalOrderPrice + shippingCost;
    
    let paymentData = null;
    const mpToken = settings.mercadopago_access_token;
    const isPix = (payment_method || '').toLowerCase().includes('pix');

    if (isPix && mpToken && totalToCharge > 0) {
        try {
            const payerEmail = customer.email || `${phoneClean}@whatsapp.loja`;
            
            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mpToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `order-${order.id}-${Date.now()}`
                },
                body: JSON.stringify({
                    transaction_amount: totalToCharge,
                    description: `Pedido #${order.id} - ${customer.name || 'Cliente'}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: payerEmail,
                        first_name: customer.name?.split(' ')[0] || 'Cliente',
                    },
                    notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`
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
            }
        } catch (e) {
            console.error("Falha ao gerar Pix:", e);
        }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: order.id, 
        products_total: totalOrderPrice,
        shipping_cost: shippingCost,
        final_total: totalToCharge,
        payment_info: paymentData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})