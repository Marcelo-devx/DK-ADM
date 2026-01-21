"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TicketCheck, RefreshCw, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { UserCoupon } from "./types";

const fetchUserCoupons = async () => {
    // Agora buscamos também a data de criação do pedido relacionado (orders -> created_at)
    const { data, error } = await supabase
        .from("user_coupons")
        .select(`
            *, 
            profiles (first_name, last_name), 
            coupons (name, discount_value),
            orders (created_at)
        `)
        .order("created_at", { ascending: false });
        
    if (error) throw error;
    return data as unknown as UserCoupon[];
}

export const UserCouponsTab = () => {
  const queryClient = useQueryClient();
  const { data: userCoupons, isLoading, isError, refetch } = useQuery({ queryKey: ["adminUserCoupons"], queryFn: fetchUserCoupons });

  const deleteUserCouponMutation = useMutation({
    mutationFn: async (id: number) => {
        const { error } = await supabase.from("user_coupons").delete().eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["adminUserCoupons"] });
        showSuccess("Cupom do usuário removido!");
    },
    onError: (err: any) => showError(err.message),
  });

  return (
    <Card className="mt-6">
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-base flex items-center gap-2"><TicketCheck className="w-5 h-5 text-emerald-600" /> Histórico Completo de Cupons</CardTitle>
                    <CardDescription>Lista de todos os cupons resgatados (usados e disponíveis).</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Atualizar Lista
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Cupom</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data Resgate</TableHead>
                            <TableHead>Data Uso</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-red-500 bg-red-50">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-6 h-6" />
                                        <span className="font-bold">Erro ao carregar dados.</span>
                                        <span className="text-xs">Verifique suas permissões de administrador.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : userCoupons?.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhum cupom resgatado ainda.</TableCell></TableRow>
                        ) : (
                            userCoupons?.map((uc) => (
                                <TableRow key={uc.id} className={uc.is_used ? "opacity-60 bg-gray-50" : ""}>
                                    <TableCell className="font-medium">{uc.profiles?.first_name} {uc.profiles?.last_name}</TableCell>
                                    <TableCell className="font-bold text-gray-700">{uc.coupons?.name}</TableCell>
                                    <TableCell className="text-emerald-600 font-bold">R$ {uc.coupons?.discount_value}</TableCell>
                                    <TableCell>
                                        {uc.is_used ? (
                                            <Badge variant="secondary" className="text-[10px]">Usado #{uc.order_id}</Badge>
                                        ) : (
                                            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px]">Disponível</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(uc.created_at).toLocaleDateString('pt-BR')} <span className="text-[10px]">{new Date(uc.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground font-medium">
                                        {uc.is_used && uc.orders?.created_at ? (
                                            <>
                                                {new Date(uc.orders.created_at).toLocaleDateString('pt-BR')} <span className="text-[10px]">{new Date(uc.orders.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                            </>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Deseja apagar este cupom do inventário do cliente?")) deleteUserCouponMutation.mutate(uc.id); }} className="text-red-500 hover:bg-red-50" disabled={deleteUserCouponMutation.isPending}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );
};