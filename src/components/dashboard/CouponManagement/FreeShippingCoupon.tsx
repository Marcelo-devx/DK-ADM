"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Truck, CheckCircle, Loader2, Gift } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { ClientData } from "./ClientSearch";

interface FreeShippingCouponProps {
  client: ClientData | null;
}

export const FreeShippingCoupon = ({ client }: FreeShippingCouponProps) => {
  const [applyToAll, setApplyToAll] = useState(false);
  const queryClient = useQueryClient();

  // Mutação para atribuir cupom de frete grátis
  const assignFreeShippingMutation = useMutation({
    mutationFn: async () => {
      // Buscar o cupom FRETEGRATIS
      const { data: couponData } = await supabase
        .from("coupons")
        .select("id")
        .eq("name", "FRETEGRATIS")
        .eq("is_active", true)
        .single();

      if (!couponData) {
        throw new Error("Cupom de frete grátis não encontrado ou inativo");
      }

      if (applyToAll) {
        // Atribuir a todos
        const { data, error } = await supabase.rpc("assign_coupon_to_all_clients", {
          p_coupon_id: couponData.id,
        });
        if (error) throw error;
        return data;
      } else {
        // Atribuir a cliente específico
        if (!client?.user_id) {
          throw new Error("Selecione um cliente para atribuir o cupom");
        }
        const { data, error } = await supabase.rpc("assign_coupon_to_user", {
          p_user_id: client.user_id,
          p_coupon_id: couponData.id,
          p_expires_days: 90,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (message) => {
      showSuccess(message);
      queryClient.invalidateQueries({ queryKey: ["adminUserCouponsV2"] });
    },
    onError: (err: any) => {
      showError(err.message || "Erro ao atribuir cupom de frete grátis");
    },
  });

  const handleAssign = () => {
    if (!applyToAll && !client) {
      showError("Selecione um cliente para atribuir o cupom de frete grátis");
      return;
    }

    const confirmMessage = applyToAll
      ? "ATENÇÃO: Isso atribuirá o cupom de frete grátis a TODOS os clientes ativos. Deseja continuar?"
      : `Deseja atribuir o cupom de frete grátis para ${client?.first_name} ${client?.last_name}?`;

    if (confirm(confirmMessage)) {
      assignFreeShippingMutation.mutate();
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Truck className="h-5 w-5" />
          Gerar Frete Grátis
        </CardTitle>
        <CardDescription className="text-blue-700">
          Crie e atribua cupons de frete grátis para clientes que esqueceram de pedir outro produto e
          querem fazer outro pedido sem pagar 2x o frete.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Opção de aplicar a todos */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-blue-600" />
              <label htmlFor="apply-to-all" className="text-sm font-medium">
                Aplicar para todos os clientes
              </label>
            </div>
            <p className="text-xs text-gray-600">
              Se desativado, o cupom será atribuído apenas ao cliente selecionado
            </p>
          </div>
          <Switch
            id="apply-to-all"
            checked={applyToAll}
            onCheckedChange={setApplyToAll}
            disabled={assignFreeShippingMutation.isPending}
          />
        </div>

        {/* Informação do cliente selecionado */}
        {!applyToAll && client ? (
          <div className="p-4 bg-white rounded-lg border">
            <p className="text-sm text-gray-600 mb-1">Cliente selecionado:</p>
            <p className="font-medium">
              {client.first_name} {client.last_name}
            </p>
            <p className="text-xs text-gray-500">{client.email}</p>
          </div>
        ) : !applyToAll && !client ? (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              ⚠️ Selecione um cliente acima ou ative a opção "Aplicar para todos" para continuar.
            </p>
          </div>
        ) : null}

        {/* Botão de ação */}
        <Button
          onClick={handleAssign}
          disabled={
            assignFreeShippingMutation.isPending ||
            (!applyToAll && !client) ||
            (applyToAll && !confirm)
          }
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {assignFreeShippingMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Atribuindo...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              {applyToAll ? "Atribuir a Todos os Clientes" : "Atribuir Frete Grátis"}
            </>
          )}
        </Button>

        {/* Informações do cupom */}
        <div className="text-xs text-gray-600 space-y-1">
          <p>• O cupom descontará o valor total do frete do pedido</p>
          <p>• Valido por 90 dias após a atribuição</p>
          <p>• Estoque atual: 1000 cupons</p>
        </div>
      </CardContent>
    </Card>
  );
};
