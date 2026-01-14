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

    // 1. Segurança
    const authHeader = req.headers.get('Authorization');
    const secretToken = authHeader?.replace('Bearer ', '');
    
    const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'n8n_integration_token')
        .single();
    
    const configuredSecret = setting?.value;

    if (!configuredSecret || secretToken !== configuredSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Buscar Produtos e Variações
    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select(`
            id, 
            name, 
            sku, 
            price, 
            stock_quantity,
            image_url,
            product_variants (
                id,
                sku,
                price,
                stock_quantity,
                flavors(name),
                volume_ml,
                color
            )
        `)
        .eq('is_visible', true)
        .gt('stock_quantity', 0); // Opcional: trazer apenas com estoque > 0

    if (error) throw error;

    // 3. Formatar para o Bot (Simplificado)
    const formatted = products.map(p => {
        const variants = p.product_variants || [];
        
        // Se tiver variações, retorna elas como itens individuais ou agrupados
        if (variants.length > 0) {
            return {
                type: 'variations',
                base_product: p.name,
                options: variants.filter(v => v.stock_quantity > 0).map(v => ({
                    sku: v.sku,
                    name: `${p.name} - ${v.flavors?.name || ''} ${v.volume_ml ? v.volume_ml + 'ml' : ''}`.trim(),
                    price: v.price,
                    stock: v.stock_quantity
                }))
            };
        }

        // Produto Simples
        return {
            type: 'simple',
            sku: p.sku,
            name: p.name,
            price: p.price,
            stock: p.stock_quantity,
            image: p.image_url
        };
    });

    return new Response(JSON.stringify(formatted), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})