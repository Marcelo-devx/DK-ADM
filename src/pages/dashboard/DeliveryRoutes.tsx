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
  Clock,
  Phone
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
      // PASSO 0: Buscar Lista de Motoristas para Mapeamento (ID -> Nome)
      // Isso é necessário pois o plano pode retornar apenas IDs ou objetos parciais
      const { data: driversResponse } = await supabase.functions.invoke("spoke-proxy", {
        body: { action: "drivers", params: { maxPageSize: 100 } }
      });
      
      const driversList = driversResponse?.drivers || [];
      const driversMap = new Map();
      driversList.forEach((d: any) => {
        // Mapeia tanto o ID completo "drivers/123" quanto o sufixo "123" se necessário
        driversMap.set(d.id, d);
      });

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
      const detailedPlans = await Promise.all(rawPlans.map(async (plan: any) => {
        try {
            const planIdPath = plan.id.startsWith('plans/') ? plan.id : `plans/${plan.id}`;
            const stopsAction = `${planIdPath}/stops`;

            const { data: stopsResponse } = await supabase.functions.invoke("spoke-proxy", {
                body: { action: stopsAction }
            });

            const stops = stopsResponse.stops || (Array.isArray(stopsResponse) ? stopsResponse : []);
            
            // MÉTRICAS BASEADAS NO MODELO DE STOP (deliveryInfo)
            const totalStops = stops.length;
            
            const completedStops = stops.filter((s: any) => {
                // Verifica deliveryInfo.succeeded conforme documentação
                return s.deliveryInfo?.succeeded === true || s.deliveryInfo?.state === 'delivered_to_recipient';
            }).length;
            
            const failedStops = stops.filter((s: any) => {
                // Verifica tentativas falhas
                return s.deliveryInfo?.attempted === true && s.deliveryInfo?.succeeded === false;
            }).length;

            // Identificar Motorista
            let driverInfo = { name: "Aguardando Atribuição", phone: null };
            
            // O modelo de plano retorna "drivers": [ { id: "..." } ]
            if (plan.drivers && plan.drivers.length > 0) {
                const driverId = plan.drivers[0].id || plan.drivers[0]; // Pode ser objeto ou string
                const fullDriverData = driversMap.get(driverId);
                
                if (fullDriverData) {
                    driverInfo = { name: fullDriverData.name || fullDriverData.displayName || "Motorista", phone: fullDriverData.phone };
                } else if (typeof plan.drivers[0] === 'object' && (plan.drivers[0].name || plan.drivers[0].displayName)) {
                     // Fallback se o objeto do plano já tiver o nome
                     driverInfo = { name: plan.drivers[0].name || plan.drivers[0].displayName, phone: plan.drivers[0].phone };
                }
            }

            return {
                id: plan.id,
                name: plan.title || `Rota ${plan.id.split('/').pop().substring(0,6)}`,
                status: completedStops === totalStops && totalStops > 0 ? 'completed' : 'active',
                driver: driverInfo,
                stops_count: totalStops,
                completed_stops_count: completedStops,
                failed_stops_count: failedStops,
                stops_list: stops
            };

        } catch (err) {
            console.error(`Erro ao buscar detalhes do plano ${plan.id}:`, err);
            return {
                id: plan.id,
                name: plan.title || "Erro ao carregar",
                status: 'error',
                driver: { name: "N/A", phone: null },
                stops_count: 0,
                completed_stops_count: 0,
                failed_stops_count: 0
            };
        }
      }));
      
      return detailedPlans;
    },
    retry: 1,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
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
            <h1 className="text-2xl font-bold">Logística Spoke (Circuit)</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <Globe className="w-3 h-3" /> Monitoramento v0.2b
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
                <Warehouse className="h-4 w-4" /> Visão Geral da Frota
              </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-20 text-center space-y-4">
                        <RefreshCw className="h-10 w-10 animate-spin mx-auto text-primary opacity-50" />
                        <p className="text-muted-foreground animate-pulse">Sincronizando com Spoke API...</p>
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
                            <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
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
                                            {r.name?.charAt(0).toUpperCase() || 'R'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-base">{r.name}</p>
                                                {r.status === 'completed' ? (
                                                    <Badge className="text-[9px] bg-green-500 h-4 px-1">CONCLUÍDO</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 h-4 px-1">ATIVO</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                                                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {r.stops_count} paradas</span>
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.driver.name}</span>
                                                {r.driver.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.driver.phone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 w-full sm:w-1/3">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-muted-foreground">
                                                <span>Entregas</span>
                                                <span>{r.completed_stops_count}/{r.stops_count}</span>
                                            </div>
                                            <Progress value={progress} className="h-2" />
                                        </div>
                                        <div className="text-right w-12">
                                            {progress === 100 ? (
                                                <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
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