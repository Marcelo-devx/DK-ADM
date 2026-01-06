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
  ChevronRight, 
  Warehouse,
  Globe,
  RefreshCw,
  AlertTriangle,
  Settings,
  ArrowRight,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const DeliveryRoutesPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const formattedDate = date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const { data: routes, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["spokeRoutes", formattedDate],
    queryFn: async () => {
      const { data, error: invokeError } = await supabase.functions.invoke("spoke-proxy", {
        body: { 
          action: "routes",
          params: { date: formattedDate }
        }
      });
      
      if (invokeError) {
        let errorMsg = invokeError.message;
        try {
            const body = await invokeError.context.json();
            errorMsg = body.details || body.error || invokeError.message;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      
      const routesList = data.routes || [];
      return routesList.map((r: any) => ({
        id: r.id,
        name: r.name || `Rota #${r.id.substring(0, 5)}`,
        status: r.status,
        driver: r.driver ? { name: r.driver.name, phone: r.driver.phone } : null,
        stops_count: r.stops?.length || 0,
        completed_stops_count: r.stops?.filter((s: any) => s.status === 'completed' || s.status === 'delivered').length || 0,
        total_distance_km: r.distance_meters ? parseFloat((r.distance_meters / 1000).toFixed(1)) : 0,
        eta: r.eta ? format(new Date(r.eta), "HH:mm") : null
      }));
    },
    retry: false,
    refetchInterval: 60000,
  });

  const stats = useMemo(() => {
    if (!routes) return { vehicles: 0, total: 0, completed: 0, efficiency: 0 };
    const total = routes.reduce((acc: number, r: any) => acc + r.stops_count, 0);
    const completed = routes.reduce((acc: number, r: any) => acc + r.completed_stops_count, 0);
    return {
      vehicles: routes.length,
      total,
      completed,
      efficiency: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [routes]);

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
                <Warehouse className="h-4 w-4" /> Status da Frota
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
                        <p className="text-sm text-red-600 mb-6 max-w-md mx-auto">
                            O endereço configurado parece estar incorreto ou o serviço está inacessível.
                        </p>
                        
                        <div className="p-6 bg-white border border-red-100 rounded-2xl max-w-2xl mx-auto shadow-lg text-left mb-8">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Relatório Técnico</span>
                                <Badge variant="outline" className="text-[9px] border-red-200 text-red-500 bg-red-50 uppercase font-bold">DNS Error</Badge>
                            </div>
                            <p className="text-sm font-mono text-red-600 bg-red-50/50 p-4 rounded-xl border border-red-50 leading-relaxed overflow-x-auto">
                                { (error as Error).message }
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className="flex gap-3">
                                <Button onClick={() => refetch()} disabled={isRefetching} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 font-bold">
                                    <RefreshCw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} /> Tentar Novamente
                                </Button>
                                <Button asChild className="bg-red-600 hover:bg-red-700 font-bold shadow-md">
                                    <Link to="/dashboard/settings">
                                        <Settings className="w-4 h-4 mr-2" /> Corrigir Endereço
                                    </Link>
                                </Button>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-4 space-y-1">
                                <p>• Verifique se a <b>Base URL</b> em Configurações está correta (ex: https://api.spoke.com)</p>
                                <p>• Certifique-se de que o <b>Token</b> não possui espaços extras.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y">
                        <div className="grid grid-cols-3 gap-8 p-6 bg-gray-50/30">
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Veículos Ativos</p><p className="text-3xl font-black">{stats.vehicles}</p></div>
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Stops Concluídos</p><p className="text-3xl font-black">{stats.completed} <span className="text-sm font-normal text-muted-foreground">/ {stats.total}</span></p></div>
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Taxa de Sucesso</p><p className="text-3xl font-black text-blue-600">{stats.efficiency}%</p></div>
                        </div>
                        {routes && routes.length > 0 ? routes.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between p-5 hover:bg-gray-50 transition-all border-l-4 border-transparent hover:border-blue-500">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl">{r.driver?.name?.charAt(0) || 'V'}</div>
                                    <div>
                                        <p className="font-black text-base">{r.driver?.name || "Aguardando Motorista"}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                                            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {r.stops_count} entregas</span>
                                            <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> ETA: {r.eta || '--:--'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-bold text-muted-foreground">{Math.round((r.completed_stops_count / Math.max(1, r.stops_count)) * 100)}%</span>
                                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden border">
                                            <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${(r.completed_stops_count / Math.max(1, r.stops_count)) * 100}%` }} />
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-gray-300" />
                                </div>
                            </div>
                        )) : (
                            <div className="p-24 text-center">
                                <MapIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium italic">Nenhuma rota ativa para o dia {format(date || new Date(), "dd/MM")}.</p>
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