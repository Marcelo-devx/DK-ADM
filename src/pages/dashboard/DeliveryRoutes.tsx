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
  Package,
  Users,
  CheckCircle2,
  Phone,
  ChevronDown,
  ChevronUp,
  MapPin,
  XCircle,
  User
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
    queryKey: ["spokeRoutesByDriver", formattedDate],
    queryFn: async () => {
      // FUNÇÃO PARA BUSCAR TODAS AS PÁGINAS
      const fetchAllPages = async (action: string, initialParams: any, listKey: string) => {
        let allItems: any[] = [];
        let nextToken = null;
        do {
          const { data, error } = await supabase.functions.invoke("spoke-proxy", {
            body: { action, params: { ...initialParams, pageToken: nextToken || undefined } }
          });
          if (error) throw error;
          const items = data[listKey] || (Array.isArray(data) ? data : []);
          allItems = [...allItems, ...items];
          nextToken = data.nextPageToken;
        } while (nextToken);
        return allItems;
      };

      // 1. Buscar Drivers
      const driversList = await fetchAllPages("drivers", { maxPageSize: 50 }, "drivers");
      const driversMap = new Map(driversList.map((d: any) => [d.id, d]));

      // 2. Buscar Planos do dia
      const plans = await fetchAllPages("plans", { "filter.startsGte": formattedDate, maxPageSize: 20 }, "plans");

      // 3. Para cada Plano, buscar as Rotas (divisão por motorista)
      const allIndividualRoutes: any[] = [];

      for (const plan of plans) {
        try {
          const planIdPath = plan.id.startsWith('plans/') ? plan.id : `plans/${plan.id}`;
          
          // Busca as rotas dentro do plano (onde está a divisão por motorista)
          const routesInPlan = await fetchAllPages(`${planIdPath}/routes`, { maxPageSize: 20 }, "routes");

          for (const route of routesInPlan) {
            const driverId = route.driverId;
            const fullDriverData = driversMap.get(driverId);
            
            // Busca as paradas desta rota específica
            const stops = await fetchAllPages(`${route.id}/stops`, { maxPageSize: 50 }, "stops");
            
            const completed = stops.filter((s: any) => s.deliveryInfo?.succeeded === true).length;
            const failed = stops.filter((s: any) => s.deliveryInfo?.attempted === true && !s.deliveryInfo?.succeeded).length;

            allIndividualRoutes.push({
              id: route.id,
              planName: plan.title || "Plano Geral",
              driver: {
                name: fullDriverData?.name || fullDriverData?.displayName || "Motorista não identificado",
                phone: fullDriverData?.phone || null
              },
              stops_count: stops.length,
              completed_stops_count: completed,
              failed_stops_count: failed,
              stops_list: stops,
              status: (completed + failed) === stops.length && stops.length > 0 ? 'completed' : 'active'
            });
          }
        } catch (err) {
          console.error(`Erro ao processar rotas do plano ${plan.id}:`, err);
        }
      }
      
      return allIndividualRoutes;
    },
    retry: 1,
    refetchInterval: 45000,
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

  const getStopStatusBadge = (stop: any) => {
    if (stop.deliveryInfo?.succeeded) return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Entregue</Badge>;
    if (stop.deliveryInfo?.attempted) return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Falha</Badge>;
    return <Badge variant="outline" className="text-gray-400">Pendente</Badge>;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-gray-800 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Monitoramento por Motorista</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Spoke Cloud Sync
            </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} /> Sincronizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <Card className="shadow-sm border-none bg-white sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Filtrar Data</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} className="w-full" />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-9 space-y-6">
          {isLoading ? (
            <div className="p-20 text-center space-y-4">
                <RefreshCw className="h-10 w-10 animate-spin mx-auto text-primary opacity-50" />
                <p className="text-muted-foreground animate-pulse font-bold uppercase text-xs tracking-widest">Mapeando Rotas por Condutor...</p>
            </div>
          ) : activeRoutes && activeRoutes.length > 0 ? (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <Card className="bg-white border-none shadow-sm"><CardContent className="p-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Motoristas na Rua</p>
                        <p className="text-2xl font-black">{stats.drivers}</p>
                    </CardContent></Card>
                    <Card className="bg-white border-none shadow-sm"><CardContent className="p-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Paradas Totais</p>
                        <p className="text-2xl font-black">{stats.completed} <span className="text-sm opacity-40">/ {stats.total_stops}</span></p>
                    </CardContent></Card>
                    <Card className="bg-white border-none shadow-sm"><CardContent className="p-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Conclusão Geral</p>
                        <p className="text-2xl font-black text-blue-600">{stats.efficiency}%</p>
                    </CardContent></Card>
                </div>

                {activeRoutes.map((route: any) => {
                    const progress = route.stops_count > 0 ? (route.completed_stops_count / route.stops_count) * 100 : 0;
                    const isExpanded = expandedRoutes[route.id];

                    return (
                        <Card key={route.id} className={cn(
                            "border-none shadow-sm overflow-hidden transition-all",
                            route.status === 'completed' ? "opacity-70" : "ring-1 ring-black/5"
                        )}>
                            <div 
                                className="p-5 flex flex-col sm:flex-row items-center justify-between cursor-pointer hover:bg-gray-50 gap-4"
                                onClick={() => setExpandedRoutes(prev => ({ ...prev, [route.id]: !prev[route.id] }))}
                            >
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-lg">{route.driver.name}</p>
                                            {route.status === 'completed' && <Badge className="bg-green-500">FINALIZADA</Badge>}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-2">
                                            {route.planName} • <Phone className="w-3 h-3" /> {route.driver.phone || "Sem Telefone"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-1/2 justify-end">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground">
                                            <span>Progresso da Rota</span>
                                            <span>{route.completed_stops_count}/{route.stops_count}</span>
                                        </div>
                                        <Progress value={progress} className="h-1.5" />
                                    </div>
                                    <Button variant="ghost" size="icon">
                                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                    </Button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="border-t bg-gray-50/50 p-4 animate-in slide-in-from-top-1 duration-200">
                                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-gray-50">
                                                <TableRow>
                                                    <TableHead className="w-12 text-center text-[10px] font-black uppercase">Seq</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase">Endereço de Entrega</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase">Destinatário</TableHead>
                                                    <TableHead className="text-right text-[10px] font-black uppercase">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {route.stops_list.map((stop: any, idx: number) => (
                                                    <TableRow key={stop.id} className="hover:bg-gray-50">
                                                        <TableCell className="text-center font-black text-muted-foreground text-xs">{idx + 1}</TableCell>
                                                        <TableCell>
                                                            <p className="text-xs font-bold flex items-center gap-1">
                                                                <MapPin className="w-3 h-3 text-primary" /> {stop.address?.address || "N/A"}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground pl-4">{stop.address?.city} - {stop.address?.state}</p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <p className="text-xs font-black">{stop.recipient?.name || "N/A"}</p>
                                                            {stop.recipient?.phone && <p className="text-[10px] text-muted-foreground">{stop.recipient.phone}</p>}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {getStopStatusBadge(stop)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
          ) : (
            <div className="p-24 text-center bg-white rounded-3xl border-2 border-dashed">
                <MapIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Nenhuma rota ativa para esta data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryRoutesPage;