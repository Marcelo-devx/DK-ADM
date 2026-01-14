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
  Package,
  Users,
  CheckCircle2,
  Phone,
  ChevronDown,
  ChevronUp,
  MapPin,
  XCircle,
  User,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DeliveryRoutesPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const formattedDate = date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  const { data: activeRoutes, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["spokeRoutesSafe", formattedDate],
    queryFn: async () => {
      try {
        // 1. Buscar Lista de Motoristas (com limite alto para pegar todos)
        const { data: driversData, error: driversError } = await supabase.functions.invoke("spoke-proxy", {
          body: { action: "drivers", params: { maxPageSize: 100 } }
        });
        
        if (driversError) throw new Error("Falha ao buscar motoristas: " + driversError.message);
        
        const driversList = driversData?.drivers || [];
        const driversMap = new Map();
        driversList.forEach((d: any) => driversMap.set(d.id, d));

        // 2. Buscar Planos do dia
        const { data: plansData, error: plansError } = await supabase.functions.invoke("spoke-proxy", {
          body: { 
            action: "plans", 
            params: { "filter.startsGte": formattedDate, maxPageSize: 20 }
          }
        });

        if (plansError) throw new Error("Falha ao buscar planos: " + plansError.message);
        const rawPlans = plansData?.plans || [];

        // 3. Processar Rotas dentro dos Planos
        const allRoutes: any[] = [];

        for (const plan of rawPlans) {
          try {
            // Buscar rotas do plano (que são divididas por motorista)
            const planId = plan.id.includes('/') ? plan.id : `plans/${plan.id}`;
            const { data: routesData } = await supabase.functions.invoke("spoke-proxy", {
                body: { action: `${planId}/routes`, params: { maxPageSize: 50 } }
            });

            const routesInPlan = routesData?.routes || [];

            for (const route of routesInPlan) {
                // Buscar paradas da rota
                const routeId = route.id.includes('/') ? route.id : `routes/${route.id}`;
                const { data: stopsData } = await supabase.functions.invoke("spoke-proxy", {
                    body: { action: `${routeId}/stops`, params: { maxPageSize: 100 } }
                });

                const stops = stopsData?.stops || [];
                
                // Calcular status
                const total = stops.length;
                const completed = stops.filter((s: any) => s.deliveryInfo?.succeeded).length;
                const failed = stops.filter((s: any) => s.deliveryInfo?.attempted && !s.deliveryInfo?.succeeded).length;

                // Identificar motorista
                const driverId = route.driverId;
                const driverDetails = driversMap.get(driverId);
                const driverName = driverDetails?.name || driverDetails?.displayName || "Motorista não identificado";
                const driverPhone = driverDetails?.phone || null;

                allRoutes.push({
                    id: route.id,
                    planName: plan.title || "Plano Geral",
                    routeName: route.title,
                    driver: { name: driverName, phone: driverPhone },
                    stops_count: total,
                    completed_stops_count: completed,
                    failed_stops_count: failed,
                    status: (completed + failed) === total && total > 0 ? 'completed' : 'active',
                    stops_list: stops
                });
            }
          } catch (innerErr) {
            console.error("Erro ao processar plano específico:", innerErr);
            // Continua para o próximo plano em vez de quebrar tudo
          }
        }

        return allRoutes;

      } catch (err: any) {
        console.error("Erro fatal na busca de rotas:", err);
        throw err;
      }
    },
    retry: 1,
    refetchInterval: 60000,
  });

  const stats = useMemo(() => {
    if (!activeRoutes) return { drivers: 0, total_stops: 0, completed: 0, efficiency: 0 };
    const total = activeRoutes.reduce((acc, r) => acc + r.stops_count, 0);
    const completed = activeRoutes.reduce((acc, r) => acc + r.completed_stops_count, 0);
    return {
      drivers: activeRoutes.length,
      total_stops: total,
      completed,
      efficiency: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [activeRoutes]);

  const toggleRoute = (id: string) => {
    setExpandedRoutes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStopStatusBadge = (stop: any) => {
    if (stop.deliveryInfo?.succeeded) return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Entregue</Badge>;
    if (stop.deliveryInfo?.attempted) return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Falhou</Badge>;
    return <Badge variant="outline" className="text-gray-500">Pendente</Badge>;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-gray-800 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Monitoramento por Motorista</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <Globe className="w-3 h-3" /> Integração Spoke
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
          <Card className="shadow-sm border-none bg-white sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Filtrar Data</CardTitle>
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
                        <p className="text-muted-foreground animate-pulse font-bold uppercase text-xs tracking-widest">Carregando dados da logística...</p>
                    </div>
                ) : isError ? (
                    <div className="p-12 text-center bg-red-50/20">
                        <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                        <h3 className="text-xl font-black text-red-800">Erro ao carregar</h3>
                        <p className="text-sm text-red-600 mb-6 max-w-md mx-auto font-medium">
                            {(error as Error)?.message || "Não foi possível conectar à API de logística."}
                        </p>
                        <Button onClick={() => refetch()} variant="outline">Tentar Novamente</Button>
                    </div>
                ) : (
                    <div className="divide-y">
                        <div className="grid grid-cols-3 gap-8 p-6 bg-gray-50/30">
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Motoristas</p><p className="text-3xl font-black">{stats.drivers}</p></div>
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Entregas</p><p className="text-3xl font-black">{stats.completed} <span className="text-sm font-normal text-muted-foreground">/ {stats.total_stops}</span></p></div>
                            <div><p className="text-xs text-muted-foreground font-bold uppercase">Eficiência</p><p className="text-3xl font-black text-blue-600">{stats.efficiency}%</p></div>
                        </div>
                        
                        {activeRoutes && activeRoutes.length > 0 ? activeRoutes.map((r: any) => {
                            const progress = r.stops_count > 0 ? (r.completed_stops_count / r.stops_count) * 100 : 0;
                            const isExpanded = expandedRoutes[r.id];

                            return (
                                <div key={r.id} className="transition-all border-l-4 border-transparent hover:border-blue-500 bg-white">
                                    <div 
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-gray-50 cursor-pointer gap-4 sm:gap-0"
                                        onClick={() => toggleRoute(r.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl flex-shrink-0 uppercase">
                                                {r.driver.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-base">{r.driver.name}</p>
                                                    {r.status === 'completed' ? (
                                                        <Badge className="text-[9px] bg-green-500 h-4 px-1">CONCLUÍDO</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 h-4 px-1">EM ROTA</Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                                                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {r.stops_count} paradas</span>
                                                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {r.planName}</span>
                                                    {r.driver.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.driver.phone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 w-full sm:w-1/3 justify-end">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                                                    <span>Progresso</span>
                                                    <span>{r.completed_stops_count}/{r.stops_count}</span>
                                                </div>
                                                <Progress value={progress} className="h-2" />
                                            </div>
                                            <div className="text-right w-12">
                                                <span className="text-lg font-bold text-blue-600">{Math.round(progress)}%</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="shrink-0">
                                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t bg-gray-50 p-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="bg-white rounded-lg border overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-gray-100">
                                                        <TableRow>
                                                            <TableHead className="w-12 text-center text-[10px] font-black uppercase">Seq</TableHead>
                                                            <TableHead className="text-[10px] font-black uppercase">Endereço</TableHead>
                                                            <TableHead className="text-[10px] font-black uppercase">Destinatário</TableHead>
                                                            <TableHead className="text-right text-[10px] font-black uppercase">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {r.stops_list.map((stop: any, index: number) => (
                                                            <TableRow key={stop.id} className="hover:bg-gray-50">
                                                                <TableCell className="text-center font-mono font-bold text-muted-foreground text-xs">
                                                                    {index + 1}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-sm flex items-center gap-1">
                                                                            <MapPin className="w-3 h-3 text-gray-400" /> 
                                                                            {stop.address?.address || stop.address?.addressLineOne || "Endereço não disponível"}
                                                                        </span>
                                                                        {(stop.address?.city || stop.address?.state) && (
                                                                            <span className="text-[10px] text-muted-foreground pl-4">
                                                                                {[stop.address.city, stop.address.state].filter(Boolean).join(" - ")}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-sm">
                                                                            {stop.recipient?.name || "Cliente"}
                                                                        </span>
                                                                        {stop.recipient?.phone && (
                                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                                <Phone className="w-3 h-3" /> {stop.recipient.phone}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {getStopStatusBadge(stop)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {r.stops_list.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                                    Nenhuma parada registrada.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }) : (
                            <div className="p-24 text-center">
                                <MapIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium italic">Nenhuma rota ativa encontrada para esta data.</p>
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