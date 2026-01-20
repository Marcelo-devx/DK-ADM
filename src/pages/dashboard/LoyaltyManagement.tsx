"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showSuccess, showError } from "@/utils/toast";
import { Crown, Coins, History, Settings, Search, PlusCircle, Save, Loader2, User, Gift, Zap, Trash2, Info, TicketCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- TYPES ---
interface LoyaltyTier {
  id: number;
  name: string;
  min_spend: number;
  max_spend: number | null;
  points_multiplier: number;
}

interface LoyaltyHistoryItem {
  id: number;
  user_id: string;
  points: number;
  description: string;
  created_at: string;
  operation_type: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface UserCoupon {
    id: number;
    created_at: string;
    is_used: boolean;
    expires_at: string;
    order_id: number | null;
    profiles: {
        first_name: string | null;
        last_name: string | null;
    } | null;
    coupons: {
        name: string;
        discount_value: number;
    } | null;
}

// --- FETCHERS ---
const fetchTiers = async () => {
  const { data, error } = await supabase.from("loyalty_tiers").select("*").order("min_spend");
  if (error) throw error;
  return data as LoyaltyTier[];
};

const fetchRedemptionRules = async () => {
  const { data, error } = await supabase.from("loyalty_redemption_rules").select("*").order("points_cost");
  if (error) throw error;
  return data;
};

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from("loyalty_history")
    .select("*, profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as LoyaltyHistoryItem[];
};

const fetchUserCoupons = async () => {
    const { data, error } = await supabase
        .from("user_coupons")
        .select("*, profiles(first_name, last_name), coupons(name, discount_value)")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data as unknown as UserCoupon[];
}

const fetchSettings = async () => {
  const keys = [
    'loyalty_birthday_bonus', 'loyalty_referral_bonus', 
    'loyalty_ticket_threshold', 'loyalty_ticket_bonus',
    'loyalty_recurrence_2nd', 'loyalty_recurrence_3rd', 'loyalty_recurrence_4th'
  ];
  const { data } = await supabase.from("app_settings").select("*").in("key", keys);
  const settingsMap: any = {};
  data?.forEach((item: any) => settingsMap[item.key] = item.value);
  return settingsMap;
};

export default function LoyaltyManagementPage() {
  const queryClient = useQueryClient();
  
  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  
  // New Rule States
  const [newRulePoints, setNewRulePoints] = useState("");
  const [newRuleValue, setNewRuleValue] = useState("");

  // Queries
  const { data: tiers, isLoading: loadingTiers } = useQuery({ queryKey: ["adminTiers"], queryFn: fetchTiers });
  const { data: redemptionRules, isLoading: loadingRules } = useQuery({ queryKey: ["adminRedemptionRules"], queryFn: fetchRedemptionRules });
  const { data: history } = useQuery({ queryKey: ["adminLoyaltyHistory"], queryFn: fetchHistory });
  const { data: settings } = useQuery({ queryKey: ["adminLoyaltySettings"], queryFn: fetchSettings });
  const { data: userCoupons, isLoading: loadingUserCoupons } = useQuery({ queryKey: ["adminUserCoupons"], queryFn: fetchUserCoupons });

  // --- MUTATIONS ---

  const deleteUserCouponMutation = useMutation({
    mutationFn: async (id: number) => {
        const { error } = await supabase.from("user_coupons").delete().eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["adminUserCoupons"] });
        showSuccess("Cupom do usuário removido!");
    },
    onError: (err: any) => showError(err.message),
  });

  const updateTierMutation = useMutation({
    mutationFn: async (tier: any) => {
      const { error } = await supabase.from("loyalty_tiers").update(tier).eq("id", tier.id);
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Nível atualizado!"),
    onError: (err: any) => showError(err.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { key: string, value: string }[]) => {
      const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["adminLoyaltySettings"] });
        showSuccess("Configurações salvas!");
    },
    onError: (err: any) => showError(err.message),
  });

  const addRuleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loyalty_redemption_rules").insert({
        points_cost: parseInt(newRulePoints),
        discount_value: parseFloat(newRuleValue.replace(',', '.'))
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRedemptionRules"] });
      setNewRulePoints("");
      setNewRuleValue("");
      showSuccess("Opção de resgate adicionada!");
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("loyalty_redemption_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRedemptionRules"] });
      showSuccess("Opção removida.");
    }
  });

  const searchUser = async () => {
    if (!searchTerm.includes("@")) { showError("Digite o e-mail completo."); return; }
    const { data: uid } = await supabase.rpc('get_user_id_by_email', { user_email: searchTerm });
    if (uid) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single();
        setFoundUser(profile);
    } else {
        setFoundUser(null);
        showError("Usuário não encontrado.");
    }
  };

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_adjust_points", {
        target_user_id: foundUser.id,
        points_delta: adjustPoints,
        reason: adjustReason || "Ajuste manual administrativo"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Pontos ajustados!");
      setAdjustPoints(0);
      setAdjustReason("");
      setFoundUser(null);
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["adminLoyaltyHistory"] });
    },
    onError: (err: any) => showError(err.message),
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Crown className="h-8 w-8 text-yellow-500" /> Gestão Club DK
            </h1>
            <p className="text-muted-foreground">Configure as regras do seu programa de fidelidade.</p>
        </div>
      </div>

      <Tabs defaultValue="bonus" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 bg-slate-100 p-1">
            <TabsTrigger value="bonus">Regras de Pontuação</TabsTrigger>
            <TabsTrigger value="tiers">Níveis</TabsTrigger>
            <TabsTrigger value="redemption">Regras de Resgate</TabsTrigger>
            <TabsTrigger value="user-coupons">Cupons dos Clientes</TabsTrigger>
            <TabsTrigger value="manual">Ajuste Manual</TabsTrigger>
            <TabsTrigger value="history">Extrato Geral</TabsTrigger>
        </TabsList>

        {/* 1. REGRAS DE PONTUAÇÃO (BÔNUS) */}
        <TabsContent value="bonus" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4 text-pink-500" /> Gatilhos de Engajamento</CardTitle>
                        <CardDescription>Pontos dados por ações específicas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-4">
                            <Label>Bônus de Aniversário</Label>
                            <div className="flex items-center gap-2">
                                <Input className="w-20 text-right" defaultValue={settings?.loyalty_birthday_bonus} id="input-bday" />
                                <span className="text-xs text-muted-foreground">pts</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <Label>Bônus por Indicação (MGM)</Label>
                                <p className="text-[10px] text-muted-foreground max-w-[220px] flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Pago somente após a <strong>1ª compra paga</strong> do indicado.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input className="w-20 text-right" defaultValue={settings?.loyalty_referral_bonus} id="input-ref" />
                                <span className="text-xs text-muted-foreground">pts</span>
                            </div>
                        </div>
                        <Button 
                            className="w-full bg-slate-800" 
                            onClick={() => updateSettingsMutation.mutate([
                                { key: 'loyalty_birthday_bonus', value: (document.getElementById('input-bday') as HTMLInputElement).value },
                                { key: 'loyalty_referral_bonus', value: (document.getElementById('input-ref') as HTMLInputElement).value }
                            ])}
                        >
                            Salvar Gatilhos
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Bônus Ticket Alto</CardTitle>
                        <CardDescription>Incentive compras maiores.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Valor Mínimo do Pedido (R$)</Label>
                            <Input defaultValue={settings?.loyalty_ticket_threshold} id="input-thresh" />
                        </div>
                        <div className="space-y-2">
                            <Label>Pontos Extras Concedidos</Label>
                            <Input defaultValue={settings?.loyalty_ticket_bonus} id="input-ticket-pts" />
                        </div>
                        <Button 
                            className="w-full bg-slate-800" 
                            onClick={() => updateSettingsMutation.mutate([
                                { key: 'loyalty_ticket_threshold', value: (document.getElementById('input-thresh') as HTMLInputElement).value },
                                { key: 'loyalty_ticket_bonus', value: (document.getElementById('input-ticket-pts') as HTMLInputElement).value }
                            ])}
                        >
                            Salvar Ticket Alto
                        </Button>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-blue-500" /> Bônus de Recorrência Mensal</CardTitle>
                        <CardDescription>Pontos extras baseados na quantidade de compras no mesmo mês.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>2ª Compra</Label>
                                <Input defaultValue={settings?.loyalty_recurrence_2nd} id="rec-2" />
                            </div>
                            <div className="space-y-2">
                                <Label>3ª Compra</Label>
                                <Input defaultValue={settings?.loyalty_recurrence_3rd} id="rec-3" />
                            </div>
                            <div className="space-y-2">
                                <Label>4ª Compra em diante</Label>
                                <Input defaultValue={settings?.loyalty_recurrence_4th} id="rec-4" />
                            </div>
                        </div>
                        <Button 
                            className="w-full mt-4 bg-slate-800" 
                            onClick={() => updateSettingsMutation.mutate([
                                { key: 'loyalty_recurrence_2nd', value: (document.getElementById('rec-2') as HTMLInputElement).value },
                                { key: 'loyalty_recurrence_3rd', value: (document.getElementById('rec-3') as HTMLInputElement).value },
                                { key: 'loyalty_recurrence_4th', value: (document.getElementById('rec-4') as HTMLInputElement).value }
                            ])}
                        >
                            Salvar Recorrência
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* 2. NÍVEIS (TIERS) */}
        <TabsContent value="tiers" className="mt-6">
            <Card>
                <CardHeader><CardTitle>Configuração de Níveis</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nível</TableHead>
                                <TableHead>Gasto Mín (R$)</TableHead>
                                <TableHead>Multiplicador</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingTiers ? <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow> : 
                             tiers?.map((tier: any) => (
                                <TableRow key={tier.id}>
                                    <TableCell className="font-bold">{tier.name}</TableCell>
                                    <TableCell>
                                        <Input type="number" defaultValue={tier.min_spend} className="w-24 h-8" 
                                            onBlur={(e) => updateTierMutation.mutate({...tier, min_spend: parseFloat(e.target.value)})}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" step="0.1" defaultValue={tier.points_multiplier} className="w-20 h-8" 
                                            onBlur={(e) => updateTierMutation.mutate({...tier, points_multiplier: parseFloat(e.target.value)})}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right"><Badge variant="outline">Auto-salvar</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        {/* 3. REGRAS DE RESGATE */}
        <TabsContent value="redemption" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 border-dashed bg-slate-50">
                    <CardHeader>
                        <CardTitle className="text-base">Adicionar Opção</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Custo em Pontos</Label>
                            <Input placeholder="Ex: 2000" type="number" value={newRulePoints} onChange={(e) => setNewRulePoints(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Desconto (R$)</Label>
                            <Input placeholder="Ex: 250,00" value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)} />
                        </div>
                        <Button className="w-full" disabled={!newRulePoints || !newRuleValue} onClick={() => addRuleMutation.mutate()}>
                            <PlusCircle className="w-4 h-4 mr-2" /> Adicionar
                        </Button>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader><CardTitle>Opções de Troca Disponíveis</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pontos Necessários</TableHead>
                                    <TableHead>Valor do Cupom</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingRules ? <TableRow><TableCell colSpan={3}>Carregando...</TableCell></TableRow> :
                                 redemptionRules?.map((rule: any) => (
                                    <TableRow key={rule.id}>
                                        <TableCell className="font-bold">{rule.points_cost} pts</TableCell>
                                        <TableCell className="text-green-600 font-bold">R$ {rule.discount_value}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)} className="text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* NOVA ABA: CUPONS DOS CLIENTES */}
        <TabsContent value="user-coupons" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><TicketCheck className="w-5 h-5 text-emerald-600" /> Inventário de Cupons Resgatados</CardTitle>
                    <CardDescription>Lista de todos os cupons que os clientes compraram com pontos e ainda possuem.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Cupom</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Resgatado em</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingUserCoupons ? <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow> :
                             userCoupons?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum cupom resgatado ainda.</TableCell></TableRow> :
                             userCoupons?.map((uc) => (
                                <TableRow key={uc.id} className={uc.is_used ? "opacity-50" : ""}>
                                    <TableCell className="font-medium">{uc.profiles?.first_name} {uc.profiles?.last_name}</TableCell>
                                    <TableCell className="font-bold">{uc.coupons?.name}</TableCell>
                                    <TableCell className="text-emerald-600 font-bold">R$ {uc.coupons?.discount_value}</TableCell>
                                    <TableCell>
                                        {uc.is_used ? (
                                            <Badge variant="secondary">Usado no Pedido #{uc.order_id}</Badge>
                                        ) : (
                                            <Badge className="bg-emerald-500">Disponível</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">{new Date(uc.created_at).toLocaleDateString('pt-BR')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Deseja apagar este cupom do inventário do cliente?")) deleteUserCouponMutation.mutate(uc.id); }} className="text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        {/* 4. AJUSTE MANUAL */}
        <TabsContent value="manual" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Lançamento Manual</CardTitle>
                    <CardDescription>Correção ou bonificação direta para um cliente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <Label>Buscar Cliente por E-mail</Label>
                            <div className="flex gap-2">
                                <Input placeholder="cliente@email.com" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                <Button onClick={searchUser} variant="secondary"><Search className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </div>

                    {foundUser && (
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 animate-in fade-in">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold"><User className="w-6 h-6" /></div>
                                <div>
                                    <p className="font-bold text-xl">{foundUser.first_name} {foundUser.last_name}</p>
                                    <p className="text-sm text-muted-foreground">Saldo: <span className="font-bold text-black">{foundUser.points} pts</span></p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantidade</Label>
                                    <Input type="number" placeholder="100 ou -50" value={adjustPoints} onChange={(e) => setAdjustPoints(Number(e.target.value))} />
                                    <p className="text-xs text-muted-foreground">Negativo para remover.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Motivo</Label>
                                    <Input placeholder="Ex: Erro no sistema" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                                </div>
                            </div>
                            <Button className="w-full mt-6 font-bold bg-black hover:bg-gray-800" onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || adjustPoints === 0}>
                                {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Confirmar
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        {/* 5. HISTÓRICO */}
        <TabsContent value="history" className="mt-6">
            <Card>
                <CardHeader><CardTitle>Extrato Recente (Global)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Pontos</TableHead><TableHead>Motivo</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {history?.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.profiles?.first_name} {item.profiles?.last_name}</TableCell>
                                    <TableCell><Badge variant="outline" className={item.points > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}>{item.points > 0 ? "+" : ""}{item.points}</Badge></TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{item.description}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}