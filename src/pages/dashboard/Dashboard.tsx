import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, Package, TrendingUp, Wallet, Calendar, Ticket,
  QrCode, CreditCard, Coins, Award, Users, ShoppingCart,
  AlertTriangle, Clock, CheckCircle2, RefreshCw, ArrowUpRight,
  Truck, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startOfMonth, format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const fmt = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

// ─── Fetch principal (período filtrado) ──────────────────────────────────────
const fetchFinancialSummary = async (startDate?: string, endDate?: string) => {
  // Busca todos os pedidos sem limite (paginando de 1000 em 1000)
  let allSales: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let q = supabase
      .from("orders")
      .select("total_price, coupon_discount, created_at, payment_method, donation_amount, status")
      .in("status", ["Finalizada", "Pago"])
      .range(from, from + pageSize - 1);

    if (startDate) q = q.gte("created_at", startDate);
    if (endDate) q = q.lte("created_at", endDate + "T23:59:59");

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allSales = allSales.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const sales = allSales;

  const { data: usedCouponsRaw } = await supabase
    .from("user_coupons")
    .select("created_at, coupons(name)")
    .eq("is_used", true);

  const usedInPeriod = (usedCouponsRaw || []).filter((uc) => {
    if (!startDate || !endDate) return true;
    const date = new Date(uc.created_at);
    return date >= new Date(startDate) && date <= new Date(endDate + "T23:59:59");
  });

  const couponStats = usedInPeriod.reduce((acc: Record<string, number>, curr: any) => {
    const couponData = Array.isArray(curr.coupons) ? curr.coupons[0] : curr.coupons;
    const name = couponData?.name || "Desconhecido";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const { data: products } = await supabase
    .from("products")
    .select(`id, stock_quantity, cost_price, price, name, brand, variants:product_variants(price, cost_price, stock_quantity, flavors(name), color, size, ohms, volume_ml)`);
  const { data: promos } = await supabase.from("promotions").select("stock_quantity, price, name");

  const { data: profilesPoints } = await supabase.from("profiles").select("points");
  const totalPointsDistributed = (profilesPoints || []).reduce((acc, p) => acc + Number(p.points || 0), 0);
  const activeLoyaltyUsers = (profilesPoints || []).filter((p) => Number(p.points || 0) > 0).length;

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const totalDiscount = sales.reduce((acc, s) => acc + Number(s.coupon_discount || 0), 0);
  const totalCouponsCount = sales.filter((s) => Number(s.coupon_discount || 0) > 0).length;
  const pixRevenue = sales
    .filter((s) => (s.payment_method || "pix").toLowerCase().includes("pix"))
    .reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const cardRevenue = sales
    .filter((s) => (s.payment_method || "").toLowerCase().includes("cart"))
    .reduce((acc, s) => acc + Number(s.total_price || 0), 0);

  const inventoryCostValue = (products || []).reduce((total, product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0)
      return total + variants.reduce((sum, v) => sum + Number(v.stock_quantity) * Number(v.cost_price || 0), 0);
    return total + Number(product.stock_quantity) * Number(product.cost_price || 0);
  }, 0);

  const potentialRevenueValue = [
    ...(products || []).map((product) => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length > 0)
        return variants.reduce((sum, v) => sum + Number(v.stock_quantity) * Number(v.price || 0), 0);
      return Number(product.stock_quantity) * Number(product.price || 0);
    }),
    ...(promos || []).map((p) => p.stock_quantity * (p.price || 0)),
  ].reduce((acc, val) => acc + val, 0);

  const paidSales = sales.filter((s) => s.status === "Pago");
  const totalDonations = paidSales.reduce((acc, s) => acc + Number(s.donation_amount || 0), 0);

  return {
    totalRevenue, totalSalesCount: sales.length, pixRevenue, cardRevenue,
    totalDiscount, totalCouponsCount, couponStats,
    inventoryCostValue, potentialRevenueValue,
    totalPointsDistributed, activeLoyaltyUsers, totalDonations,
    rawProducts: products || [], rawPromos: promos || [],
  };
};

