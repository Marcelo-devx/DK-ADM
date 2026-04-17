"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line, ComposedChart,
} from "recharts";
import {
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Target,
  MapPin, Calendar, CheckCircle2, ShoppingCart, RefreshCw,
  AlertCircle, Package, Tag, Clock, Truck, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const C = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#64748b","#ec4899","#14b8a6","#f97316","#06b6d4"];

const PERIODS = [
  { value: "7d",  label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "6m",  label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "24m", label: "Últimos 24 meses" },
];

const R = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const pct = (v: number) => `${(v ?? 0).toFixed(1)}%`;

const tooltipStyle = {
  borderRadius: "10px",
  border: "none",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  fontSize: 12,
};

const EmptyChart = ({ msg = "Sem dados para o período" }: { msg?: string }) => (
  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
    <BarChart3 className="w-8 h-8 text-gray-200" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

const KpiCard = ({
  title, value, sub, icon: Icon, color = "blue", delta,
}: {
  title: string; value: string; sub?: string;
  icon: any; color?: string; delta?: number;
}) => {
  const bg: Record<string, string> = {
    blue:   "bg-blue-50   text-blue-600",
    green:  "bg-green-50  text-green-600",
    amber:  "bg-amber-50  text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    rose:   "bg-rose-50   text-rose-600",
    teal:   "bg-teal-50   text-teal-600",
  };
  return (
    <Card className="border bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("p-2 rounded-lg", bg[color] ?? bg.blue)}>
            <Icon className="w-4 h-4" />
          </div>
          {delta !== undefined && (
            <span className={cn(
              "text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
              delta >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            )}>
              {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
};

const ProgressBar = ({ value, max, color = "#3b82f6" }: { value: number; max: number; color?: string }) => (
  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
    <div
      className="h-1.5 rounded-full transition-all"
      style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }}
    />
  </div>
);

const AnalyticsSkeleton = () => (
  <div className="space-y-6 p-2">
    <div className="flex items-center justify-between">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-9 w-44" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Skeleton className="h-72 lg:col-span-2" />
      <Skeleton className="h-72" />
    </div>
  </div>
);

// ─── Hook: busca os 4 RPCs em paralelo ───────────────────────────────────────
function useAnalyticsData(period: string) {
  return useQuery({
    queryKey: ["analytics-v3", period],
    queryFn: async () => {
      const [summaryRes, monthlyRes, productsRes, demoRes] = await Promise.all([
        supabase.rpc("get_analytics_summary", { p_period: period }),
        supabase.rpc("get_analytics_monthly",  { p_period: period }),
        supabase.rpc("get_analytics_products", { p_period: period }),
        supabase.rpc("get_analytics_demographics", { p_period: period }),
      ]);

      if (summaryRes.error) throw new Error(summaryRes.error.message);
      if (monthlyRes.error) throw new Error(monthlyRes.error.message);
      if (productsRes.error) throw new Error(productsRes.error.message);
      if (demoRes.error) throw new Error(demoRes.error.message);

      return {
        summary:  summaryRes.data  as any,
        monthly:  monthlyRes.data  as any[] ?? [],
        products: productsRes.data as any,
        demo:     demoRes.data     as any,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

// ─── Página principal ─────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const [period, setPeriod] = useState("12m");
  const { data, isLoading, isError, error, refetch, isFetching } = useAnalyticsData(period);

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError) {
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {(error as Error)?.message || "Erro desconhecido ao carregar analytics."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const s = data?.summary ?? {};
  const monthly          = data?.monthly ?? [];
  const topProducts      = data?.products?.byRevenue ?? [];
  const topProductsByQty = data?.products?.byQty ?? [];
  const demo             = data?.demo ?? {};
  const ordersByStatus   = demo.ordersByStatus ?? [];
  const paymentMethods   = demo.paymentMethods ?? [];
  const hourlyHeatmap    = demo.hourlyHeatmap ?? [];
  const weekdayHeatmap   = demo.weekdayHeatmap ?? [];

  // Preencher horas faltantes (0-23)
  const fullHourly = Array.from({ length: 24 }, (_, h) => {
    const label = `${String(h).padStart(2, "0")}h`;
    const found = hourlyHeatmap.find((x: any) => x.hour_brt === h || x.label === label);
    return found ?? { hour_brt: h, label, orders: 0, revenue: 0 };
  });

  // Preencher dias faltantes (0-6)
  const dayNames = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const fullWeekday = Array.from({ length: 7 }, (_, d) => {
    const found = weekdayHeatmap.find((x: any) => x.dow === d);
    return found ?? { dow: d, name: dayNames[d], orders: 0, revenue: 0 };
  });

  const hasTimeline = monthly.some((m: any) => m.orders > 0);
  const maxRegionOrders = Math.max(...(demo.regions ?? []).map((r: any) => r.orders), 1);
  const maxHour = Math.max(...fullHourly.map((h: any) => h.orders), 1);

  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? period;

  return (
    <div className="space-y-6 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" /> Inteligência de Negócio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periodLabel} · {s.totalOrders ?? 0} pedidos analisados
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="border-0 focus:ring-0 text-sm font-semibold text-gray-700 bg-transparent p-0 h-auto w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFetching && <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
        </div>
      </div>

      {/* KPIs Financeiros */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Fat. Bruto"    value={R(s.totalRevenue)}             sub={`${s.totalOrders ?? 0} pedidos`}        icon={DollarSign}   color="blue"   />
        <KpiCard title="Fat. Líquido"  value={R(s.totalRevenueNoShip ?? 0)} sub="s/ frete e s/ descontos"                icon={DollarSign}   color="green"  />
        <KpiCard title="Custo Total"   value={R(s.totalCost ?? 0)}           sub="só produtos c/ custo cadastrado"        icon={TrendingDown} color="rose"   />
        <KpiCard title="Margem Bruta"  value={R(s.grossProfit ?? 0)}         sub={s.totalRevenueNoShip > 0 ? `${pct(((s.grossProfit ?? 0) / s.totalRevenueNoShip) * 100)} do líquido` : "—"} icon={TrendingUp} color="teal" />
        <KpiCard title="Ticket Médio"  value={R(s.avgTicket)}                sub="pedidos aprovados"                      icon={Target}       color="amber"  />
        <KpiCard title="Recorrentes"   value={String(s.recurringUsers ?? 0)} sub={`${s.newUsers ?? 0} novos`}             icon={Users}        color="purple" />
      </div>

      {/* Cards de Status dos Pedidos */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Status dos Pedidos <span className="text-[10px] font-normal normal-case text-gray-400">(cancelados excluídos)</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Status do Pedido */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-green-700">{s.countPago ?? 0}</p>
            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mt-0.5">Pago</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{s.countFinalizada ?? 0}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mt-0.5">Finalizado</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-yellow-700">{s.countPendente ?? 0}</p>
            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide mt-0.5">Pendente</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-700">{s.countAguardando ?? 0}</p>
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mt-0.5">Aguardando</p>
          </div>
          {/* Status de Entrega */}
          <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-sky-700">{s.countAguardandoColeta ?? 0}</p>
            <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wide mt-0.5">Ag. Coleta</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{s.countEmbalado ?? 0}</p>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mt-0.5">Embalado</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{s.countDespachado ?? 0}</p>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mt-0.5">Despachado</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-purple-700">{s.countEntregue ?? 0}</p>
            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mt-0.5">Entregue</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vendas" className="space-y-5">
        <TabsList className="bg-gray-100 p-1 rounded-xl h-auto flex-wrap gap-1">
          <TabsTrigger value="vendas"    className="rounded-lg font-semibold text-xs px-4 py-2">📈 Vendas</TabsTrigger>
          <TabsTrigger value="produtos"  className="rounded-lg font-semibold text-xs px-4 py-2">📦 Produtos</TabsTrigger>
          <TabsTrigger value="clientes"  className="rounded-lg font-semibold text-xs px-4 py-2">👥 Clientes</TabsTrigger>
          <TabsTrigger value="logistica" className="rounded-lg font-semibold text-xs px-4 py-2">🗺️ Logística</TabsTrigger>
          <TabsTrigger value="tempo"     className="rounded-lg font-semibold text-xs px-4 py-2">⏰ Horários</TabsTrigger>
        </TabsList>

        {/* ── ABA VENDAS ── */}
        <TabsContent value="vendas" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento & Volume de Pedidos</CardTitle>
              <CardDescription>Receita (barras) e quantidade de pedidos (linha) no período.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {hasTimeline ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis yAxisId="rev" axisLine={false} tickLine={false} tick={{ fontSize: 10 }}
                        tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="ord" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) =>
                          name === "revenue" ? [R(v), "Faturamento"] : [v, "Pedidos"]} />
                      <Bar yAxisId="rev" dataKey="revenue" fill="#3b82f6" radius={[5,5,0,0]} barSize={28} opacity={0.9} />
                      <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#f59e0b" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Taxa de aprovação */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Taxa de Aprovação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  {hasTimeline ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthly}>
                        <defs>
                          <linearGradient id="gApproval" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number) => [`${v.toFixed(1)}%`, "Aprovação"]} />
                        <Area type="monotone" dataKey="approved_rate" stroke="#10b981"
                          strokeWidth={2.5} fill="url(#gApproval)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </div>
                <div className="mt-3 p-3 bg-green-50 rounded-xl">
                  <p className="text-xs font-bold text-green-700">Taxa no período</p>
                  <p className="text-2xl font-black text-green-700">{pct(s.approvalRate)}</p>
                  <p className="text-[11px] text-green-600">{s.approvedOrders ?? 0} de {s.totalOrders ?? 0} pedidos</p>
                </div>
              </CardContent>
            </Card>

            {/* Frete vs Descontos mini */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0 mt-1">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-xs font-medium text-gray-600">Fat. Bruto (c/ frete)</span>
                    <span className="text-sm font-black text-blue-700">{R(s.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-xs font-medium text-gray-500">− Frete</span>
                    <span className="text-sm font-bold text-gray-500">− {R(s.totalShipping)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-xs font-medium text-gray-500">− Descontos</span>
                    <span className="text-sm font-bold text-gray-500">− {R(s.totalDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b bg-green-50 px-2 rounded-lg">
                    <span className="text-xs font-bold text-green-700">= Fat. Líquido</span>
                    <span className="text-sm font-black text-green-700">{R(s.totalRevenueNoShip ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-xs font-medium text-gray-500">− Custo (c/ custo cadastrado)</span>
                    <span className="text-sm font-bold text-rose-600">− {R(s.totalCost ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 bg-teal-50 px-2 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-teal-700">= Margem Bruta</span>
                      {s.totalRevenueNoShip > 0 && (
                        <span className="ml-2 text-[10px] font-bold text-teal-500">
                          {pct(((s.grossProfit ?? 0) / s.totalRevenueNoShip) * 100)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-black text-teal-700">{R(s.grossProfit ?? 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métodos de pagamento */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métodos de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentMethods.length > 0 ? (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentMethods} innerRadius={45} outerRadius={70}
                          paddingAngle={4} dataKey="value">
                          {paymentMethods.map((_: any, i: number) => (
                            <Cell key={i} fill={C[i % C.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number, _: any, p: any) => [v, p.payload.name]} />
                        <Legend iconSize={8} iconType="circle"
                          formatter={(v) => <span className="text-[11px] font-medium">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart msg="Sem dados de pagamento" />}
              </CardContent>
            </Card>
          </div>

          {/* Frete vs Descontos */}
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Frete vs. Descontos ao Longo do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                {hasTimeline ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }}
                        tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) =>
                          [R(v), name === "shipping" ? "Frete" : "Descontos"]} />
                      <Line type="monotone" dataKey="shipping"  stroke="#f59e0b" strokeWidth={2} dot={false} name="shipping" />
                      <Line type="monotone" dataKey="discounts" stroke="#ef4444" strokeWidth={2} dot={false} name="discounts" strokeDasharray="4 2" />
                      <Legend iconType="line"
                        formatter={(v) => <span className="text-[11px]">{v === "shipping" ? "Frete" : "Descontos"}</span>} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA PRODUTOS ── */}
        <TabsContent value="produtos" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" /> Top 10 por Receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 600 }} width={130}
                          tickFormatter={v => v.length > 18 ? v.substring(0, 18) + "…" : v} />
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number) => [R(v), "Receita"]} />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[0,4,4,0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart msg="Sem dados de produtos" />}
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600" /> Top 10 por Quantidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProductsByQty.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProductsByQty} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 600 }} width={130}
                          tickFormatter={v => v.length > 18 ? v.substring(0, 18) + "…" : v} />
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number) => [v, "Unidades"]} />
                        <Bar dataKey="qty" fill="#8b5cf6" radius={[0,4,4,0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart msg="Sem dados de produtos" />}
              </CardContent>
            </Card>
          </div>

          {topProducts.length > 0 && (
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ranking Completo — Top 10 Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {topProducts.map((p: any, i: number) => (
                    <div key={p.name} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                        i === 0 ? "bg-amber-100 text-amber-700" :
                        i === 1 ? "bg-gray-100 text-gray-600" :
                        i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"
                      )}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{p.qty} un.</span>
                          <ProgressBar value={p.revenue} max={topProducts[0]?.revenue ?? 1} color={C[i % C.length]} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-900 shrink-0">{R(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ABA CLIENTES ── */}
        <TabsContent value="clientes" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Fidelização */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fidelização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  {(s.newUsers > 0 || s.recurringUsers > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Novos", value: s.newUsers ?? 0 },
                            { name: "Recorrentes", value: s.recurringUsers ?? 0 },
                          ]}
                          innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                          <Cell fill="#3b82f6" />
                          <Cell fill="#10b981" />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconSize={8} iconType="circle"
                          formatter={v => <span className="text-[11px]">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart msg="Sem dados de clientes" />}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-black text-blue-700">{s.newUsers ?? 0}</p>
                    <p className="text-[10px] text-blue-600 font-medium">Novos</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-black text-green-700">{s.recurringUsers ?? 0}</p>
                    <p className="text-[10px] text-green-600 font-medium">Recorrentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gênero */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Perfil por Gênero</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  {(demo.gender ?? []).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={demo.gender} cx="50%" cy="50%" outerRadius={70}
                          labelLine={false} dataKey="value">
                          {demo.gender.map((_: any, i: number) => (
                            <Cell key={i} fill={C[i % C.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconSize={8} iconType="circle"
                          formatter={v => <span className="text-[11px]">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart msg="Dados de gênero não informados" />}
                </div>
              </CardContent>
            </Card>

            {/* Uso de cupons */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Uso de Cupons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  {(s.withCoupon > 0 || s.withoutCoupon > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Com Cupom", value: s.withCoupon ?? 0 },
                            { name: "Sem Cupom", value: s.withoutCoupon ?? 0 },
                          ]}
                          innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                          <Cell fill="#10b981" />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconSize={8} iconType="circle"
                          formatter={v => <span className="text-[11px]">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart msg="Sem dados de cupons" />}
                </div>
                <div className="mt-2 p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-black text-gray-800">{pct(s.couponUsageRate)}</p>
                  <p className="text-[10px] text-muted-foreground">dos pedidos usaram cupom</p>
                  <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Total descontado: {R(s.totalDiscount)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tiers */}
          {(demo.tiers ?? []).length > 0 && (
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Distribuição por Tier de Fidelidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demo.tiers} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number) => [v, "Clientes"]} />
                      <Bar dataKey="value" radius={[5,5,0,0]} barSize={40}>
                        {demo.tiers.map((_: any, i: number) => (
                          <Cell key={i} fill={C[i % C.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ABA LOGÍSTICA ── */}
        <TabsContent value="logistica" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" /> Pedidos por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {(demo.regions ?? []).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demo.regions} layout="vertical" margin={{ left: 0, right: 60 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                          tick={{ fontSize: 11, fontWeight: 700 }} width={35} />
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number, name: string) =>
                            [name === "orders" ? v : R(v), name === "orders" ? "Pedidos" : "Receita"]} />
                        <Bar dataKey="orders" fill="#3b82f6" radius={[0,4,4,0]} barSize={18}
                          label={{ position: "right", fontSize: 10, fontWeight: 700, fill: "#374151" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart msg="Sem dados de região" />}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Receita por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                {(demo.regions ?? []).length > 0 ? (
                  <div className="space-y-0">
                    {demo.regions.slice(0, 10).map((r: any, i: number) => (
                      <div key={r.name} className="py-2 border-b last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C[i % C.length] }} />
                            <span className="text-xs font-bold text-gray-700">{r.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{r.orders} pedidos</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <ProgressBar value={r.orders} max={maxRegionOrders} color={C[i % C.length]} />
                          <span className="text-[10px] font-bold text-gray-800 ml-2 shrink-0">{R(r.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyChart msg="Sem dados de região" />}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Frete Total", value: R(s.totalShipping), sub: "no período", icon: Truck, color: "amber" },
              { label: "Frete Médio", value: R(s.avgShipping), sub: "por pedido", icon: Target, color: "blue" },
              {
                label: "Frete / Receita",
                value: s.totalRevenue > 0 ? pct((s.totalShipping / s.totalRevenue) * 100) : "0%",
                sub: "representação do frete",
                icon: ShoppingCart,
                color: "purple",
              },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label} className="border-none shadow-md">
                <CardContent className="pt-5">
                  <KpiCard title={label} value={value} sub={sub} icon={Icon} color={color} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── ABA HORÁRIOS ── */}
        <TabsContent value="tempo" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Pedidos por Hora do Dia
              </CardTitle>
              <CardDescription className="text-xs">
                Identifique os horários de pico para campanhas e atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                {fullHourly.some((h: any) => h.orders > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fullHourly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false}
                        tick={{ fontSize: 9, fontWeight: 600 }} interval={1} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number) => [v, "Pedidos"]} />
                      <Bar dataKey="orders" radius={[3,3,0,0]} barSize={18}>
                        {fullHourly.map((h: any, i: number) => (
                          <Cell key={i}
                            fill={`rgba(59,130,246,${0.15 + (h.orders / maxHour) * 0.85})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart msg="Sem dados de horário" />}
              </div>
              {fullHourly.some((h: any) => h.orders > 0) && (
                <div className="mt-4 flex gap-3">
                  {[...fullHourly]
                    .sort((a: any, b: any) => b.orders - a.orders)
                    .slice(0, 3)
                    .map((h: any, i: number) => (
                      <div key={h.label} className={cn(
                        "flex-1 rounded-xl p-3 text-center",
                        i === 0 ? "bg-blue-600 text-white" : "bg-gray-50"
                      )}>
                        <p className={cn("text-lg font-black", i === 0 ? "text-white" : "text-gray-800")}>{h.label}</p>
                        <p className={cn("text-[10px] font-medium", i === 0 ? "text-blue-100" : "text-muted-foreground")}>
                          {h.orders} pedidos
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" /> Pedidos por Dia da Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                {fullWeekday.some((d: any) => d.orders > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fullWeekday} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number) => [v, "Pedidos"]} />
                      <Bar dataKey="orders" radius={[5,5,0,0]} barSize={40}>
                        {fullWeekday.map((d: any, i: number) => (
                          <Cell key={i} fill={C[i % C.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart msg="Sem dados por dia da semana" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
