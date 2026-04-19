"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TicketCheck, RefreshCw, Loader2, AlertCircle, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface UserCouponRPC {
  id: number; created_at: string; is_used: boolean; expires_at: string;
  order_id: number | null; user_id: string;
  profile_first_name: string | null; profile_last_name: string | null; profile_email: string | null;
  coupon_name: string | null; coupon_discount_value: number | null; usage_date: string | null;
}

const fetchUserCoupons = async () => {
  const { data, error } = await supabase.rpc("get_all_user_coupons_with_usage");
  if (error) { console.error("[UserCouponsTab] Erro ao carregar histórico de cupons:", error); throw error; }
  return data as UserCouponRPC[];
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const UserCouponsTab = ({ className }: { className?: string }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: userCoupons, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["adminUserCouponsV2"],
    queryFn: fetchUserCoupons,
  });

  const deleteUserCouponMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("admin_delete_user_coupon", { target_id: id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["adminUserCouponsV2"] }); showSuccess("Cupom do usuário removido!"); },
    onError: (err: any) => showError(err.message),
  });

  const filteredCoupons = userCoupons?.filter((coupon) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    const name = `${coupon.profile_first_name || ""} ${coupon.profile_last_name || ""}`.toLowerCase();
    return name.includes(s) || (coupon.profile_email || "").toLowerCase().includes(s);
  });

  const handleDelete = (id: number) => {
    if (confirm("Deseja apagar este cupom do inventário do cliente permanentemente?")) {
      deleteUserCouponMutation.mutate(id);
    }
  };

  return (
    <Card className={cn("mt-6", className)}>
      <CardHeader>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TicketCheck className="w-5 h-5 text-emerald-600" /> Histórico Completo de Resgates
            </CardTitle>
            <CardDescription>Visualize o histórico de uso e resgate de pontos por cupons.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar por nome ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          {searchTerm && filteredCoupons && (
            <p className="text-xs text-gray-500 mt-1">{filteredCoupons.length} cupom(ns) encontrado(s) para "{searchTerm}"</p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-10 text-red-500 bg-red-50 rounded-lg">
            <AlertCircle className="w-6 h-6" />
            <span className="font-bold">Erro ao carregar dados.</span>
            <span className="text-xs">{error instanceof Error ? error.message : "Tente recarregar a página."}</span>
          </div>
        ) : (
          <>
            {/* ── Mobile: cards ── */}
            <div className="md:hidden space-y-3">
              {filteredCoupons?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm ? `Nenhum cupom encontrado para "${searchTerm}"` : "Nenhum cupom resgatado ainda."}
                </p>
              ) : (
                filteredCoupons?.map((uc) => (
                  <div key={uc.id} className={cn("rounded-xl border-2 p-4 space-y-2", uc.is_used ? "border-gray-100 bg-gray-50/50 opacity-80" : "border-emerald-100 bg-emerald-50/20")}>
                    {/* Nome + valor */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight">
                          {uc.profile_first_name} {uc.profile_last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{uc.profile_email || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-emerald-600 text-sm">R$ {uc.coupon_discount_value}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleDelete(uc.id)} disabled={deleteUserCouponMutation.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Cupom + status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-gray-700 text-sm">{uc.coupon_name}</span>
                      {uc.is_used ? (
                        <Badge variant="secondary" className="text-[10px]">Usado #{uc.order_id}</Badge>
                      ) : (
                        <Badge className="bg-emerald-500 text-white text-[10px]">Disponível</Badge>
                      )}
                    </div>

                    {/* Datas */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Resgatado: {fmtDate(uc.created_at)} {fmtTime(uc.created_at)}</span>
                      {uc.is_used && uc.usage_date && (
                        <span>Usado: {fmtDate(uc.usage_date)} {fmtTime(uc.usage_date)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Desktop: tabela ── */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Cliente</TableHead><TableHead>E-mail</TableHead><TableHead>Cupom</TableHead>
                    <TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Data Resgate</TableHead>
                    <TableHead>Data Uso</TableHead><TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons?.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      {searchTerm ? `Nenhum cupom encontrado para "${searchTerm}"` : "Nenhum cupom resgatado ainda."}
                    </TableCell></TableRow>
                  ) : (
                    filteredCoupons?.map((uc) => (
                      <TableRow key={uc.id} className={uc.is_used ? "opacity-60 bg-gray-50" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{uc.profile_first_name} {uc.profile_last_name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">ID: ...{uc.user_id.substring(0, 6)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{uc.profile_email || <span className="italic text-gray-300">—</span>}</TableCell>
                        <TableCell className="font-bold text-gray-700">{uc.coupon_name}</TableCell>
                        <TableCell className="text-emerald-600 font-bold">R$ {uc.coupon_discount_value}</TableCell>
                        <TableCell>
                          {uc.is_used ? (
                            <Badge variant="secondary" className="text-[10px]">Usado #{uc.order_id}</Badge>
                          ) : (
                            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px]">Disponível</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(uc.created_at)} <span className="text-[10px] text-gray-400">{fmtTime(uc.created_at)}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {uc.is_used && uc.usage_date ? (
                            <>{fmtDate(uc.usage_date)} <span className="text-[10px] text-gray-400">{fmtTime(uc.usage_date)}</span></>
                          ) : <span className="text-gray-300">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(uc.id)} className="text-red-500 hover:bg-red-50" disabled={deleteUserCouponMutation.isPending}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
