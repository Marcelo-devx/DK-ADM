"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Brain, Sparkles, TrendingUp, Users, ShoppingBag, 
  Zap, ArrowRight, HelpCircle, Bot, LineChart, Target
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MetaflowInsightsPage = () => {
  // Buscamos dados básicos para ancorar a explicação na realidade do usuário
  const { data: stats, isLoading } = useQuery({
    queryKey: ["metaflow-anchor-data"],
    queryFn: async () => {
        const { count: products } = await supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: orders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
        const { count: clients } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        return { products, orders, clients };
    }
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-[#0B1221] text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl border border-blue-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <Brain className="w-12 h-12 text-white" />
            </div>
            <div className="flex-1">
                <h1 className="text-3xl font-black italic uppercase tracking-tighter">Metaflow AI Insights</h1>
                <p className="text-blue-200 text-lg mt-2 font-medium">
                    Transformando sua base de <span className="text-white font-bold">{stats?.orders} pedidos</span> em lucro previsível.
                </p>
            </div>
            <Badge className="bg-amber-500 text-white font-black px-4 py-2 text-sm italic">MODO SIMULAÇÃO</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CASO 1: ESTOQUE */}
        <Card className="border-none shadow-md overflow-hidden group">
            <div className="h-2 bg-blue-500" />
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><TrendingUp className="w-5 h-5" /></div>
                    <Badge variant="secondary">Previsão</Badge>
                </div>
                <CardTitle className="pt-4">Otimização de Compras</CardTitle>
                <CardDescription>Evite dinheiro parado e ruptura de estoque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border-2 border-dashed">
                    <p className="text-xs font-bold text-gray-500 uppercase">Hoje você tem:</p>
                    <p className="text-2xl font-black">{stats?.products} SKUs cadastrados</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-700 font-bold bg-blue-50 p-3 rounded-lg">
                    <Sparkles className="w-4 h-4" />
                    <span>Metaflow diria: "O Essência X vende 40% mais em dias de chuva. Compre 20 un. extras hoje."</span>
                </div>
            </CardContent>
        </Card>

        {/* CASO 2: RECOMENDAÇÃO */}
        <Card className="border-none shadow-md overflow-hidden">
            <div className="h-2 bg-emerald-500" />
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Target className="w-5 h-5" /></div>
                    <Badge variant="secondary">Cross-sell</Badge>
                </div>
                <CardTitle className="pt-4">Venda Casada Inteligente</CardTitle>
                <CardDescription>Aumente o ticket médio sem esforço humano.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border-2 border-dashed">
                    <p className="text-xs font-bold text-gray-500 uppercase">Padrão Identificado:</p>
                    <p className="text-sm font-medium">92% de quem compra 'Carvão' também leva 'Alumínio'.</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-emerald-700 font-bold bg-emerald-50 p-3 rounded-lg">
                    <Bot className="w-4 h-4" />
                    <span>Metaflow criaria kits automáticos no site baseados nestes padrões reais.</span>
                </div>
            </CardContent>
        </Card>

        {/* CASO 3: CHURN */}
        <Card className="border-none shadow-md overflow-hidden">
            <div className="h-2 bg-rose-500" />
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><Users className="w-5 h-5" /></div>
                    <Badge variant="secondary">Retenção</Badge>
                </div>
                <CardTitle className="pt-4">Recuperação de Clientes</CardTitle>
                <CardDescription>Não deixe os clientes esquecerem de você.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border-2 border-dashed">
                    <p className="text-xs font-bold text-gray-500 uppercase">Base Ativa:</p>
                    <p className="text-2xl font-black">{stats?.clients} Clientes</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-rose-700 font-bold bg-rose-50 p-3 rounded-lg">
                    <Zap className="w-4 h-4" />
                    <span>A IA avisaria: "João não compra há 20 dias. Ele costuma vir a cada 15. Enviar cupom?"</span>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* DOCUMENTAÇÃO VISUAL (O QUE ELE FAZ) */}
      <Card className="bg-[#0B1221] border-none shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-400" /> O que o Metaflow realmente faz?
              </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-8 space-y-6 border-r border-white/10">
                      <div className="flex gap-4">
                          <div className="h-10 w-10 shrink-0 bg-white/5 rounded-lg flex items-center justify-center font-black text-blue-400 border border-white/10">1</div>
                          <div>
                              <h4 className="text-white font-bold text-lg">Criação de Workflows</h4>
                              <p className="text-gray-400 text-sm mt-1">Ele organiza os "passos" que a inteligência deve seguir: Buscar dados no Supabase {'>'} Limpar os dados {'>'} Aplicar o Algoritmo {'>'} Salvar Previsão.</p>
                          </div>
                      </div>
                      <div className="flex gap-4">
                          <div className="h-10 w-10 shrink-0 bg-white/5 rounded-lg flex items-center justify-center font-black text-blue-400 border border-white/10">2</div>
                          <div>
                              <h4 className="text-white font-bold text-lg">Processamento em Nuvem</h4>
                              <p className="text-gray-400 text-sm mt-1">Ele libera seu painel administrativo desse peso. Cálculos matemáticos complexos de IA rodam em servidores de alta performance.</p>
                          </div>
                      </div>
                      <div className="flex gap-4">
                          <div className="h-10 w-10 shrink-0 bg-white/5 rounded-lg flex items-center justify-center font-black text-blue-400 border border-white/10">3</div>
                          <div>
                              <h4 className="text-white font-bold text-lg">Versionamento de Dados</h4>
                              <p className="text-gray-400 text-sm mt-1">O Metaflow guarda um "histórico" de cada previsão. Se uma sugestão de compra foi errada, ele volta no tempo para entender o porquê e aprender.</p>
                          </div>
                      </div>
                  </div>

                  <div className="p-8 bg-blue-600/5 flex flex-col justify-center">
                      <div className="bg-[#1E293B] p-6 rounded-2xl border border-white/10 shadow-inner">
                          <div className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-widest mb-4">
                              <LineChart className="w-4 h-4" /> Exemplo de Fluxo (Flow)
                          </div>
                          <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold">START</div>
                                  <div className="h-[2px] flex-1 bg-white/10" />
                                  <div className="text-xs text-gray-300 font-mono">fetch_orders</div>
                                  <div className="h-[2px] flex-1 bg-white/10" />
                                  <div className="text-xs text-gray-300 font-mono">train_model</div>
                                  <div className="h-[2px] flex-1 bg-white/10" />
                                  <div className="h-8 w-8 rounded bg-green-600 flex items-center justify-center text-[10px] font-bold">END</div>
                              </div>
                              <p className="text-[11px] text-gray-500 italic">O Metaflow garante que se o passo de "train_model" falhar, ele tente novamente sem perder os dados dos passos anteriores.</p>
                          </div>
                      </div>
                      <Button className="mt-8 bg-blue-600 hover:bg-blue-700 font-black h-12">CONTRATAR IMPLEMENTAÇÃO DE IA</Button>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
};

export default MetaflowInsightsPage;