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

    // 1. Associações de produtos (Venda Casada)
    const { data: associations } = await supabaseAdmin.rpc('get_product_pair_frequency');

    // 2. Clientes em risco (Churn)
    const { data: churnRisk } = await supabaseAdmin.rpc('get_customers_at_risk');

    // 3. Ranking VIP (Clientes que mais gastaram na história - LTV)
    const { data: vips } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, points')
        .order('points', { ascending: false })
        .limit(5);

    // 4. Previsão de Estoque e Lucratividade
    const { data: salesHistory } = await supabaseAdmin
        .from('order_items')
        .select('item_id, quantity, price_at_purchase')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: allProducts } = await supabaseAdmin
        .from('products')
        .select('id, name, stock_quantity, price, cost_price, brand');

    const velocityMap = {};
    const profitByBrand = {};
    
    salesHistory?.forEach(item => {
        velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + item.quantity;
    });

    const inventoryAnalysis = allProducts?.map(p => {
        const soldLast30Days = velocityMap[p.id] || 0;
        const dailyRate = soldLast30Days / 30;
        
        let daysRemaining = 999; // Valor alto padrão (seguro)
        let status = 'ok';

        // SÓ calcula previsão se tiver giro (vendas nos últimos 30 dias)
        if (dailyRate > 0) {
            daysRemaining = Math.floor(p.stock_quantity / dailyRate);
            status = 'active';
        }
        
        // Lucro estimado (Preço Atual - Custo Atual) * Vendas
        const unitMargin = p.price - (p.cost_price || 0);
        const estMonthlyProfit = unitMargin * soldLast30Days;

        if (p.brand) {
            profitByBrand[p.brand] = (profitByBrand[p.brand] || 0) + estMonthlyProfit;
        }
        
        return {
            name: p.name,
            current_stock: p.stock_quantity,
            days_remaining: daysRemaining,
            daily_rate: dailyRate.toFixed(2),
            profit_contribution: estMonthlyProfit,
            status_type: status
        };
    });

    // Filtra APENAS itens com giro ativo E que vão acabar em menos de 45 dias
    const alerts = inventoryAnalysis
        ?.filter(p => p.days_remaining < 45 && p.daily_rate > 0)
        .sort((a,b) => a.days_remaining - b.days_remaining)
        .slice(0, 8) || [];

    return new Response(JSON.stringify({
        associations: associations || [],
        churn: churnRisk || [],
        inventory: alerts,
        vips: vips || [],
        profitability: Object.entries(profitByBrand)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 5)
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})