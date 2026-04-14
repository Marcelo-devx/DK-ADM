"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import { 
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign,
  Target, Zap, Map as MapIcon, Calendar, CheckCircle2,
  ShoppingCart, RefreshCw, AlertCircle, CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b", "#ec4899", "#14b8a6"];

const PERIODS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "24m", label: "Últimos 24 meses" },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatPeriodLabel = (period: string) =>
  PERIODS.find(p => p.value === period)?.label ?? period;

// --- KPI Card ---
const KpiCard = ({ title, value, sub, icon: Icon, trend, color = "blue" }: {
  title: string;
  value: string;
  sub?: string;
  icon: any;
  trend?: { value: number; label: string };
  color?: string;
}) => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className="shadow-sm border bg-white">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg", colorMap[color] || colorMap.blue)}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold",
                trend.value >= 0
                  ? "text-green-600 border-green-200 bg-green-50"
                  : "text-red-600 border-red-200 bg-red-50"
              )}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {Math.abs(trend.value).toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-gray-400 tracking-widest">{title}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

// --- Loading Skeleton ---
const AnalyticsSkeleton = () => (
  <div className="space-y-6 p-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-48" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="h-80 lg:col-span-2" />
      <Skeleton className="h-80" />
    </div>
  </div>
);

// --- Empty State ---
const EmptyChart = ({ message = "Sem dados para o período selecionado" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-12">
    <BarChart3 className="w-10 h-10 text-gray-200 mb-3" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

const AnalyticsPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("12m");

  const { data: bi, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["bi-data-premium", selectedPeriod],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("analytics-bi", {
        body: { period: selectedPeriod },
      });
      if (error) throw new Error(error.message || "Erro ao carregar analytics");
      if (!data) throw new Error("Nenhum dado retornado");
      return data;
    },
    retry: 2,
    refetchInterval: 300000,
  });

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError) {
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar os dados de analytics: {(error as Error)?.message || "Erro desconhecido"}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const summary = bi?.summary || {
    totalRevenue: 0,
    totalOrders: 0,
    approvedOrders: 0,
    approvalRate: 0,
    avgTicket: 0,
    newUsers: 0,
    recurringUsers: 0,
  };

  const monthly = bi?.monthly || [];
  const demographics = bi?.demographics || {
    gender: [],
    regions: [],
    retention: [],
    paymentMethods: [],
  };

  const hasMonthlyData = monthly.some((m: any) => m.orders > 0);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" /> Inteligência de Negócio
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Dados reais processados — {formatPeriodLabel(selectedPeriod)}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border shadow-sm px-4">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px] border-0 focus:ring-0 text-sm font-bold text-gray-600 bg-transparent p-0 h-auto">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFetching && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Faturamento Total"
          value={formatCurrency(summary.totalRevenue)}
          sub={`${summary.totalOrders} pedidos no período`}
          icon={DollarSign}
          color="blue"
        />
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(summary.avgTicket)}
          sub="Valor médio por pedido"
          icon={Target}
          color="green"
        />
        <KpiCard
          title="Taxa de Aprovação"
          value={`${summary.approvalRate.toFixed(1)}%`}
          sub={`${summary.approvedOrders} de ${summary.totalOrders} pedidos`}
          icon={CheckCircle2}
          color="amber"
        />
        <KpiCard
          title="Clientes Recorrentes"
          value={summary.recurringUsers.toString()}
          sub={`${summary.newUsers} novos no período`}
          icon={Users}
          color="purple"
        />
      </div>

      <Tabs defaultValue="vendas" className="space-y-6">
        <TabsList className="bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="vendas" className="rounded-lg font-bold px-6">
            Performance de Vendas
          </TabsTrigger>
          <TabsTrigger value="clientes" className="rounded-lg font-bold px-6">
            Comportamento do Cliente
          </TabsTrigger>
          <TabsTrigger value="logistica" className="rounded-lg font-bold px-6">
            Logística & Região
          </TabsTrigger>
        </TabsList>

        {/* ABA VENDAS */}
        <TabsContent value="vendas" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg">
                  Faturamento — {formatPeriodLabel(selectedPeriod)}
                </CardTitle>
                <CardDescription>Evolução da receita no período selecionado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  {hasMonthlyData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          cursor={{ fill: "#f8fafc" }}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg">Taxa de Aprovação</CardTitle>
                <CardDescription>% de pedidos convertidos em venda real.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  {hasMonthlyData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthly}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Aprovação"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="approved_rate"
                          stroke="#10b981"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorRate)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </div>
                <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-xs font-bold text-green-700 uppercase">Taxa Atual</p>
                  <p className="text-2xl font-black text-green-700 mt-1">
                    {summary.approvalRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {summary.approvedOrders} pedidos aprovados de {summary.totalOrders} total
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pedidos por período */}
          <Card className="shadow-md border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" /> Volume de Pedidos
              </CardTitle>
              <CardDescription>Quantidade de pedidos no período.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {hasMonthlyData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fontWeight: 700 }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        contentStyle={{ borderRadius: "12px", border: "none" }}
                        formatter={(value: number) => [value, "Pedidos"]}
                      />
                      <Bar dataKey="orders" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={35} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA CLIENTES */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Fidelização */}
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-base">Fidelização de Clientes</CardTitle>
                <CardDescription>Novos vs. recorrentes no período.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {demographics.retention.some((r: any) => r.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={demographics.retention}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {demographics.retention.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "Clientes"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart message="Sem dados de clientes no período" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Gênero */}
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-base">Perfil por Gênero</CardTitle>
                <CardDescription>Distribuição dos clientes cadastrados.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {demographics.gender.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={demographics.gender}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {demographics.gender.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "Clientes"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart message="Dados de gênero não informados" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sugestão de IA */}
            <Card className="bg-[#0B1221] text-white shadow-xl border-none p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter">Sugestão de IA</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {summary.recurringUsers > 0 && summary.newUsers > 0
                    ? `Você tem ${summary.recurringUsers} clientes recorrentes e ${summary.newUsers} novos. `
                    : ""}
                  Sua taxa de recorrência pode ser otimizada.{" "}
                  <strong>Ação sugerida:</strong> Criar um cupom de 10% OFF exclusivo para clientes
                  que não compram há mais de 30 dias.
                </p>
              </div>
              <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 font-bold h-12 uppercase text-xs">
                Ativar Campanha
              </Button>
            </Card>
          </div>

          {/* Métodos de Pagamento */}
          {demographics.paymentMethods.length > 0 && (
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" /> Métodos de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demographics.paymentMethods} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fontWeight: 700 }}
                        width={80}
                      />
                      <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v: number) => [v, "Pedidos"]} />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA LOGÍSTICA */}
        <TabsContent value="logistica" className="space-y-6">
          <Card className="shadow-md border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-blue-600" /> Distribuição por Região (Top Estados)
              </CardTitle>
              <CardDescription>
                Baseado nos endereços de entrega dos pedidos no período.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                {demographics.regions.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={demographics.regions}
                      layout="vertical"
                      margin={{ left: 50 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fontWeight: 700 }}
                      />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        formatter={(v: number) => [v, "Pedidos"]}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Sem dados de região disponíveis" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
