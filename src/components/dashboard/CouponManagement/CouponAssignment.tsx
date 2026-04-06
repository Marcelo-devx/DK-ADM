"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Gift, CheckCircle, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { ClientData } from "./ClientSearch";

interface Coupon {
  id: number;
  name: string;
  description: string | null;
  discount_value: number;
  discount_type: string;
  stock_quantity: number;
  is_active: boolean;
}

interface CouponAssignmentProps {
  client: ClientData | null;
}

export const CouponAssignment = ({ client }: CouponAssignmentProps) => {
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Buscar cupons disponíveis para atribuição
  const { data: coupons, isLoading: loadingCoupons } = useQuery({
    queryKey: ["availableCoupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Coupon[];
    },
  });

  // Mutação para atribuir cupom a um cliente específico
  const assignCouponMutation = useMutation({
    mutationFn: async (couponId: number) => {
      if (!client?.user_id) throw new Error("Nenhum cliente selecionado");
      const { data, error } = await supabase.rpc("assign_coupon_to_user", {
        p_user_id: client.user_id,
        p_coupon_id: couponId,
        p_expires_days: 90,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (message) => {
      showSuccess(message);
      setSelectedCouponId(null);
      queryClient.invalidateQueries({ queryKey: ["adminUserCouponsV2"] });
    },
    onError: (err: any) => {
      showError(err.message || "Erro ao atribuir cupom");
    },
  });

  // Mutação para atribuir cupom a TODOS os clientes
  const assignToAllMutation = useMutation({
    mutationFn: async (couponId: number) => {
      const { data, error } = await supabase.rpc("assign_coupon_to_all_clients", {
        p_coupon_id: couponId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (message) => {
      showSuccess(message);
      setSelectedCouponId(null);
      queryClient.invalidateQueries({ queryKey: ["adminUserCouponsV2"] });
    },
    onError: (err: any) => {
      showError(err.message || "Erro ao atribuir cupom a todos");
    },
  });

  const handleAssignToClient = () => {
    if (!selectedCouponId) return;
    if (confirm(`Deseja atribuir o cupom selecionado para ${client?.first_name} ${client?.last_name}?`)) {
      assignCouponMutation.mutate(selectedCouponId);
    }
  };

  const handleAssignToAll = () => {
    if (!selectedCouponId) return;
    if (
      confirm(
        "ATENÇÃO: Isso atribuirá o cupom a TODOS os clientes ativos do sistema. Deseja continuar?"
      )
    ) {
      assignToAllMutation.mutate(selectedCouponId);
    }
  };

  const selectedCoupon = coupons?.find((c) => c.id === selectedCouponId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-purple-600" />
          Atribuir Cupom Existente
        </CardTitle>
        <CardDescription>
          Atribua um cupom existente para um cliente específico ou para todos os clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seleção de cupom */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Selecione o Cupom</label>
          <Select
            value={selectedCouponId?.toString() || ""}
            onValueChange={(value) => setSelectedCouponId(parseInt(value))}
          >
            <SelectTrigger disabled={loadingCoupons}>
              <SelectValue placeholder="Escolha um cupom..." />
            </SelectTrigger>
            <SelectContent>
              {loadingCoupons ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : coupons && coupons.length > 0 ? (
                coupons.map((coupon) => (
                  <SelectItem key={coupon.id} value={coupon.id.toString()}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-medium">{coupon.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {coupon.discount_type === "shipping" ? "Frete Grátis" : "Desconto"}
                        </Badge>
                        <span className="text-sm font-bold text-green-600">
                          {coupon.discount_type === "shipping"
                            ? "Grátis"
                            : `R$ ${coupon.discount_value}`}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-gray-500">Nenhum cupom disponível</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Detalhes do cupom selecionado */}
        {selectedCoupon && (
          <Card className="bg-gray-50">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{selectedCoupon.name}</p>
                  <p className="text-sm text-gray-600">{selectedCoupon.description || "Sem descrição"}</p>
                </div>
                <Badge
                  variant={selectedCoupon.discount_type === "shipping" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {selectedCoupon.discount_type === "shipping" ? "Frete Grátis" : "Desconto"}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Valor:</span>{" "}
                  <span className="font-bold text-green-600">
                    {selectedCoupon.discount_type === "shipping"
                      ? "Frete Total"
                      : `R$ ${selectedCoupon.discount_value}`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Estoque:</span>{" "}
                  <span className="font-medium">
                    {selectedCoupon.stock_quantity === -1 ? "Ilimitado" : selectedCoupon.stock_quantity}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botões de ação */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleAssignToClient}
            disabled={!selectedCouponId || !client || assignCouponMutation.isPending}
            className="w-full"
          >
            {assignCouponMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Atribuir ao Cliente Selecionado
          </Button>

          <Button
            onClick={handleAssignToAll}
            disabled={!selectedCouponId || assignToAllMutation.isPending}
            variant="outline"
            className="w-full"
          >
            {assignToAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Gift className="h-4 w-4 mr-2" />
            )}
            Atribuir a Todos os Clientes
          </Button>
        </div>

        {/* Alerta se nenhum cliente selecionado */}
        {!client && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              Selecione um cliente acima para atribuir um cupom específico, ou use a opção
              "Atribuir a Todos" para enviar para todos os clientes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};