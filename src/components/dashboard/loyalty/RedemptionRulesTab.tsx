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
import { showSuccess, showError } from "@/utils/toast";
import { RewardCoupon } from "./types";

const fetchRedemptionRules = async () => {
  const { data, error } = await supabase.from("coupons").select("*").gt("points_cost", 0).eq("is_active", true).order("points_cost");
  if (error) throw error;
  return data as RewardCoupon[];
};

export const RedemptionRulesTab = () => {
  const queryClient = useQueryClient();
  const [newRulePoints, setNewRulePoints] = useState("");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newRuleName, setNewRuleName] = useState("");

  const { data: redemptionRules, isLoading } = useQuery({ queryKey: ["adminRewardCoupons"], queryFn: fetchRedemptionRules });

  const addRuleMutation = useMutation({
    mutationFn: async () => {
      const points = parseInt(newRulePoints);
      const value = parseFloat(newRuleValue.replace(',', '.'));
      
      const { error } = await supabase.from("coupons").insert({
        name: newRuleName || `RESGATE${points}`,
        description: `Cupom de R$ ${value} por ${points} pontos`,
        discount_value: value,
        points_cost: points,
        minimum_order_value: 0,
        stock_quantity: 9999,
        is_active: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRewardCoupons"] });
      setNewRulePoints("");
      setNewRuleValue("");
      setNewRuleName("");
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="md:col-span-1 border-dashed bg-slate-50">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Ticket className="w-4 h-4" /> Criar Prêmio</CardTitle>
                <CardDescription>Cria um cupom real comprável com pontos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Nome do Cupom (Código)</Label>
                    <Input placeholder="Ex: VALE10" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                    <Label>Custo em Pontos</Label>
                    <Input placeholder="Ex: 1000" type="number" value={newRulePoints} onChange={(e) => setNewRulePoints(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Valor do Desconto (R$)</Label>
                    <Input placeholder="Ex: 10,00" value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)} />
                </div>
                <Button className="w-full" disabled={!newRulePoints || !newRuleValue || addRuleMutation.isPending} onClick={() => addRuleMutation.mutate()}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Salvar Prêmio
                </Button>
            </CardContent>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader><CardTitle>Catálogo Atual</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cupom</TableHead>
                            <TableHead>Pontos (Preço)</TableHead>
                            <TableHead>Desconto</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow> :
                         redemptionRules?.map((rule) => (
                            <TableRow key={rule.id}>
                                <TableCell className="font-medium">{rule.name}</TableCell>
                                <TableCell className="font-bold text-yellow-600">{rule.points_cost} pts</TableCell>
                                <TableCell className="text-green-600 font-bold">R$ {rule.discount_value}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)} className="text-red-500" disabled={deleteRuleMutation.isPending}>
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
  );
};