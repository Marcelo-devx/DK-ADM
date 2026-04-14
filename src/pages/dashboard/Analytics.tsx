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
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line, ComposedChart,
} from "recharts";
import {
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Target,
  Zap, MapPin, Calendar, CheckCircle2, ShoppingCart, RefreshCw,
  AlertCircle, CreditCard, Package, Tag, Clock, Truck, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#64748b","#ec4899","#14b8a6","#f97316","#06b6d4"];

const PERIODS = [
  { value: "7d",  label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "6m",  label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "24m", label: "Últimos 24 meses" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const R = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const pct = (v: number) => `${v.toFixed(1)}%`;

const periodLabel = (p: string) => PERIODS.find(x => x.value === p)?.label ?? p;

// ─── Componentes base ─────────────────────────────────────────────────────────

const EmptyChart = ({ msg = "Sem dados para o período" }: { msg?: string }) => (
  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
    <BarChart3 className="w-8 h-8 text-gray-200" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

const tooltipStyle = {
  borderRadius: "10px",
  border: "none",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  fontSize: 12,
};

// KPI grande com ícone colorido
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

// Mini stat inline
const MiniStat = ({ label, value, color = "text-gray-900" }: { label: string; value: string; color?: string }) => (
  <div className="flex items-center justify-between py-2 border-b last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={cn("text-xs font-bold", color)}>{value}</span>
  </div>
);

// Barra de progresso simples
const ProgressBar = ({ value, max, color = "#3b82f6" }: { value: number; max: number; color?: string }) => (
  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
    <div
      className="h-1.5 rounded-full transition-all"
      style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }}
    />
  </div>
);

// Skeleton de loading
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const [period, setPeriod] = useState("12m");

  const { data: bi, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["bi-v2", period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("analytics-bi", {
        body: { period },
      });
      if (error) throw new Error(error.message || "Erro ao carregar analytics");
      if (!data)  throw new Error("Nenhum dado retornado");
      return data;
    },
    retry: 2,
    refetchInterval: 300_000,
  });

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

  // ── Dados com fallbacks ───────────────────────────────────────────────────
  const s = bi?.summary ?? {
    totalRevenue: 0, totalOrders: 0, approvedOrders: 0, approvalRate: 0,
    avgTicket: 0, totalShipping: 0, avgShipping: 0, totalDiscount: 0,
    newUsers: 0, recurringUsers: 0, couponUsageRate: 0, withCoupon: 0, withoutCoupon: 0,
  };
  const monthly          = bi?.monthly          ?? [];
  const topProducts      = bi?.topProducts      ?? [];
  const topProductsByQty = bi?.topProductsByQty ?? [];
  const ordersByStatus   = bi?.ordersByStatus   ?? [];
  const paymentMethods   = bi?.paymentMethods   ?? [];
  const hourlyHeatmap    = bi?.hourlyHeatmap     ?? [];
  const weekdayHeatmap   = bi?.weekdayHeatmap    ?? [];
  const demo             = bi?.demographics      ?? { gender: [], regions: [], tiers: [], retention: [], couponUsage: [] };

  const hasTimeline = monthly.some((m: any) => m.orders > 0);
  const maxRegionOrders = Math.max(...(demo.regions ?? []).map((r: any) => r.orders), 1);
  const maxHour = Math.max(...hourlyHeatmap.map((h: any) => h.orders), 1);

  return (
    <div className="space-y-6 pb-24">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" /> Inteligência de Negócio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periodLabel(period)} · {s.totalOrders} pedidos analisados
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

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Faturamento"    value={R(s.totalRevenue)}          sub={`${s.totalOrders} pedidos`}                icon={DollarSign}   color="blue"   />
        <KpiCard title="Ticket Médio"   value={R(s.avgTicket)}             sub="por pedido"                                icon={Target}       color="green"  />
        <KpiCard title="Aprovação"      value={pct(s.approvalRate)}        sub={`${s.approvedOrders} aprovados`}           icon={CheckCircle2} color="teal"   />
        <KpiCard title="Frete Total"    value={R(s.totalShipping)}         sub={`Média ${R(s.avgShipping)}`}               icon={Truck}        color="amber"  />
        <KpiCard title="Descontos"      value={R(s.totalDiscount)}         sub={`${pct(s.couponUsageRate)} c/ cupom`}      icon={Tag}          color="rose"   />
        <KpiCard title="Recorrentes"    value={s.recurringUsers.toString()} sub={`${s.newUsers} novos`}                    icon={Users}        color="purple" />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="vendas" className="space-y-5">
        <TabsList className="bg-gray-100 p-1 rounded-xl h-auto flex-wrap gap-1">
          <TabsTrigger value="vendas"    className="rounded-lg font-semibold text-xs px-4 py-2">📈 Vendas</TabsTrigger>
          <TabsTrigger value="produtos"  className="rounded-lg font-semibold text-xs px-4 py-2">📦 Produtos</TabsTrigger>
          <TabsTrigger value="clientes"  className="rounded-lg font-semibold text-xs px-4 py-2">👥 Clientes</TabsTrigger>
          <TabsTrigger value="logistica" className="rounded-lg font-semibold text-xs px-4 py-2">🗺️ Logística</TabsTrigger>
          <TabsTrigger value="tempo"     className="rounded-lg font-semibold text-xs px-4 py-2">⏰ Horários</TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════════
            ABA VENDAS
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="vendas" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">

          {/* Faturamento + Pedidos (ComposedChart) */}
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
                  <p className="text-[11px] text-green-600">{s.approvedOrders} de {s.totalOrders} pedidos</p>
                </div>
              </CardContent>
            </Card>

            {/* Status dos pedidos */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Status dos Pedidos</CardTitle>
                <CardDescription className="text-xs">Todos os pedidos do período</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersByStatus.length > 0 ? (
                  <div className="space-y-0">
                    {ordersByStatus.map((s: any, i: number) => (
                      <div key={s.name} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C[i % C.length] }} />
                          <span className="text-xs font-medium text-gray-700">{s.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold">{s.value}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <EmptyChart msg="Sem dados de status" />}
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

          {/* Frete e descontos ao longo do tempo */}
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Frete vs. Descontos ao Longo do Tempo</CardTitle>
              <CardDescription className="text-xs">Comparativo de custos de frete e descontos aplicados.</CardDescription>
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

        {/* ════════════════════════════════════════════════════════════════════
            ABA PRODUTOS
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="produtos" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top por receita */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" /> Top 10 por Receita
                </CardTitle>
                <CardDescription className="text-xs">Produtos que mais geraram faturamento.</CardDescription>
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

            {/* Top por quantidade */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600" /> Top 10 por Quantidade
                </CardTitle>
                <CardDescription className="text-xs">Produtos mais vendidos em unidades.</CardDescription>
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

          {/* Tabela top 10 */}
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

        {/* ════════════════════════════════════════════════════════════════════
            ABA CLIENTES
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="clientes" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Novos vs Recorrentes */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fidelização</CardTitle>
                <CardDescription className="text-xs">Novos vs. clientes recorrentes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  {demo.retention.some((r: any) => r.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={demo.retention} innerRadius={45} outerRadius={70}
                          paddingAngle={4} dataKey="value">
                          {demo.retention.map((_: any, i: number) => (
                            <Cell key={i} fill={C[i % C.length]} />
                          ))}
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
                    <p className="text-lg font-black text-blue-700">{s.newUsers}</p>
                    <p className="text-[10px] text-blue-600 font-medium">Novos</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-black text-green-700">{s.recurringUsers}</p>
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
                  {demo.gender.length > 0 ? (
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
                <CardDescription className="text-xs">Pedidos com e sem desconto.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  {demo.couponUsage.some((c: any) => c.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={demo.couponUsage} innerRadius={45} outerRadius={70}
                          paddingAngle={4} dataKey="value">
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

          {/* Tiers de fidelidade */}
          {demo.tiers.length > 0 && (
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

          {/* Card de sugestão */}
          <Card className="bg-gradient-to-br from-[#0B1221] to-[#1a2540] text-white border-none shadow-xl">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black uppercase tracking-tight">Sugestão de Campanha</h3>
                  <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                    Você tem <strong className="text-white">{s.recurringUsers} clientes recorrentes</strong> e{" "}
                    <strong className="text-white">{s.newUsers} novos</strong> no período.{" "}
                    {s.couponUsageRate < 30
                      ? `Apenas ${pct(s.couponUsageRate)} dos pedidos usaram cupom — ative uma campanha de desconto para aumentar a conversão.`
                      : `Com ${pct(s.couponUsageRate)} de uso de cupons, considere criar um programa de fidelidade para reduzir a dependência de descontos.`}
                  </p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 font-bold shrink-0 uppercase text-xs h-10 px-6">
                  Ativar Campanha
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            ABA LOGÍSTICA
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="logistica" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Gráfico de regiões */}
            <Card className="lg:col-span-2 border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" /> Pedidos por Estado
                </CardTitle>
                <CardDescription className="text-xs">Baseado nos endereços de entrega.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {demo.regions.length > 0 ? (
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

            {/* Lista de regiões com receita */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Receita por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                {demo.regions.length > 0 ? (
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

          {/* Métricas de frete */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-amber-50 rounded-lg"><Truck className="w-4 h-4 text-amber-600" /></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Frete Total</p>
                </div>
                <p className="text-2xl font-black text-gray-900">{R(s.totalShipping)}</p>
                <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg"><Target className="w-4 h-4 text-blue-600" /></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Frete Médio</p>
                </div>
                <p className="text-2xl font-black text-gray-900">{R(s.avgShipping)}</p>
                <p className="text-xs text-muted-foreground mt-1">por pedido</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-50 rounded-lg"><ShoppingCart className="w-4 h-4 text-purple-600" /></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Frete / Receita</p>
                </div>
                <p className="text-2xl font-black text-gray-900">
                  {s.totalRevenue > 0 ? pct((s.totalShipping / s.totalRevenue) * 100) : "0%"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">representação do frete na receita</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            ABA HORÁRIOS
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="tempo" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">

          {/* Heatmap por hora */}
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
                {hourlyHeatmap.some((h: any) => h.orders > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyHeatmap} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false}
                        tick={{ fontSize: 9, fontWeight: 600 }} interval={1} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) =>
                          [name === "orders" ? v : R(v), name === "orders" ? "Pedidos" : "Receita"]} />
                      <Bar dataKey="orders" radius={[3,3,0,0]} barSize={18}>
                        {hourlyHeatmap.map((h: any, i: number) => (
                          <Cell key={i}
                            fill={`rgba(59,130,246,${0.15 + (h.orders / maxHour) * 0.85})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart msg="Sem dados de horário" />}
              </div>
              {/* Top 3 horários */}
              {hourlyHeatmap.some((h: any) => h.orders > 0) && (
                <div className="mt-4 flex gap-3">
                  {[...hourlyHeatmap]
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

          {/* Heatmap por dia da semana */}
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" /> Pedidos por Dia da Semana
              </CardTitle>
              <CardDescription className="text-xs">
                Descubra os dias mais movimentados para planejar estoque e equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                {weekdayHeatmap.some((d: any) => d.orders > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayHeatmap} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) =>
                          [name === "orders" ? v : R(v), name === "orders" ? "Pedidos" : "Receita"]} />
                      <Bar dataKey="orders" radius={[5,5,0,0]} barSize={40}>
                        {weekdayHeatmap.map((d: any, i: number) => (
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
