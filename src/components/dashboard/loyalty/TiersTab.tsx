"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { LoyaltyTier } from "./types";

const fetchTiers = async () => {
  const { data, error } = await supabase.from("loyalty_tiers").select("*").order("min_spend");
  if (error) throw error;
  return data as LoyaltyTier[];
};

export const TiersTab = () => {
  const { data: tiers, isLoading } = useQuery({ queryKey: ["adminTiers"], queryFn: fetchTiers });

  const updateTierMutation = useMutation({
    mutationFn: async (tier: any) => {
      const { error } = await supabase.from("loyalty_tiers").update(tier).eq("id", tier.id);
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Nível atualizado!"),
    onError: (err: any) => showError(err.message),
  });

  return (
    <Card className="mt-6">
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
                    {isLoading ? <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow> : 
                     tiers?.map((tier) => (
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
  );
};