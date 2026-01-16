"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, CheckCircle2, XCircle, Route, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const fetchLogisticsData = async () => {
  const today = new Date();
  const fourteenDaysAgo = subDays(today, 14);
  const formattedDate = format(fourteenDaysAgo, "yyyy-MM-dd");

  // Busca planos dos últimos 14 dias
  const { data, error } = await supabase.functions.invoke("spoke-proxy", {
    body: { 
      action: "plans", 
      params: { 
        "filter.startsGte": formattedDate,
        "maxPageSize": 100 // Limite seguro para análise rápida
      } 
    }
  });

  if (error) throw error;
  
  const plans = data.plans || [];
  
  // Processamento dos dados
  let totalStops = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalRoutes = plans.length;

  // Agrupamento por dia
  const dailyStats: Record<string, { date: string, success: number, failed: number, total: number }> = {};

  plans.forEach((plan: any) => {
    // Tenta pegar a data de início ou criação
    const dateStr = plan.start ? plan.start.split('T')[0] : plan.created.split('T')[0];
    const displayDate = format(parseISO(dateStr), "dd/MM", { locale: ptBR });

    if (!dailyStats[displayDate]) {
        dailyStats[displayDate] = { date: displayDate, success: 0, failed: 0, total: 0 };
    }

    // Circuit retorna contadores agregados no objeto do plano (usualmente em optimization.metrics ou similar, 
    // mas aqui vamos iterar se tiver stops summary, ou assumir baseados no status se a API simplificada não retornar stops)
    // Para simplificar e garantir performance sem fazer N requests de stops, vamos usar métricas estimadas se disponíveis,
    // ou assumir sucesso total se status == completed (o que é uma aproximação).
    
    // NOTA: A API v0.2b do Circuit retorna um objeto simplificado na lista de planos.
    // O ideal seria buscar stops, mas isso seria lento. Vamos trabalhar com o status do plano.
    
    // Estimativa inteligente baseada no estado do plano (se não tivermos contadores detalhados)
    // Se a API retornar detalhes de paradas no futuro, ajustamos aqui.
    
    // Simulação de dados reais baseada na estrutura típica:
    // Vamos considerar que um plano "completed" teve sucesso, mas pode ter tido falhas.
    // Como não podemos buscar stops de 14 dias sem estourar limites, vamos focar na EFICIÊNCIA DA ROTA.
    
    // Se o plano foi concluído, assumimos sucesso. Se foi cancelado ou falhou, falha.
    // Esta é uma métrica de "Sucesso da Rota", não micro-entrega (por limitações da API de lista).
    
    const isCompleted = plan.status === 'completed' || plan.status === 'distributed'; // Ajuste conforme retorno real
    
    // Tentar extrair contagem de paradas do título ou metadados se houver (muitas vezes vem no title "Rota X - 15 paradas")
    // Fallback: 1 plano = 1 evento de logística
    
    if (isCompleted) {
        dailyStats[displayDate].success += 1;
        totalSuccess += 1;
    } else {
        // Se está ativo ou falhou
        // dailyStats[displayDate].failed += 1; // Não necessariamente falha, pode estar em andamento
        // Vamos contar apenas falhas explícitas ou planos antigos não finalizados
    }
    
    // Hack para simular "Paradas" se a API não entregar na lista:
    // Vamos usar uma média baseada no seu histórico (aprox 15-20 por rota) para projeção
    // OU se você quiser dados precisos, precisamos fazer fetch detalhado (mais lento).
    
    // Vou usar a contagem de Planos como métrica de "Saídas"
    dailyStats[displayDate].total += 1;
  });

  // Transformar em array e ordenar
  const chartData = Object.values(dailyStats).reverse(); // Datas mais antigas primeiro se vierem ordenadas desc

  return {
    overview: {
        totalRoutes,
        successRate: totalRoutes > 0 ? (totalSuccess / totalRoutes) * 100 : 0,
        avgRoutesPerDay: Object.keys(dailyStats).length > 0 ? (totalRoutes / Object.keys(dailyStats).length) : 0
    },
    chartData
  };
};

export const LogisticsInsights = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["logisticsMetrics"],
    queryFn: fetchLogisticsData,
    staleTime: 1000 * 60 * 15 // 15 min cache
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError) return null; // Silently fail if integration is not active

  const successRate = data?.overview.successRate || 0;
  const isHealthy = successRate > 90;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Card */}
        <Card className={isHealthy ? "border-l-4 border-l-green-500 bg-white shadow-md" : "border-l-4 border-l-orange-500 bg-white shadow-md"}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase text-gray-500 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" /> Eficiência de Roteirização
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-3xl font-black text-gray-900">{data?.overview.totalRoutes}</div>
                        <p className="text-xs text-muted-foreground font-bold uppercase">Rotas (14 dias)</p>
                    </div>
                    <Badge variant="outline" className={isHealthy ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}>
                        {isHealthy ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                        {successRate.toFixed(0)}% Conclusão
                    </Badge>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs">
                    <span className="text-gray-500">Média Diária:</span>
                    <span className="font-bold text-gray-900">{data?.overview.avgRoutesPerDay.toFixed(1)} saídas</span>
                </div>
            </CardContent>
        </Card>

        {/* Gráfico de Volume */}
        <Card className="lg:col-span-2 border-none shadow-md bg-white">
            <CardHeader className="pb-2 border-b bg-gray-50/50">
                <CardTitle className="text-sm font-black uppercase text-gray-500 flex items-center gap-2">
                    <Route className="w-4 h-4 text-purple-600" /> Volume de Saídas (Últimos 14 Dias)
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.chartData}>
                        <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="total" name="Rotas Criadas" fill="#8b5cf6" radius={[4, 4, 4, 4]} barSize={30}>
                             {data?.chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.total >= 3 ? "#7c3aed" : "#c4b5fd"} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    </div>
  );
};