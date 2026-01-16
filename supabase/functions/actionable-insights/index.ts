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

    // 2. Ranking VIP (Clientes que mais gastaram na história - LTV)
    const { data: vips } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, points')
        .order('points', { ascending: false })
        .limit(5);

    // 3. DADOS PARA ANÁLISE DE ESTOQUE E TENDÊNCIA
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

    // 4. DADOS PARA RFM (Todos os pedidos finalizados)
    const { data: allOrders } = await supabaseAdmin
        .from('orders')
        .select('user_id, total_price, created_at')
        .in('status', ['Finalizada', 'Pago'])
        .order('created_at', { ascending: false }); // Do mais recente para o mais antigo

    // --- CÁLCULOS RFM ---
    const rfmMap = new Map();
    
    allOrders?.forEach(order => {
        if (!rfmMap.has(order.user_id)) {
            rfmMap.set(order.user_id, {
                lastOrderDate: new Date(order.created_at),
                frequency: 0,
                monetary: 0
            });
        }
        const entry = rfmMap.get(order.user_id);
        entry.frequency += 1;
        entry.monetary += Number(order.total_price);
    });

    const segments = {
        champions: { count: 0, revenue: 0 }, // R < 30, F > 4
        loyal: { count: 0, revenue: 0 },     // F > 2
        potential: { count: 0, revenue: 0 }, // R < 30, F <= 2
        at_risk: { count: 0, revenue: 0 },   // R 30-90, F > 2
        hibernating: { count: 0, revenue: 0 } // R > 90
    };

    const churnList = [];

    rfmMap.forEach((metrics, userId) => {
        const daysSinceLast = Math.floor((today.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 3600 * 24));
        
        let segmentKey = 'hibernating';

        if (daysSinceLast <= 30) {
            if (metrics.frequency >= 4) segmentKey = 'champions';
            else segmentKey = 'potential';
        } else if (daysSinceLast <= 90) {
            if (metrics.frequency >= 3) segmentKey = 'at_risk';
            else segmentKey = 'loyal'; // Compra esporádica mas fiel
        } else {
            segmentKey = 'hibernating';
        }

        segments[segmentKey].count += 1;
        segments[segmentKey].revenue += metrics.monetary;

        // Monta lista de Churn (Em Risco ou Hibernando com alto valor)
        if (segmentKey === 'at_risk' || (segmentKey === 'hibernating' && metrics.monetary > 500)) {
            // Precisamos buscar o nome depois, mas para performance vamos retornar só stats
            // ou usar a lista antiga se preferir. Vamos manter a estrutura de Churn antiga mas alimentada por essa lógica
            // Para não quebrar o front existente, manteremos a lista simplificada de Churn Risk no response
        }
    });

    // --- CÁLCULOS ESTOQUE & TENDÊNCIA ---
    const velocityMap = {};      
    const profitByBrand = {};    
    const salesThisWeek = {};    
    const salesLastWeek = {};    
    const hoursMap = new Array(24).fill(0); 

    salesHistory?.forEach(item => {
        const itemDate = new Date(item.created_at);
        const qty = item.quantity;

        velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + qty;

        let hour = itemDate.getHours() - 3;
        if (hour < 0) hour += 24;
        hoursMap[hour] += qty;

        if (itemDate >= sevenDaysAgo) {
            salesThisWeek[item.item_id] = (salesThisWeek[item.item_id] || 0) + qty;
        } else if (itemDate >= fourteenDaysAgo) {
            salesLastWeek[item.item_id] = (salesLastWeek[item.item_id] || 0) + qty;
        }
    });

    const inventoryAnalysis = allProducts?.map(p => {
        const soldLast30Days = velocityMap[p.id] || 0;
        const dailyRate = soldLast30Days / 30;
        let daysRemaining = 999;
        let status = 'ok';

        if (dailyRate > 0) {
            daysRemaining = Math.floor(p.stock_quantity / dailyRate);
            status = 'active';
        }
        
        const unitMargin = p.price - (p.cost_price || 0);
        const estMonthlyProfit = unitMargin * soldLast30Days;

        if (p.brand) {
            profitByBrand[p.brand] = (profitByBrand[p.brand] || 0) + estMonthlyProfit;
        }

        const thisWeek = salesThisWeek[p.id] || 0;
        const lastWeek = salesLastWeek[p.id] || 0;
        let growthPercent = 0;

        if (lastWeek > 0) {
            growthPercent = ((thisWeek - lastWeek) / lastWeek) * 100;
        } else if (thisWeek > 0) {
            growthPercent = 100; 
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

    const alerts = inventoryAnalysis
        ?.filter(p => p.days_remaining < 45 && p.daily_rate > 0)
        .sort((a,b) => a.days_remaining - b.days_remaining)
        .slice(0, 8) || [];

    const trendingUp = inventoryAnalysis
        ?.filter(p => p.growth >= 20 && p.sales_this_week >= 3)
        .sort((a,b) => b.growth - a.growth)
        .slice(0, 5) || [];

    const coolingDown = inventoryAnalysis
        ?.filter(p => p.growth <= -20 && p.sales_this_week < 5) 
        .sort((a,b) => a.growth - b.growth) 
        .slice(0, 5) || [];

    const peakHours = hoursMap.map((count, hour) => ({
        hour: `${hour}h`,
        orders: count
    }));

    // Mantemos a chamada RPC original para Churn para garantir dados completos de nome/email
    // Mas agora temos os dados ricos de RFM também
    const { data: churnRisk } = await supabaseAdmin.rpc('get_customers_at_risk');

    return new Response(JSON.stringify({
        associations: associations || [],
        churn: churnRisk || [], // Mantém compatibilidade
        rfm: segments, // Novo payload
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