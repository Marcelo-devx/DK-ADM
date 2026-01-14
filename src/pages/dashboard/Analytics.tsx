"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from "lucide-react";

// Cores para os gráficos
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const fetchAnalyticsData = async () => {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  // 1. Vendas dos últimos 30 dias
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("total_price, created_at, status")
    .gte("created_at", thirtyDaysAgo)
    .neq("status", "Cancelado");

  if (ordersError) throw ordersError;

  // 2. Itens vendidos (para Top Produtos)
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("name_at_purchase, quantity, total:price_at_purchase")
    .gte("created_at", thirtyDaysAgo);

  if (itemsError) throw itemsError;

  // Processamento: Vendas por Dia
  const salesByDateMap = new Map();
  // Inicializa os últimos 30 dias com 0
  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "dd/MM");
    salesByDateMap.set(date, 0);
  }

  orders?.forEach(order => {
    const date = format(new Date(order.created_at), "dd/MM");
    const current = salesByDateMap.get(date) || 0;
    salesByDateMap.set(date, current + Number(order.total_price));
  });

  const salesData = Array.from(salesByDateMap.entries()).map(([name, value]) => ({ name, value }));

  // Processamento: Status dos Pedidos
  const statusCount: Record<string, number> = {};
  orders?.forEach(order => {
    statusCount[order.status] = (statusCount[order.status] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  // Processamento: Top Produtos
  const productCount: Record<string, number> = {};
  orderItems?.forEach(item => {
    productCount[item.name_at_purchase] = (productCount[item.name_at_purchase] || 0) + item.quantity;
  });
  
  const topProductsData = Object.entries(productCount)
    .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return { salesData, statusData, topProductsData };
};

const AnalyticsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["analyticsDashboard"],
    queryFn: fetchAnalyticsData,
  });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold mb-6">Analytics</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-[400px]" />
          <Skeleton className="col-span-3 h-[400px]" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <BarChart3 className="h-8 w-8 text-blue-600" />
        Analytics & Relatórios
      </h1>

      {/* Gráfico Principal: Vendas 30 dias */}
      <Card className="col-span-4 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Faturamento (Últimos 30 dias)
          </CardTitle>
          <CardDescription>Evolução diária das vendas confirmadas.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.salesData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={30}
                />
                <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `R$${value}`}
                />
                <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico: Status dos Pedidos */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-orange-500" />
                Distribuição de Status
            </CardTitle>
            <CardDescription>Visão geral do funil de pedidos recente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data?.statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico: Top Produtos */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Top 5 Produtos
            </CardTitle>
            <CardDescription>Itens mais vendidos em quantidade nos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120} 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30}>
                    {data?.topProductsData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "#7c3aed" : "#a78bfa"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;