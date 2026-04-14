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

    // Obter período do corpo da requisição
    let period = "12m";
    try {
      const body = await req.json();
      period = body.period || "12m";
    } catch (_) {
      // usa default
    }
    
    console.log("[analytics-bi] Processando período:", period);

    // Calcular data inicial baseada no período
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "6m":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "12m":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case "24m":
        startDate.setFullYear(now.getFullYear() - 2);
        break;
      default:
        startDate.setFullYear(now.getFullYear() - 1);
    }

    // Buscar pedidos filtrados por período
    const { data: ordersRaw, error: ordersError } = await supabaseAdmin
        .from('orders')
        .select('total_price, created_at, status, payment_method, shipping_cost, coupon_discount, user_id, shipping_address')
        .neq('status', 'Cancelado')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

    if (ordersError) {
      console.error("[analytics-bi] Erro ao buscar pedidos:", ordersError);
    }

    const orders = ordersRaw || [];

    // Buscar perfis (dados demográficos)
    const { data: profilesRaw, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, gender, date_of_birth, state, city');

    if (profilesError) {
      console.error("[analytics-bi] Erro ao buscar perfis:", profilesError);
    }

    const profiles = profilesRaw || [];

    // --- PROCESSAMENTO DE BI ---
    
    // Determinar agrupamento baseado no período
    let groupBy = 'month';
    if (period === "7d" || period === "30d") {
      groupBy = 'day';
    } else if (period === "90d" || period === "6m") {
      groupBy = 'week';
    }

    // Gerar array de períodos para o gráfico
    const generatePeriodArray = () => {
      const periods = [];
      const current = new Date(startDate);
      
      while (current <= now) {
        let periodKey;
        let periodLabel;
        
        if (groupBy === 'day') {
          periodKey = current.toISOString().substring(0, 10);
          periodLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(current);
        } else if (groupBy === 'week') {
          const weekStart = new Date(current);
          const weekEnd = new Date(current);
          weekEnd.setDate(weekEnd.getDate() + 6);
          periodKey = `${weekStart.toISOString().substring(0, 10)}_to_${weekEnd.toISOString().substring(0, 10)}`;
          periodLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
        } else {
          periodKey = current.toISOString().substring(0, 7);
          periodLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(current);
        }
        
        // Evitar duplicatas
        if (!periods.find(p => p.key === periodKey)) {
          periods.push({ key: periodKey, label: periodLabel });
        }
        
        if (groupBy === 'day') {
          current.setDate(current.getDate() + 1);
        } else if (groupBy === 'week') {
          current.setDate(current.getDate() + 7);
        } else {
          current.setMonth(current.getMonth() + 1);
        }
      }
      
      return periods;
    };

    const periodArray = generatePeriodArray();

    // Agrupar dados por período
    const statsByPeriod = periodArray.map(p => {
      let filtered;
      
      if (groupBy === 'day') {
        filtered = orders.filter(o => o.created_at && o.created_at.startsWith(p.key));
      } else if (groupBy === 'week') {
        const [start, end] = p.key.split('_to_');
        filtered = orders.filter(o => o.created_at && o.created_at >= start && o.created_at <= end + 'T23:59:59');
      } else {
        filtered = orders.filter(o => o.created_at && o.created_at.startsWith(p.key));
      }
      
      const revenue = filtered.reduce((acc, o) => acc + Number(o.total_price || 0), 0);
      const approved = filtered.filter(o => o.status === 'Finalizada' || o.status === 'Pago' || o.status === 'Entregue').length;
      
      return {
        month: p.key,
        label: p.label,
        revenue: Math.round(revenue * 100) / 100,
        orders: filtered.length,
        approved_rate: filtered.length > 0 ? Math.round((approved / filtered.length) * 1000) / 10 : 0
      };
    });

    // 2. DEMOGRAFIA - Gênero
    const genderStats = profiles.reduce((acc, p) => {
        const g = p.gender || 'Não Informado';
        acc[g] = (acc[g] || 0) + 1;
        return acc;
    }, {});

    // 3. REGIÕES - extrair do shipping_address dos pedidos (mais preciso)
    const regionFromOrders = orders.reduce((acc, o) => {
      let state = null;
      if (o.shipping_address) {
        try {
          const addr = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : o.shipping_address;
          state = addr.state || addr.uf || null;
        } catch (_) {}
      }
      if (!state) return acc;
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    // Fallback para perfis se não houver dados nos pedidos
    const regionStats = Object.keys(regionFromOrders).length > 0 
      ? regionFromOrders 
      : profiles.reduce((acc, p) => {
          const s = p.state || 'Outros';
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});

    // 4. NOVOS VS RECORRENTES
    const userOrderCounts = orders.reduce((acc, o) => {
        if (!o.user_id) return acc;
        acc[o.user_id] = (acc[o.user_id] || 0) + 1;
        return acc;
    }, {});
    
    const recurring = Object.values(userOrderCounts).filter(count => count > 1).length;
    const newUsers = Object.values(userOrderCounts).filter(count => count === 1).length;

    // 5. MÉTODOS DE PAGAMENTO
    const paymentStats = orders.reduce((acc, o) => {
      const method = o.payment_method || 'Outros';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    // 6. TOTAIS GERAIS
    const totalRevenue = orders.reduce((acc, o) => acc + Number(o.total_price || 0), 0);
    const totalOrders = orders.length;
    const approvedOrders = orders.filter(o => o.status === 'Finalizada' || o.status === 'Pago' || o.status === 'Entregue').length;

    console.log("[analytics-bi] Dados processados:", { 
      periods: periodArray.length, 
      orders: orders.length, 
      profiles: profiles.length,
      totalRevenue: Math.round(totalRevenue)
    });

    // Ordenar regiões por valor
    const sortedRegions = Object.entries(regionStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return new Response(JSON.stringify({
        monthly: statsByPeriod,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          approvedOrders,
          approvalRate: totalOrders > 0 ? Math.round((approvedOrders / totalOrders) * 1000) / 10 : 0,
          avgTicket: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
          newUsers,
          recurringUsers: recurring,
        },
        demographics: {
            gender: Object.entries(genderStats).map(([name, value]) => ({ name, value })),
            regions: sortedRegions,
            retention: [
                { name: 'Novos', value: newUsers },
                { name: 'Recorrentes', value: recurring }
            ],
            paymentMethods: Object.entries(paymentStats).map(([name, value]) => ({ name, value }))
        }
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error("[analytics-bi] Erro:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})
