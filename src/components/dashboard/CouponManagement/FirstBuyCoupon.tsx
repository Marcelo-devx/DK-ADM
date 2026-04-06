"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { translateDatabaseError } from "@/utils/error-handler";

interface Coupon {
  id: number;
  name: string;
  description: string | null;
  discount_value: number;
  discount_type: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}

export const FirstBuyCoupon = () => {
  const queryClient = useQueryClient();

  // Buscar cupom PRIMEIRACOMPRA
  const { data: coupon, isLoading, refetch } = useQuery({
    queryKey: ["firstBuyCoupon"],
    queryFn: async () => {
      console.log('[FirstBuyCoupon] Buscando cupom PRIMEIRACOMPRA...');
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("name", "PRIMEIRACOMPRA")
        .maybeSingle();
      
      if (error) {
        console.error('[FirstBuyCoupon] Erro ao buscar cupom:', error);
        throw new Error(translateDatabaseError(error));
      }
      
      console.log('[FirstBuyCoupon] Cupom encontrado:', !!data);
      return data as Coupon | null;
    },
    refetchOnWindowFocus: false,
  });

  // Mutação para recriar o cupom
  const recreateCouponMutation = useMutation({
    mutationFn: async () => {
      console.log('[FirstBuyCoupon] Iniciando recriação do cupom PRIMEIRACOMPRA...');
      
      // Primeiro, deletar o cupom existente
      if (coupon) {
        console.log('[FirstBuyCoupon] Deletando cupom existente...');
        const { error: deleteError } = await supabase
          .from("coupons")
          .delete()
          .eq("name", "PRIMEIRACOMPRA");
        
        if (deleteError) {
          console.error('[FirstBuyCoupon] Erro ao deletar cupom existente:', deleteError);
          throw new Error(translateDatabaseError(deleteError));
        }
      }

      // Criar novo cupom
      console.log('[FirstBuyCoupon] Criando novo cupom...');
      const { data, error } = await supabase.from("coupons").insert({
        name: "PRIMEIRACOMPRA",
        description: "Desconto de 5% para sua primeira compra! Bem-vindo(a) à Tabacaria DK!",
        discount_value: 5,
        points_cost: 0,
        minimum_order_value: 0,
        stock_quantity: -1, // Ilimitado
        is_active: true,
        discount_type: "product",
        max_uses_per_user: 1,
      });
      
      if (error) {
        console.error('[FirstBuyCoupon] Erro ao criar cupom:', error);
        throw new Error(translateDatabaseError(error));
      }
      
      console.log('[FirstBuyCoupon] Cupom criado com sucesso');
      return data;
    },
    onSuccess: () => {
      showSuccess("Cupom PRIMEIRACOMPRA criado/recriado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["firstBuyCoupon"] });
    },
    onError: (err: any) => {
      const errorMessage = translateDatabaseError(err);
      showError(errorMessage || "Erro ao criar cupom. Por favor, tente novamente.");
    },
  });

  const handleRecreate = () => {
    if (
      confirm(
        coupon
          ? "O cupom PRIMEIRACOMPRA já existe. Deseja recriá-lo? (Isso pode afetar clientes que já têm o cupom)"
          : "Deseja criar o cupom PRIMEIRACOMPRA?"
      )
    ) {
      recreateCouponMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-600">Carregando informações do cupom...</span>
        </CardContent>
      </Card>
    );
  }

  const isProcessing = recreateCouponMutation.isPending;

  return (
    <Card className={coupon ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-600" />
          Cupom Primeira Compra
        </CardTitle>
        <CardDescription className={coupon ? "text-green-700" : "text-orange-700"}>
          {coupon
            ? "O cupom PRIMEIRACOMPRA está ativo e será atribuído automaticamente a novos clientes."
            : "Crie o cupom PRIMEIRACOMPRA para atrair novos clientes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status do cupom */}
        {coupon ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-lg text-green-900">Cupom Ativo</p>
                  <p className="text-sm text-gray-600">Criado em {new Date(coupon.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>
            </div>

            {/* Detalhes do cupom */}
            <div className="p-4 bg-white rounded-lg border space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Nome:</span>
                  <p className="font-medium">{coupon.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Desconto:</span>
                  <p className="font-bold text-green-600">{coupon.discount_value}%</p>
                </div>
                <div>
                  <span className="text-gray-500">Estoque:</span>
                  <p className="font-medium">Ilimitado</p>
                </div>
                <div>
                  <span className="text-gray-500">Usos:</span>
                  <p className="font-medium">1 por cliente</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">{coupon.description}</p>
            </div>

            {/* Informações de funcionamento */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Como funciona:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Automaticamente atribuído a novos clientes no cadastro</li>
                    <li>Não é atribuído a clientes que já têm pedidos</li>
                    <li>Válido por 180 dias após o cadastro</li>
                    <li>Apenas clientes sem pedidos anteriores podem usar</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              onClick={() => refetch()}
              variant="outline"
              className="w-full"
              disabled={isProcessing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Status
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-bold text-lg text-orange-900">Cupom Não Encontrado</p>
                  <p className="text-sm text-gray-600">O cupom PRIMEIRACOMPRA não existe</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Crie o cupom para atrair novos clientes com um desconto especial na primeira compra.
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Configurações automáticas:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    <span className="text-xs">Nome: PRIMEIRACOMPRA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    <span className="text-xs">Desconto: 5% sobre produtos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    <span className="text-xs">Estoque: Ilimitado (-1)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    <span className="text-xs">Usos: 1 por cliente</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    <span className="text-xs">Validade: 180 dias após cadastro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    <span className="text-xs">Atribuição: Automática no cadastro</span>
                  </li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleRecreate}
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Criar Cupom PRIMEIRACOMPRA
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};