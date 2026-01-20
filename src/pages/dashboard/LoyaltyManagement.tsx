"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/utils/toast";
import { Crown, Coins, History, Settings, Search, PlusCircle, MinusCircle, Save, Loader2, User } from "lucide-react";
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
    email: string | null; // Note: email is in auth.users, handled via join or separate fetch if needed. Let's assume profile join for name.
  } | null;
}

// --- FETCHERS ---
const fetchTiers = async () => {
  const { data, error } = await supabase.from("loyalty_tiers").select("*").order("min_spend");
  if (error) throw error;
  return data as LoyaltyTier[];
};

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from("loyalty_history")
    .select("*, profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as any[];
};

const fetchStats = async () => {
  // Simulação de stats (ideal seria RPC para performance em grandes bases)
  const { data: profiles } = await supabase.from("profiles").select("points");
  const totalPoints = profiles?.reduce((acc, p) => acc + (p.points || 0), 0) || 0;
  
  // Pontos distribuidos hoje
  const today = new Date().toISOString().split('T')[0];
  const { data: history } = await supabase
    .from("loyalty_history")
    .select("points")
    .eq("operation_type", "earn")
    .gte("created_at", today);
  const pointsToday = history?.reduce((acc, h) => acc + h.points, 0) || 0;

  return { totalPoints, pointsToday };
};

export default function LoyaltyManagementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);

  const { data: tiers, isLoading: loadingTiers } = useQuery({ queryKey: ["adminTiers"], queryFn: fetchTiers });
  const { data: history, isLoading: loadingHistory } = useQuery({ queryKey: ["adminLoyaltyHistory"], queryFn: fetchHistory });
  const { data: stats } = useQuery({ queryKey: ["adminLoyaltyStats"], queryFn: fetchStats });

  // Busca usuário para ajuste manual
  const searchUser = async () => {
    if (!searchTerm.includes("@")) {
        showError("Digite o e-mail completo para buscar.");
        return;
    }
    const { data: uid } = await supabase.rpc('get_user_id_by_email', { user_email: searchTerm });
    
    if (uid) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single();
        setFoundUser(profile);
        setAdjustUserId(uid);
    } else {
        setFoundUser(null);
        setAdjustUserId("");
        showError("Usuário não encontrado.");
    }
  };

  // Mutação: Ajuste Manual
  const adjustMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_adjust_points", {
        target_user_id: adjustUserId,
        points_delta: adjustPoints,
        reason: adjustReason || "Ajuste manual administrativo"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Pontos ajustados com sucesso!");
      setAdjustPoints(0);
      setAdjustReason("");
      setFoundUser(null);
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["adminLoyaltyHistory"] });
      queryClient.invalidateQueries({ queryKey: ["adminLoyaltyStats"] });
    },
    onError: (err: any) => showError(err.message),
  });

  // Mutação: Editar Tier (Simples)
  const updateTierMutation = useMutation({
    mutationFn: async (tier: LoyaltyTier) => {
      const { error } = await supabase.from("loyalty_tiers").update(tier).eq("id", tier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Nível atualizado!");
      queryClient.invalidateQueries({ queryKey: ["adminTiers"] });
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
            <p className="text-muted-foreground">Gerencie níveis, pontuação e ajustes manuais.</p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-800 font-bold uppercase flex items-center gap-2">
                    <Coins className="w-4 h-4" /> Pontos em Circulação
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black text-yellow-900">{stats?.totalPoints?.toLocaleString() || 0}</div>
                <p className="text-xs text-yellow-700 mt-1">Saldo total dos clientes</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500 font-bold uppercase flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Gerados Hoje
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black text-green-600">+{stats?.pointsToday?.toLocaleString() || 0}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500 font-bold uppercase flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Configuração
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{tiers?.length || 0} Níveis</div>
                <p className="text-xs text-muted-foreground">Regras ativas</p>
            </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="manual">Ajuste Manual</TabsTrigger>
            <TabsTrigger value="tiers">Regras de Nível</TabsTrigger>
        </TabsList>

        {/* ABA HISTÓRICO */}
        <TabsContent value="history" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Extrato Global</CardTitle>
                    <CardDescription>Últimas 50 movimentações de pontos em toda a loja.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Pontos</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Data</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingHistory ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                            ) : history?.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        {item.profiles?.first_name} {item.profiles?.last_name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={item.points > 0 ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}>
                                            {item.points > 0 ? "+" : ""}{item.points}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{item.description}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        {/* ABA AJUSTE MANUAL */}
        <TabsContent value="manual" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Lançamento Manual</CardTitle>
                    <CardDescription>Adicione ou remova pontos de um cliente específico.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <Label>Buscar Cliente por E-mail</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="cliente@email.com" 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                />
                                <Button onClick={searchUser} variant="secondary"><Search className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </div>

                    {foundUser && (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in fade-in">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-lg">{foundUser.first_name} {foundUser.last_name}</p>
                                    <p className="text-sm text-muted-foreground">Saldo Atual: <span className="font-bold text-black">{foundUser.points} pts</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantidade de Pontos</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="Ex: 100 ou -50" 
                                        value={adjustPoints} 
                                        onChange={(e) => setAdjustPoints(Number(e.target.value))}
                                    />
                                    <p className="text-xs text-muted-foreground">Use valor negativo para remover.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Motivo</Label>
                                    <Input 
                                        placeholder="Ex: Bonificação por atraso" 
                                        value={adjustReason} 
                                        onChange={(e) => setAdjustReason(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button 
                                className="w-full mt-4 font-bold" 
                                onClick={() => adjustMutation.mutate()} 
                                disabled={adjustMutation.isPending || adjustPoints === 0}
                            >
                                {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Confirmar Lançamento
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        {/* ABA TIERS */}
        <TabsContent value="tiers" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Configuração de Níveis</CardTitle>
                    <CardDescription>Defina os valores de gasto necessários para cada faixa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nível</TableHead>
                                <TableHead>Gasto Mín (R$)</TableHead>
                                <TableHead>Multiplicador (pts/R$)</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingTiers ? (
                                <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow>
                            ) : tiers?.map((tier) => (
                                <TableRow key={tier.id}>
                                    <TableCell className="font-bold">{tier.name}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            defaultValue={tier.min_spend} 
                                            className="w-24 h-8" 
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if(val !== tier.min_spend) updateTierMutation.mutate({...tier, min_spend: val});
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            step="0.1" 
                                            defaultValue={tier.points_multiplier} 
                                            className="w-20 h-8" 
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if(val !== tier.points_multiplier) updateTierMutation.mutate({...tier, points_multiplier: val});
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline">Auto-salvar</Badge>
                                    </TableCell>
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