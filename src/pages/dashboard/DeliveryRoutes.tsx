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
  Phone,
  ChevronDown,
  ChevronUp,
  MapPin,
  XCircle,
  CalendarClock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Função para verificar se o pedido caiu na próxima rota (Cópia da lógica de Orders.tsx)
const checkIsNextRoute = (dateString: string | null | undefined) => {
  if (!dateString) return false;
  const orderDate = new Date(dateString);
  const day = orderDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  // Cria data de corte baseada no dia do pedido
  const cutoff = new Date(orderDate);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  if (day === 0) {
    // Domingo: Tudo vai para próxima rota (Segunda)
    return true;
  } else if (day === 6) {
    // Sábado: Corte às 12:30
    cutoff.setHours(12, 30, 0);
  } else {
    // Segunda a Sexta: Corte às 14:00
    cutoff.setHours(14, 0, 0);
  }

  // Se o pedido foi feito DEPOIS do corte, é próxima rota
  return orderDate > cutoff;
};

const DeliveryRoutesPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const formattedDate = date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  const { data: routes, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["spokeRoutesDeep", formattedDate],
    queryFn: async () => {
      // FUNÇÃO AUXILIAR PARA BUSCAR TODAS AS PÁGINAS (PAGINAÇÃO)
      const fetchAllPages = async (action: string, initialParams: any, listKey: string) => {
        let allItems: any[] = [];
        let nextToken = null;
        
        do {
          const { data, error } = await supabase.functions.invoke("spoke-proxy", {
            body: { 
              action, 
              params: { ...initialParams, pageToken: nextToken || undefined } 
            }
          });
          
          if (error) throw error;
          
          const items = data[listKey] || (Array.isArray(data) ? data : []);
          allItems = [...allItems, ...items];
          nextToken = data.nextPageToken;
        } while (nextToken);
        
        return allItems;
      };

      // PASSO 0: Buscar Lista de Motoristas (Paginado)
      const driversList = await fetchAllPages("drivers", { maxPageSize: 50 }, "drivers");
      const driversMap = new Map();
      driversList.forEach((d: any) => {
        driversMap.set(d.id, d);
      });

      // PASSO 1: Buscar os planos (Plans) do dia (Paginado)
      const rawPlans = await fetchAllPages("plans", { "filter.startsGte": formattedDate, maxPageSize: 20 }, "plans");

      // PASSO 2: Para cada plano, buscar as paradas (Stops) detalhadas (Paginado)
      const detailedPlans = await Promise.all(rawPlans.map(async (plan: any) => {
        try {
            const planIdPath = plan.id.startsWith('plans/') ? plan.id : `plans/${plan.id}`;
            const stopsAction = `${planIdPath}/stops`;

            // Busca todas as paradas do plano lidando com a paginação interna
            const stops = await fetchAllPages(stopsAction, { maxPageSize: 10 }, "stops");
            
            // --- INÍCIO DA LÓGICA DE ENRIQUECIMENTO COM DADOS DO SUPABASE ---
            // Coletar External IDs (que devem corresponder aos IDs de pedido)
            const orderIds = stops
                .map((s: any) => s.externalId)
                .filter((id: any) => id); // Filtra nulos/vazios

            // Buscar dados dos pedidos no Supabase se houver IDs
            const ordersDataMap = new Map();
            if (orderIds.length > 0) {
                const { data: ordersData } = await supabase
                    .from('orders')
                    .select('id, created_at')
                    .in('id', orderIds);
                
                if (ordersData) {
                    ordersData.forEach(o => ordersDataMap.set(String(o.id), o.created_at));
                }
            }

            // Anexar data de criação aos stops
            stops.forEach((s: any) => {
                if (s.externalId) {
                    s.orderCreatedAt = ordersDataMap.get(String(s.externalId));
                }
            });
            // --- FIM DA LÓGICA DE ENRIQUECIMENTO ---

            const totalStops = stops.length;
            
            const completedStops = stops.filter((s: any) => {
                return s.deliveryInfo?.succeeded === true || s.deliveryInfo?.state === 'delivered_to_recipient';
            }).length;
            
            const failedStops = stops.filter((s: any) => {
                return s.deliveryInfo?.attempted === true && s.deliveryInfo?.succeeded === false;
            }).length;

            let driverInfo = { name: "Aguardando Atribuição", phone: null };
            
            if (plan.drivers && plan.drivers.length > 0) {
                const driverId = plan.drivers[0].id || plan.drivers[0];
                const fullDriverData = driversMap.get(driverId);
                
                if (fullDriverData) {
                    driverInfo = { name: fullDriverData.name || fullDriverData.displayName || "Motorista", phone: fullDriverData.phone };
                } else if (typeof plan.drivers[0] === 'object' && (plan.drivers[0].name || plan.drivers[0].displayName)) {
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
                failed_stops_count: 0,
                stops_list: []
            };
        }
      }));
      
      return detailedPlans;
    },
    retry: 1,
    refetchInterval: 60000, 
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

  const toggleRoute = (id: string) => {
    setExpandedRoutes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStopStatusBadge = (stop: any) => {
    if (stop.deliveryInfo?.succeeded) {
      return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Entregue</Badge>;
    }
    if (stop.deliveryInfo?.attempted && !stop.deliveryInfo?.succeeded) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Falhou</Badge>;
    }
    return <Badge variant="outline" className="text-gray-500">Pendente</Badge>;
  };

  const getErrorMessage = (err: Error) => {
    const msg = err.message;
    if (msg.includes("Name or service not known") || msg.includes("dns error")) {
        return "URL INVÁLIDA: O endereço da API configurado não existe.";
    }
    if (msg.includes("401") || msg.includes("Unauthorized")) {
        return "ACESSO NEGADO: O Token da API está incorreto ou expirou.";
    }
    return msg;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-gray-800 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Logística Spoke (Circuit)</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <Globe className="w-3 h-3" /> Monitoramento Ilimitado
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
                        <p className="text-muted-foreground animate-pulse">Sincronizando rotas e pedidos...</p>
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
                            const isExpanded = expandedRoutes[r.id];

                            return (
                                <div key={r.id} className="transition-all border-l-4 border-transparent hover:border-blue-500 bg-white">
                                    <div 
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-gray-50 cursor-pointer gap-4 sm:gap-0"
                                        onClick={() => toggleRoute(r.id)}
                                    >
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
                                                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {r.stops_count} paradas totais</span>
                                                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.driver.name}</span>
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
                                                            <TableHead className="w-12 text-center">Seq</TableHead>
                                                            <TableHead className="w-[200px]">Pedido & Data</TableHead>
                                                            <TableHead>Endereço</TableHead>
                                                            <TableHead>Cliente</TableHead>
                                                            <TableHead className="text-right">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {r.stops_list.map((stop: any, index: number) => {
                                                            const isNextRoute = checkIsNextRoute(stop.orderCreatedAt);
                                                            return (
                                                              <TableRow key={stop.id} className={cn("hover:bg-gray-50", isNextRoute && "bg-yellow-50/60 border-l-4 border-l-yellow-400")}>
                                                                  <TableCell className="text-center font-mono font-bold text-muted-foreground">
                                                                      {index + 1}
                                                                  </TableCell>
                                                                  <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-xs">{stop.externalId ? `#${stop.externalId}` : "Sem ID"}</span>
                                                                        {stop.orderCreatedAt ? (
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                {new Date(stop.orderCreatedAt).toLocaleString("pt-BR")}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-muted-foreground italic">Sem data</span>
                                                                        )}
                                                                        {isNextRoute && (
                                                                            <Badge variant="outline" className="mt-1 w-fit text-[9px] bg-yellow-100 text-yellow-800 border-yellow-300 gap-1 px-1">
                                                                                <CalendarClock className="w-3 h-3" /> Próx. Dia
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                  </TableCell>
                                                                  <TableCell>
                                                                      <div className="flex flex-col">
                                                                          <span className="font-medium text-sm flex items-center gap-1">
                                                                              <MapPin className="w-3 h-3 text-gray-400" /> 
                                                                              {stop.address?.address || stop.address?.addressLineOne || "Endereço não disponível"}
                                                                          </span>
                                                                          {stop.address?.city && (
                                                                              <span className="text-xs text-muted-foreground pl-4">
                                                                                  {stop.address.city} - {stop.address.state}
                                                                              </span>
                                                                          )}
                                                                      </div>
                                                                  </TableCell>
                                                                  <TableCell>
                                                                      <div className="flex flex-col">
                                                                          <span className="font-bold text-sm">
                                                                              {stop.recipient?.name || "Cliente sem nome"}
                                                                          </span>
                                                                          {stop.recipient?.phone && (
                                                                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                                  <Phone className="w-3 h-3" /> {stop.recipient.phone}
                                                                              </span>
                                                                          )}
                                                                      </div>
                                                                  </TableCell>
                                                                  <TableCell className="text-right">
                                                                      {getStopStatusBadge(stop)}
                                                                  </TableCell>
                                                              </TableRow>
                                                            );
                                                        })}
                                                        {r.stops_list.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                    Nenhuma parada registrada nesta rota.
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
                                <p className="text-muted-foreground font-medium italic">Nenhum plano de rota encontrado para esta data.</p>
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