"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Trash2, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { RewardCoupon } from "./types";

const fetchRedemptionRules = async () => {
  const { data, error } = await supabase
    .from("coupons").select("*").gt("points_cost", 0).eq("is_active", true).order("points_cost");
  if (error) throw error;
  return data as RewardCoupon[];
};

export const RedemptionRulesTab = () => {
  const queryClient = useQueryClient();
  const [newRulePoints, setNewRulePoints] = useState("");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newRuleName, setNewRuleName] = useState("");

  const { data: redemptionRules, isLoading } = useQuery({
    queryKey: ["adminRewardCoupons"],
    queryFn: fetchRedemptionRules,
  });

  const addRuleMutation = useMutation({
    mutationFn: async () => {
      const points = parseInt(newRulePoints);
      const value = parseFloat(newRuleValue.replace(",", "."));
      const { error } = await supabase.from("coupons").insert({
        name: newRuleName || `RESGATE${points}`,
        description: `Cupom de R$ ${value} por ${points} pontos`,
        discount_value: value,
        points_cost: points,
        minimum_order_value: 0,
        stock_quantity: 9999,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRewardCoupons"] });
      setNewRulePoints(""); setNewRuleValue(""); setNewRuleName("");
      showSuccess("Opção de resgate criada!");
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRewardCoupons"] });
      showSuccess("Opção removida.");
    },
    onError: (err: any) => showError(`Erro ao remover: ${err.message}`),
  });

  return (
    <div className="space-y-4 mt-4">
      {/* Formulário de criação */}
      <Card className="border-dashed bg-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Criar Prêmio
          </CardTitle>
          <CardDescription className="text-xs">Cria um cupom comprável com pontos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Cupom</Label>
              <Input placeholder="Ex: VALE10" value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value.toUpperCase())} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo em Pontos</Label>
              <Input placeholder="Ex: 1000" type="number" value={newRulePoints}
                onChange={(e) => setNewRulePoints(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desconto (R$)</Label>
              <Input placeholder="Ex: 10,00" value={newRuleValue}
                onChange={(e) => setNewRuleValue(e.target.value)} className="h-9" />
            </div>
          </div>
          <Button className="w-full" disabled={!newRulePoints || !newRuleValue || addRuleMutation.isPending}
            onClick={() => addRuleMutation.mutate()}>
            <PlusCircle className="w-4 h-4 mr-2" /> Salvar Prêmio
          </Button>
        </CardContent>
      </Card>

      {/* Catálogo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Catálogo Atual</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Carregando...</p>
          ) : !redemptionRules?.length ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Nenhum prêmio cadastrado.</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden space-y-2">
                {redemptionRules.map((rule) => (
                  <div key={rule.id} className="bg-white rounded-xl border p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200 text-xs font-bold">
                          {rule.points_cost} pts
                        </Badge>
                        <span className="text-green-600 font-bold text-sm">R$ {rule.discount_value}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)}
                      className="text-red-500 shrink-0" disabled={deleteRuleMutation.isPending}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cupom</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptionRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="font-bold text-yellow-600">{rule.points_cost} pts</TableCell>
                        <TableCell className="text-green-600 font-bold">R$ {rule.discount_value}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)}
                            className="text-red-500" disabled={deleteRuleMutation.isPending}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
