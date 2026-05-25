import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Lock, Cake, Loader2, History, TicketCheck, TrendingUp, TrendingDown } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SalesPopupDisplay } from "@/components/SalesPopupDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RewardCoupon {
    id: number;
    name: string;
    points_cost: number;
    discount_value: number;
    description: string;
}

export default function ClubDKPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [birthDate, setBirthDate] = useState("");
  const birthdayProcessedRef = useRef(false);
  const [pendingRedeemCoupon, setPendingRedeemCoupon] = useState<RewardCoupon | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["loyaltyProfile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, points, date_of_birth, birth_date_locked")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: rewardCoupons, isLoading: isLoadingRewards } = useQuery({
    queryKey: ["publicRewardCoupons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .gt("points_cost", 0)
        .eq("is_active", true)
        .order("points_cost");
      return data as RewardCoupon[];
    },
  });

  const { data: loyaltyHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["myLoyaltyHistory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_history")
        .select("id, points, description, operation_type, created_at, related_order_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: myCoupons, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ["myUserCoupons", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_coupons")
        .select("id, is_used, expires_at, created_at, order_id, coupons(name, discount_value, description)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (birthdayProcessedRef.current) return;
    if (!user || !profile?.date_of_birth) return;

    try {
      const dob = new Date(profile.date_of_birth);
      const today = new Date();
      const isBirthdayToday =
        dob.getUTCDate() === today.getUTCDate() &&
        dob.getUTCMonth() === today.getUTCMonth();

      if (!isBirthdayToday) return;

      birthdayProcessedRef.current = true;

      (async () => {
        try {
          const { data, error } = await supabase.rpc("process_annual_birthday_bonus", {
            p_user_id: user.id,
          });
          if (error) {
            showError(`Erro ao processar bônus de aniversário: ${error.message}`);
            return;
          }
          if (
            data === "Bônus concedido com sucesso!" ||
            (typeof data === "string" && data.toLowerCase().includes("concedido"))
          ) {
            showSuccess("🎉 Feliz aniversário! Você acaba de ganhar seus pontos de presente.");
            queryClient.invalidateQueries({ queryKey: ["loyaltyProfile"] });
          }
        } catch (err: any) {
          showError(`Erro ao processar bônus de aniversário: ${err?.message ?? String(err)}`);
        }
      })();
    } catch (err: any) {
      birthdayProcessedRef.current = true;
      console.error("ClubDK birthday processing error:", err);
    }
  }, [user, profile?.date_of_birth, queryClient]);

  const saveBirthDateMutation = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase.rpc("update_birth_date", { p_date: date });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Data salva! Você ganhou seus primeiros pontos de boas-vindas.");
      queryClient.invalidateQueries({ queryKey: ["loyaltyProfile"] });
    },
    onError: (err: any) => showError(err.message),
  });

  const redeemMutation = useMutation({
    mutationFn: async (couponId: number) => {
      const { data, error } = await supabase.rpc("redeem_coupon", {
        coupon_id_to_redeem: couponId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("Resgate realizado! O cupom está na sua conta.");
      queryClient.invalidateQueries({ queryKey: ["loyaltyProfile"] });
      queryClient.invalidateQueries({ queryKey: ["myUserCoupons"] });
      queryClient.invalidateQueries({ queryKey: ["myLoyaltyHistory"] });
    },
    onError: (err: any) => showError(`Erro no resgate: ${err.message}`),
  });

  if (isLoading || !profile)
    return (
      <div className="p-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const getOperationLabel = (type: string) => {
    switch (type) {
      case "order_points":    return "Compra";
      case "redeem":          return "Resgate";
      case "adjustment":      return "Ajuste";
      case "birthday_bonus":  return "Aniversário";
      case "referral_bonus":  return "Indicação";
      case "ticket_bonus":    return "Ticket Alto";
      case "recurrence_bonus":return "Recorrência";
      case "earn":            return "Ganho";
      default:                return type;
    }
  };

  const now = new Date();
  const activeCoupons  = (myCoupons || []).filter((c: any) => !c.is_used && new Date(c.expires_at) > now);
  const usedCoupons    = (myCoupons || []).filter((c: any) => c.is_used);
  const expiredCoupons = (myCoupons || []).filter((c: any) => !c.is_used && new Date(c.expires_at) <= now);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-5xl">

      {/* HERO SECTION */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-slate-800 to-black text-white p-8 md:p-12 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="space-y-3">
            <Badge className="bg-yellow-500 text-black font-black uppercase px-3 py-1">Club DK</Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
              Bem-vindo ao <span className="text-yellow-400">Club DK</span>
            </h1>
            <p className="text-gray-300 text-lg font-medium">
              Acumule pontos a cada compra e troque por cupons de desconto exclusivos.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col items-center justify-center text-center min-w-[180px]">
            <p className="text-sm font-bold uppercase text-gray-300 mb-1">Saldo Disponível</p>
            <div className="text-6xl font-black text-white mb-2">{profile.points}</div>
            <p className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">pontos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Tabs defaultValue="redeem" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="redeem">Resgatar</TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
              <TabsTrigger value="coupons" className="flex items-center gap-1">
                <TicketCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cupons</span>
                {activeCoupons.length > 0 && (
                  <span className="ml-1 bg-green-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {activeCoupons.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── ABA: RESGATAR PONTOS ── */}
            <TabsContent value="redeem">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-600" /> Loja de Pontos
                  </CardTitle>
                  <CardDescription>Troque seus pontos por cupons de desconto.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingRewards ? (
                    <div className="text-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
                    </div>
                  ) : rewardCoupons && rewardCoupons.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {rewardCoupons.map((coupon) => {
                        const canAfford = profile.points >= coupon.points_cost;
                        return (
                          <button
                            key={coupon.id}
                            disabled={!canAfford || redeemMutation.isPending}
                            onClick={() => {
                              if (canAfford) setPendingRedeemCoupon(coupon);
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative group",
                              canAfford
                                ? "border-purple-100 bg-purple-50 hover:border-purple-500 cursor-pointer shadow-sm hover:shadow-md"
                                : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed grayscale"
                            )}
                          >
                            {!canAfford && (
                              <Lock className="w-3 h-3 text-gray-400 absolute top-2 right-2" />
                            )}
                            <span className="text-2xl font-black text-purple-700">
                              R$ {coupon.discount_value}
                            </span>
                            <span className="text-xs font-bold text-gray-500 mt-1 uppercase">Cupom</span>
                            <div className="mt-3 bg-white px-3 py-1 rounded-full text-xs font-bold shadow-sm border text-purple-900">
                              {coupon.points_cost} pts
                            </div>
                            {canAfford && (
                              <div className="absolute inset-0 bg-purple-600/90 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white font-bold flex items-center gap-2">
                                  <Gift className="w-4 h-4" /> RESGATAR
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      Nenhuma opção de resgate disponível no momento.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── ABA: HISTÓRICO DE PONTOS ── */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" /> Histórico de Pontos
                  </CardTitle>
                  <CardDescription>Todas as movimentações de pontos da sua conta.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingHistory ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : !loyaltyHistory || loyaltyHistory.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>Nenhuma movimentação de pontos ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {loyaltyHistory.map((entry: any) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-full border",
                                entry.points > 0
                                  ? "bg-green-50 text-green-600 border-green-200"
                                  : "bg-red-50 text-red-500 border-red-200"
                              )}
                            >
                              {entry.points > 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 leading-tight">
                                {entry.description}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 border",
                                    entry.points > 0
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-red-50 text-red-600 border-red-200"
                                  )}
                                >
                                  {getOperationLabel(entry.operation_type)}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDate(entry.created_at)}
                                </span>
                                {entry.related_order_id && (
                                  <span className="text-[11px] text-muted-foreground">
                                    · Pedido #{entry.related_order_id}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "text-base font-black tabular-nums shrink-0 ml-3",
                              entry.points > 0 ? "text-green-600" : "text-red-500"
                            )}
                          >
                            {entry.points > 0 ? "+" : ""}
                            {entry.points} pts
                          </div>
                        </div>
                      ))}
                      {loyaltyHistory.length === 50 && (
                        <p className="text-center text-xs text-muted-foreground pt-2">
                          Exibindo os 50 registros mais recentes.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── ABA: MEUS CUPONS ── */}
            <TabsContent value="coupons">
              <div className="space-y-4">
                {isLoadingCoupons ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !myCoupons || myCoupons.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12 text-muted-foreground">
                      <TicketCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>Você ainda não tem cupons.</p>
                      <p className="text-xs mt-1">Resgate pontos ou aguarde promoções especiais!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {activeCoupons.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <TicketCheck className="w-4 h-4" /> Disponíveis ({activeCoupons.length})
                        </h3>
                        <div className="space-y-2">
                          {activeCoupons.map((uc: any) => (
                            <div
                              key={uc.id}
                              className="flex items-center justify-between p-4 rounded-xl border-2 border-green-200 bg-green-50"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-green-800 text-base">{uc.coupons?.name}</p>
                                {uc.coupons?.description && (
                                  <p className="text-xs text-green-700 mt-0.5">{uc.coupons.description}</p>
                                )}
                                <p className="text-[11px] text-green-600 mt-1">
                                  Válido até {formatDate(uc.expires_at)}
                                </p>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <span className="text-2xl font-black text-green-700">
                                  R$ {uc.coupons?.discount_value}
                                </span>
                                <p className="text-[10px] text-green-600 font-bold uppercase">desconto</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {usedCoupons.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                          Utilizados ({usedCoupons.length})
                        </h3>
                        <div className="space-y-2">
                          {usedCoupons.map((uc: any) => (
                            <div
                              key={uc.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50 opacity-60"
                            >
                              <div>
                                <p className="font-semibold text-gray-600 line-through">{uc.coupons?.name}</p>
                                {uc.order_id && (
                                  <p className="text-[11px] text-gray-500">Usado no pedido #{uc.order_id}</p>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-xs shrink-0 ml-3">
                                Usado
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {expiredCoupons.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide mb-2">
                          Expirados ({expiredCoupons.length})
                        </h3>
                        <div className="space-y-2">
                          {expiredCoupons.map((uc: any) => (
                            <div
                              key={uc.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/50 opacity-60"
                            >
                              <div>
                                <p className="font-semibold text-gray-500 line-through">{uc.coupons?.name}</p>
                                <p className="text-[11px] text-red-400">
                                  Expirou em {formatDate(uc.expires_at)}
                                </p>
                              </div>
                              <Badge variant="destructive" className="text-xs opacity-70 shrink-0 ml-3">
                                Expirado
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pink-600">
                <Cake className="w-5 h-5" /> Seu Aniversário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.birth_date_locked ? (
                <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-100">
                  <p className="text-sm font-medium text-pink-800">
                    Parabéns! Sua data está registrada.
                  </p>
                  <p className="text-2xl font-black text-pink-600 mt-2">
                    {format(new Date(profile.date_of_birth), "dd/MM", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Você ganhará bônus automaticamente neste dia todos os anos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-600">
                    Informe sua data para ganhar <strong>100 pontos</strong> agora! (Não poderá
                    alterar depois)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => saveBirthDateMutation.mutate(birthDate)}
                      disabled={!birthDate || saveBirthDateMutation.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de confirmação de resgate */}
      <AlertDialog
        open={!!pendingRedeemCoupon}
        onOpenChange={(open) => {
          if (!open) setPendingRedeemCoupon(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Resgate</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja trocar <strong>{pendingRedeemCoupon?.points_cost} pontos</strong> pelo cupom de{" "}
              <strong>R$ {pendingRedeemCoupon?.discount_value}</strong>? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRedeemCoupon) {
                  redeemMutation.mutate(pendingRedeemCoupon.id);
                  setPendingRedeemCoupon(null);
                }
              }}
            >
              Confirmar Resgate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SalesPopupDisplay />
    </div>
  );
}
