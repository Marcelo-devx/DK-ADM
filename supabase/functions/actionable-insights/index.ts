// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Pegar associações de produtos (Venda Casada Real)
    const { data: associations } = await supabaseAdmin.rpc('get_product_pair_frequency');

    // 2. Pegar clientes em risco (Recuperação Real)
    const { data: churnRisk } = await supabaseAdmin.rpc('get_customers_at_risk');

    // 3. Cálculo de Previsão de Estoque (Velocidade de Venda)
    // Buscamos o que vendeu nos últimos 15 dias para projetar o futuro
    const { data: salesHistory } = await supabaseAdmin
        .from('order_items')
        .select('item_id, quantity, name_at_purchase')
        .gte('created_at', new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString());

    const { data: currentStock } = await supabaseAdmin
        .from('products')
        .select('id, name, stock_quantity')
        .gt('stock_quantity', 0);

    const velocityMap = {};
    salesHistory?.forEach(item => {
        velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + item.quantity;
    });

    const stockPredictions = currentStock?.map(p => {
        const soldLast15Days = velocityMap[p.id] || 0;
        const dailyRate = soldLast15Days / 15;
        const daysRemaining = dailyRate > 0 ? Math.floor(p.stock_quantity / dailyRate) : 999;
        
        return {
            name: p.name,
            current_stock: p.stock_quantity,
            days_remaining: daysRemaining,
            daily_rate: dailyRate.toFixed(2)
        };
    }).filter(p => p.days_remaining < 60) // Só mostrar o que acaba em breve
      .sort((a, b) => a.days_remaining - b.days_remaining)
      .slice(0, 10);

    return new Response(JSON.stringify({
        associations: associations || [],
        churn: churnRisk || [],
        inventory: stockPredictions || []
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})