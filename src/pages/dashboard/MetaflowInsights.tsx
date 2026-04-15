import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lightbulb, Package, Target, UserMinus, Plus, ArrowRight,
  Sparkles, Crown, Wallet, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, Clock, BarChart4, AlertOctagon,
  Hourglass, Brain, Calculator, Search,
  Database, Binary, Rocket, ShoppingCart, Users, Activity,
  ChevronRight, Zap, Eye
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

  const { data: insights, isLoading, refetch, isRefetching, isError, error } = useQuery({
    queryKey: ["actionable-insights-final"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/actionable-insights",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM",
            "Authorization": `Bearer ${session?.access_token ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM"}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Erro ${res.status}: ${errText}`);
      }
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      return data;
    },
    refetchInterval: 300000
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleCreateKit = (productA: string, idA: number, productB: string, idB: number) => {
    navigate("/dashboard/promotions", {
      state: {
        suggestedName: `Kit ${productA} + ${productB}`,
        suggestedDescription: `Combo especial contendo ${productA} e ${productB}. Economize levando os dois!`,
        suggestedProductIds: [idA, idB]
      }
    });
  };

  const handleRecoverClient = () => {
    setIsRetentionModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
          <AlertOctagon className="w-10 h-10 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-gray-800">Erro ao carregar insights</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {(error as any)?.message || "Não foi possível conectar ao servidor de análise. Tente novamente."}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const inventoryItems = insights?.inventory || [];
  const outOfStockItems = inventoryItems.filter((item: any) => item.current_stock === 0);
  const lowStockItems = inventoryItems.filter((item: any) => item.current_stock > 0);

  const totalAlerts = inventoryItems.length;
  const churnCount = insights?.churn?.length || 0;
  const crossSellCount = insights?.associations?.length || 0;
  const trendingUpCount = insights?.trends?.up?.length || 0;

  const InventoryItemRow = ({ item }: { item: any }) => {
    const isStagnant = item.status_type === 'stagnant_low';
    const isOut = item.current_stock === 0;

    return (
      <div className={cn(
        "flex items-center justify-between p-3 rounded-xl border transition-all group hover:shadow-sm",
        isOut
          ? "border-red-100 bg-gradient-to-r from-red-50/50 to-transparent"
          : "border-gray-100 bg-gradient-to-r from-orange-50/30 to-transparent"
      )}>
        <div className="overflow-hidden flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate" title={item.name}>{item.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isStagnant ? (
              <span className="flex items-center text-orange-600 gap-1">
                <AlertTriangle className="w-3 h-3" /> Produto parado
              </span>
            ) : (
              `${item.daily_rate} un/dia`
            )}
          </p>
        </div>
        <div className="ml-3 shrink-0">
          {isOut ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-full">
              <AlertOctagon className="w-3 h-3" /> ESGOTADO
            </span>
          ) : isStagnant ? (
            <span className="inline-flex text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
              {item.current_stock} UN
            </span>
          ) : (
            <span className={cn(
              "inline-flex text-[10px] font-bold px-2 py-1 rounded-full",
              item.days_remaining <= 7
                ? "text-red-600 bg-red-100"
                : item.days_remaining <= 15
                  ? "text-orange-600 bg-orange-100"
                  : "text-yellow-700 bg-yellow-100"
            )}>
              {item.days_remaining}d restantes
            </span>
          )}
        </div>
      </div>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color, bg }: any) => (
    <div className={cn("rounded-2xl p-4 border flex items-center gap-4", bg)}>
      <div className={cn("p-2.5 rounded-xl", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Inteligência de Negócio
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise em tempo real do comportamento de vendas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded-xl border-gray-200 text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} />
            Atualizar
          </Button>
          <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-3 py-1.5 rounded-xl border-0">
            <Zap className="w-3 h-3 mr-1" /> IA ATIVA
          </Badge>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={AlertOctagon}
          label="Alertas de Estoque"
          value={totalAlerts}
          color="bg-orange-500"
          bg="bg-orange-50/50 border-orange-100"
        />
        <StatCard
          icon={UserMinus}
          label="Clientes em Risco"
          value={churnCount}
          color="bg-rose-500"
          bg="bg-rose-50/50 border-rose-100"
        />
        <StatCard
          icon={ShoppingCart}
          label="Combos Sugeridos"
          value={crossSellCount}
          color="bg-blue-500"
          bg="bg-blue-50/50 border-blue-100"
        />
        <StatCard
          icon={TrendingUp}
          label="Produtos em Alta"
          value={trendingUpCount}
          color="bg-green-500"
          bg="bg-green-50/50 border-green-100"
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* COLUNA 1: ESTOQUE */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden flex flex-col">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 rounded-xl border border-orange-100">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-800">Alertas de Estoque</CardTitle>
                  <CardDescription className="text-xs">Ruptura e previsão de demanda</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 font-bold text-[10px] rounded-full">
                {totalAlerts} itens
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <Tabs defaultValue="esgotados" className="w-full">
              <div className="px-5 mb-3">
                <TabsList className="w-full grid grid-cols-2 bg-gray-100 p-1 rounded-xl h-9">
                  <TabsTrigger value="esgotados" className="text-[11px] font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">
                    <AlertOctagon className="w-3 h-3 mr-1" /> Esgotados ({outOfStockItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="previsao" className="text-[11px] font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm">
                    <Hourglass className="w-3 h-3 mr-1" /> Baixo ({lowStockItems.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="px-5 pb-5 space-y-2 max-h-[360px] overflow-y-auto">
                <TabsContent value="esgotados" className="space-y-2 mt-0">
                  {outOfStockItems.length > 0 ? (
                    outOfStockItems.map((item: any, i: number) => <InventoryItemRow key={i} item={item} />)
                  ) : (
                    <div className="py-12 flex flex-col items-center text-center opacity-60">
                      <div className="p-4 bg-green-50 rounded-2xl mb-3">
                        <Package className="w-8 h-8 text-green-500" />
                      </div>
                      <p className="text-sm font-bold text-gray-600">Nenhum produto esgotado!</p>
                      <p className="text-xs text-gray-400 mt-1">Estoque saudável ✓</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="previsao" className="space-y-2 mt-0">
                  {lowStockItems.length > 0 ? (
                    lowStockItems.map((item: any, i: number) => <InventoryItemRow key={i} item={item} />)
                  ) : (
                    <div className="py-12 flex flex-col items-center text-center opacity-60">
                      <div className="p-4 bg-gray-50 rounded-2xl mb-3">
                        <Clock className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-600">Sem previsões de ruptura</p>
                      <p className="text-xs text-gray-400 mt-1">Produtos com estoque para +45 dias</p>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* COLUNA 2: CROSS-SELL */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden flex flex-col">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-800">Combos Sugeridos</CardTitle>
                  <CardDescription className="text-xs">Produtos comprados juntos</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-bold text-[10px] rounded-full">
                Cross-sell
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 max-h-[400px] overflow-y-auto">
            {insights?.associations?.length > 0 ? (
              insights.associations.map((pair: any, i: number) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-blue-900 truncate" title={pair.product_a}>{pair.product_a}</p>
                    </div>
                    <div className="shrink-0 p-1 bg-blue-100 rounded-full">
                      <Plus className="w-2.5 h-2.5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-blue-900 truncate" title={pair.product_b}>{pair.product_b}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">
                      {pair.frequency}x juntos
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] px-2 font-bold text-blue-700 hover:bg-blue-100 rounded-lg"
                      onClick={() => handleCreateKit(pair.product_a, pair.product_a_id, pair.product_b, pair.product_b_id)}
                    >
                      Criar Kit <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center text-center opacity-60">
                <div className="p-4 bg-blue-50 rounded-2xl mb-3">
                  <ShoppingCart className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-sm font-bold text-gray-600">Aguardando dados</p>
                <p className="text-xs text-gray-400 mt-1">Mais vendas geram sugestões melhores</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COLUNA 3: RETENÇÃO */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden flex flex-col">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-500" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                  <UserMinus className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-800">Clientes Sumidos</CardTitle>
                  <CardDescription className="text-xs">Sem compras há mais de 30 dias</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 font-bold text-[10px] rounded-full">
                {churnCount} clientes
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 max-h-[400px] overflow-y-auto">
            {insights?.churn?.length > 0 ? (
              insights.churn.map((client: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50/40 to-transparent hover:border-rose-200 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-rose-600">
                        {client.customer_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{client.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">{client.total_orders} compras no histórico</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[11px] font-black text-rose-600">{client.days_since_last_order}d</p>
                    <Button
                      variant="link"
                      className="h-4 p-0 text-[10px] text-blue-600 font-bold"
                      onClick={() => handleRecoverClient()}
                    >
                      Recuperar
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center text-center opacity-60">
                <div className="p-4 bg-green-50 rounded-2xl mb-3">
                  <Users className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-sm font-bold text-gray-600">Clientes ativos!</p>
                <p className="text-xs text-gray-400 mt-1">Nenhum cliente sumido no momento</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEGUNDA LINHA: HORÁRIOS + MOMENTUM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Horários de Pico */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 rounded-xl border border-purple-100">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-800">Horários de Pico</CardTitle>
                <CardDescription className="text-xs">Volume de pedidos por hora (últimos 30 dias)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 h-[260px]">
            {insights?.peak_hours ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.peak_hours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6', radius: 4 }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 20px -2px rgb(0 0 0 / 0.15)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                    formatter={(value: any) => [`${value} pedidos`, 'Volume']}
                  />
                  <Bar dataKey="orders" radius={[6, 6, 0, 0]} barSize={16}>
                    {insights.peak_hours.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.orders > 5 ? "#7c3aed" : entry.orders > 2 ? "#a78bfa" : "#ede9fe"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center opacity-50">
                  <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sem dados suficientes</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Momentum */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/50 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-50 rounded-xl border border-teal-100">
                <BarChart4 className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-800">Momentum de Vendas</CardTitle>
                <CardDescription className="text-xs">Variação: últimos 7 dias vs semana anterior</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="p-1 bg-green-100 rounded-lg">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-xs font-black text-green-700 uppercase tracking-wide">Em Alta</span>
              </div>
              <div className="space-y-2">
                {insights?.trends?.up?.length > 0 ? (
                  insights.trends.up.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-green-50 last:border-0">
                      <span className="text-xs font-medium text-gray-700 truncate flex-1" title={item.name}>{item.name}</span>
                      <span className="text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">
                        +{item.growth.toFixed(0)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic py-4 text-center">Nenhum produto disparou</p>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="p-1 bg-red-100 rounded-lg">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span className="text-xs font-black text-red-700 uppercase tracking-wide">Esfriando</span>
              </div>
              <div className="space-y-2">
                {insights?.trends?.down?.length > 0 ? (
                  insights.trends.down.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-red-50 last:border-0">
                      <span className="text-xs font-medium text-gray-700 truncate flex-1" title={item.name}>{item.name}</span>
                      <span className="text-[10px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">
                        {item.growth.toFixed(0)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic py-4 text-center">Nenhuma queda detectada</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TERCEIRA LINHA: VIPs + LUCRATIVIDADE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Clientes VIP */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gradient-to-r from-yellow-50/50 to-amber-50/30 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-yellow-100 rounded-xl border border-yellow-200">
                <Crown className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-800">Top Clientes VIP</CardTitle>
                <CardDescription className="text-xs">Maiores saldos de pontos acumulados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {insights?.vips?.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {insights.vips.map((vip: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                      i === 0 ? "bg-yellow-100 text-yellow-700" :
                        i === 1 ? "bg-gray-100 text-gray-600" :
                          i === 2 ? "bg-orange-100 text-orange-600" :
                            "bg-blue-50 text-blue-500"
                    )}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {vip.first_name} {vip.last_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Cliente Fidelidade</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-blue-700">{vip.points?.toLocaleString('pt-BR')} pts</p>
                      <p className="text-[10px] text-gray-400">saldo</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center text-center opacity-60">
                <Crown className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Sem dados de clientes VIP</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lucratividade por Marca */}
        <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gradient-to-r from-green-50/50 to-emerald-50/30 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-green-100 rounded-xl border border-green-200">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-800">Marcas Mais Lucrativas</CardTitle>
                <CardDescription className="text-xs">Margem bruta estimada (últimos 30 dias)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {insights?.profitability?.length > 0 ? (
              insights.profitability.map((brand: any, i: number) => {
                const maxVal = insights.profitability[0]?.value || 1;
                const pct = Math.round((brand.value / maxVal) * 100);
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">{brand.name || 'Sem Marca'}</span>
                      <span className="text-sm font-black text-green-700">{formatCurrency(brand.value)}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">{pct}% do top</p>
                  </div>
                );
              })
            ) : (
              <div className="py-12 flex flex-col items-center text-center opacity-60">
                <Wallet className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Sem dados de lucratividade</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PIPELINE EDUCATIVO */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-5">
          <Brain className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Como funciona o pipeline de dados?</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { n: 1, icon: Database, color: "text-slate-600", bg: "bg-slate-50 border-slate-100", title: "Coleta", desc: "Cada venda, cliente e estoque é registrado automaticamente." },
            { n: 2, icon: Binary, color: "text-blue-600", bg: "bg-blue-50 border-blue-100", title: "Processamento", desc: "O sistema varre milhões de linhas em segundos." },
            { n: 3, icon: Calculator, color: "text-purple-600", bg: "bg-purple-50 border-purple-100", title: "Análise", desc: "Algoritmos calculam médias, tendências e frequências." },
            { n: 4, icon: Search, color: "text-orange-600", bg: "bg-orange-50 border-orange-100", title: "Detecção", desc: "Padrões são identificados: quem sumiu, o que combina." },
            { n: 5, icon: Lightbulb, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100", title: "Insight", desc: "Dados brutos viram sugestões acionáveis." },
            { n: 6, icon: Rocket, color: "text-green-600", bg: "bg-green-50 border-green-100", title: "Resultado", desc: "Você age com precisão e gera mais lucro." },
          ].map(({ n, icon: Icon, color, bg, title, desc }) => (
            <div key={n} className={cn("relative p-4 rounded-2xl border text-center hover:shadow-md transition-all group", bg)}>
              <div className="absolute top-2 right-2.5 text-[10px] font-black opacity-20 text-gray-400">#{n}</div>
              <div className={cn("inline-flex p-2.5 rounded-xl mb-3 transition-transform group-hover:scale-110", bg)}>
                <Icon className={cn("w-5 h-5", color)} />
              </div>
              <h4 className="font-bold text-slate-800 text-xs mb-1">{title}</h4>
              <p className="text-[10px] text-slate-500 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <RetentionCampaignModal isOpen={isRetentionModalOpen} onClose={() => setIsRetentionModalOpen(false)} />
    </div>
  );
};

export default MetaflowInsightsPage;