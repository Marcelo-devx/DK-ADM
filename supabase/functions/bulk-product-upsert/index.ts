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
    const { products } = await req.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum produto fornecido para upsert.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const allFlavorNames = new Set();
    for (const product of products) {
      if (product.flavor_names) {
        product.flavor_names.split(',').map(name => name.trim()).forEach(name => {
          if (name) allFlavorNames.add(name);
        });
      }
    }
    const flavorNamesArray = Array.from(allFlavorNames);

    let flavorMap = new Map();
    if (flavorNamesArray.length > 0) {
      const { data: existingFlavors, error: flavorError } = await supabaseAdmin
        .from('flavors')
        .select('id, name')
        .in('name', flavorNamesArray);

      if (flavorError) throw flavorError;
      
      flavorMap = new Map(existingFlavors.map(f => [f.name, f.id]));
    }

    const productsToUpsert = products.map(p => {
      const { flavor_names, ...productData } = p;
      // Garante que o SKU seja nulo se estiver vazio, para não violar a restrição UNIQUE
      if (productData.sku === '') {
        productData.sku = null;
      }
      return productData;
    });

    const { data: upsertedProducts, error: upsertError } = await supabaseAdmin
      .from('products')
      .upsert(productsToUpsert, { onConflict: 'sku' }) // Alterado de 'name' para 'sku'
      .select('id, sku, name');

    if (upsertError) throw upsertError;

    const productFlavorInserts = [];
    const productIdsMap = new Map(upsertedProducts.map(p => [p.sku || p.name, p.id]));

    for (const product of products) {
      const identifier = product.sku || product.name;
      const productId = productIdsMap.get(identifier);
      if (!productId) continue;

      const flavorNames = product.flavor_names ? product.flavor_names.split(',').map(name => name.trim()).filter(name => name) : [];
      
      const { error: deleteError } = await supabaseAdmin
        .from('product_flavors')
        .delete()
        .eq('product_id', productId);
      if (deleteError) console.error(`Erro ao limpar product_flavors para produto ${productId}:`, deleteError);

      for (const flavorName of flavorNames) {
        const flavorId = flavorMap.get(flavorName);
        if (flavorId) {
          productFlavorInserts.push({
            product_id: productId,
            flavor_id: flavorId,
            is_visible: true,
          });
        }
      }
    }

    if (productFlavorInserts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('product_flavors')
        .insert(productFlavorInserts);
      if (insertError) console.error('Erro ao inserir product_flavors:', insertError);
    }

    return new Response(
      JSON.stringify({ message: `${upsertedProducts.length} produtos processados com sucesso.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro no bulk-product-upsert:', error);
    return new Response(
      JSON.stringify({ error: 'Falha na operação em massa.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})