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

    // Busca produtos E variações
    const { data: allProducts } = await supabaseAdmin
        .from('products')
        .select(`
            id, name, stock_quantity, price, cost_price, brand,
            product_variants (id, stock_quantity, flavors(name), volume_ml, color, cost_price, price)
        `);

    // --- CÁLCULOS ---
    const velocityMap = {};      // Vendas totais 30d (para estoque)
    const profitByBrand = {};    // Lucratividade
    const salesThisWeek = {};    // Vendas 0-7 dias
    const salesLastWeek = {};    // Vendas 7-14 dias
    const hoursMap = new Array(24).fill(0); // Mapa de calor de horas

    salesHistory?.forEach(item => {
        const itemDate = new Date(item.created_at);
        const qty = item.quantity;

        // Velocity 30d (Agrupado por Produto Pai para simplicidade de tendência)
        velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + qty;

        // Horário de Pico
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

    const alertsCandidates = [];
    const trendCandidates = [];

    allProducts?.forEach(p => {
        // Métricas do Produto Pai
        const soldLast30Days = velocityMap[p.id] || 0;
        const dailyRate = soldLast30Days / 30;
        const thisWeek = salesThisWeek[p.id] || 0;
        const lastWeek = salesLastWeek[p.id] || 0;
        
        let growthPercent = 0;
        if (lastWeek > 0) {
            growthPercent = ((thisWeek - lastWeek) / lastWeek) * 100;
        } else if (thisWeek > 0) {
            growthPercent = 100; 
        }

        // 1. PROFITABILITY (Brand) - Usa dados do pai
        const unitMargin = p.price - (p.cost_price || 0);
        const estMonthlyProfit = unitMargin * soldLast30Days;
        if (p.brand) {
            profitByBrand[p.brand] = (profitByBrand[p.brand] || 0) + estMonthlyProfit;
        }

        // 2. TRENDS (Product Level)
        trendCandidates.push({
            id: p.id,
            name: p.name,
            growth: growthPercent,
            sales_this_week: thisWeek
        });

        // 3. INVENTORY ALERTS (Variant Level Granularity)
        const variants = p.product_variants || [];
        
        if (variants.length > 0) {
            // Se tem variações, analisa cada uma individualmente
            variants.forEach(v => {
                // Se o produto pai tem giro (dailyRate > 0), assumimos que as variações precisam de estoque.
                // Estimativa: Dividimos o giro do pai pelo nº de variações para uma média simples de "dias restantes".
                if (dailyRate > 0) {
                    const estimatedVariantRate = dailyRate / variants.length; 
                    let daysRemaining = 999;
                    
                    if (estimatedVariantRate > 0) {
                        daysRemaining = Math.floor(v.stock_quantity / estimatedVariantRate);
                    } else if (v.stock_quantity === 0) {
                        daysRemaining = 0; // Acabou e produto tem giro
                    }

                    // Formata Nome: Produto - Sabor - Cor
                    let vName = p.name;
                    const details = [];
                    if (v.flavors?.name) details.push(v.flavors.name);
                    if (v.color) details.push(v.color);
                    if (v.volume_ml) details.push(v.volume_ml + 'ml');
                    if (details.length > 0) vName += ` (${details.join(' - ')})`;

                    alertsCandidates.push({
                        id: p.id,
                        variant_id: v.id,
                        name: vName,
                        current_stock: v.stock_quantity,
                        days_remaining: daysRemaining,
                        daily_rate: dailyRate.toFixed(2), // Mostra taxa do pai como contexto de demanda
                        status_type: daysRemaining < 45 ? 'active' : 'ok'
                    });
                }
            });
        } else {
            // Produto Simples (Sem variação)
            if (dailyRate > 0) {
                const daysRemaining = Math.floor(p.stock_quantity / dailyRate);
                alertsCandidates.push({
                    id: p.id,
                    name: p.name,
                    current_stock: p.stock_quantity,
                    days_remaining: daysRemaining,
                    daily_rate: dailyRate.toFixed(2),
                    status_type: daysRemaining < 45 ? 'active' : 'ok'
                });
            }
        }
    });

    // --- FILTRAGEM FINAL ---
    
    // Alertas: Ordena por urgência (menos dias restantes)
    const alerts = alertsCandidates
        .filter(a => a.days_remaining < 45)
        .sort((a,b) => a.days_remaining - b.days_remaining)
        .slice(0, 8);

    // Em Alta
    const trendingUp = trendCandidates
        .filter(p => p.growth >= 20 && p.sales_this_week >= 3)
        .sort((a,b) => b.growth - a.growth)
        .slice(0, 5);

    // Esfriando
    const coolingDown = trendCandidates
        .filter(p => p.growth <= -20 && p.sales_this_week < 5)
        .sort((a,b) => a.growth - b.growth)
        .slice(0, 5);

    // Horários de Pico
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