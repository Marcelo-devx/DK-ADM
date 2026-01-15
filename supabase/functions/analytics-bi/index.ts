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

    // 1. FATURAMENTO 12 MESES (Agrupado por mês)
    const { data: monthlyHistory } = await supabaseAdmin.rpc('get_monthly_stats_v2'); 
    // Nota: Como não temos a RPC pronta, vamos simular via query se necessário, 
    // mas o ideal é rodar direto no SQL. Segue a lógica otimizada:
    
    const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('total_price, created_at, status, payment_method, shipping_cost, coupon_discount, user_id')
        .neq('status', 'Cancelado')
        .order('created_at', { ascending: true });

    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, gender, date_of_birth, state');

    // --- PROCESSAMENTO DE BI ---
    const now = new Date();
    const last12Months = Array.from({length: 12}, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return d.toISOString().substring(0, 7); // YYYY-MM
    }).reverse();

    const statsByMonth = last12Months.map(month => {
        const filtered = orders.filter(o => o.created_at.startsWith(month));
        const revenue = filtered.reduce((acc, o) => acc + Number(o.total_price), 0);
        const approved = filtered.filter(o => o.status === 'Finalizada' || o.status === 'Pago').length;
        
        return {
            month,
            label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(month + "-01")),
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

    // 3. NOVOS VS RECORRENTES
    const userOrderCounts = orders.reduce((acc, o) => {
        acc[o.user_id] = (acc[o.user_id] || 0) + 1;
        return acc;
    }, {});
    
    const recurring = Object.values(userOrderCounts).filter(count => count > 1).length;
    const newUsers = Object.values(userOrderCounts).filter(count => count === 1).length;

    return new Response(JSON.stringify({
        monthly: statsByMonth,
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
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})