// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Busca paginada segura
async function fetchPaginated(supabase, table, selectQuery, filters = [], pageSize = 1000, maxRows = 10000) {
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(selectQuery);
    for (const f of filters) {
      query = query[f.method](...f.args);
    }
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error(`[actionable-insights] Erro paginando ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < pageSize || allData.length >= maxRows) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
  }
  return allData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  console.log("[actionable-insights] Iniciando execução");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // ── 1. ASSOCIAÇÕES DE PRODUTOS (Cross-sell) ──────────────────────────────
    let associations = [];
    try {
      const { data, error } = await supabaseAdmin.rpc('get_product_pair_frequency');
      if (error) console.log("[actionable-insights] rpc get_product_pair_frequency error:", error.message);
      else associations = (data || []).slice(0, 10);
      console.log("[actionable-insights] associations:", associations.length);
    } catch (e) {
      console.log("[actionable-insights] associations exception:", e.message);
    }

    // ── 2. CLIENTES EM RISCO (Churn) ─────────────────────────────────────────
    let churnRisk = [];
    try {
      const { data, error } = await supabaseAdmin.rpc('get_customers_at_risk');
      if (error) console.log("[actionable-insights] rpc get_customers_at_risk error:", error.message);
      else churnRisk = (data || []).slice(0, 10);
      console.log("[actionable-insights] churn:", churnRisk.length);
    } catch (e) {
      console.log("[actionable-insights] churn exception:", e.message);
    }

    // ── 3. RANKING VIP ────────────────────────────────────────────────────────
    let vips = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, points')
        .order('points', { ascending: false })
        .limit(5);
      if (error) console.log("[actionable-insights] vips error:", error.message);
      else vips = data || [];
      console.log("[actionable-insights] vips:", vips.length);
    } catch (e) {
      console.log("[actionable-insights] vips exception:", e.message);
    }

    // ── 4. HISTÓRICO DE VENDAS (30 dias) com paginação ───────────────────────
    const today = new Date();
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);

    let salesHistory = [];
    try {
      salesHistory = await fetchPaginated(
        supabaseAdmin,
        'order_items',
        'item_id, quantity, created_at',
        [{ method: 'gte', args: ['created_at', thirtyDaysAgo.toISOString()] }],
        2000,
        10000  // máximo 10k itens
      );
      console.log("[actionable-insights] salesHistory rows:", salesHistory.length);
    } catch (e) {
      console.log("[actionable-insights] salesHistory exception:", e.message);
    }

    // ── 5. PRODUTOS + VARIAÇÕES ───────────────────────────────────────────────
    let allProducts = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, name, stock_quantity, price, cost_price, brand, is_visible, product_variants(id, stock_quantity, color, cost_price, price, flavor_id, flavors(name))')
        .eq('is_visible', true)
        .limit(500);
      if (error) console.log("[actionable-insights] allProducts error:", error.message);
      else allProducts = data || [];
      console.log("[actionable-insights] allProducts:", allProducts.length);
    } catch (e) {
      console.log("[actionable-insights] allProducts exception:", e.message);
    }

    // ── 6. CÁLCULOS ───────────────────────────────────────────────────────────
    const velocityMap = {};
    const profitByBrand = {};
    const salesThisWeek = {};
    const salesLastWeek = {};
    const hoursMap = new Array(24).fill(0);

    for (const item of salesHistory) {
      const itemDate = new Date(item.created_at);
      const qty = item.quantity || 0;

      velocityMap[item.item_id] = (velocityMap[item.item_id] || 0) + qty;

      // Horário de Pico (ajuste BRT -3h)
      const hour = ((itemDate.getUTCHours() - 3) + 24) % 24;
      hoursMap[hour] += qty;

      if (itemDate >= sevenDaysAgo) {
        salesThisWeek[item.item_id] = (salesThisWeek[item.item_id] || 0) + qty;
      } else if (itemDate >= fourteenDaysAgo) {
        salesLastWeek[item.item_id] = (salesLastWeek[item.item_id] || 0) + qty;
      }
    }

    const alertsCandidates = [];
    const trendCandidates = [];

    for (const p of allProducts) {
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

      // Lucratividade por marca
      const unitMargin = (p.price || 0) - (p.cost_price || 0);
      const estMonthlyProfit = unitMargin * soldLast30Days;
      if (p.brand && estMonthlyProfit > 0) {
        profitByBrand[p.brand] = (profitByBrand[p.brand] || 0) + estMonthlyProfit;
      }

      // Tendências
      trendCandidates.push({ id: p.id, name: p.name, growth: growthPercent, sales_this_week: thisWeek });

      // Alertas de estoque
      const variants = p.product_variants || [];
      if (variants.length > 0) {
        if (dailyRate > 0) {
          const estimatedVariantRate = dailyRate / variants.length;
          for (const v of variants) {
            let daysRemaining = 999;
            if (estimatedVariantRate > 0) {
              daysRemaining = Math.floor((v.stock_quantity || 0) / estimatedVariantRate);
            } else if ((v.stock_quantity || 0) === 0) {
              daysRemaining = 0;
            }

            let vName = p.name;
            const details = [];
            if (v.flavors?.name) details.push(v.flavors.name);
            if (v.color) details.push(v.color);
            if (details.length > 0) vName += ` (${details.join(' - ')})`;

            if (daysRemaining < 45) {
              alertsCandidates.push({
                id: p.id,
                variant_id: v.id,
                name: vName,
                current_stock: v.stock_quantity || 0,
                days_remaining: daysRemaining,
                daily_rate: dailyRate.toFixed(2),
                status_type: 'active'
              });
            }
          }
        } else {
          // Produto sem vendas mas com variantes — verificar estoque zerado
          for (const v of variants) {
            if ((v.stock_quantity || 0) === 0) {
              let vName = p.name;
              const details = [];
              if (v.flavors?.name) details.push(v.flavors.name);
              if (v.color) details.push(v.color);
              if (details.length > 0) vName += ` (${details.join(' - ')})`;
              alertsCandidates.push({
                id: p.id,
                variant_id: v.id,
                name: vName,
                current_stock: 0,
                days_remaining: 0,
                daily_rate: '0.00',
                status_type: 'stagnant_low'
              });
            }
          }
        }
      } else {
        if (dailyRate > 0) {
          const daysRemaining = Math.floor((p.stock_quantity || 0) / dailyRate);
          if (daysRemaining < 45) {
            alertsCandidates.push({
              id: p.id,
              name: p.name,
              current_stock: p.stock_quantity || 0,
              days_remaining: daysRemaining,
              daily_rate: dailyRate.toFixed(2),
              status_type: 'active'
            });
          }
        } else if ((p.stock_quantity || 0) === 0) {
          alertsCandidates.push({
            id: p.id,
            name: p.name,
            current_stock: 0,
            days_remaining: 0,
            daily_rate: '0.00',
            status_type: 'stagnant_low'
          });
        }
      }
    }

    // ── 7. FILTRAGEM FINAL ────────────────────────────────────────────────────
    const alerts = alertsCandidates
      .sort((a, b) => a.days_remaining - b.days_remaining)
      .slice(0, 15);

    const trendingUp = trendCandidates
      .filter(p => p.growth >= 20 && p.sales_this_week >= 2)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 5);

    const coolingDown = trendCandidates
      .filter(p => p.growth <= -20 && p.sales_this_week < 5)
      .sort((a, b) => a.growth - b.growth)
      .slice(0, 5);

    const peakHours = hoursMap.map((count, hour) => ({ hour: `${hour}h`, orders: count }));

    const profitability = Object.entries(profitByBrand)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const result = {
      associations,
      churn: churnRisk,
      inventory: alerts,
      vips,
      profitability,
      trends: { up: trendingUp, down: coolingDown },
      peak_hours: peakHours,
    };

    console.log("[actionable-insights] Concluído com sucesso. Retornando dados.");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.log("[actionable-insights] ERRO GERAL:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
