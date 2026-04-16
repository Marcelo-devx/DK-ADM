// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Busca paginada para evitar timeout com grandes volumes
async function fetchAllPaginated(supabase, table, selectQuery, filters = [], pageSize = 1000) {
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
      console.error(`[analytics-bi] Erro paginando ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
    // Limite de segurança: máximo 20k registros por tabela
    if (allData.length >= 20000) {
      console.log(`[analytics-bi] Limite de segurança atingido para ${table}: ${allData.length} registros`);
      hasMore = false;
    }
  }
  return allData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    let period = "12m";
    try {
      const body = await req.json();
      period = body.period || "12m";
    } catch (_) {}

    console.log("[analytics-bi] Processando período:", period);

    const now = new Date();
    const startDate = new Date();
    switch (period) {
      case "7d":   startDate.setDate(now.getDate() - 7); break;
      case "30d":  startDate.setDate(now.getDate() - 30); break;
      case "90d":  startDate.setDate(now.getDate() - 90); break;
      case "6m":   startDate.setMonth(now.getMonth() - 6); break;
      case "12m":  startDate.setFullYear(now.getFullYear() - 1); break;
      case "24m":  startDate.setFullYear(now.getFullYear() - 2); break;
      default:     startDate.setFullYear(now.getFullYear() - 1);
    }

    const startIso = startDate.toISOString();

    // ── Buscar dados com paginação segura ─────────────────────────────────────
    console.log("[analytics-bi] Buscando orders...");
    const allOrders = await fetchAllPaginated(
      supabaseAdmin,
      'orders',
      'id, total_price, shipping_cost, coupon_discount, created_at, status, payment_method, user_id, shipping_address',
      [{ method: 'gte', args: ['created_at', startIso] }],
      1000
    );

    console.log("[analytics-bi] Buscando order_items...");
    const allItems = await fetchAllPaginated(
      supabaseAdmin,
      'order_items',
      'order_id, item_id, name_at_purchase, quantity, price_at_purchase, item_type',
      [{ method: 'gte', args: ['created_at', startIso] }],
      2000
    );

    console.log("[analytics-bi] Buscando profiles...");
    // Profiles não precisam de filtro de data, mas limitamos a 5000
    const profilesRes = await supabaseAdmin
      .from('profiles')
      .select('id, gender, state, city, created_at, tier_id, current_tier_name')
      .limit(5000);
    const profiles = profilesRes.data || [];

    // Pedidos sem cancelados para métricas de receita
    const orders = allOrders.filter(o => o.status !== 'Cancelado');

    console.log("[analytics-bi] Dados brutos:", {
      allOrders: allOrders.length,
      items: allItems.length,
      profiles: profiles.length
    });

    // ── Agrupamento temporal ──────────────────────────────────────────────────
    let groupBy = 'month';
    if (period === "7d" || period === "30d") groupBy = 'day';
    else if (period === "90d" || period === "6m") groupBy = 'week';

    const generatePeriodArray = () => {
      const periods = [];
      const current = new Date(startDate);
      while (current <= now) {
        let key, label;
        if (groupBy === 'day') {
          key   = current.toISOString().substring(0, 10);
          label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(current);
        } else if (groupBy === 'week') {
          const ws = new Date(current);
          key   = ws.toISOString().substring(0, 10);
          label = `${ws.getDate()}/${ws.getMonth() + 1}`;
        } else {
          key   = current.toISOString().substring(0, 7);
          label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(current);
        }
        if (!periods.find(p => p.key === key)) periods.push({ key, label });
        if (groupBy === 'day')        current.setDate(current.getDate() + 1);
        else if (groupBy === 'week')  current.setDate(current.getDate() + 7);
        else                          current.setMonth(current.getMonth() + 1);
      }
      return periods;
    };

    const periodArray = generatePeriodArray();

    const getOrderKey = (o) => {
      if (groupBy === 'day')  return o.created_at?.substring(0, 10);
      if (groupBy === 'week') {
        const d = o.created_at?.substring(0, 10);
        const found = periodArray.find(p => {
          const end = new Date(p.key);
          end.setDate(end.getDate() + 6);
          return d >= p.key && d <= end.toISOString().substring(0, 10);
        });
        return found?.key;
      }
      return o.created_at?.substring(0, 7);
    };

    // ── Série temporal ────────────────────────────────────────────────────────
    // Pré-agrupar por chave para performance
    const ordersByKey = {};
    for (const o of orders) {
      const key = getOrderKey(o);
      if (!key) continue;
      if (!ordersByKey[key]) ordersByKey[key] = [];
      ordersByKey[key].push(o);
    }

    const monthly = periodArray.map(p => {
      const filtered = ordersByKey[p.key] || [];
      const revenue  = filtered.reduce((s, o) => s + Number(o.total_price || 0), 0);
      const shipping = filtered.reduce((s, o) => s + Number(o.shipping_cost || 0), 0);
      const discounts= filtered.reduce((s, o) => s + Number(o.coupon_discount || 0), 0);
      const approved = filtered.filter(o => ['Finalizada','Pago','Entregue'].includes(o.status)).length;
      return {
        key: p.key,
        label: p.label,
        revenue:       Math.round(revenue * 100) / 100,
        orders:        filtered.length,
        shipping:      Math.round(shipping * 100) / 100,
        discounts:     Math.round(discounts * 100) / 100,
        approved_rate: filtered.length > 0 ? Math.round((approved / filtered.length) * 1000) / 10 : 0,
      };
    });

    // ── Status dos pedidos ────────────────────────────────────────────────────
    const statusCount = {};
    for (const o of allOrders) {
      statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    }
    const ordersByStatus = Object.entries(statusCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ── Métodos de pagamento ──────────────────────────────────────────────────
    const paymentCount = {};
    for (const o of orders) {
      const m = o.payment_method || 'Outros';
      paymentCount[m] = (paymentCount[m] || 0) + 1;
    }
    const paymentMethods = Object.entries(paymentCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ── Top produtos ──────────────────────────────────────────────────────────
    const validOrderIds = new Set(orders.map(o => o.id));
    const productMap = {};
    for (const item of allItems) {
      if (!validOrderIds.has(item.order_id)) continue;
      const key = item.name_at_purchase || 'Desconhecido';
      if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0 };
      productMap[key].qty     += Number(item.quantity || 0);
      productMap[key].revenue += Number(item.price_at_purchase || 0) * Number(item.quantity || 0);
    }

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }));

    const topProductsByQty = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // ── Regiões ───────────────────────────────────────────────────────────────
    const regionMap = {};
    for (const o of orders) {
      let state = null;
      if (o.shipping_address) {
        try {
          const addr = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : o.shipping_address;
          state = addr.state || addr.uf || null;
        } catch (_) {}
      }
      if (!state) continue;
      if (!regionMap[state]) regionMap[state] = { name: state, orders: 0, revenue: 0 };
      regionMap[state].orders  += 1;
      regionMap[state].revenue += Number(o.total_price || 0);
    }

    const regions = Object.values(regionMap)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 12)
      .map(r => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }));

    // ── Gênero ────────────────────────────────────────────────────────────────
    const genderMap = {};
    for (const p of profiles) {
      const g = p.gender || 'Não Informado';
      genderMap[g] = (genderMap[g] || 0) + 1;
    }
    const gender = Object.entries(genderMap).map(([name, value]) => ({ name, value }));

    // ── Tiers de fidelidade ───────────────────────────────────────────────────
    const tierMap = {};
    for (const p of profiles) {
      const t = p.current_tier_name || 'Bronze';
      tierMap[t] = (tierMap[t] || 0) + 1;
    }
    const tiers = Object.entries(tierMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ── Novos vs Recorrentes ──────────────────────────────────────────────────
    const userOrderCounts = {};
    for (const o of orders) {
      if (!o.user_id) continue;
      userOrderCounts[o.user_id] = (userOrderCounts[o.user_id] || 0) + 1;
    }
    const recurringUsers = Object.values(userOrderCounts).filter(c => c > 1).length;
    const newUsers       = Object.values(userOrderCounts).filter(c => c === 1).length;

    // ── Heatmap por hora do dia ───────────────────────────────────────────────
    const hourMap = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
    for (const o of orders) {
      // Ajuste para BRT (UTC-3)
      const h = ((new Date(o.created_at).getUTCHours() - 3) + 24) % 24;
      hourMap[h].orders  += 1;
      hourMap[h].revenue += Number(o.total_price || 0);
    }
    const hourlyHeatmap = hourMap.map(h => ({
      ...h,
      label: `${String(h.hour).padStart(2, '0')}h`,
      revenue: Math.round(h.revenue * 100) / 100,
    }));

    // ── Heatmap por dia da semana ─────────────────────────────────────────────
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayMap = Array.from({ length: 7 }, (_, d) => ({ day: d, name: dayNames[d], orders: 0, revenue: 0 }));
    for (const o of orders) {
      const d = new Date(o.created_at).getDay();
      dayMap[d].orders  += 1;
      dayMap[d].revenue += Number(o.total_price || 0);
    }
    const weekdayHeatmap = dayMap.map(d => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 }));

    // ── Uso de cupons ─────────────────────────────────────────────────────────
    const withCoupon    = orders.filter(o => Number(o.coupon_discount || 0) > 0).length;
    const withoutCoupon = orders.length - withCoupon;
    const totalDiscount = orders.reduce((s, o) => s + Number(o.coupon_discount || 0), 0);

    // ── Sumário geral ─────────────────────────────────────────────────────────
    const totalRevenue   = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const totalShipping  = orders.reduce((s, o) => s + Number(o.shipping_cost || 0), 0);
    const totalOrders    = orders.length;
    const approvedOrders = orders.filter(o => ['Finalizada','Pago','Entregue'].includes(o.status)).length;

    const summary = {
      totalRevenue:    Math.round(totalRevenue * 100) / 100,
      totalOrders,
      approvedOrders,
      approvalRate:    totalOrders > 0 ? Math.round((approvedOrders / totalOrders) * 1000) / 10 : 0,
      avgTicket:       totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
      totalShipping:   Math.round(totalShipping * 100) / 100,
      avgShipping:     totalOrders > 0 ? Math.round((totalShipping / totalOrders) * 100) / 100 : 0,
      totalDiscount:   Math.round(totalDiscount * 100) / 100,
      newUsers,
      recurringUsers,
      couponUsageRate: totalOrders > 0 ? Math.round((withCoupon / totalOrders) * 1000) / 10 : 0,
      withCoupon,
      withoutCoupon,
    };

    console.log("[analytics-bi] Sumário:", summary);

    return new Response(JSON.stringify({
      monthly,
      summary,
      topProducts,
      topProductsByQty,
      ordersByStatus,
      paymentMethods,
      hourlyHeatmap,
      weekdayHeatmap,
      demographics: {
        gender,
        regions,
        tiers,
        retention: [
          { name: 'Novos', value: newUsers },
          { name: 'Recorrentes', value: recurringUsers },
        ],
        couponUsage: [
          { name: 'Com Cupom', value: withCoupon },
          { name: 'Sem Cupom', value: withoutCoupon },
        ],
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[analytics-bi] Erro:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