// ─── Fetch dados em tempo real (hoje + últimos pedidos + clientes) ────────────
const fetchRealtimeData = async () => {
  const now = new Date();
  // Hoje em horário de Brasília (UTC-3)
  const todayStartUTC = new Date(now);
  todayStartUTC.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  if (now.getUTCHours() < 3) todayStartUTC.setUTCDate(todayStartUTC.getUTCDate() - 1);

  // Pedidos de hoje
  const { data: todayOrders } = await supabase
    .from("orders")
    .select("id, total_price, status, created_at, payment_method, shipping_address, profiles(first_name, last_name)")
    .gte("created_at", todayStartUTC.toISOString())
    .order("created_at", { ascending: false });

  const todayPaid = (todayOrders || []).filter((o) => ["Pago", "Finalizada"].includes(o.status));
  const todayRevenue = todayPaid.reduce((acc, o) => acc + Number(o.total_price || 0), 0);
  const todayPending = (todayOrders || []).filter((o) => ["Pendente", "Aguardando Pagamento", "Aguardando Validação"].includes(o.status)).length;
  const todayCancelled = (todayOrders || []).filter((o) => o.status === "Cancelado").length;

  // Últimos 5 pedidos
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, total_price, status, created_at, payment_method, profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Pedidos prontos para envio
  const { count: readyToShip } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["Pago", "Finalizada"])
    .in("delivery_status", ["Pendente", "Aguardando Coleta"]);

  // Pedidos em rota
  const { count: inRoute } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("delivery_status", "Despachado");

  // Clientes novos hoje
  const { count: newClientsToday } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStartUTC.toISOString());

  // Total de clientes
  const { count: totalClients } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // Vendas dos últimos 7 dias (para o gráfico)
  const sevenDaysAgo = new Date(todayStartUTC);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const { data: weekOrders } = await supabase
    .from("orders")
    .select("created_at, total_price, status")
    .gte("created_at", sevenDaysAgo.toISOString())
    .in("status", ["Pago", "Finalizada"]);

  // Agrupa por dia
  const dayMap: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStartUTC);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dayMap[key] = { revenue: 0, orders: 0 };
  }
  (weekOrders || []).forEach((o) => {
    // Converte para data BRT
    const brtDate = new Date(new Date(o.created_at).getTime() - 3 * 60 * 60 * 1000);
    const key = brtDate.toISOString().split("T")[0];
    if (dayMap[key]) {
      dayMap[key].revenue += Number(o.total_price || 0);
      dayMap[key].orders += 1;
    }
  });

  const weekChart = Object.entries(dayMap).map(([date, val]) => ({
    label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
    revenue: val.revenue,
    orders: val.orders,
    isToday: date === todayStartUTC.toISOString().split("T")[0],
  }));

  // Estoque crítico (≤ 5 unidades)
  const { data: lowStockProducts } = await supabase
    .from("products")
    .select("id, name, stock_quantity, variants:product_variants(stock_quantity, color, size, ohms, volume_ml, flavors(name))")
    .lte("stock_quantity", 5);

  const criticalStock: { name: string; stock: number; spec?: string }[] = [];
  (lowStockProducts || []).forEach((p) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (variants.length > 0) {
      variants.filter((v: any) => v.stock_quantity <= 5).forEach((v: any) => {
        const parts = [v.flavors?.name, v.volume_ml ? `${v.volume_ml}ml` : null, v.size, v.color, v.ohms].filter(Boolean);
        criticalStock.push({ name: p.name, stock: v.stock_quantity, spec: parts.join(" | ") || undefined });
      });
    } else if (p.stock_quantity <= 5) {
      criticalStock.push({ name: p.name, stock: p.stock_quantity });
    }
  });
  criticalStock.sort((a, b) => a.stock - b.stock);

  return {
    todayRevenue, todayOrders: todayOrders?.length || 0, todayPaid: todayPaid.length,
    todayPending, todayCancelled,
    recentOrders: recentOrders || [],
    readyToShip: readyToShip || 0,
    inRoute: inRoute || 0,
    newClientsToday: newClientsToday || 0,
    totalClients: totalClients || 0,
    weekChart,
    criticalStock: criticalStock.slice(0, 8),
  };
};

// ─── Status badge helper ──────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    Pago: "bg-green-100 text-green-800",
    Finalizada: "bg-emerald-100 text-emerald-800",
    Pendente: "bg-yellow-100 text-yellow-800",
    "Aguardando Pagamento": "bg-orange-100 text-orange-800",
    "Aguardando Validação": "bg-orange-100 text-orange-800",
    Cancelado: "bg-red-100 text-red-800",
  };
  return (
    <Badge variant="secondary" className={cn("text-[10px] font-semibold", map[status] || "bg-gray-100 text-gray-700")}>
      {status}
    </Badge>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const DashboardPage = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats, isFetching: isFetchingStats } = useQuery({
    queryKey: ["dashboardFinancialStats", startDate, endDate],
    queryFn: () => fetchFinancialSummary(startDate, endDate),
    refetchInterval: 60000,
  });

  const { data: rt, isLoading: isLoadingRt, refetch: refetchRt, isFetching: isFetchingRt } = useQuery({
    queryKey: ["dashboardRealtime"],
    queryFn: fetchRealtimeData,
    refetchInterval: 30000,
  });

  const isLoading = isLoadingStats || isLoadingRt;
  const isFetching = isFetchingStats || isFetchingRt;

  if (isLoading)
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel de Gestão</h1>
            <p className="text-sm text-muted-foreground">Visão geral em tempo real do negócio.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { refetchStats(); refetchRt(); }}
            className={cn("h-9 w-9", isFetching && "animate-spin")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-end gap-2 bg-white p-3 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <span className="text-xs text-muted-foreground italic">Filtro aplicado nos KPIs financeiros abaixo</span>
        </div>
      </div>

      {/* ── HOJE — cards de tempo real ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Hoje
        </h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="border-l-4 border-l-green-600 shadow-sm col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Faturamento Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold leading-tight text-green-700">{fmt(rt?.todayRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">{rt?.todayPaid || 0} pedidos pagos</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Pedidos Hoje</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold leading-tight">{rt?.todayOrders || 0}</div>
              <p className="text-xs text-muted-foreground">{rt?.todayPending || 0} pendentes</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Prontos p/ Envio</CardTitle>
              <Package className="h-4 w-4 text-amber-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold leading-tight text-amber-700">{rt?.readyToShip || 0}</div>
              <p className="text-xs text-muted-foreground">aguardando coleta</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-sky-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Em Rota</CardTitle>
              <Truck className="h-4 w-4 text-sky-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold leading-tight text-sky-700">{rt?.inRoute || 0}</div>
              <p className="text-xs text-muted-foreground">despachados</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Clientes Novos</CardTitle>
              <Users className="h-4 w-4 text-purple-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold leading-tight text-purple-700">{rt?.newClientsToday || 0}</div>
              <p className="text-xs text-muted-foreground">{rt?.totalClients?.toLocaleString()} total</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-400 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Cancelados Hoje</CardTitle>
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold leading-tight text-red-600">{rt?.todayCancelled || 0}</div>
              <p className="text-xs text-muted-foreground">no dia</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Gráfico 7 dias + Últimos pedidos ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Gráfico */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" /> Faturamento — Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rt?.weekChart || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <RechartTooltip
                    contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), "Faturamento"]}
                  />
                  <Bar dataKey="revenue" radius={[5, 5, 0, 0]} barSize={32}>
                    {(rt?.weekChart || []).map((entry, i) => (
                      <Cell key={i} fill={entry.isToday ? "#16a34a" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-3 mt-2 px-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Dias anteriores
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-green-600 inline-block" /> Hoje
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Últimos pedidos */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" /> Últimos Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3">
              {(rt?.recentOrders || []).map((order: any) => {
                const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
                const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Cliente";
                const isPixMethod = !order.payment_method || order.payment_method.toLowerCase().includes("pix");
                return (
                  <div key={order.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        isPixMethod ? "bg-cyan-100" : "bg-purple-100")}>
                        {isPixMethod
                          ? <QrCode className="w-3.5 h-3.5 text-cyan-600" />
                          : <CreditCard className="w-3.5 h-3.5 text-purple-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          #{order.id} · {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-xs font-bold text-gray-900">{fmt(Number(order.total_price || 0))}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                );
              })}
              {(!rt?.recentOrders || rt.recentOrders.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum pedido recente.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── KPIs do período ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" /> Período selecionado
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <Card className="border-l-4 border-l-green-600 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Faturamento</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold leading-tight">{fmt(stats?.totalRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">{stats?.totalSalesCount} vendas</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-pink-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Descontos</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Ticket className="h-4 w-4 text-pink-500 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="w-64 p-3">
                    <p className="font-bold border-b pb-1 mb-2">Cupons Usados:</p>
                    {stats?.couponStats && Object.keys(stats.couponStats).length > 0 ? (
                      Object.entries(stats.couponStats).map(([name, count]) => (
                        <div key={name} className="flex justify-between text-xs py-1">
                          <span>{name}</span>
                          <span className="font-bold text-pink-600">{count}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs italic text-muted-foreground">Nenhum cupom identificado.</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-pink-600 leading-tight">{fmt(stats?.totalDiscount || 0)}</div>
              <p className="text-xs text-muted-foreground">{stats?.totalCouponsCount || 0} cupons</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Pontos</CardTitle>
              <Award className="h-4 w-4 text-yellow-600 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-yellow-700 leading-tight">{stats?.totalPointsDistributed?.toLocaleString()} pts</div>
              <p className="text-xs text-muted-foreground">{stats?.activeLoyaltyUsers} clientes</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Doações</CardTitle>
              <Award className="h-4 w-4 text-rose-600 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-rose-700 leading-tight">{fmt(stats?.totalDonations || 0)}</div>
              <p className="text-xs text-muted-foreground">no período</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Estoque (custo)</CardTitle>
              <Wallet className="h-4 w-4 text-orange-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold leading-tight">{fmt(stats?.inventoryCostValue || 0)}</div>
              <p className="text-xs text-muted-foreground">capital preso</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-600 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Potencial</CardTitle>
              <Coins className="h-4 w-4 text-blue-600 shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-blue-700 leading-tight">{fmt(stats?.potentialRevenueValue || 0)}</div>
              <p className="text-xs text-muted-foreground">valor de venda</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Pix + Cartão ── */}
      <div className="grid gap-3 grid-cols-2">
        <Card className="bg-cyan-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Via Pix</CardTitle>
            <QrCode className="h-4 w-4 text-cyan-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-cyan-700 leading-tight">{fmt(stats?.pixRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">imediato em conta</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Via Cartão</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-purple-700 leading-tight">{fmt(stats?.cardRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">a processar</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default DashboardPage;
