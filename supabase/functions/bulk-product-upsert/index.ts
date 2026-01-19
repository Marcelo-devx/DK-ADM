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
      return new Response(JSON.stringify({ error: 'Nenhum produto fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Cache de sabores para evitar muitas queries
    const { data: allFlavors } = await supabaseAdmin.from('flavors').select('id, name');
    const flavorMap = new Map(allFlavors?.map(f => [f.name.toLowerCase().trim(), f.id]));

    for (const p of products) {
      try {
        const { flavor_names, ...productData } = p;
        
        // Validações básicas
        if (!productData.name) throw new Error("Nome do produto é obrigatório");

        // Tratamento de SKU vazio
        if (productData.sku === '' || productData.sku === undefined) {
            productData.sku = null;
        }

        // 1. Upsert do Produto
        // Se tiver SKU, usa como chave de conflito. Se não, é um INSERT novo.
        const options = productData.sku ? { onConflict: 'sku' } : undefined;
        
        const { data: upsertedProduct, error: upsertError } = await supabaseAdmin
          .from('products')
          .upsert(productData, options)
          .select('id')
          .single();

        if (upsertError) {
            // Tratamento específico para erro de SKU duplicado se não capturado pelo upsert
            if (upsertError.code === '23505') throw new Error("SKU já existe em outro produto.");
            throw upsertError;
        }
        
        const productId = upsertedProduct.id;

        // 2. Processar Sabores (Se houver coluna flavor_names na planilha)
        if (flavor_names) {
           const names = String(flavor_names).split(',').map((n: string) => n.trim());
           
           // Remove associações antigas para recriar (estratégia simples de sync)
           await supabaseAdmin.from('product_flavors').delete().eq('product_id', productId);
           
           const flavorsToInsert = [];
           for (const name of names) {
             if (!name) continue;
             const normalized = name.toLowerCase();
             let fId = flavorMap.get(normalized);
             
             // Cria sabor se não existir (Opcional, mas útil na importação)
             if (!fId) {
                const { data: newFlavor, error: newFlavorError } = await supabaseAdmin
                    .from('flavors')
                    .insert({ name: name, is_visible: true })
                    .select('id')
                    .single();
                
                if (!newFlavorError && newFlavor) {
                    fId = newFlavor.id;
                    flavorMap.set(normalized, fId);
                }
             }

             if (fId) {
                flavorsToInsert.push({ product_id: productId, flavor_id: fId, is_visible: true });
             }
           }

           if (flavorsToInsert.length > 0) {
             await supabaseAdmin.from('product_flavors').insert(flavorsToInsert);
           }
        }

        results.success++;

      } catch (err: any) {
        results.failed++;
        const iden = p.sku || p.name || 'Produto desconhecido';
        results.errors.push(`${iden}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processamento concluído.`,
        details: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Falha interna na função.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})