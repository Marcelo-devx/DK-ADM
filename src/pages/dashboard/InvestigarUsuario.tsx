import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, User, Ticket, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Loader2, ShieldAlert, MapPin, Phone, Star, Calendar, Hash,
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserProfile {
  id: string; email: string | null; first_name: string | null; last_name: string | null;
  phone: string | null; cpf_cnpj: string | null; points: number; current_tier_name: string | null;
  city: string | null; state: string | null; is_blocked: boolean | null; role: string;
  created_at: string | null; spend_last_6_months: number | null;
}

interface UserCouponWithDetails {
  id: number; user_id: string; coupon_id: number; is_used: boolean; order_id: number | null;
  expires_at: string; created_at: string; coupon_name: string; coupon_description: string | null;
  discount_value: number; discount_type: string | null; is_coupon_active: boolean;
}

const InvestigarUsuario = () => {
  const [emailInput, setEmailInput] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const queryClient = useQueryClient();

  const handleSearch = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    setSearchEmail(trimmed);
  };

  const { data: profile, isLoading: loadingProfile, isError: errorProfile } = useQuery({
    queryKey: ["investigar-usuario-profile", searchEmail],
    queryFn: async () => {
      if (!searchEmail) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("email", searchEmail).maybeSingle();
      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!searchEmail,
  });

  const { data: userCoupons, isLoading: loadingCoupons } = useQuery({
    queryKey: ["investigar-usuario-coupons", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("user_coupons")
        .select(`id,user_id,coupon_id,is_used,order_id,expires_at,created_at,coupons(name,description,discount_value,discount_type,is_active)`)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((uc: any) => ({
        id: uc.id, user_id: uc.user_id, coupon_id: uc.coupon_id, is_used: uc.is_used,
        order_id: uc.order_id, expires_at: uc.expires_at, created_at: uc.created_at,
        coupon_name: uc.coupons?.name ?? "Cupom desconhecido",
        coupon_description: uc.coupons?.description ?? null,
        discount_value: uc.coupons?.discount_value ?? 0,
        discount_type: uc.coupons?.discount_type ?? null,
        is_coupon_active: uc.coupons?.is_active ?? false,
      })) as UserCouponWithDetails[];
    },
    enabled: !!profile?.id,
  });

  const reativarMutation = useMutation({
    mutationFn: async (userCouponId: number) => {
      const { error } = await supabase.from("user_coupons").update({ is_used: false, order_id: null }).eq("id", userCouponId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cupom reativado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["investigar-usuario-coupons", profile?.id] });
    },
    onError: (err: any) => showError("Erro ao reativar cupom: " + (err?.message ?? "Erro desconhecido")),
  });

  const problemCoupons = userCoupons?.filter((uc) => uc.is_used && !uc.order_id) ?? [];
  const usedWithOrder = userCoupons?.filter((uc) => uc.is_used && uc.order_id) ?? [];
  const activeCoupons = userCoupons?.filter((uc) => !uc.is_used) ?? [];

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return dateStr; }
  };
  const formatDiscount = (uc: UserCouponWithDetails) => {
    if (uc.discount_type === "shipping") return "Frete Grátis";
    if (uc.discount_type === "percentage") return `${uc.discount_value}%`;
    return `R$ ${Number(uc.discount_value).toFixed(2)}`;
  };

  // Componente reutilizável de card de cupom para mobile
  const CouponCard = ({ uc, showReactivate }: { uc: UserCouponWithDetails; showReactivate?: boolean }) => (
    <div className={`rounded-xl border-2 p-4 space-y-2 ${uc.is_used && !uc.order_id ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">{uc.coupon_name}</p>
          {uc.coupon_description && <p className="text-xs text-muted-foreground mt-0.5">{uc.coupon_description}</p>}
        </div>
        <Badge className="shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-bold">
          {formatDiscount(uc)}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Criado: {formatDate(uc.created_at)}</span>
        <span>Expira: {formatDate(uc.expires_at)}</span>
        {uc.order_id && <span>Pedido: #{uc.order_id}</span>}
        {uc.is_used && !uc.order_id && (
          <Badge variant="outline" className="text-red-600 border-red-300 text-[10px]">Sem pedido</Badge>
        )}
      </div>
      {showReactivate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="w-full border-green-400 text-green-700 hover:bg-green-50 mt-1" disabled={reativarMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reativar Cupom
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reativar cupom?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai marcar o cupom <strong>"{uc.coupon_name}"</strong> como <strong>não usado</strong> e remover o vínculo com qualquer pedido. O usuário poderá utilizá-lo novamente.
                {uc.order_id && <><br /><br /><span className="text-amber-600 font-medium">⚠️ Use apenas se o pedido vinculado foi cancelado.</span></>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => reativarMutation.mutate(uc.id)} className="bg-green-600 hover:bg-green-700">
                Sim, reativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
          <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Investigar Usuário</h1>
          <p className="text-sm text-muted-foreground">Busque um usuário por email para visualizar seus dados e corrigir problemas com cupons.</p>
        </div>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Digite o email do usuário..." value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-10" />
            </div>
            <Button onClick={handleSearch} disabled={!emailInput.trim()}>
              {loadingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchEmail && !loadingProfile && (
        <>
          {errorProfile || !profile ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-700">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <p className="font-medium">Nenhum usuário encontrado com o email <strong>{searchEmail}</strong></p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Alerta de problema */}
              {problemCoupons.length > 0 && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-800">{problemCoupons.length} cupom(ns) com problema detectado(s)</p>
                        <p className="text-sm text-amber-700 mt-1">Estes cupons estão marcados como <strong>usados</strong> mas <strong>não possuem pedido vinculado</strong> — provavelmente foram "queimados" durante um checkout que não foi concluído. Você pode reativá-los abaixo.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dados do perfil */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-blue-600" /> Dados do Usuário
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: "Nome", value: `${profile.first_name || "—"} ${profile.last_name || ""}` },
                      { label: "Email", value: profile.email || "—" },
                      { label: "Telefone", icon: <Phone className="h-3 w-3" />, value: profile.phone || "—" },
                      { label: "CPF/CNPJ", icon: <Hash className="h-3 w-3" />, value: profile.cpf_cnpj || "—" },
                      { label: "Cidade/Estado", icon: <MapPin className="h-3 w-3" />, value: profile.city && profile.state ? `${profile.city} / ${profile.state}` : "—" },
                      { label: "Pontos / Tier", icon: <Star className="h-3 w-3" />, value: `${profile.points} pts — ${profile.current_tier_name || "—"}` },
                      { label: "Gasto (6 meses)", value: `R$ ${Number(profile.spend_last_6_months ?? 0).toFixed(2)}` },
                      { label: "Cadastro", icon: <Calendar className="h-3 w-3" />, value: profile.created_at ? formatDate(profile.created_at) : "—" },
                    ].map((item, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          {item.icon}{item.label}
                        </p>
                        <p className="font-medium text-sm">{item.value}</p>
                      </div>
                    ))}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant={profile.role === "adm" ? "destructive" : "secondary"}>{profile.role}</Badge>
                        {profile.is_blocked && <Badge variant="destructive">Bloqueado</Badge>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cupons com problema */}
              {problemCoupons.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-amber-700">
                      <AlertTriangle className="h-5 w-5" /> Cupons com Problema ({problemCoupons.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Mobile */}
                    <div className="md:hidden space-y-3">
                      {problemCoupons.map((uc) => <CouponCard key={uc.id} uc={uc} showReactivate />)}
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead><TableHead>Cupom</TableHead><TableHead>Desconto</TableHead>
                            <TableHead>Criado em</TableHead><TableHead>Expira em</TableHead><TableHead>Pedido</TableHead><TableHead>Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {problemCoupons.map((uc) => (
                            <TableRow key={uc.id} className="bg-amber-50/50">
                              <TableCell className="font-mono text-xs">{uc.id}</TableCell>
                              <TableCell><p className="font-medium">{uc.coupon_name}</p>{uc.coupon_description && <p className="text-xs text-muted-foreground">{uc.coupon_description}</p>}</TableCell>
                              <TableCell>{formatDiscount(uc)}</TableCell>
                              <TableCell className="text-sm">{formatDate(uc.created_at)}</TableCell>
                              <TableCell className="text-sm">{formatDate(uc.expires_at)}</TableCell>
                              <TableCell><Badge variant="outline" className="text-red-600 border-red-300">Sem pedido</Badge></TableCell>
                              <TableCell>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50" disabled={reativarMutation.isPending}>
                                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reativar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reativar cupom?</AlertDialogTitle>
                                      <AlertDialogDescription>Isso vai marcar o cupom <strong>"{uc.coupon_name}"</strong> como <strong>não usado</strong> e remover o vínculo com qualquer pedido.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => reativarMutation.mutate(uc.id)} className="bg-green-600 hover:bg-green-700">Sim, reativar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cupons ativos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Ticket className="h-5 w-5 text-green-600" /> Cupons Disponíveis ({activeCoupons.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingCoupons ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                  ) : activeCoupons.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cupom disponível para este usuário.</p>
                  ) : (
                    <>
                      {/* Mobile */}
                      <div className="md:hidden space-y-3">
                        {activeCoupons.map((uc) => (
                          <div key={uc.id} className="rounded-xl border-2 border-green-100 bg-green-50/30 p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm">{uc.coupon_name}</p>
                                {uc.coupon_description && <p className="text-xs text-muted-foreground">{uc.coupon_description}</p>}
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-bold shrink-0">{formatDiscount(uc)}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>Criado: {formatDate(uc.created_at)}</span>
                              <span>Expira: {formatDate(uc.expires_at)}</span>
                            </div>
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Disponível
                            </Badge>
                          </div>
                        ))}
                      </div>
                      {/* Desktop */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead><TableHead>Cupom</TableHead><TableHead>Desconto</TableHead>
                              <TableHead>Criado em</TableHead><TableHead>Expira em</TableHead><TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeCoupons.map((uc) => (
                              <TableRow key={uc.id}>
                                <TableCell className="font-mono text-xs">{uc.id}</TableCell>
                                <TableCell><p className="font-medium">{uc.coupon_name}</p>{uc.coupon_description && <p className="text-xs text-muted-foreground">{uc.coupon_description}</p>}</TableCell>
                                <TableCell>{formatDiscount(uc)}</TableCell>
                                <TableCell className="text-sm">{formatDate(uc.created_at)}</TableCell>
                                <TableCell className="text-sm">{formatDate(uc.expires_at)}</TableCell>
                                <TableCell><Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Disponível</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Cupons usados com pedido */}
              {usedWithOrder.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-gray-500">
                      <XCircle className="h-5 w-5" /> Cupons Utilizados ({usedWithOrder.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">💡 Se o pedido vinculado foi <strong>cancelado</strong>, você pode reativar o cupom para o usuário usar novamente.</p>
                    {/* Mobile */}
                    <div className="md:hidden space-y-3">
                      {usedWithOrder.map((uc) => <CouponCard key={uc.id} uc={uc} showReactivate />)}
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead><TableHead>Cupom</TableHead><TableHead>Desconto</TableHead>
                            <TableHead>Usado em</TableHead><TableHead>Pedido</TableHead><TableHead>Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usedWithOrder.map((uc) => (
                            <TableRow key={uc.id}>
                              <TableCell className="font-mono text-xs">{uc.id}</TableCell>
                              <TableCell><p className="font-medium">{uc.coupon_name}</p></TableCell>
                              <TableCell>{formatDiscount(uc)}</TableCell>
                              <TableCell className="text-sm">{formatDate(uc.created_at)}</TableCell>
                              <TableCell><Badge variant="secondary">Pedido #{uc.order_id}</Badge></TableCell>
                              <TableCell>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50" disabled={reativarMutation.isPending}>
                                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reativar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reativar cupom?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Isso vai marcar o cupom <strong>"{uc.coupon_name}"</strong> como <strong>não usado</strong> e remover o vínculo com o <strong>Pedido #{uc.order_id}</strong>.<br /><br />
                                        <span className="text-amber-600 font-medium">⚠️ Use apenas se o pedido vinculado foi cancelado.</span>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => reativarMutation.mutate(uc.id)} className="bg-green-600 hover:bg-green-700">Sim, reativar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InvestigarUsuario;
