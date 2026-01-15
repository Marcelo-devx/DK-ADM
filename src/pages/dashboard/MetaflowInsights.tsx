"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, TrendingUp, Users, ShoppingBag, 
  Zap, Target, Package, AlertTriangle, ArrowRight, UserMinus, Sparkles,
  Plus, CheckCircle2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MetaflowInsightsPage = () => {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["actionable-insights"],
    queryFn: async () => {
        const { data, error } = await supabase.functions.invoke("actionable-insights");
        if (error) throw error;
        return data;
    },
    refetchInterval: 300000 // 5 minutos
  });

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-[#0B1221] text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl border border-blue-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <Lightbulb className="w-12 h-12 text-white" />
            </div>
            <div className="flex-1">
                <h1 className="text-3xl font-black italic uppercase tracking-tighter">Insights de Negócio</h1>
                <p className="text-blue-200 text-lg mt-2 font-medium">
                    Análise computacional baseada no comportamento real da sua loja.
                </p>
            </div>
            <Badge className="bg-green-500 text-white font-black px-4 py-2 text-sm italic">DADOS REAIS</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CARD 1: PREVISÃO DE ESGOTAMENTO (LOGÍSTICA) */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <div className="h-2 bg-orange-500" />
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Package className="w-5 h-5" /></div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">Reposição</Badge>
                </div>
                <CardTitle className="pt-4 text-lg">Alertas de Estoque</CardTitle>
                <CardDescription>Previsão baseada na velocidade de venda (15 dias).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {insights?.inventory?.length > 0 ? (
                    insights.inventory.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="overflow-hidden">
                                <p className="text-xs font-bold truncate w-40">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">{item.daily_rate} un / dia</p>
                            </div>
                            <div className="text-right">
                                <Badge variant={item.days_remaining <= 3 ? "destructive" : "outline"} className="text-[10px]">
                                    {item.days_remaining <= 0 ? "Esgotado" : `Acaba em ${item.days_remaining}d`}
                                </Badge>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Sem dados de venda suficientes para projetar.</p>
                )}
            </CardContent>
        </Card>

        {/* CARD 2: VENDA CASADA (MARKETING) */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <div className="h-2 bg-blue-500" />
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Target className="w-5 h-5" /></div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">Cross-sell</Badge>
                </div>
                <CardTitle className="pt-4 text-lg">Produtos Sugeridos</CardTitle>
                <CardDescription>Itens que os clientes mais compram juntos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {insights?.associations?.length > 0 ? (
                    insights.associations.map((pair: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 relative group overflow-hidden">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-800">
                                <span className="truncate flex-1">{pair.product_a}</span>
                                <Plus className="w-3 h-3 shrink-0" />
                                <span className="truncate flex-1">{pair.product_b}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] text-blue-600 font-medium">{pair.frequency} pedidos em comum</span>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] p-0 font-bold text-blue-700 group-hover:translate-x-1 transition-transform">
                                    Criar Kit <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Ainda não há pedidos suficientes para cruzamento.</p>
                )}
            </CardContent>
        </Card>

        {/* CARD 3: RECUPERAÇÃO DE CLIENTES (CRM) */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <div className="h-2 bg-rose-500" />
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><UserMinus className="w-5 h-5" /></div>
                    <Badge variant="secondary" className="bg-rose-100 text-rose-700">Retenção</Badge>
                </div>
                <CardTitle className="pt-4 text-lg">Clientes Sumidos</CardTitle>
                <CardDescription>Clientes frequentes que não compram há {'>'} 30 dias.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {insights?.churn?.length > 0 ? (
                    insights.churn.map((client: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-dashed border-rose-200 bg-rose-50/20">
                            <div>
                                <p className="text-xs font-bold text-gray-800">{client.customer_name}</p>
                                <p className="text-[10px] text-muted-foreground">{client.total_orders} compras totais</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-rose-600 uppercase tracking-tighter">{client.days_since_last_order} dias sumido</p>
                                <Button variant="link" className="h-4 p-0 text-[9px] text-blue-600 font-bold">Enviar Promo</Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Tudo em dia! Seus clientes estão ativos.</p>
                )}
            </CardContent>
        </Card>
      </div>

      {/* DOCUMENTAÇÃO DA LÓGICA (O QUE SUBSTITUI O METAFLOW) */}
      <Card className="bg-[#0B1221] border-none shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400" /> Lógica de Negócio Integrada
              </CardTitle>
          </CardHeader>
          <CardContent className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h4 className="text-blue-400 font-bold flex items-center gap-2">
                            <Zap className="w-4 h-4" /> SQL Analysis vs. Deep Learning
                        </h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Substituímos o Metaflow por **SQL dinâmico**. Em vez de treinar um modelo caro, o sistema faz cálculos matemáticos em tempo real sobre a sua base de pedidos. Isso é 100% gratuito e rápido o suficiente para sua escala atual.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-blue-400 font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Vantagens de ser Nativo
                        </h4>
                        <ul className="text-gray-400 text-sm space-y-2 list-disc pl-4">
                            <li>Custo zero de infraestrutura de IA.</li>
                            <li>Dados atualizados instantaneamente após cada pedido.</li>
                            <li>Lógica personalizada para o mercado de Tabacaria.</li>
                        </ul>
                    </div>
                </div>

                <div className="bg-[#1E293B] p-6 rounded-2xl border border-white/10 flex flex-col justify-center">
                    <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Pipeline de Dados atual</p>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-green-600 flex items-center justify-center text-[10px] font-bold">SQL</div>
                            <div className="h-[1px] flex-1 bg-white/10" />
                            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] font-bold">EDGE</div>
                            <div className="h-[1px] flex-1 bg-white/10" />
                            <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center text-[10px] font-bold">WEB</div>
                        </div>
                        <div className="grid grid-cols-3 text-[10px] font-bold text-gray-500 uppercase text-center">
                            <span>Processamento</span>
                            <span>Agregação</span>
                            <span>Visualização</span>
                        </div>
                    </div>
                    <div className="mt-8 p-4 bg-blue-900/20 rounded-xl border border-blue-500/20">
                        <p className="text-xs text-blue-300 italic">
                            "A análise de cesta de compras (Cross-sell) ajuda a identificar que sabores de essência combinam com quais marcas de carvão."
                        </p>
                    </div>
                </div>
          </CardContent>
      </Card>
    </div>
  );
};

export default MetaflowInsightsPage;