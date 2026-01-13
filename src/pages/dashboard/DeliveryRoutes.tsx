"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { 
  Map as MapIcon, 
  Warehouse,
  Globe,
  RefreshCw,
  AlertTriangle,
  Settings,
  ArrowRight,
  Package,
  Users,
  CheckCircle2,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const DeliveryRoutesPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const formattedDate = date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const { data: routes, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["spokeRoutesDeep", formattedDate],
    queryFn: async () => {
      // PASSO 1: Buscar os planos (Plans) do dia
      const { data: plansResponse, error: plansError } = await supabase.functions.invoke("spoke-proxy", {
        body: { 
          action: "plans", 
          params: { "filter.startsGte": formattedDate }
        }
      });
      
      if (plansError) {
        let errorMsg = plansError.message;
        try {
            const body = await plansError.context.json();
            errorMsg = body.details || body.error || plansError.message;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      
      const rawPlans = plansResponse.plans || (Array.isArray(plansResponse) ? plansResponse : []);

      // PASSO 2: Para cada plano, buscar as paradas (Stops) detalhadas
      // A API retorna IDs como "plans/plan_id". O endpoint de paradas é "plans/plan_id/stops".
      const detailedPlans = await Promise.all(rawPlans.map(async (plan: any) => {
        try {
            // Se o ID já vier como "plans/xyz", usamos ele + "/stops".
            // Se o ID for só "xyz", construímos "plans/xyz/stops".
            const planIdPath = plan.id.startsWith('plans/') ? plan.id : `plans/${plan.id}`;
            const stopsAction = `${planIdPath}/stops`;

            const { data: stopsResponse } = await supabase.functions.invoke("spoke-proxy", {
                body: { action: stopsAction }
            });

            const stops = stopsResponse.stops || (Array.isArray(stopsResponse) ? stopsResponse : []);
            
            // Calcular métricas reais baseadas nas paradas
            const totalStops = stops.length;
            const completedStops = stops.filter((s: any) => 
                // Estados comuns de sucesso no Spoke/Circuit
                s.state === 'succeeded' || s.state === 'delivered' || s.status === 'completed' || s.succeeded === true
            ).length;
            
            const failedStops = stops.filter((s: any) => 
                s.state === 'failed' || s.attempted === true
            ).length;

            return {
                id: plan.id,
                name: plan.title || `Plano ${plan.id.split('/').pop().substring(0,6)}`,
                status: plan.status || 'active',
                driver: { name: plan.driver?.name || "Motorista não atríbuido", phone: plan.driver?.phone },
                stops_count: totalStops,
                completed_stops_count: completedStops,
                failed_stops_count: failedStops,
                vehicle_count: 1, 
                stops_list: stops // Opcional: guardar para uso futuro (mapa, lista detalhada)
            };

        } catch (err) {
            console.error(`Erro ao buscar detalhes do plano ${plan.id}:`, err);
            // Retorna o plano com dados zerados em caso de erro no fetch de detalhes
            return {
                id: plan.id,
                name: plan.title || "Plano (Erro)",
                status: 'error',
                driver: { name: "Erro ao carregar", phone: null },
                stops_count: 0,
                completed_stops_count: 0,
                failed_stops_count: 0,
                vehicle_count: 0
            };
        }
      }));
      
      return detailedPlans;
    },
    retry: 1,
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });

  const stats = useMemo(() => {
    if (!routes) return { plans: 0, total_stops: 0, completed: 0, efficiency: 0 };
    const total = routes.reduce((acc: number, r: any) => acc + r.stops_count, 0);
    const completed = routes.reduce((acc: number, r: any) => acc + r.completed_stops_count, 0);
    return {
      plans: routes.length,
      total_stops: total,
      completed,
      efficiency: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [routes]);

  const getErrorMessage = (err: Error) => {
    const msg = err.message;
    if (msg.includes("Name or service not known") || msg.includes("dns error")) {
        return "URL INVÁLIDA: O endereço da API configurado não existe. Verifique o campo 'Base URL' nas configurações.";
    }
    if (msg.includes("401") || msg.includes("Unauthorized")) {
        return "ACESSO NEGADO: O Token da API está incorreto ou expirou.";
    }
    return msg;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Logística Spoke</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <Globe className="w-3 h-3" /> Monitor Real-time
            </Badge>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} /> Atualizar
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Data das Rotas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={ptBR}
                className="w-full"
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-9 space-y-6">
          <Card className="shadow-sm border-none overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 border-b py-3 px-6">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-600 uppercase">
                <Warehouse className="h-4 w-4" /> Status da Frota (Planos)
              </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-20 text-center space-y-4">
                        <RefreshCw className="h-10 w-10 animate-spin mx-auto text-primary opacity-50" />
                        <p className="text-muted-foreground animate-pulse">Conectando ao Dispatcher...</p>
                    </div>
                ) : isError ? (
                    <div className="p-12 text-center bg-red-50/20">
                        <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                        <h3 className="text-xl font-black text-red-800">Conexão Falhou</h3>
                        <p className="text-sm text-red-600 mb-6 max-w-md mx-auto font-medium">
                            {getErrorMessage(error as Error)}
                        </p>
                        <div className="flex justify-center gap-3">
                            <Button onClick={() => refetch()} variant="outline">Tentar Novamente</Button>
                            <Button asChild className="bg-red-600 hover:bg-red-700">
                                <Link to="/dashboard/settings"><Settings className="w-4 h-4 mr-2" /> Configurações</Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y">
                        <div className="grid grid-cols-3 gap-8 p-6 bg-gray-50/30">
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Planos Ativos</p><p className="text-3xl font-black">{stats.plans}</p></div>
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Entregas Totais</p><p className="text-3xl font-black">{stats.completed} <span className="text-sm font-normal text-muted-foreground">/ {stats.total_stops}</span></p></div>
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Progresso Geral</p><p className="text-3xl font-black text-blue-600">{stats.efficiency}%</p></div>
                        </div>
                        {routes && routes.length > 0 ? routes.map((r: any) => {
                            const progress = r.stops_count > 0 ? (r.completed_stops_count / r.stops_count) * 100 : 0;
                            return (
                                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-gray-50 transition-all border-l-4 border-transparent hover:border-blue-500 gap-4 sm:gap-0">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl flex-shrink-0">
                                            {r.name?.charAt(0) || 'P'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-base">{r.name}</p>
                                                {r.status === 'active' && <Badge className="text-[9px] bg-green-500 h-4 px-1">ATIVO</Badge>}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                                                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {r.stops_count} paradas</span>
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.driver.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 w-full sm:w-1/3">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-muted-foreground">
                                                <span>Progresso</span>
                                                <span>{r.completed_stops_count}/{r.stops_count}</span>
                                            </div>
                                            <Progress value={progress} className="h-2" />
                                        </div>
                                        <div className="text-right">
                                            {progress === 100 ? (
                                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                                            ) : (
                                                <span className="text-lg font-bold text-blue-600">{Math.round(progress)}%</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="p-24 text-center">
                                <MapIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium italic">Nenhum plano de rota encontrado para {format(date || new Date(), "dd/MM")}.</p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeliveryRoutesPage;