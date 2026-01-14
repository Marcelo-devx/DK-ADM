"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend, Line 
} from "recharts";
import { 
  subDays, format, startOfMonth, endOfMonth, subMonths, 
  differenceInDays, isSameDay, startOfDay, endOfDay 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart3, TrendingUp, TrendingDown, Calendar as CalendarIcon, 
  DollarSign, ShoppingBag, CreditCard, Package, Download 
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

// --- Types ---
type DateRange = {
  from: Date;
  to: Date;
};

type KPICardProps = {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  prefix?: string;
};

// --- Colors ---
const COLORS = {
  primary: "#2563eb", // Blue 600
  secondary: "#9333ea", // Purple 600
  success: "#16a34a", // Green 600
  warning: "#ca8a04", // Yellow 600
  danger: "#dc2626", // Red 600
  gray: "#94a3b8", // Slate 400
  chart: ["#2563eb", "#0ea5e9", "#22c55e", "#eab308", "#f97316"]
};

// --- Data Fetching ---
const fetchAnalyticsData = async (range: DateRange) => {
  const startDate = startOfDay(range.from).toISOString();
  const endDate = endOfDay(range.to).toISOString();

  // Calcular período anterior para comparação
  const diffDays = differenceInDays(range.to, range.from) + 1;
  const prevStartDate = startOfDay(subDays(range.from, diffDays)).toISOString();
  const prevEndDate = endOfDay(subDays(range.to, diffDays)).toISOString();

  // 1. Pedidos do Período Atual
  const { data: currentOrders, error: currError } = await supabase
    .from("orders")
    .select("total_price, created_at, status, payment_method")
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .neq("status", "Cancelado");

  if (currError) throw currError;

  // 2. Pedidos do Período Anterior
  const { data: prevOrders, error: prevError } = await supabase
    .from("orders")
    .select("total_price, created_at")
    .gte("created_at", prevStartDate)
    .lte("created_at", prevEndDate)
    .neq("status", "Cancelado");

  if (prevError) throw prevError;

  // 3. Itens vendidos (Top Produtos)
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("name_at_purchase, quantity, price_at_purchase")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (itemsError) throw itemsError;

  return { currentOrders, prevOrders, orderItems, range, diffDays };
};

// --- Components ---

const KPICard = ({ title, value, change, icon: Icon, prefix = "" }: KPICardProps) => {
  const isPositive = change >= 0;
  return (
    <Card className="shadow-sm border-l-4" style={{ borderLeftColor: isPositive ? COLORS.success : COLORS.danger }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <div className={cn("p-2 rounded-full bg-opacity-10", isPositive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
            <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black text-gray-800">{value}</div>
        <p className="text-xs flex items-center mt-1">
          <span className={cn("font-bold flex items-center", isPositive ? "text-green-600" : "text-red-600")}>
            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-muted-foreground ml-1">vs. período anterior</span>
        </p>
      </CardContent>
    </Card>
  );
};

const AnalyticsPage = () => {
  const navigate = useNavigate();
  // State for Date Range
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyticsEnterprise", dateRange.from, dateRange.to],
    queryFn: () => fetchAnalyticsData(dateRange),
    refetchOnWindowFocus: false,
  });

  // --- Processamento de Dados (Memoized) ---
  const processedData = useMemo(() => {
    if (!data) return null;
    const { currentOrders, prevOrders, orderItems, range, diffDays } = data;

    // --- KPIs ---
    const calcTotal = (orders: any[]) => orders.reduce((acc, o) => acc + Number(o.total_price), 0);
    
    const currRevenue = calcTotal(currentOrders || []);
    const prevRevenue = calcTotal(prevOrders || []);
    const revenueGrowth = prevRevenue === 0 ? 100 : ((currRevenue - prevRevenue) / prevRevenue) * 100;

    const currCount = currentOrders?.length || 0;
    const prevCount = prevOrders?.length || 0;
    const countGrowth = prevCount === 0 ? 100 : ((currCount - prevCount) / prevCount) * 100;

    const currTicket = currCount > 0 ? currRevenue / currCount : 0;
    const prevTicket = prevCount > 0 ? prevRevenue / prevCount : 0;
    const ticketGrowth = prevTicket === 0 ? 100 : ((currTicket - prevTicket) / prevTicket) * 100;

    const itemsCount = orderItems?.reduce((acc, i) => acc + i.quantity, 0) || 0;
    const avgItems = currCount > 0 ? itemsCount / currCount : 0;

    // --- Gráfico de Evolução (Area Chart) ---
    const chartDataMap = new Map();
    
    // Preenche os dias do intervalo com 0
    for (let i = 0; i < diffDays; i++) {
        const d = subDays(range.to, (diffDays - 1) - i);
        const key = format(d, "dd/MM");
        chartDataMap.set(key, { name: key, revenue: 0, orders: 0 });
    }

    currentOrders?.forEach(order => {
        const key = format(new Date(order.created_at), "dd/MM");
        if (chartDataMap.has(key)) {
            const entry = chartDataMap.get(key);
            entry.revenue += Number(order.total_price);
            entry.orders += 1;
        }
    });

    const revenueChartData = Array.from(chartDataMap.values());

    // --- Gráfico de Métodos de Pagamento (Pie) ---
    const paymentCounts: Record<string, number> = {};
    currentOrders?.forEach(o => {
        let method = o.payment_method || 'Outros';
        if (method.toLowerCase().includes('pix')) method = 'Pix';
        else if (method.toLowerCase().includes('cart')) method = 'Cartão';
        
        paymentCounts[method] = (paymentCounts[method] || 0) + Number(o.total_price);
    });
    
    const paymentChartData = Object.entries(paymentCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // --- Top Produtos (Bar) ---
    const productStats: Record<string, number> = {};
    orderItems?.forEach(item => {
        const name = item.name_at_purchase;
        productStats[name] = (productStats[name] || 0) + item.quantity;
    });

    const topProductsData = Object.entries(productStats)
        .map(([name, value]) => ({ 
            name: name.length > 25 ? name.substring(0, 25) + '...' : name, 
            full_name: name,
            value 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    return {
        kpi: {
            revenue: { val: currRevenue, growth: revenueGrowth },
            orders: { val: currCount, growth: countGrowth },
            ticket: { val: currTicket, growth: ticketGrowth },
            avgItems: avgItems
        },
        charts: {
            revenue: revenueChartData,
            payment: paymentChartData,
            products: topProductsData
        }
    };
  }, [data]);

  // --- Handlers ---
  const handlePresetChange = (days: number) => {
    setDateRange({
        from: subDays(new Date(), days),
        to: new Date()
    });
  };

  const handleExportReport = () => {
    if (!processedData) return;
    
    const wb = XLSX.utils.book_new();
    
    // Aba de KPIs
    const kpiData = [
        ["Métrica", "Valor", "Crescimento (%)"],
        ["Faturamento", processedData.kpi.revenue.val, processedData.kpi.revenue.growth],
        ["Pedidos", processedData.kpi.orders.val, processedData.kpi.orders.growth],
        ["Ticket Médio", processedData.kpi.ticket.val, processedData.kpi.ticket.growth],
    ];
    const wsKPI = XLSX.utils.aoa_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, "Resumo");

    // Aba de Vendas Diárias
    const wsSales = XLSX.utils.json_to_sheet(processedData.charts.revenue);
    XLSX.utils.book_append_sheet(wb, wsSales, "Vendas Diárias");

    XLSX.writeFile(wb, `Relatorio_Analytics_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    showSuccess("Relatório exportado com sucesso!");
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getVariant = (days: number) => {
    return differenceInDays(dateRange.to, dateRange.from) === days ? "secondary" : "ghost";
  };

  const getButtonClass = (days: number) => {
    return cn("text-xs font-bold shadow-sm", differenceInDays(dateRange.to, dateRange.from) === days && "bg-white");
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Performance da Loja
          </h1>
          <p className="text-muted-foreground mt-1">Análise detalhada de vendas e comportamento.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <Button variant={getVariant(7)} size="sm" onClick={() => handlePresetChange(7)} className={getButtonClass(7)}>7D</Button>
                <Button variant={getVariant(30)} size="sm" onClick={() => handlePresetChange(30)} className={getButtonClass(30)}>30D</Button>
                <Button variant={getVariant(90)} size="sm" onClick={() => handlePresetChange(90)} className={getButtonClass(90)}>90D</Button>
            </div>
            
            <div className="flex items-center gap-2 border-l pl-4">
                <div className="grid gap-1">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Início</span>
                    <Input 
                        type="date" 
                        value={format(dateRange.from, "yyyy-MM-dd")} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                        className="h-8 w-32 text-xs"
                    />
                </div>
                <div className="grid gap-1">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Fim</span>
                    <Input 
                        type="date" 
                        value={format(dateRange.to, "yyyy-MM-dd")} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                        className="h-8 w-32 text-xs"
                    />
                </div>
            </div>

            <Button variant="outline" size="icon" onClick={handleExportReport} title="Baixar Relatório">
                <Download className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {isLoading || isRefetching || !processedData ? (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : (
        <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <KPICard 
                    title="Faturamento Total" 
                    value={formatCurrency(processedData.kpi.revenue.val)} 
                    change={processedData.kpi.revenue.growth} 
                    icon={DollarSign} 
                />
                <KPICard 
                    title="Total de Pedidos" 
                    value={processedData.kpi.orders.val.toString()} 
                    change={processedData.kpi.orders.growth} 
                    icon={ShoppingBag} 
                />
                <KPICard 
                    title="Ticket Médio" 
                    value={formatCurrency(processedData.kpi.ticket.val)} 
                    change={processedData.kpi.ticket.growth} 
                    icon={CreditCard} 
                />
                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Itens / Pedido</CardTitle>
                        <div className="p-2 rounded-full bg-blue-100 text-blue-600"><Package className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-gray-800">{processedData.kpi.avgItems.toFixed(1)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Média de produtos por carrinho</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-md">
                    <CardHeader>
                        <CardTitle>Evolução de Vendas</CardTitle>
                        <CardDescription>Receita diária no período selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={processedData.charts.revenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 12, fill: '#64748b' }} 
                                        minTickGap={30}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        tickFormatter={(value) => `R$${value/1000}k`}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        formatter={(value: number) => [formatCurrency(value), "Receita"]}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="revenue" 
                                        stroke={COLORS.primary} 
                                        strokeWidth={3} 
                                        fillOpacity={1} 
                                        fill="url(#colorRevenue)" 
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle>Top Produtos</CardTitle>
                        <CardDescription>Mais vendidos (Qtd)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processedData.charts.products} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={100} 
                                        tick={{ fontSize: 11, fill: '#475569' }} 
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                        {processedData.charts.products.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle>Métodos de Pagamento</CardTitle>
                        <CardDescription>Distribuição da receita por forma de pagamento.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={processedData.charts.payment}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {processedData.charts.payment.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardHeader>
                        <CardTitle className="text-blue-900">Dica de Gestão</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="p-3 bg-white rounded-lg shadow-sm border">
                                <TrendingUp className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Aumente seu Ticket Médio</h4>
                                <p className="text-sm text-gray-600 mt-1">
                                    Seu ticket médio atual é <strong>{formatCurrency(processedData.kpi.ticket.val)}</strong>. 
                                    Tente criar kits promocionais com os produtos mais vendidos ("{processedData.charts.products[0]?.name}") para incentivar compras maiores.
                                </p>
                            </div>
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/dashboard/promotions')}>
                            Criar Promoção Agora
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;