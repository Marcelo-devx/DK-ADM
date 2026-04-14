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
import { translateDatabaseError } from "@/utils/error-handler";
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

  const { data: coupons, isLoading: loadingCoupons, refetch: refetchCoupons } = useQuery({
    queryKey: ["availableCoupons"],
    queryFn: async () => {
      console.log('[CouponAssignment] Buscando cupons disponíveis...');
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) {
        console.error('[CouponAssignment] Erro ao buscar cupons:', error);
        throw new Error(translateDatabaseError(error));
      }
      
      console.log('[CouponAssignment] Cupons carregados:', data?.length || 0);
      return data as Coupon[];
    },
    refetchOnWindowFocus: false,
  });

  const assignCouponMutation = useMutation({
    mutationFn: async (couponId: number) => {
      if (!client?.user_id) {
        throw new Error('Nenhum cliente selecionado. Por favor, selecione um cliente antes de atribuir o cupom.');
      }
      
      console.log('[CouponAssignment] Iniciando atribuição de cupom:', {
        couponId,
        userId: client.user_id,
        clientName: `${client.first_name} ${client.last_name}`
      });
      
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);

        const { data, error } = await supabase.rpc("assign_coupon_to_user", {
          p_user_id: client.user_id,
          p_coupon_id: couponId,
          p_expires_days: 90,
          p_expires_at: expiresAt.toISOString(),
        });
        
        if (error) {
          console.error('[CouponAssignment] Erro ao atribuir cupom:', error);
          throw new Error(translateDatabaseError(error));
        }
        
        console.log('[CouponAssignment] Cupom atribuído com sucesso:', data);
        return data;
      } catch (err: any) {
        const translatedError = translateDatabaseError(err);
        console.error('[CouponAssignment] Erro traduzido:', translatedError);
        throw new Error(translatedError);
      }
    },
    onSuccess: (message) => {
      const successMessage = message || 'Cupom atribuído com sucesso ao cliente!';
      showSuccess(successMessage);
      setSelectedCouponId(null);
      queryClient.invalidateQueries({ queryKey: ["adminUserCouponsV2"] });
      queryClient.invalidateQueries({ queryKey: ["availableCoupons"] });
    },
    onError: (err: any) => {
      const errorMessage = translateDatabaseError(err);
      showError(errorMessage || 'Erro ao atribuir cupom. Por favor, tente novamente.');
    },
  });

  const assignToAllMutation = useMutation({
    mutationFn: async (couponId: number) => {
      console.log('[CouponAssignment] Iniciando atribuição de cupom para todos os clientes:', { couponId });
      
      try {
        const { data, error } = await supabase.rpc("assign_coupon_to_all_clients", {
          p_coupon_id: couponId,
        });
        
        if (error) {
          console.error('[CouponAssignment] Erro ao atribuir cupom para todos:', error);
          throw new Error(translateDatabaseError(error));
        }
        
        console.log('[CouponAssignment] Cupom atribuído a todos com sucesso:', data);
        return data;
      } catch (err: any) {
        const translatedError = translateDatabaseError(err);
        console.error('[CouponAssignment] Erro traduzido:', translatedError);
        throw new Error(translatedError);
      }
    },
    onSuccess: (message) => {
      const successMessage = message || 'Cupom atribuído a todos os clientes com sucesso!';
      showSuccess(successMessage);
      setSelectedCouponId(null);
      queryClient.invalidateQueries({ queryKey: ["adminUserCouponsV2"] });
      queryClient.invalidateQueries({ queryKey: ["availableCoupons"] });
    },
    onError: (err: any) => {
      const errorMessage = translateDatabaseError(err);
      showError(errorMessage || 'Erro ao atribuir cupom a todos. Por favor, tente novamente.');
    },
  });

  const handleAssignToClient = () => {
    if (!selectedCouponId) return;
    
    if (!client) {
      showError('Selecione um cliente para atribuir o cupom.');
      return;
    }
    
    const confirmMessage = `Deseja atribuir o cupom selecionado para ${client.first_name} ${client.last_name}?`;
    if (confirm(confirmMessage)) {
      assignCouponMutation.mutate(selectedCouponId);
    }
  };

  const handleAssignToAll = () => {
    if (!selectedCouponId) return;
    
    const confirmMessage = "ATENÇÃO: Isso atribuirá o cupom a TODOS os clientes ativos do sistema. Deseja continuar?";
    if (confirm(confirmMessage)) {
      assignToAllMutation.mutate(selectedCouponId);
    }
  };

  const selectedCoupon = coupons?.find((c) => c.id === selectedCouponId);

  const isProcessing = assignCouponMutation.isPending || assignToAllMutation.isPending;

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
        <div className="space-y-2">
          <label className="text-sm font-medium">Selecione o Cupom</label>
          <Select
            value={selectedCouponId?.toString() || ""}
            onValueChange={(value) => setSelectedCouponId(parseInt(value))}
            disabled={loadingCoupons}
          >
            <SelectTrigger disabled={loadingCoupons || isProcessing}>
              <SelectValue placeholder="Escolha um cupom..." />
            </SelectTrigger>
            <SelectContent>
              {loadingCoupons ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm">Carregando cupons...</span>
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
                <div className="p-2 text-sm text-gray-500">
                  Nenhum cupom disponível
                  <Button
                    variant="link"
                    className="p-0 h-auto text-purple-600"
                    onClick={() => refetchCoupons()}
                  >
                    Recarregar lista
                  </Button>
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

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

        <div className="space-y-3 pt-2">
          <Button
            onClick={handleAssignToClient}
            disabled={!selectedCouponId || !client || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Atribuir ao Cliente Selecionado
              </>
            )}
          </Button>

          <Button
            onClick={handleAssignToAll}
            disabled={!selectedCouponId || isProcessing}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Atribuir a Todos os Clientes
              </>
            )}
          </Button>
        </div>

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