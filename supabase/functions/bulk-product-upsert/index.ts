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

    // 1. CARREGAR DADOS AUXILIARES EM MEMÓRIA PARA EVITAR MUITAS QUERIES
    // Buscamos tudo para criar mapas de verificação (Nome -> ID)
    
    // Sabores
    const { data: allFlavors } = await supabaseAdmin.from('flavors').select('id, name');
    const flavorMap = new Map(allFlavors?.map(f => [f.name.toLowerCase().trim(), f.id]));

    // Marcas
    const { data: allBrands } = await supabaseAdmin.from('brands').select('id, name');
    const brandMap = new Map(allBrands?.map(b => [b.name.toLowerCase().trim(), b.id]));

    // Categorias
    const { data: allCategories } = await supabaseAdmin.from('categories').select('id, name');
    const categoryMap = new Map(allCategories?.map(c => [c.name.toLowerCase().trim(), c]));

    // Sub-Categorias (Map complexo: "nome_sub|id_cat" -> id_sub)
    const { data: allSubCategories } = await supabaseAdmin.from('sub_categories').select('id, name, category_id');
    const subCategoryMap = new Map(allSubCategories?.map(s => [`${s.name.toLowerCase().trim()}|${s.category_id}`, s.id]));

    // Função auxiliar para criar Marca se não existir
    const ensureBrand = async (name: string) => {
        if (!name) return;
        const normalized = name.toLowerCase().trim();
        if (!brandMap.has(normalized)) {
            const { data, error } = await supabaseAdmin.from('brands').insert({ name: name.trim(), is_visible: true }).select('id').single();
            if (!error && data) {
                brandMap.set(normalized, data.id);
            }
        }
    };

    // Função auxiliar para criar Categoria se não existir
    const ensureCategory = async (name: string) => {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();
        if (categoryMap.has(normalized)) return categoryMap.get(normalized);

        const { data, error } = await supabaseAdmin.from('categories').insert({ name: name.trim(), is_visible: true }).select('id, name').single();
        if (!error && data) {
            categoryMap.set(normalized, data);
            return data;
        }
        return null;
    };

    // Função auxiliar para criar Sub-Categoria se não existir (vinculada à categoria)
    const ensureSubCategory = async (subName: string, categoryId: number) => {
        if (!subName || !categoryId) return;
        const normalized = subName.toLowerCase().trim();
        const key = `${normalized}|${categoryId}`;
        
        if (!subCategoryMap.has(key)) {
            const { data, error } = await supabaseAdmin.from('sub_categories').insert({ 
                name: subName.trim(), 
                category_id: categoryId, 
                is_visible: true 
            }).select('id').single();
            
            if (!error && data) {
                subCategoryMap.set(key, data.id);
            }
        }
    };

    // 2. PROCESSAMENTO DOS PRODUTOS
    for (const p of products) {
      try {
        const { flavor_names, ...productData } = p;
        
        if (!productData.name) throw new Error("Nome do produto é obrigatório");

        // Tratamento de SKU vazio
        if (productData.sku === '' || productData.sku === undefined) {
            productData.sku = null;
        }

        // --- LÓGICA DE AUTO-CRIAÇÃO DE CATEGORIAS/MARCAS ---
        
        // A. Marca
        if (productData.brand) {
            await ensureBrand(productData.brand);
        }

        // B. Categoria e Sub-Categoria
        if (productData.category) {
            const categoryObj = await ensureCategory(productData.category);
            
            if (categoryObj && productData.sub_category) {
                await ensureSubCategory(productData.sub_category, categoryObj.id);
            }
        }
        // ---------------------------------------------------

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

        // 4. Processar Sabores (Variações Simplificadas)
        if (flavor_names) {
           const names = String(flavor_names).split(',').map((n: string) => n.trim());
           
           // Remove associações antigas
           await supabaseAdmin.from('product_flavors').delete().eq('product_id', productId);
           
           const flavorsToInsert = [];
           for (const name of names) {
             if (!name) continue;
             const normalized = name.toLowerCase();
             let fId = flavorMap.get(normalized);
             
             // Cria sabor se não existir
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
    console.error("Erro geral na importação:", error);
    return new Response(
      JSON.stringify({ error: 'Falha interna na função.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})