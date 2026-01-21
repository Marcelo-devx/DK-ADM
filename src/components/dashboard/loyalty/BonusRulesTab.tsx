"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Zap, History, Info } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

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

export const BonusRulesTab = () => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ["adminLoyaltySettings"], queryFn: fetchSettings });

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

  if (isLoading) return <div>Carregando configurações...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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
                    disabled={updateSettingsMutation.isPending}
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
                    disabled={updateSettingsMutation.isPending}
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
                    disabled={updateSettingsMutation.isPending}
                >
                    Salvar Recorrência
                </Button>
            </CardContent>
        </Card>
    </div>
  );
};