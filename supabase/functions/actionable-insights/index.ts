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

    // 1. Cruzamento de Dados (Venda Casada)
    const { data: associations } = await supabaseAdmin.rpc('get_product_pair_frequency');

    // 2. Churn (Retenção)
    const { data: churnRisk } = await supabaseAdmin.rpc('get_customers_at_risk');

    // 3. Clientes VIP
    const { data: vips } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, points')
        .order('points', { ascending: false })
        .limit(5);

    // 4. Análise de Vendas e Giro de Estoque
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString();
    
    const { data: salesHistory } = await supabaseAdmin
        .from('order_items')
        .select('item_id, quantity, price_at_purchase, created_at')
        .gte('created_at', thirtyDaysAgo);

    const { data: allProducts } = await supabaseAdmin
        .from('products')
        .select('id, name, stock_quantity, price, cost_price, brand, created_at');

    // 5. Receita Perdida (Pedidos 'Pendente' com mais de 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: lostRevenueOrders } = await supabaseAdmin
        .from('orders')
        .select('total_price')
        .eq('status', 'Pendente')
        .lt('created_at', yesterday);
    
    const totalLostRevenue = lostRevenueOrders?.reduce((acc, o) => acc + Number(o.total_price), 0) || 0;

    const velocityMap = {};
    salesHistory?.forEach(item => {
        velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + item.quantity;
    });

    const profitByBrand = {};
    const deadStock = [];
    const stockOutSoon = [];

    allProducts?.forEach(p => {
        const soldLast30Days = velocityMap[p.id] || 0;
        const unitMargin = p.price - (p.cost_price || 0);
        const profit = unitMargin * soldLast30Days;

        if (p.brand) profitByBrand[p.brand] = (profitByBrand[p.brand] || 0) + profit;

        // Se não vendeu nada em 30 dias e tem estoque > 5
        if (soldLast30Days === 0 && p.stock_quantity > 5) {
            deadStock.push({ name: p.name, value: p.stock_quantity * (p.cost_price || 0), quantity: p.stock_quantity });
        }

        // Previsão de esgotamento
        const dailyRate = soldLast30Days / 30;
        const daysRemaining = dailyRate > 0 ? Math.floor(p.stock_quantity / dailyRate) : 999;
        
        if (daysRemaining < 45) {
            stockOutSoon.push({ name: p.name, days_remaining: daysRemaining, profit_impact: profit });
        }
    });

    return new Response(JSON.stringify({
        associations: associations || [],
        churn: churnRisk || [],
        inventory: stockOutSoon.sort((a,b) => a.days_remaining - b.days_remaining).slice(0, 8),
        vips: vips || [],
        profitability: Object.entries(profitByBrand).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5),
        risks: {
            lost_revenue: totalLostRevenue,
            dead_stock_value: deadStock.reduce((acc, i) => acc + i.value, 0),
            top_dead_items: deadStock.sort((a,b) => b.value - a.value).slice(0, 3)
        }
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})