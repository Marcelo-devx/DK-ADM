"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, Package, Target, UserMinus, Plus, ArrowRight, 
  CheckCircle2, Sparkles, BarChart3, Crown, Wallet, MessageSquare, Zap 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const MetaflowInsightsPage = () => {
  const navigate = useNavigate();
  
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

  const handleCreateKit = (productA: string, idA: number, productB: string, idB: number) => {
    navigate("/dashboard/promotions", { 
      state: { 
        suggestedName: `Kit ${productA} + ${productB}`,
        suggestedDescription: `Combo especial contendo ${productA} e ${productB}. Economize levando os dois!`,
        suggestedProductIds: [idA, idB]
      } 
    });
  };

  const handleRecoverClient = (clientName: string) => {
     navigate("/dashboard/coupons", {
        state: {
            suggestedName: "VOLTA10",
            suggestedDescription: `Cupom especial de reativação para o cliente ${clientName || "sumido"}.`
        }
     });
  };

  const handleCreateCrossSellKit = () => {
      const assoc = insights?.associations[0];
      if (assoc) {
          handleCreateKit(assoc.product_a, assoc.product_a_id, assoc.product_b, assoc.product_b_id);
      }
  };

  const handleGlobalRecovery = () => {
      navigate("/dashboard/coupons", {
        state: {
            suggestedName: "SAUDADES10",
            suggestedDescription: "Cupom geral para campanha de recuperação de clientes inativos."
        }
     });
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER INTEGRADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" /> Inteligência de Negócio
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Recomendações geradas a partir do comportamento de vendas.</p>
        </div>
        <div className="flex gap-2">
            <Badge className="bg-blue-600 text-white font-bold px-3 py-1">IA ATIVA</Badge>
            <Badge variant="outline" className="text-gray-500 font-bold px-3 py-1">v2.1.0</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUNA 1: REPOSIÇÃO */}
        <Card className="border-none shadow-md bg-white flex flex-col h-full">
            <div className="h-1 bg-orange-500 rounded-t-lg" />
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600 border border-orange-100"><Package className="w-6 h-6" /></div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 font-bold rounded-full px-3">Reposição</Badge>
                </div>
                <CardTitle className="pt-6 text-xl font-bold text-gray-800">Alertas de Estoque</CardTitle>
                <CardDescription className="text-gray-500">Previsão baseada na velocidade de venda (15 dias).</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                {insights?.inventory?.length > 0 ? (
                    insights.inventory.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors group">
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-800 truncate w-32 md:w-40">{item.name}</p>
                                <p className="text-[11px] text-muted-foreground font-medium">{item.daily_rate} unidades / dia</p>
                            </div>
                            <div className="text-right">
                                <Badge variant={item.days_remaining <= 3 ? "destructive" : "outline"} className={cn("text-[10px] font-black", item.days_remaining > 3 && "text-orange-600 border-orange-200")}>
                                    {item.days_remaining <= 0 ? "ESGOTADO" : `ACABA EM ${item.days_remaining}D`}
                                </Badge>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-sm text-muted-foreground italic">Sem dados de venda suficientes para projetar.</p>
                    </div>
                )}
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
                                <span className="truncate flex-1">{pair.product_a}</span>
                                <Plus className="w-3 h-3 shrink-0 text-blue-400" />
                                <span className="truncate flex-1">{pair.product_b}</span>
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
                        <p className="text-sm text-muted-foreground italic">Ainda não há pedidos suficientes para cruzamento.</p>
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

      {/* SEÇÃO: ESTRATÉGIAS DE VENDA */}
      <div className="pt-4 space-y-4">
        <h2 className="text-sm font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Ações Estratégicas Sugeridas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0B1221] border-none shadow-xl p-8 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Target className="w-32 h-32 text-blue-500" />
                    </div>
                    <div className="relative z-10 space-y-6">
                        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black">ESTRATÉGIA CROSS-SELL</Badge>
                        <h3 className="text-2xl font-black text-white italic uppercase leading-none">Combo de Alta Performance</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            A IA detectou que o produto <strong>{insights?.associations[0]?.product_a || 'Item A'}</strong> e <strong>{insights?.associations[0]?.product_b || 'Item B'}</strong> possuem alta correlação. 
                            Crie um Kit agora com 5% de desconto para aumentar o faturamento em aprox. 12%.
                        </p>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-700 font-black w-full h-12 gap-2"
                            onClick={handleCreateCrossSellKit}
                        >
                            <Plus className="w-5 h-5" /> CRIAR KIT RECOMENDADO
                        </Button>
                    </div>
            </Card>

            <Card className="bg-white border-2 border-dashed border-rose-200 shadow-md p-8 relative group">
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-rose-600 border-rose-200 font-black">CAMPANHA DE RETENÇÃO</Badge>
                        <h3 className="text-2xl font-black text-gray-900 italic uppercase leading-none">Recuperar Clientes Inativos</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Existem <strong>{insights?.churn?.length || 0} clientes</strong> de alto valor que não compram há mais de 30 dias. 
                            Eles representam um faturamento potencial imediato através de cupons de reativação.
                        </p>
                        <Button 
                            variant="outline" 
                            className="border-rose-600 text-rose-600 hover:bg-rose-50 font-black w-full h-12 gap-2"
                            onClick={handleGlobalRecovery}
                        >
                            <Zap className="w-5 h-5" /> DISPARAR CUPOM DE VOLTA (10% OFF)
                        </Button>
                    </div>
            </Card>
        </div>
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
    </div>
  );
};

export default MetaflowInsightsPage;