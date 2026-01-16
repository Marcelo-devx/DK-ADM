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

    // 4. DADOS PARA ANÁLISE DE ESTOQUE E TENDÊNCIA
    const today = new Date();
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);

    // Busca itens vendidos nos últimos 30 dias
    const { data: salesHistory } = await supabaseAdmin
        .from('order_items')
        .select('item_id, quantity, price_at_purchase, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: allProducts } = await supabaseAdmin
        .from('products')
        .select('id, name, stock_quantity, price, cost_price, brand');

    // --- CÁLCULOS ---
    const velocityMap = {};      // Vendas totais 30d (para estoque)
    const profitByBrand = {};    // Lucratividade
    const salesThisWeek = {};    // Vendas 0-7 dias
    const salesLastWeek = {};    // Vendas 7-14 dias
    const hoursMap = new Array(24).fill(0); // Mapa de calor de horas

    salesHistory?.forEach(item => {
        const itemDate = new Date(item.created_at);
        const qty = item.quantity;

        // Velocity 30d
        velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + qty;

        // Horário de Pico (acumulado dos últimos 30 dias)
        // Ajuste fuso horário (simplificado -3h Brasil)
        let hour = itemDate.getHours() - 3;
        if (hour < 0) hour += 24;
        hoursMap[hour] += qty;

        // Trending (Semanal)
        if (itemDate >= sevenDaysAgo) {
            salesThisWeek[item.item_id] = (salesThisWeek[item.item_id] || 0) + qty;
        } else if (itemDate >= fourteenDaysAgo) {
            salesLastWeek[item.item_id] = (salesLastWeek[item.item_id] || 0) + qty;
        }
    });

    // Processamento de Produtos
    const inventoryAnalysis = allProducts?.map(p => {
        // --- Análise de Estoque ---
        const soldLast30Days = velocityMap[p.id] || 0;
        const dailyRate = soldLast30Days / 30;
        
        let daysRemaining = 999;
        let status = 'ok';

        if (dailyRate > 0) {
            daysRemaining = Math.floor(p.stock_quantity / dailyRate);
            status = 'active';
        }
        
        // --- Análise de Lucro ---
        const unitMargin = p.price - (p.cost_price || 0);
        const estMonthlyProfit = unitMargin * soldLast30Days;

        if (p.brand) {
            profitByBrand[p.brand] = (profitByBrand[p.brand] || 0) + estMonthlyProfit;
        }

        // --- Análise de Tendência (Growth) ---
        const thisWeek = salesThisWeek[p.id] || 0;
        const lastWeek = salesLastWeek[p.id] || 0;
        let growthPercent = 0;

        if (lastWeek > 0) {
            growthPercent = ((thisWeek - lastWeek) / lastWeek) * 100;
        } else if (thisWeek > 0) {
            growthPercent = 100; // Novo ou explodiu do zero
        }

        return {
            id: p.id,
            name: p.name,
            current_stock: p.stock_quantity,
            days_remaining: daysRemaining,
            daily_rate: dailyRate.toFixed(2),
            profit_contribution: estMonthlyProfit,
            status_type: status,
            growth: growthPercent,
            sales_this_week: thisWeek
        };
    });

    // Filtros Finais
    
    // 1. Alertas de Estoque (Acaba em < 45 dias)
    const alerts = inventoryAnalysis
        ?.filter(p => p.days_remaining < 45 && p.daily_rate > 0)
        .sort((a,b) => a.days_remaining - b.days_remaining)
        .slice(0, 8) || [];

    // 2. Em Alta (Trending Up) - Crescimento > 20% e venda relevante
    const trendingUp = inventoryAnalysis
        ?.filter(p => p.growth >= 20 && p.sales_this_week >= 3)
        .sort((a,b) => b.growth - a.growth)
        .slice(0, 5) || [];

    // 3. Esfriando (Trending Down) - Queda > 20% e tinha venda antes
    const coolingDown = inventoryAnalysis
        ?.filter(p => p.growth <= -20 && p.sales_this_week < 5) // Caindo e vendendo pouco agora
        .sort((a,b) => a.growth - b.growth) // Menores crescimentos (mais negativos) primeiro
        .slice(0, 5) || [];

    // 4. Horários de Pico Formatados
    const peakHours = hoursMap.map((count, hour) => ({
        hour: `${hour}h`,
        orders: count
    }));

    return new Response(JSON.stringify({
        associations: associations || [],
        churn: churnRisk || [],
        inventory: alerts,
        vips: vips || [],
        profitability: Object.entries(profitByBrand)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 5),
        trends: {
            up: trendingUp,
            down: coolingDown
        },
        peak_hours: peakHours
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})