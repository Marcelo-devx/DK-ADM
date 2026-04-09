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
    const { period = "12m" } = await req.json();
    
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
    const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('total_price, created_at, status, payment_method, shipping_cost, coupon_discount, user_id')
        .neq('status', 'Cancelado')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

    // Buscar perfis (dados demográficos não precisam de filtro de período)
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, gender, date_of_birth, state');

    // --- PROCESSAMENTO DE BI ---
    
    // Determinar agrupamento baseado no período
    let groupBy: 'day' | 'week' | 'month';
    if (period === "7d" || period === "30d") {
      groupBy = 'day';
    } else if (period === "90d" || period === "6m") {
      groupBy = 'week';
    } else {
      groupBy = 'month';
    }

    // Gerar array de períodos para o gráfico
    const generatePeriodArray = () => {
      const periods = [];
      const current = new Date(startDate);
      
      while (current <= now) {
        let periodKey: string;
        let periodLabel: string;
        
        if (groupBy === 'day') {
          periodKey = current.toISOString().substring(0, 10); // YYYY-MM-DD
          periodLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(current);
        } else if (groupBy === 'week') {
          const weekStart = new Date(current);
          const weekEnd = new Date(current);
          weekEnd.setDate(weekEnd.getDate() + 6);
          periodKey = `${weekStart.toISOString().substring(0, 10)}_to_${weekEnd.toISOString().substring(0, 10)}`;
          periodLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
        } else {
          periodKey = current.toISOString().substring(0, 7); // YYYY-MM
          periodLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(current);
        }
        
        periods.push({ key: periodKey, label: periodLabel });
        
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
    const statsByPeriod = periodArray.map(period => {
      let filtered;
      
      if (groupBy === 'day') {
        filtered = orders.filter(o => o.created_at.startsWith(period.key));
      } else if (groupBy === 'week') {
        const [start, end] = period.key.split('_to_');
        filtered = orders.filter(o => o.created_at >= start && o.created_at <= end);
      } else {
        filtered = orders.filter(o => o.created_at.startsWith(period.key));
      }
      
      const revenue = filtered.reduce((acc, o) => acc + Number(o.total_price), 0);
      const approved = filtered.filter(o => o.status === 'Finalizada' || o.status === 'Pago').length;
      
      return {
        month: period.key,
        label: period.label,
        revenue,
        orders: filtered.length,
        approved_rate: filtered.length > 0 ? (approved / filtered.length) * 100 : 0
      };
    });

    // 2. DEMOGRAFIA
    const genderStats = profiles.reduce((acc, p) => {
        const g = p.gender || 'Não Informado';
        acc[g] = (acc[g] || 0) + 1;
        return acc;
    }, {});

    const regionStats = profiles.reduce((acc, p) => {
        const s = p.state || 'Outros';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    // 3. NOVOS VS RECORRENTES (apenas do período selecionado)
    const userOrderCounts = orders.reduce((acc, o) => {
        acc[o.user_id] = (acc[o.user_id] || 0) + 1;
        return acc;
    }, {});
    
    const recurring = Object.values(userOrderCounts).filter(count => count > 1).length;
    const newUsers = Object.values(userOrderCounts).filter(count => count === 1).length;

    console.log("[analytics-bi] Dados processados:", { period: periodArray.length, genderStats: Object.keys(genderStats).length });

    return new Response(JSON.stringify({
        monthly: statsByPeriod,
        demographics: {
            gender: Object.entries(genderStats).map(([name, value]) => ({ name, value })),
            regions: Object.entries(regionStats).map(([name, value]) => ({ name, value })),
            retention: [
                { name: 'Novos', value: newUsers },
                { name: 'Recorrentes', value: recurring }
            ]
        }
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error("[analytics-bi] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})