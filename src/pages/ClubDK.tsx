import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Gift, Truck, Zap, Lock, Info, Star, Copy, UserPlus, Cake } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Configuração dos Cupons de Resgate
const REDEMPTION_OPTIONS = [
  { points: 50, value: 5 },
  { points: 100, value: 10 },
  { points: 200, value: 20 },
  { points: 500, value: 50 },
  { points: 700, value: 70 },
  { points: 900, value: 90 },
  { points: 1100, value: 110 },
  { points: 1300, value: 130 },
  { points: 1500, value: 150 },
];

export default function ClubDKPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [birthDate, setBirthDate] = useState("");

  // Busca dados do perfil enriquecidos
  const { data: profile, isLoading } = useQuery({
    queryKey: ["loyaltyProfile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, loyalty_tiers(*)")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Busca todos os níveis para mostrar a régua
  const { data: tiers } = useQuery({
    queryKey: ["loyaltyTiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_tiers")
        .select("*")
        .order("min_spend", { ascending: true });
      return data || [];
    },
  });

  // Mutação para salvar aniversário
  const saveBirthDateMutation = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase.rpc("update_birth_date", { p_date: date });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Data salva! Você ganhou 100 pontos.");
      queryClient.invalidateQueries({ queryKey: ["loyaltyProfile"] });
    },
    onError: (err: any) => showError(err.message),
  });

  // Mutação para resgatar cupom
  const redeemMutation = useMutation({
    mutationFn: async (option: { points: number, value: number }) => {
      if ((profile?.points || 0) < option.points) throw new Error("Pontos insuficientes.");
      
      const { error } = await supabase.rpc("redeem_coupon_v2", { 
        p_points_cost: option.points,
        p_discount_value: option.value 
      });
      // Nota: Precisamos criar essa RPC específica ou adaptar a existente
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cupom resgatado com sucesso! Verifique na finalização da compra.");
      queryClient.invalidateQueries({ queryKey: ["loyaltyProfile"] });
    },
    onError: (err: any) => showError(err.message || "Erro ao resgatar."),
  });

  if (isLoading || !profile || !tiers) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  const currentTier = profile.loyalty_tiers;
  const nextTier = tiers.find((t: any) => t.min_spend > (profile.spend_last_6_months || 0));
  const spend = profile.spend_last_6_months || 0;
  
  // Cálculo de progresso
  let progressPercent = 0;
  let toNextLevel = 0;
  
  if (nextTier) {
    const currentTierMin = currentTier?.min_spend || 0;
    const range = nextTier.min_spend - currentTierMin;
    const currentInLevel = spend - currentTierMin;
    progressPercent = Math.min(100, Math.max(0, (currentInLevel / range) * 100));
    toNextLevel = nextTier.min_spend - spend;
  } else {
    progressPercent = 100; // Nível Máximo (Black)
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-5xl">
      
      {/* HERO SECTION */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-slate-800 to-black text-white p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10">
            <Crown className="w-64 h-64 text-white" />
        </div>
        
        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
                <Badge className="bg-yellow-500 text-black font-black uppercase px-3 py-1">Club DK</Badge>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                    Você é cliente <span className="text-yellow-400">{currentTier?.name}</span>
                </h1>
                <p className="text-gray-300 text-lg font-medium">
                    Seu histórico vale mais do que você imagina. Continue comprando para desbloquear benefícios exclusivos.
                </p>
                
                <div className="pt-4">
                    <div className="flex justify-between text-sm font-bold mb-2">
                        <span>Progresso do Nível</span>
                        {nextTier ? <span>Faltam {formatCurrency(toNextLevel)} para {nextTier.name}</span> : <span>Nível Máximo!</span>}
                    </div>
                    <Progress 
                      value={progressPercent} 
                      className="h-3 bg-gray-700 [&>div]:bg-gradient-to-r [&>div]:from-yellow-400 [&>div]:to-yellow-600" 
                    />
                    <p className="text-xs text-gray-400 mt-2">Baseado no gasto de {formatCurrency(spend)} nos últimos 6 meses.</p>
                </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-bold uppercase text-gray-300 mb-1">Saldo Disponível</p>
                <div className="text-6xl font-black text-white mb-2">{profile.points}</div>
                <p className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">pontos</p>
                <p className="text-xs text-gray-400 mt-4 max-w-xs mx-auto">
                    Use seus pontos para gerar cupons de desconto na sua próxima compra.
                </p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: RESGATE E AÇÕES */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* ABAS PRINCIPAIS */}
            <Tabs defaultValue="benefits" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="benefits">Benefícios & Níveis</TabsTrigger>
                    <TabsTrigger value="redeem">Resgatar Pontos</TabsTrigger>
                </TabsList>

                {/* ABA BENEFÍCIOS */}
                <TabsContent value="benefits" className="space-y-6">
                    <div className="grid gap-4">
                        {tiers.map((tier: any) => {
                            const isCurrent = tier.id === currentTier?.id;
                            const isLocked = tier.min_spend > spend;
                            const benefits = tier.benefits ? JSON.parse(JSON.stringify(tier.benefits)) : [];

                            return (
                                <Card key={tier.id} className={cn("border-l-4 transition-all", isCurrent ? "border-l-yellow-500 bg-yellow-50/30 shadow-md transform scale-[1.01]" : "border-l-gray-200 opacity-80")}>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg border-2", isCurrent ? "bg-yellow-100 text-yellow-700 border-yellow-400" : "bg-gray-100 text-gray-500 border-gray-200")}>
                                                {tier.name[0]}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg flex items-center gap-2">
                                                    {tier.name}
                                                    {isCurrent && <Badge className="bg-yellow-500 text-black">Atual</Badge>}
                                                    {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
                                                </h3>
                                                <p className="text-sm text-muted-foreground">Gasto: {formatCurrency(tier.min_spend)} {tier.max_spend ? `a ${formatCurrency(tier.max_spend)}` : "+"}</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {Array.isArray(benefits) && benefits.map((b: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px] bg-white border">{b}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {isLocked && (
                                            <div className="hidden md:block text-right">
                                                <p className="text-xs font-bold text-gray-400">Falta</p>
                                                <p className="text-sm font-bold text-gray-600">{formatCurrency(tier.min_spend - spend)}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </TabsContent>

                {/* ABA RESGATE */}
                <TabsContent value="redeem">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5 text-purple-600" /> Loja de Pontos</CardTitle>
                            <CardDescription>Troque seus pontos por descontos imediatos. Limite de 30% do valor da compra.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {REDEMPTION_OPTIONS.map((opt) => {
                                    const canAfford = profile.points >= opt.points;
                                    return (
                                        <button
                                            key={opt.points}
                                            disabled={!canAfford}
                                            onClick={() => {
                                                if(confirm(`Trocar ${opt.points} pontos por R$ ${opt.value} de desconto?`)) {
                                                    // TODO: Implementar RPC de resgate
                                                    alert("Funcionalidade de troca será implementada no próximo passo (RPC).");
                                                }
                                            }}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                                                canAfford 
                                                    ? "border-purple-100 bg-purple-50 hover:border-purple-500 cursor-pointer" 
                                                    : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed grayscale"
                                            )}
                                        >
                                            <span className="text-2xl font-black text-purple-700">R$ {opt.value}</span>
                                            <span className="text-xs font-bold text-gray-500 mt-1 uppercase">Cupom</span>
                                            <div className="mt-3 bg-white px-3 py-1 rounded-full text-xs font-bold shadow-sm border">
                                                {opt.points} pts
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>

        {/* COLUNA DIREITA: GANHAR MAIS PONTOS */}
        <div className="space-y-6">
            
            {/* GANHE MAIS */}
            <Card className="bg-gradient-to-b from-blue-50 to-white border-blue-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-800"><Zap className="w-5 h-5" /> Acelere seus Ganhos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border">
                        <div className="p-2 bg-green-100 text-green-700 rounded-full"><Star className="w-4 h-4" /></div>
                        <div className="flex-1">
                            <p className="text-sm font-bold">Compras Acima de R$500</p>
                            <p className="text-xs text-gray-500">+10 pontos extras</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border">
                        <div className="p-2 bg-orange-100 text-orange-700 rounded-full"><Truck className="w-4 h-4" /></div>
                        <div className="flex-1">
                            <p className="text-sm font-bold">Recorrência Mensal</p>
                            <p className="text-xs text-gray-500">Até +15 pontos por compra</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ANIVERSÁRIO */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-pink-600"><Cake className="w-5 h-5" /> Seu Aniversário</CardTitle>
                </CardHeader>
                <CardContent>
                    {profile.birth_date_locked ? (
                        <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-100">
                            <p className="text-sm font-medium text-pink-800">Parabéns! Sua data está registrada.</p>
                            <p className="text-2xl font-black text-pink-600 mt-2">
                                {format(new Date(profile.date_of_birth), "dd/MM", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">Você ganhará 100 pontos neste dia.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-600">Informe sua data para ganhar <strong>100 pontos</strong> agora! (Não poderá alterar depois)</p>
                            <div className="flex gap-2">
                                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="text-sm" />
                                <Button size="sm" onClick={() => saveBirthDateMutation.mutate(birthDate)} disabled={!birthDate}>Salvar</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* INDICAÇÃO */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-600"><UserPlus className="w-5 h-5" /> Indique e Ganhe</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">Ganhe <strong>50 pontos</strong> quando seu amigo fizer a primeira compra.</p>
                    <div className="flex gap-2">
                        <Input readOnly value={profile.referral_code} className="font-mono bg-gray-50 text-center font-bold" />
                        <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(profile.referral_code); showSuccess("Código copiado!"); }}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

        </div>
      </div>
    </div>
  );
}