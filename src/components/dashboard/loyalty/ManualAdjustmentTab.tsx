"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Save, User } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

export const ManualAdjustmentTab = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");

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
    <Card className="mt-6">
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
  );
};