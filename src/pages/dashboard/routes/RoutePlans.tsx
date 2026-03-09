"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Map as MapIcon, 
  Plus, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Users,
  Loader2,
  Zap,
  Send,
  Calendar,
  History,
  Filter
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Plan {
  id: string;
  title: string;
  status: string;
  drivers: any[];
  stops_count: number;
  created_at: string;
  starts_at?: string;
  ends_at?: string;
}

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  delivery_status: string;
  shipping_address: any;
  user_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

const RoutePlansPage = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null);
  const [isDistributing, setIsDistributing] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const queryClient = useQueryClient();

  // Buscar planos existentes
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ["spokePlans", dateRange],
    queryFn: async () => {
      let params: any = { maxPageSize: 100 };
      
      if (dateRange === "today") {
        const today = format(new Date(), "yyyy-MM-dd");
        params["filter.startsGte"] = today;
        params["filter.startsLt"] = format(new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      } else if (dateRange === "week") {
        const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
        params["filter.startsGte"] = weekAgo;
      } else if (dateRange === "month") {
        const monthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
        params["filter.startsGte"] = monthAgo;
      }
      // "all" não aplica filtro de data

      const { data, error } = await supabase.functions.invoke("spoke-proxy", {
        body: { action: "plans", params }
      });
      
      if (error) throw error;
      
      const plansList = data?.plans || [];
      
      // Ordenar por data de início (mais recente primeiro)
      return plansList.sort((a: any, b: any) => {
        const dateA = new Date(a.startsAt || a.created_at);
        const dateB = new Date(b.startsAt || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
    },
    refetchInterval: 60000,
  });

  // Buscar pedidos disponíveis para incluir em planos
  const { data: availableOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["ordersForPlans"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, created_at, total_price, status, delivery_status, user_id, shipping_address")
        .in("status", ["Finalizada", "Pago"])
        .in("delivery_status", ["Pendente", "Aguardando Coleta"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const userIds = [...new Set(orders.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return orders.map(order => ({
        ...order,
        profiles: profilesMap.get(order.user_id) || null,
      })) as Order[];
    },
  });

  // Criar novo plano
  const createPlanMutation = useMutation({
    mutationFn: async () => {
      if (!planTitle.trim()) {
        throw new Error("Digite um nome para o plano");
      }
      if (selectedOrders.size === 0) {
        throw new Error("Selecione pelo menos um pedido");
      }

      setIsCreating(true);
      
      // 1. Criar o plano
      const { data: planData, error: planError } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: "plans",
          method: "POST",
          body: {
            title: planTitle,
            date: planDate,
          }
        }
      });

      if (planError) throw planError;

      const planId = planData.id;
      
      // 2. Buscar detalhes dos pedidos selecionados
      const ordersData = availableOrders?.filter(o => selectedOrders.has(o.id)) || [];
      
      // 3. Criar paradas para o plano
      const stops = ordersData.map(order => {
        const address = order.shipping_address || {};
        const profile = order.profiles;
        const phoneClean = profile?.phone?.replace(/\D/g, "") || "";
        
        return {
          address: {
            addressLineOne: `${address.street}, ${address.number}`,
            addressLineTwo: address.complement || "",
            city: address.city || "",
            state: address.state || "",
            postalCode: address.cep?.replace(/\D/g, "") || "",
          },
          recipient: {
            name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Cliente",
            phone: phoneClean,
          },
          externalId: String(order.id),
          notes: phoneClean ? `wa.me/55${phoneClean}` : "",
        };
      });

      // 4. Importar paradas em lote
      const { error: importError } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: `${planId}/stops:import`,
          method: "POST",
          body: { stops }
        }
      });

      if (importError) throw importError;

      return planId;
    },
    onSuccess: () => {
      showSuccess("Plano criado com sucesso!");
      setCreateDialogOpen(false);
      setPlanTitle("");
      setSelectedOrders(new Set());
      queryClient.invalidateQueries({ queryKey: ["spokePlans"] });
      queryClient.invalidateQueries({ queryKey: ["ordersForPlans"] });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
    onSettled: () => {
      setIsCreating(false);
    },
  });

  // Otimizar plano
  const optimizePlan = async (planId: string) => {
    setIsOptimizing(planId);
    try {
      const { error } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: `${planId}:optimize`,
          method: "POST",
        }
      });

      if (error) throw error;
      showSuccess("Rota otimizada com sucesso!");
      refetchPlans();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsOptimizing(null);
    }
  };

  // Distribuir plano para motoristas
  const distributePlan = async (planId: string) => {
    setIsDistributing(planId);
    try {
      const { error } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: `${planId}:distribute`,
          method: "POST",
        }
      });

      if (error) throw error;
      showSuccess("Plano distribuído para motoristas!");
      refetchPlans();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsDistributing(null);
    }
  };

  const toggleSelectAll = () => {
    if (availableOrders && selectedOrders.size === availableOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(availableOrders?.map(o => o.id) || []));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const getPlanStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluído</Badge>;
      case 'distributed':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Send className="w-3 h-3 mr-1" /> Distribuído</Badge>;
      case 'optimizing':
        return <Badge className="bg-purple-500 hover:bg-purple-600"><Zap className="w-3 h-3 mr-1" /> Otimizando</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500"><Clock className="w-3 h-3 mr-1" /> Rascunho</Badge>;
    }
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case "today": return "Hoje";
      case "week": return "Últimos 7 dias";
      case "month": return "Últimos 30 dias";
      case "all": return "Todo o histórico";
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-gray-800 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Gestão de Planos de Rota</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                <MapIcon className="w-3 h-3" /> Spoke/Circuit
            </Badge>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchPlans()} disabled={plansLoading} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", plansLoading && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Plano
            </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm border-none bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Período:</Label>
            </div>
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
              <History className="w-4 h-4" />
              <span>Mostrando: <strong>{getDateRangeLabel()}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Planos */}
      <Card className="shadow-sm border-none overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 border-b py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-600 uppercase">
              <MapIcon className="h-4 w-4" /> Planos de Rota
            </div>
            <Badge variant="secondary">{plans?.length || 0}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {plansLoading ? (
            <div className="p-20 text-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-50" />
              <p className="text-muted-foreground animate-pulse">Carregando planos...</p>
            </div>
          ) : plans && plans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paradas</TableHead>
                  <TableHead>Motoristas</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan: Plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.title}</TableCell>
                    <TableCell>{getPlanStatusBadge(plan.status)}</TableCell>
                    <TableCell>{plan.stops_count || 0}</TableCell>
                    <TableCell>
                      {plan.drivers && plan.drivers.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {plan.drivers[0].name || plan.drivers[0].displayName || "Motorista"}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não atribuído</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.starts_at ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{format(new Date(plan.starts_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(plan.starts_at), "HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      ) : (
                        format(new Date(plan.created_at), "dd/MM/yyyy", { locale: ptBR })
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => optimizePlan(plan.id)}
                          disabled={isOptimizing === plan.id || plan.status === 'completed'}
                          className="gap-1"
                        >
                          {isOptimizing === plan.id ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Otimizando...</>
                          ) : (
                            <><Zap className="w-3 h-3" /> Otimizar</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => distributePlan(plan.id)}
                          disabled={isDistributing === plan.id || plan.status === 'completed'}
                          className="gap-1"
                        >
                          {isDistributing === plan.id ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
                          ) : (
                            <><Send className="w-3 h-3" /> Distribuir</>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-24 text-center">
              <MapIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium italic">Nenhum plano encontrado para este período.</p>
              <p className="text-sm text-muted-foreground mt-2">Tente alterar o filtro de período ou crie um novo plano.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Criar Plano */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Plano de Rota</DialogTitle>
            <DialogDescription>
              Selecione os pedidos que deseja incluir na rota e crie um plano no Spoke.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planTitle">Nome do Plano</Label>
                <Input
                  id="planTitle"
                  placeholder="Ex: Rota Centro - 09/03/2026"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planDate">Data da Rota</Label>
                <Input
                  id="planDate"
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                />
              </div>
            </div>

            <div className="border rounded-lg">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Pedidos Disponíveis</Label>
                  <Badge variant="secondary">{availableOrders?.length || 0}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                  Selecionar Todos
                </Button>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto">
                {ordersLoading ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </div>
                ) : availableOrders && availableOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrders.size === availableOrders.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4"
                          />
                        </TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableOrders.map((order) => (
                        <TableRow 
                          key={order.id}
                          className={cn("cursor-pointer hover:bg-gray-50", selectedOrders.has(order.id) && "bg-blue-50")}
                          onClick={() => toggleSelectOne(order.id)}
                        >
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={selectedOrders.has(order.id)}
                              onChange={() => toggleSelectOne(order.id)}
                              className="w-4 h-4"
                            />
                          </TableCell>
                          <TableCell className="font-mono font-bold">#{order.id}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {order.profiles?.first_name} {order.profiles?.last_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {order.profiles?.phone || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{order.shipping_address?.neighborhood}</span>
                              <span className="text-xs text-muted-foreground">
                                {order.shipping_address?.city}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            R$ {order.total_price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum pedido disponível para criar rota.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {selectedOrders.size} pedidos selecionados
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createPlanMutation.mutate()} 
              disabled={isCreating || selectedOrders.size === 0}
              className="gap-2"
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
              ) : (
                <><Plus className="w-4 h-4" /> Criar Plano</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoutePlansPage;