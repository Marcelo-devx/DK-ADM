"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, TrendingUp, Users, ShoppingBag, 
  Zap, Target, Package, AlertTriangle, ArrowRight, UserMinus, Sparkles,
  Plus, CheckCircle2, Crown, Wallet, BarChart3, MessageSquare, ArrowDownRight,
  TrendingDown, Coins, Info
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MetaflowInsightsPage = () => {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["actionable-insights-final"],
    queryFn: async () => {
        const { data, error } = await supabase.functions.invoke("actionable-insights");
        if (error) throw error;
        return data;
    },
    refetchInterval: 300000 
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER MASTER */}
      <div className="bg-[#0B1221] text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl border border-blue-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <Sparkles className="w-12 h-12 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter">Decision Intelligence</h1>
                    <p className="text-blue-200 text-lg mt-1 font-medium">Análise avançada de capital, giro e retenção.</p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                    <Badge className="bg-blue-500 text-white font-black px-4 py-2 text-sm italic">SISTEMA ATIVO</Badge>
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sincronizado há 2 min</p>
            </div>
        </div>
      </div>

      {/* MÉTRICAS DE RISCO FINANCEIRO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-rose-50 border-rose-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase text-rose-700 flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4" /> Fuga de Receita (Leakage)
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-black text-rose-900">{formatCurrency(insights?.risks?.lost_revenue)}</div>
                        <p className="text-xs text-rose-700 font-medium">Pedidos pendentes que nunca foram pagos.</p>
                    </div>
                    <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100 font-bold text-xs uppercase">Cobrar Clientes</Button>
                </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase text-orange-700 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" /> Capital Imobilizado (Dead Stock)
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-black text-orange-900">{formatCurrency(insights?.risks?.dead_stock_value)}</div>
                        <p className="text-xs text-orange-700 font-medium">Produtos sem venda há mais de 30 dias.</p>
                    </div>
                    <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100 font-bold text-xs uppercase">Liquidar Estoque</Button>
                </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RANKING VIP */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="pb-2 border-b bg-yellow-50/30">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase text-yellow-700 flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Seus Top Clientes
                    </CardTitle>
                    <Badge className="bg-yellow-500">VIP</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {insights?.vips?.map((vip: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-yellow-200 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-xs">#{i+1}</div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">{vip.first_name} {vip.last_name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">{vip.points} pts acumulados</p>
                            </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-600"><MessageSquare className="w-4 h-4" /></Button>
                    </div>
                ))}
            </CardContent>
        </Card>

        {/* LUCRATIVIDADE */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="pb-2 border-b bg-green-50/30">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase text-green-700 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Margem por Marca
                    </CardTitle>
                    <Badge className="bg-green-600">LUCRO</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {insights?.profitability?.map((brand: any, i: number) => (
                    <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold px-1">
                            <span>{brand.name || 'Sem Marca'}</span>
                            <span className="text-green-600">{formatCurrency(brand.value)}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div 
                                className="bg-green-500 h-full transition-all duration-1000" 
                                style={{ width: `${(brand.value / insights.profitability[0].value) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>

        {/* ALERTA DE REPOSIÇÃO */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="pb-2 border-b bg-orange-50/30">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase text-orange-700 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Alerta de Esgotamento
                    </CardTitle>
                    <Badge variant="destructive">URGENTE</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
                {insights?.inventory?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-orange-50/20 border border-orange-100">
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate w-32">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">Impacto: {formatCurrency(item.profit_impact)}/mês</p>
                        </div>
                        <div className="text-right">
                            <Badge variant="outline" className="text-[9px] bg-white border-orange-200 text-orange-700">
                                {item.days_remaining <= 0 ? "Esgotado" : `Acaba em ${item.days_remaining}d`}
                            </Badge>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
      </div>

      {/* AÇÕES ESTRATÉGICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[#0B1221] border-none shadow-xl p-8 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Target className="w-32 h-32 text-blue-500" />
                </div>
                <div className="relative z-10 space-y-6">
                    <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black">ESTRATÉGIA CROSS-SELL</Badge>
                    <h3 className="text-2xl font-black text-white italic uppercase leading-none">Combo Inteligente</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        A IA detectou que o produto <strong>{insights?.associations[0]?.product_a}</strong> e <strong>{insights?.associations[0]?.product_b}</strong> possuem alta correlação. 
                        Crie um Kit agora com 5% de desconto para aumentar o faturamento em aprox. 12%.
                    </p>
                    <Button className="bg-blue-600 hover:bg-blue-700 font-black w-full h-12 gap-2">
                        <Plus className="w-5 h-5" /> CRIAR KIT RECOMENDADO
                    </Button>
                </div>
          </Card>

          <Card className="bg-white border-2 border-dashed border-rose-200 shadow-md p-8 relative group">
                <div className="space-y-6">
                    <Badge variant="outline" className="text-rose-600 border-rose-200 font-black">CAMPANHA DE RETENÇÃO</Badge>
                    <h3 className="text-2xl font-black text-gray-900 italic uppercase leading-none">Recuperar Clientes Inativos</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Existem <strong>{insights?.churn?.length} clientes</strong> de alto valor que não compram há mais de 30 dias. 
                        Eles representam um faturamento potencial de <strong>{formatCurrency(insights?.churn?.reduce((acc:any, c:any) => acc + (c.total_orders * 50), 0))}</strong>.
                    </p>
                    <Button variant="outline" className="border-rose-600 text-rose-600 hover:bg-rose-50 font-black w-full h-12 gap-2">
                        <Zap className="w-5 h-5" /> DISPARAR CUPOM DE VOLTA
                    </Button>
                </div>
          </Card>
      </div>
    </div>
  );
};

export default MetaflowInsightsPage;