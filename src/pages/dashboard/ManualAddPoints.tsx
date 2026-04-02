"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Save, User, Gift, Clock, TrendingUp, Crown, AlertCircle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  points: number;
  current_tier_name: string | null;
  tier_id: number | null;
  last_purchase_date?: string;
}

interface LoyaltyHistory {
  id: number;
  points: number;
  description: string;
  created_at: string;
  operation_type: string;
}

export default function ManualAddPoints() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Buscar usuário por e-mail
  const searchUser = async () => {
    if (!searchTerm.includes("@")) {
      showError("Digite o e-mail completo.");
      return;
    }

    setIsSearching(true);
    try {
      const { data: uid, error: emailError } = await supabase.rpc('get_user_id_by_email', { user_email: searchTerm });
      
      if (emailError || !uid) {
        setFoundUser(null);
        showError("Usuário não encontrado.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, points, current_tier_name, tier_id")
        .eq("id", uid)
        .single();

      if (profileError) {
        setFoundUser(null);
        showError("Erro ao buscar dados do usuário.");
        return;
      }

      // Buscar última compra do usuário
      const { data: lastOrder } = await supabase
        .from("orders")
        .select("created_at")
        .eq("user_id", uid)
        .eq("status", "Finalizada")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setFoundUser({
        ...profile,
        email: searchTerm,
        last_purchase_date: lastOrder?.created_at
      });
    } catch (error) {
      showError("Erro ao buscar usuário.");
    } finally {
      setIsSearching(false);
    }
  };

  // Buscar histórico recente do usuário
  const { data: recentHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["userLoyaltyHistory", foundUser?.id],
    queryFn: async () => {
      if (!foundUser) return [];
      
      const { data, error } = await supabase
        .from("loyalty_history")
        .select("*")
        .eq("user_id", foundUser.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as LoyaltyHistory[];
    },
    enabled: !!foundUser,
  });

  // Mutação para adicionar pontos
  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!foundUser) throw new Error("Usuário não selecionado");
      
      const { error } = await supabase.rpc("admin_adjust_points", {
        target_user_id: foundUser.id,
        points_delta: adjustPoints,
        reason: adjustReason || "Adição manual de pontos"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`Pontos adicionados com sucesso! ${adjustPoints > 0 ? '+' : ''}${adjustPoints} pts`);
      setAdjustPoints(0);
      setAdjustReason("");
      setFoundUser(null);
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["adminLoyaltyHistory"] });
      queryClient.invalidateQueries({ queryKey: ["userLoyaltyHistory"] });
    },
    onError: (err: any) => showError(err.message),
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Adicionar Pontos Manualmente</h1>
        <p className="text-muted-foreground">Adicione pontos a um usuário específico individualmente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Usuário</CardTitle>
          <CardDescription>Digite o e-mail do usuário para buscar seus dados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>E-mail do Cliente</Label>
              <Input 
                placeholder="cliente@email.com" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUser()}
              />
            </div>
            <Button 
              onClick={searchUser} 
              variant="default"
              disabled={isSearching}
              className="bg-primary"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {foundUser && (
        <>
          {/* Card com informações do usuário */}
          <Card className="border-primary/20 bg-gradient-to-br from-slate-50 to-slate-100/50">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Informações básicas */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>Cliente</span>
                  </div>
                  <div>
                    <p className="font-bold text-xl text-slate-900">
                      {foundUser.first_name} {foundUser.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                  </div>
                </div>

                {/* Saldo atual */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gift className="w-4 h-4" />
                    <span>Saldo Atual</span>
                  </div>
                  <div>
                    <p className="font-bold text-3xl text-primary">{foundUser.points}</p>
                    <p className="text-sm text-muted-foreground">pontos disponíveis</p>
                  </div>
                </div>

                {/* Nível no clube */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Crown className="w-4 h-4" />
                    <span>Nível no Clube</span>
                  </div>
                  <div>
                    <Badge variant="secondary" className="text-sm px-3 py-1 bg-yellow-100 text-yellow-800 border-yellow-200">
                      {foundUser.current_tier_name || 'Bronze'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculado por gasto em compras
                    </p>
                  </div>
                </div>

                {/* Última compra */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Última Compra</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {foundUser.last_purchase_date ? formatDate(foundUser.last_purchase_date) : 'Nunca'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {foundUser.last_purchase_date ? 'Pedido finalizado' : 'Sem compras'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico recente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico Recente</CardTitle>
              <CardDescription>Últimas movimentações de pontos deste usuário.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !recentHistory || recentHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma movimentação recente encontrada.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          {new Date(item.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={item.points > 0 
                              ? "text-green-600 bg-green-50 border-green-200" 
                              : "text-red-600 bg-red-50 border-red-200"
                            }
                          >
                            {item.points > 0 ? '+' : ''}{item.points}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.operation_type === 'adjustment' && 'Ajuste'}
                          {item.operation_type === 'earn' && 'Ganho'}
                          {item.operation_type === 'redeem' && 'Resgate'}
                          {item.operation_type === 'bonus' && 'Bônus'}
                          {item.operation_type === 'referral_bonus' && 'Indicação'}
                          {item.operation_type === 'birthday_bonus' && 'Aniversário'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Formulário de adição de pontos */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Adicionar Pontos</CardTitle>
              <CardDescription>Informe a quantidade de pontos e o motivo para adicionar ao saldo do usuário.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade de Pontos</Label>
                  <Input 
                    type="number" 
                    placeholder="Ex: 100" 
                    value={adjustPoints}
                    onChange={(e) => setAdjustPoints(Number(e.target.value))}
                    min="-9999999"
                    max="9999999"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use valor positivo para adicionar, negativo para remover.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Motivo (Opcional)</Label>
                  <Input 
                    placeholder="Ex: Bônus de fidelidade" 
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Motivo ficará registrado no histórico do usuário.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900">Importante</p>
                    <p className="text-sm text-amber-800 mt-1">
                      Os pontos adicionados manualmente <strong>NÃO</strong> afetam a graduação de nível no clube de benefícios. O nível é calculado apenas pelo valor gasto em compras.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full font-bold bg-primary hover:bg-primary/90"
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending || adjustPoints === 0}
              >
                {adjustMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Confirmar e Adicionar {adjustPoints > 0 ? '+' : ''}{adjustPoints} Pontos
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
