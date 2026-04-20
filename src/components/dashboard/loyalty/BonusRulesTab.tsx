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
    "loyalty_birthday_bonus", "loyalty_referral_bonus",
    "loyalty_ticket_threshold", "loyalty_ticket_bonus",
    "loyalty_recurrence_2nd", "loyalty_recurrence_3rd", "loyalty_recurrence_4th",
  ];
  const { data } = await supabase.from("app_settings").select("*").in("key", keys);
  const settingsMap: any = {};
  data?.forEach((item: any) => (settingsMap[item.key] = item.value));
  return settingsMap;
};

export const BonusRulesTab = () => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["adminLoyaltySettings"],
    queryFn: fetchSettings,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { key: string; value: string }[]) => {
      const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminLoyaltySettings"] });
      showSuccess("Configurações salvas!");
    },
    onError: (err: any) => showError(err.message),
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">Carregando configurações...</div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Gatilhos de Engajamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-500" /> Gatilhos de Engajamento
          </CardTitle>
          <CardDescription className="text-xs">Pontos dados por ações específicas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Bônus de Aniversário</Label>
              <div className="flex items-center gap-2">
                <Input className="h-9" defaultValue={settings?.loyalty_birthday_bonus} id="input-bday" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Bônus por Indicação (MGM)</Label>
              <div className="flex items-center gap-2">
                <Input className="h-9" defaultValue={settings?.loyalty_referral_bonus} id="input-ref" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" /> Pago após a <strong>1ª compra paga</strong> do indicado.
              </p>
            </div>
          </div>
          <Button className="w-full bg-slate-800" disabled={updateSettingsMutation.isPending}
            onClick={() => updateSettingsMutation.mutate([
              { key: "loyalty_birthday_bonus", value: (document.getElementById("input-bday") as HTMLInputElement).value },
              { key: "loyalty_referral_bonus",  value: (document.getElementById("input-ref")  as HTMLInputElement).value },
            ])}>
            Salvar Gatilhos
          </Button>
        </CardContent>
      </Card>

      {/* Bônus Ticket Alto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> Bônus Ticket Alto
          </CardTitle>
          <CardDescription className="text-xs">Incentive compras maiores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Valor Mínimo do Pedido (R$)</Label>
              <Input className="h-9" defaultValue={settings?.loyalty_ticket_threshold} id="input-thresh" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Pontos Extras Concedidos</Label>
              <Input className="h-9" defaultValue={settings?.loyalty_ticket_bonus} id="input-ticket-pts" />
            </div>
          </div>
          <Button className="w-full bg-slate-800" disabled={updateSettingsMutation.isPending}
            onClick={() => updateSettingsMutation.mutate([
              { key: "loyalty_ticket_threshold", value: (document.getElementById("input-thresh")      as HTMLInputElement).value },
              { key: "loyalty_ticket_bonus",     value: (document.getElementById("input-ticket-pts") as HTMLInputElement).value },
            ])}>
            Salvar Ticket Alto
          </Button>
        </CardContent>
      </Card>

      {/* Bônus de Recorrência */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" /> Bônus de Recorrência Mensal
          </CardTitle>
          <CardDescription className="text-xs">Pontos extras por quantidade de compras no mesmo mês.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">2ª Compra</Label>
              <Input className="h-9" defaultValue={settings?.loyalty_recurrence_2nd} id="rec-2" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">3ª Compra</Label>
              <Input className="h-9" defaultValue={settings?.loyalty_recurrence_3rd} id="rec-3" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">4ª+</Label>
              <Input className="h-9" defaultValue={settings?.loyalty_recurrence_4th} id="rec-4" />
            </div>
          </div>
          <Button className="w-full bg-slate-800" disabled={updateSettingsMutation.isPending}
            onClick={() => updateSettingsMutation.mutate([
              { key: "loyalty_recurrence_2nd", value: (document.getElementById("rec-2") as HTMLInputElement).value },
              { key: "loyalty_recurrence_3rd", value: (document.getElementById("rec-3") as HTMLInputElement).value },
              { key: "loyalty_recurrence_4th", value: (document.getElementById("rec-4") as HTMLInputElement).value },
            ])}>
            Salvar Recorrência
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
