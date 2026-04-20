"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Database, ClipboardList, ArrowUpCircle, ArrowDownCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";

interface LoyaltyHistoryRPC {
  id: number; user_id: string; points: number; description: string;
  created_at: string; operation_type: string;
  profile_first_name: string | null; profile_last_name: string | null;
}

const fetchHistory = async () => {
  const { data, error } = await supabase.rpc("get_all_loyalty_history_admin");
  if (error) throw error;
  return data as LoyaltyHistoryRPC[];
};

const opLabel = (type: string) => {
  const map: Record<string, string> = {
    adjustment: "Ajuste", earn: "Ganho", redeem: "Resgate",
    bonus: "Bônus", referral_bonus: "Indicação", birthday_bonus: "Aniversário",
  };
  return map[type] || type;
};

export const HistoryTab = () => {
  const queryClient = useQueryClient();
  const { data: history, isLoading } = useQuery({ queryKey: ["adminLoyaltyHistory"], queryFn: fetchHistory });

  const syncHistoryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("sync_loyalty_history");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["adminLoyaltyHistory"] }); showSuccess(data); },
    onError: (err: any) => showError(`Erro na sincronização: ${err.message}`),
  });

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base">Extrato Recente (Global)</CardTitle>
        <Button variant="outline" size="sm" onClick={() => syncHistoryMutation.mutate()} disabled={syncHistoryMutation.isPending} className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
          {syncHistoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Sincronizar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !history || history.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 py-10">
            <div className="p-3 bg-slate-100 rounded-full"><ClipboardList className="w-8 h-8 text-slate-400" /></div>
            <h3 className="text-lg font-bold text-slate-700">O extrato está vazio</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left w-full space-y-3">
              <div className="flex items-start gap-3">
                <ArrowUpCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div><p className="text-sm font-bold text-slate-800">Entradas</p><p className="text-xs text-slate-500">Pontos ganhos por compras, bônus ou ajustes.</p></div>
              </div>
              <div className="flex items-start gap-3 border-t pt-3">
                <ArrowDownCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div><p className="text-sm font-bold text-slate-800">Saídas</p><p className="text-xs text-slate-500">Pontos gastos no resgate de cupons.</p></div>
              </div>
            </div>
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-100 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" /> Clique em <strong>Sincronizar</strong> para importar resgates antigos.
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile: cards ── */}
            <div className="md:hidden space-y-3">
              {history.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border-2 border-gray-100 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm leading-tight">
                        {item.profile_first_name || "Usuário"} {item.profile_last_name || ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">...{item.user_id.substring(0, 6)}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs font-bold ${item.points > 0 ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
                      {item.points > 0 ? "+" : ""}{item.points} pts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{opLabel(item.operation_type)}</span>
                    <span>{new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: tabela ── */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead><TableHead>Pontos</TableHead>
                    <TableHead>Motivo</TableHead><TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.profile_first_name || "Usuário"} {item.profile_last_name || ""}
                        <div className="text-[10px] text-muted-foreground font-mono">...{item.user_id.substring(0, 6)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={item.points > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}>
                          {item.points > 0 ? "+" : ""}{item.points}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
