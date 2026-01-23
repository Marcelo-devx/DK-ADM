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

    // --- CACHE INICIAL (Para evitar muitas consultas repetidas) ---
    // Busca dados existentes para não criar duplicados
    const { data: allFlavors } = await supabaseAdmin.from('flavors').select('id, name');
    const { data: allCategories } = await supabaseAdmin.from('categories').select('id, name');
    const { data: allBrands } = await supabaseAdmin.from('brands').select('id, name');
    const { data: allSubCategories } = await supabaseAdmin.from('sub_categories').select('id, name, category_id');

    // Mapas para busca rápida (Case Insensitive)
    const flavorMap = new Map(allFlavors?.map(f => [f.name.toLowerCase().trim(), f.id]));
    const categoryMap = new Map(allCategories?.map(c => [c.name.toLowerCase().trim(), c.id]));
    const brandMap = new Map(allBrands?.map(b => [b.name.toLowerCase().trim(), b.id]));
    
    // Mapa de subcategorias é mais complexo pois depende da categoria pai
    // Chave: "catId_subNameLower" -> ID
    const subCategoryMap = new Map(allSubCategories?.map(s => [`${s.category_id}_${s.name.toLowerCase().trim()}`, s.id]));

    for (const p of products) {
      try {
        const { flavor_names, ...productData } = p;
        
        // Validações básicas
        if (!productData.name) throw new Error("Nome do produto é obrigatório");

        // Tratamento de SKU vazio
        if (productData.sku === '' || productData.sku === undefined) {
            productData.sku = null;
        }

        // --- AUTO-CRIAÇÃO DE DEPENDÊNCIAS ---

        // 1. MARCA
        if (productData.brand) {
            const brandName = String(productData.brand).trim();
            const brandKey = brandName.toLowerCase();
            if (brandName && !brandMap.has(brandKey)) {
                const { data: newBrand, error: brandError } = await supabaseAdmin
                    .from('brands')
                    .insert({ name: brandName, is_visible: true })
                    .select('id')
                    .single();
                
                if (!brandError && newBrand) {
                    brandMap.set(brandKey, newBrand.id);
                }
            }
        }

        // 2. CATEGORIA E SUB-CATEGORIA
        if (productData.category) {
            const catName = String(productData.category).trim();
            const catKey = catName.toLowerCase();
            let catId = categoryMap.get(catKey);

            // Cria Categoria se não existir
            if (!catId && catName) {
                const { data: newCat, error: catError } = await supabaseAdmin
                    .from('categories')
                    .insert({ name: catName, is_visible: true })
                    .select('id')
                    .single();
                
                if (!catError && newCat) {
                    catId = newCat.id;
                    categoryMap.set(catKey, catId);
                }
            }

            // Cria Sub-categoria se não existir (e se tivermos o ID da categoria pai)
            if (catId && productData.sub_category) {
                const subName = String(productData.sub_category).trim();
                const subKey = `${catId}_${subName.toLowerCase()}`;
                
                if (subName && !subCategoryMap.has(subKey)) {
                    const { data: newSub, error: subError } = await supabaseAdmin
                        .from('sub_categories')
                        .insert({ name: subName, category_id: catId, is_visible: true })
                        .select('id')
                        .single();
                    
                    if (!subError && newSub) {
                        subCategoryMap.set(subKey, newSub.id);
                    }
                }
            }
        }

        // --- FIM DA AUTO-CRIAÇÃO ---

        // 3. Upsert do Produto
        const options = productData.sku ? { onConflict: 'sku' } : undefined;
        
        const { data: upsertedProduct, error: upsertError } = await supabaseAdmin
          .from('products')
          .upsert(productData, options)
          .select('id')
          .single();

        if (upsertError) {
            if (upsertError.code === '23505') throw new Error("SKU já existe em outro produto.");
            throw upsertError;
        }
        
        const productId = upsertedProduct.id;

        // 4. Processar Sabores
        if (flavor_names) {
           const names = String(flavor_names).split(',').map((n: string) => n.trim());
           
           await supabaseAdmin.from('product_flavors').delete().eq('product_id', productId);
           
           const flavorsToInsert = [];
           for (const name of names) {
             if (!name) continue;
             const normalized = name.toLowerCase();
             let fId = flavorMap.get(normalized);
             
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