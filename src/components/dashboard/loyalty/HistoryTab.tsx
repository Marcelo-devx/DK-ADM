"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { LoyaltyHistoryItem } from "./types";

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from("loyalty_history")
    .select("*, profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as LoyaltyHistoryItem[];
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
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["adminLoyaltyHistory"] });
        showSuccess(data);
    },
    onError: (err: any) => showError(`Erro na sincronização: ${err.message}`),
  });

  return (
    <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Extrato Recente (Global)</CardTitle>
            <Button variant="outline" size="sm" onClick={() => syncHistoryMutation.mutate()} disabled={syncHistoryMutation.isPending} className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                {syncHistoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Sincronizar Dados
            </Button>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Pontos</TableHead><TableHead>Motivo</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                <TableBody>
                    {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow> :
                     history?.map((item) => (
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
  );
};