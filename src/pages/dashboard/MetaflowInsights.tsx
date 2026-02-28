"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  Package,
  Target,
  UserMinus,
  Plus,
  ArrowRight,
  Sparkles,
  Crown,
  Wallet,
  Zap,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart4,
  AlertOctagon,
  Hourglass,
  Brain,
  Calculator,
  Database,
  Binary,
  Rocket,
  Search,
  Link2,
  Webhook,
  Activity,
  Copy,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { RetentionCampaignModal } from "@/components/dashboard/RetentionCampaignModal";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MetaflowInsightsPage = () => {
  const navigate = useNavigate();
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);

  const { data: insights, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["actionable-insights-final"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("actionable-insights");
      if (error) throw error;
      return data;
    },
    refetchInterval: 300000,
  });

  const { data: webhookConfigs = [] } = useQuery({
    queryKey: ["bi-webhook-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configs")
        .select("trigger_event, target_url, is_active")
        .in("trigger_event", ["order_paid", "order_shipped", "order_delivered", "retention_campaign"]);

      // Não derruba a página se a tabela ainda não existir/estiver bloqueada.
      if (error) return [];
      return data || [];
    },
    refetchInterval: 300000,
  });

  const { data: integrationLogs = [] } = useQuery({
    queryKey: ["bi-integration-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_logs")
        .select("event_type, status, response_code, created_at, details")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) return [];
      return data || [];
    },
    refetchInterval: 300000,
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleCreateKit = (productA: string, idA: number, productB: string, idB: number) => {
    navigate("/dashboard/promotions", {
      state: {
        suggestedName: `Kit ${productA} + ${productB}`,
        suggestedDescription: `Combo especial contendo ${productA} e ${productB}. Economize levando os dois!`,
        suggestedProductIds: [idA, idB],
      },
    });
  };

  const handleRecoverClient = (_clientName?: string) => {
    setIsRetentionModalOpen(true);
  };

  const expectedAutomations = useMemo(
    () =>
      [
        {
          event: "order_paid",
          label: "Pedido pago",
          hint: "Dispara quando o pedido muda para Pago",
        },
        {
          event: "order_shipped",
          label: "Pedido enviado",
          hint: "Dispara quando o pedido muda para Enviado",
        },
        {
          event: "order_delivered",
          label: "Pedido entregue",
          hint: "Dispara quando o pedido muda para Entregue/Finalizada",
        },
        {
          event: "retention_campaign",
          label: "Campanha retenção",
          hint: "Dispara ao enviar mensagens para clientes inativos",
        },
      ] as const,
    []
  );

  const automationStatus = useMemo(() => {
    const map = new Map<string, { activeCount: number; targets: string[] }>();
    expectedAutomations.forEach((a) => map.set(a.event, { activeCount: 0, targets: [] }));

    (webhookConfigs as any[]).forEach((w) => {
      if (!map.has(w.trigger_event)) return;
      const entry = map.get(w.trigger_event)!;
      if (w.is_active) entry.activeCount += 1;
      if (w.target_url) entry.targets.push(w.target_url);
    });

    return map;
  }, [webhookConfigs, expectedAutomations]);

  const executiveSummary = useMemo(() => {
    const inventoryItems = (insights?.inventory || []) as any[];
    const outOfStockCount = inventoryItems.filter((i) => Number(i.current_stock) === 0).length;
    const lowStockCount = inventoryItems.filter((i) => Number(i.current_stock) > 0).length;
    const churnCount = (insights?.churn || []).length;
    const kitOppCount = (insights?.associations || []).length;

    return { outOfStockCount, lowStockCount, churnCount, kitOppCount };
  }, [insights]);

  const handleCopySummary = async () => {
    const lines: string[] = [];
    lines.push("Inteligência de Negócio — Resumo rápido");
    lines.push(`• Esgotados: ${executiveSummary.outOfStockCount}`);
    lines.push(`• Baixo estoque: ${executiveSummary.lowStockCount}`);
    lines.push(`• Clientes sumidos: ${executiveSummary.churnCount}`);
    lines.push(`• Oportunidades de kits: ${executiveSummary.kitOppCount}`);
    lines.push("");
    lines.push("Automação (webhooks ativos):");

    expectedAutomations.forEach((a) => {
      const st = automationStatus.get(a.event);
      lines.push(`• ${a.label}: ${st?.activeCount ? "ATIVO" : "INATIVO"}`);
    });

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // silêncio: clipboard pode falhar em alguns contextos
    }
  };

  if (isLoading)
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );

  // Separação dos itens de inventário
  const inventoryItems = insights?.inventory || [];
  const outOfStockItems = inventoryItems.filter((item: any) => item.current_stock === 0);
  const lowStockItems = inventoryItems.filter((item: any) => item.current_stock > 0);

  // Componente auxiliar para renderizar item de estoque
  const InventoryItemRow = ({ item }: { item: any }) => {
    const isStagnant = item.status_type === 'stagnant_low';
    const isOut = item.current_stock === 0;

    return (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-xl border transition-colors group",
            isOut ? "border-red-100 bg-red-50/30 hover:bg-red-50" : "border-gray-100 bg-gray-50/50 hover:bg-gray-50"
        )}>
            <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-800 truncate w-32 md:w-40" title={item.name}>{item.name}</p>
                <p className="text-[11px] text-muted-foreground font-medium">
                    {isStagnant ? (
                        <span className="flex items-center text-orange-600 gap-1"><AlertTriangle className="w-3 h-3" /> Parado (Baixo)</span>
                    ) : (
                        `${item.daily_rate} vendas / dia`
                    )}
                </p>
            </div>
            <div className="text-right">
                {isOut ? (
                    <Badge variant="destructive" className="text-[10px] font-black h-5 px-2">
                        ESGOTADO
                    </Badge>
                ) : isStagnant ? (
                    <Badge variant="outline" className="text-[10px] font-black text-orange-600 border-orange-200 bg-orange-50">
                        {item.current_stock} UN RESTANTES
                    </Badge>
                ) : (
                    <Badge variant="outline" className={cn("text-[10px] font-black border-orange-200 text-orange-600 bg-white")}>
                        ACABA EM {item.days_remaining}D
                    </Badge>
                )}
            </div>
        </div>
    );
  };

  // Componente para os Steps
  const InsightStep = ({ number, icon: Icon, title, desc, color }: any) => (
    <div className="relative flex flex-col items-center text-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
        <div className={cn("absolute top-2 right-2 text-[10px] font-black opacity-20", color)}>#{number}</div>
        <div className={cn("p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110", color.replace('text-', 'bg-').replace('600', '100'))}>
            <Icon className={cn("w-6 h-6", color)} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">{title}</h4>
        <p className="text-xs text-slate-500 leading-snug">{desc}</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER INTEGRADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" /> Inteligência de Negócio
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Recomendações geradas a partir do comportamento de vendas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="font-bold"
            title="Copia um resumo rápido para colar no WhatsApp/Notion"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar resumo
          </Button>
          <Badge className="bg-blue-600 text-white font-bold px-3 py-1">IA ATIVA</Badge>
          <Badge variant="outline" className="text-gray-500 font-bold px-3 py-1">
            v3.1
          </Badge>
        </div>
      </div>

      {/* NOVO: RESUMO EXECUTIVO (sem alterar o que já existe) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Esgotados</p>
              <p className="text-2xl font-black text-red-600">{executiveSummary.outOfStockCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Baixo estoque</p>
              <p className="text-2xl font-black text-orange-600">{executiveSummary.lowStockCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <Hourglass className="w-5 h-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Clientes sumidos</p>
              <p className="text-2xl font-black text-rose-600">{executiveSummary.churnCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              <UserMinus className="w-5 h-5 text-rose-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Kits sugeridos</p>
              <p className="text-2xl font-black text-blue-600">{executiveSummary.kitOppCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUNA 1: REPOSIÇÃO (COM ABAS) */}
        <Card className="border-none shadow-md bg-white flex flex-col h-full overflow-hidden">
            <div className="h-1 bg-orange-500" />
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600 border border-orange-100"><Package className="w-6 h-6" /></div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 font-bold rounded-full px-3">Reposição</Badge>
                </div>
                <CardTitle className="pt-4 text-xl font-bold text-gray-800">Alertas de Estoque</CardTitle>
                <CardDescription className="text-gray-500">Gestão de ruptura e previsão de demanda.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                <Tabs defaultValue="esgotados" className="w-full flex flex-col h-full">
                    <div className="px-6 mb-2">
                        <TabsList className="w-full grid grid-cols-2 bg-gray-100/80 p-1">
                            <TabsTrigger value="esgotados" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">
                                <AlertOctagon className="w-3 h-3 mr-1.5" /> Esgotados ({outOfStockItems.length})
                            </TabsTrigger>
                            <TabsTrigger value="previsao" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm">
                                <Hourglass className="w-3 h-3 mr-1.5" /> Baixo ({lowStockItems.length})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 px-6 pb-6 overflow-y-auto max-h-[400px] min-h-[300px]">
                        <TabsContent value="esgotados" className="space-y-3 mt-2 data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-left-2">
                            {outOfStockItems.length > 0 ? (
                                outOfStockItems.map((item: any, i: number) => <InventoryItemRow key={i} item={item} />)
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-60">
                                    <Package className="w-12 h-12 text-green-500 mb-2" />
                                    <p className="text-sm font-bold text-gray-600">Nenhum produto esgotado!</p>
                                    <p className="text-xs text-gray-400">Seu estoque está saudável.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="previsao" className="space-y-3 mt-2 data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-right-2">
                            {lowStockItems.length > 0 ? (
                                lowStockItems.map((item: any, i: number) => <InventoryItemRow key={i} item={item} />)
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-60">
                                    <Clock className="w-12 h-12 text-gray-300 mb-2" />
                                    <p className="text-sm font-bold text-gray-600">Sem previsões de ruptura.</p>
                                    <p className="text-xs text-gray-400">Os produtos ativos têm estoque suficiente para +45 dias.</p>
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>

        {/* COLUNA 2: CROSS-SELL */}
        <Card className="border-none shadow-md bg-white flex flex-col h-full">
            <div className="h-1 bg-blue-500 rounded-t-lg" />
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100"><Target className="w-6 h-6" /></div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-bold rounded-full px-3">Cross-sell</Badge>
                </div>
                <CardTitle className="pt-6 text-xl font-bold text-gray-800">Produtos Sugeridos</CardTitle>
                <CardDescription className="text-gray-500">Itens que os clientes mais compram juntos.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
                {insights?.associations?.length > 0 ? (
                    insights.associations.map((pair: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-blue-50/20 border border-blue-100 hover:border-blue-300 transition-all group">
                            <div className="flex items-center gap-2 text-[12px] font-bold text-blue-900 leading-tight">
                                <span className="truncate flex-1" title={pair.product_a}>{pair.product_a}</span>
                                <Plus className="w-3 h-3 shrink-0 text-blue-400" />
                                <span className="truncate flex-1" title={pair.product_b}>{pair.product_b}</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-blue-100 pt-3">
                                <span className="text-[11px] text-blue-600 font-bold">{pair.frequency} pedidos em comum</span>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 text-[11px] p-0 font-black text-blue-700 hover:bg-transparent"
                                    onClick={() => handleCreateKit(pair.product_a, pair.product_a_id, pair.product_b, pair.product_b_id)}
                                >
                                    Criar Kit <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-sm text-muted-foreground italic">Aguardando mais dados de vendas.</p>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* COLUNA 3: RETENÇÃO */}
        <Card className="border-none shadow-md bg-white flex flex-col h-full">
            <div className="h-1 bg-rose-500 rounded-t-lg" />
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 border border-rose-100"><UserMinus className="w-6 h-6" /></div>
                    <Badge variant="secondary" className="bg-rose-100 text-rose-700 font-bold rounded-full px-3">Retenção</Badge>
                </div>
                <CardTitle className="pt-6 text-xl font-bold text-gray-800">Clientes Sumidos</CardTitle>
                <CardDescription className="text-gray-500">Clientes frequentes que não compram há {'>'} 30 dias.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                {insights?.churn?.length > 0 ? (
                    insights.churn.map((client: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/10 hover:bg-rose-50 transition-colors group">
                            <div>
                                <p className="text-sm font-black text-gray-800">{client.customer_name}</p>
                                <p className="text-[11px] text-muted-foreground font-bold uppercase">{client.total_orders} compras na história</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-black text-rose-600 uppercase tracking-tighter">{client.days_since_last_order} dias ausente</p>
                                <Button 
                                    variant="link" 
                                    className="h-5 p-0 text-[10px] text-blue-600 font-black uppercase"
                                    onClick={() => handleRecoverClient(client.customer_name)}
                                >
                                    Recuperar
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-sm text-muted-foreground italic">Tudo em dia! Seus clientes estão ativos.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      {/* NOVA SEÇÃO: MOMENTUM E HORÁRIOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        
        {/* Gráfico de Horários de Pico */}
        <Card className="border-none shadow-md bg-white">
            <CardHeader className="border-b bg-gray-50/50">
                <CardTitle className="text-lg font-black uppercase text-gray-700 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" /> Horários de Pico (Últimos 30 Dias)
                </CardTitle>
                <CardDescription>Volume de pedidos por hora do dia.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 h-[300px]">
                {insights?.peak_hours ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insights.peak_hours}>
                            <XAxis dataKey="hour" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20}>
                                {insights.peak_hours.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.orders > 5 ? "#7c3aed" : "#c4b5fd"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados suficientes.</div>
                )}
            </CardContent>
        </Card>

        {/* Listas de Trending */}
        <Card className="border-none shadow-md bg-white">
            <CardHeader className="border-b bg-gray-50/50">
                <CardTitle className="text-lg font-black uppercase text-gray-700 flex items-center gap-2">
                    <BarChart4 className="w-5 h-5 text-teal-600" /> Momentum de Vendas
                </CardTitle>
                <CardDescription>Variação de vendas nos últimos 7 dias vs semana anterior.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Em Alta */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-green-700 flex items-center gap-1 mb-2">
                        <TrendingUp className="w-4 h-4" /> Em Alta (Trending)
                    </h4>
                    {insights?.trends?.up?.length > 0 ? (
                        insights.trends.up.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-green-100 pb-2 last:border-0">
                                <span className="font-medium truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                <Badge className="bg-green-100 text-green-800 border-none font-bold">+{item.growth.toFixed(0)}%</Badge>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhum produto disparou recentemente.</p>
                    )}
                </div>

                {/* Esfriando */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-red-700 flex items-center gap-1 mb-2">
                        <TrendingDown className="w-4 h-4" /> Esfriando (Cooling)
                    </h4>
                    {insights?.trends?.down?.length > 0 ? (
                        insights.trends.down.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-red-100 pb-2 last:border-0">
                                <span className="font-medium truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 font-bold">{item.growth.toFixed(0)}%</Badge>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhuma queda brusca detectada.</p>
                    )}
                </div>

            </CardContent>
        </Card>
      </div>

      {/* DASHBOARD DE LTV E MARGEM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* RANKING VIP */}
            <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b bg-gray-50/50">
                    <CardTitle className="text-sm font-black uppercase text-gray-500 flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-600" /> Top Clientes por Faturamento (LTV)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {insights?.vips?.map((vip: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">#{i+1}</div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900">{vip.first_name} {vip.last_name}</p>
                                        <p className="text-[11px] text-muted-foreground font-bold uppercase">Cliente Fidelidade</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-blue-700">{vip.points} pts</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Saldo Acumulado</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* LUCRATIVIDADE POR MARCA */}
            <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b bg-gray-50/50">
                    <CardTitle className="text-sm font-black uppercase text-gray-500 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-green-600" /> Marcas Mais Lucrativas (Margem Bruta)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    {insights?.profitability?.map((brand: any, i: number) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between text-xs font-black uppercase text-gray-700">
                                <span>{brand.name || 'Sem Marca'}</span>
                                <span className="text-green-600">{formatCurrency(brand.value)} <span className="text-[10px] text-muted-foreground font-normal">lucro est.</span></span>
                            </div>
                            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden border border-gray-200">
                                <div 
                                    className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-1000" 
                                    style={{ width: `${(brand.value / (insights.profitability[0]?.value || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
      </div>

      {/* SEÇÃO EDUCATIVA VISUAL - FLUXO DE DADOS */}
      <div className="mt-12 mb-8">
        <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-6">
            <Brain className="w-5 h-5" /> Pipeline de Dados: Como funciona?
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <InsightStep 
                number="1" 
                icon={Database} 
                color="text-slate-600" 
                title="Coleta" 
                desc="O banco de dados registra cada venda, cliente e estoque." 
            />
            <InsightStep 
                number="2" 
                icon={Binary} 
                color="text-blue-600" 
                title="Processamento" 
                desc="O código varre milhões de linhas em segundos." 
            />
            <InsightStep 
                number="3" 
                icon={Calculator} 
                color="text-purple-600" 
                title="Análise" 
                desc="Algoritmos calculam médias, tendências e frequências." 
            />
            <InsightStep 
                number="4" 
                icon={Search} 
                color="text-orange-600" 
                title="Detecção" 
                desc="Identificação de padrões: quem sumiu, o que combina." 
            />
            <InsightStep 
                number="5" 
                icon={Lightbulb} 
                color="text-yellow-600" 
                title="Insight" 
                desc="Transformação de dados brutos em sugestões úteis." 
            />
            <InsightStep 
                number="6" 
                icon={Rocket} 
                color="text-green-600" 
                title="Resultado" 
                desc="Você toma a ação correta e gera mais lucro." 
            />
        </div>
      </div>

      {/* NOVO: SAÚDE DA AUTOMAÇÃO (N8N/Webhooks) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-sm font-black uppercase text-gray-600 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-pink-600" /> Automações (Webhooks)
            </CardTitle>
            <CardDescription>
              Checagem rápida do que está ativo para disparar eventos para o N8N.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {expectedAutomations.map((a) => {
              const st = automationStatus.get(a.event);
              const isActive = (st?.activeCount || 0) > 0;
              const firstTarget = st?.targets?.[0];

              return (
                <div
                  key={a.event}
                  className={cn(
                    "flex items-center justify-between gap-4 p-3 rounded-xl border",
                    isActive ? "border-green-100 bg-green-50/30" : "border-gray-100 bg-gray-50/50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{a.hint}</p>
                    {firstTarget ? (
                      <p className="text-[11px] text-blue-700 font-bold truncate flex items-center gap-1 mt-1">
                        <Link2 className="w-3 h-3" />
                        {firstTarget}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isActive ? "outline" : "secondary"}
                      className={cn(
                        "text-[10px] font-black",
                        isActive
                          ? "text-green-700 border-green-200 bg-green-50"
                          : "text-gray-600 bg-gray-100"
                      )}
                    >
                      {isActive ? "ATIVO" : "INATIVO"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-black text-[11px]"
                      onClick={() => navigate("/dashboard/incoming-webhooks")}
                    >
                      Gerenciar
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full font-black"
                onClick={() => navigate("/dashboard/n8n-integration")}
              >
                <Zap className="w-4 h-4 mr-2" />
                Abrir Automação (N8N)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-sm font-black uppercase text-gray-600 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-700" /> Últimas execuções
            </CardTitle>
            <CardDescription>
              Log recente de disparos/retornos (bom para diagnosticar se "está indo").
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {integrationLogs.length > 0 ? (
              <div className="space-y-3">
                {(integrationLogs as any[]).map((l, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-800 truncate">{l.event_type}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </p>
                      {l.details ? (
                        <p className="text-[11px] text-gray-500 truncate">{l.details}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-black",
                          l.status === "success"
                            ? "text-green-700 border-green-200 bg-green-50"
                            : "text-red-700 border-red-200 bg-red-50"
                        )}
                      >
                        {String(l.status || "-").toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-black">
                        {l.response_code ?? "-"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-center text-muted-foreground">
                <Activity className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm font-bold">Sem logs ainda.</p>
                <p className="text-xs">Quando um webhook disparar, ele aparece aqui.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RetentionCampaignModal isOpen={isRetentionModalOpen} onClose={() => setIsRetentionModalOpen(false)} />
    </div>
  );
};

export default MetaflowInsightsPage;