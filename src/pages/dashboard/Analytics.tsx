"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from "recharts";
import { 
  BarChart3, TrendingUp, Users, DollarSign, PieChart as PieIcon, 
  Target, Zap, Map as MapIcon, Calendar, ArrowRight, HelpCircle, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

// --- Componentes de UI Auxiliares ---
const BenchmarkCard = ({ title, value, benchmark, label, icon: Icon, format = "currency" }: any) => {
  const isAbove = parseFloat(value) >= benchmark;
  const formatter = (v: number) => format === "currency" 
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : format === "percent" ? `${v.toFixed(1)}%` : v.toString();

  return (
    <Card className="shadow-sm border-none bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
            <Icon className="w-3 h-3" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between border-b pb-4 mb-4">
            <div className="text-3xl font-black text-gray-900">{formatter(value)}</div>
            <Badge variant="outline" className={cn("text-[10px] font-bold", isAbove ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50")}>
                {isAbove ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
                {benchmark > 0 ? ((Math.abs(value - benchmark) / benchmark) * 100).toFixed(1) : 0}%
            </Badge>
        </div>
        <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium">{label}</span>
            <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">{formatter(benchmark)}</span>
                <div className="w-[1px] h-3 bg-gray-200" />
                <span className="text-blue-600 font-bold uppercase">Média Segmento</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AnalyticsPage = () => {
  const { data: bi, isLoading } = useQuery({
    queryKey: ["bi-data-premium"],
    queryFn: async () => {
        const { data, error } = await supabase.functions.invoke("analytics-bi");
        if (error) throw error;
        return data;
    },
    refetchInterval: 300000 // 5 min
  });

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><div className="grid grid-cols-3 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;

  const currentMonthStats = bi?.monthly[bi?.monthly.length - 1] || { revenue: 0, orders: 0, approved_rate: 0 };
  const ticketMedio = currentMonthStats.orders > 0 ? currentMonthStats.revenue / currentMonthStats.orders : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" /> Inteligência de Negócio
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Dados reais processados nos últimos 12 meses.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border shadow-sm px-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-600">Jan/2025 - Dez/2025</span>
        </div>
      </div>

      {/* KPIs DE BENCHMARK (Igual às imagens) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BenchmarkCard 
            title="Ticket Médio" 
            value={ticketMedio} 
            benchmark={185.00} 
            label="Gasto por pedido" 
            icon={Target}
          />
          <BenchmarkCard 
            title="Taxa de Aprovação" 
            value={currentMonthStats.approved_rate} 
            benchmark={92.5} 
            label="Conversão de pagamentos" 
            icon={CheckCircle2}
            format="percent"
          />
          <BenchmarkCard 
            title="Faturamento Médio" 
            value={currentMonthStats.revenue} 
            benchmark={45000} 
            label="Performance mensal" 
            icon={DollarSign}
          />
      </div>

      <Tabs defaultValue="vendas" className="space-y-6">
        <TabsList className="bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="vendas" className="rounded-lg font-bold px-6">Performance de Vendas</TabsTrigger>
          <TabsTrigger value="clientes" className="rounded-lg font-bold px-6">Comportamento do Cliente</TabsTrigger>
          <TabsTrigger value="logistica" className="rounded-lg font-bold px-6">Logística & Região</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-md border-none">
                    <CardHeader>
                        <CardTitle className="text-lg">Faturamento 12 Meses</CardTitle>
                        <CardDescription>Evolução mensal da receita bruta.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bi?.monthly}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(v) => `R$${v/1000}k`} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={35} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-none">
                    <CardHeader>
                        <CardTitle className="text-lg">Aprovação por Período</CardTitle>
                        <CardDescription>% de pedidos convertidos em venda real.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={bi?.monthly}>
                                    <defs>
                                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="label" hide />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="approved_rate" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                                </AreaChart>
                            </ResponsiveContainer>
                            <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100">
                                <p className="text-xs font-bold text-green-700 uppercase">Insight do Mês</p>
                                <p className="text-sm text-green-600 mt-1">Sua taxa de aprovação subiu em relação ao período anterior.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Novos vs Recorrentes (Fidelização) */}
                <Card className="shadow-md border-none">
                    <CardHeader><CardTitle className="text-base">Fidelização</CardTitle></CardHeader>
                    <CardContent>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={bi?.demographics.retention} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {bi?.demographics.retention.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Gênero (Igual à imagem) */}
                <Card className="shadow-md border-none">
                    <CardHeader><CardTitle className="text-base">Perfil por Gênero</CardTitle></CardHeader>
                    <CardContent>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={bi?.demographics.gender} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                                        {bi?.demographics.gender.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Alerta de Segmento */}
                <Card className="bg-[#0B1221] text-white shadow-xl border-none p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter">Sugestão de IA</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Sua taxa de recorrência pode ser otimizada. 
                            <strong> Ação sugerida:</strong> Criar um cupom de 10% OFF exclusivo para clientes que não compram há mais de 30 dias.
                        </p>
                    </div>
                    <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 font-bold h-12 uppercase text-xs">Ativar Campanha</Button>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="logistica" className="space-y-6">
            <Card className="shadow-md border-none">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-blue-600" /> Distribuição por Região (Top Estados)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bi?.demographics.regions} layout="vertical" margin={{ left: 50 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700}} />
                                <Tooltip cursor={{fill: '#f1f5f9'}} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;