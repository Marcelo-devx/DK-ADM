import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInfoTab } from "./promotion-form/BasicInfoTab";
import { CompositionTab, BreakdownItem } from "./promotion-form/CompositionTab";
import { PricingTab } from "./promotion-form/PricingTab";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

interface PromotionFormProps {
  onSubmit: (values: { id: number; saved: true }) => void;
  isSubmitting: boolean;
  initialData?: {
    id?: number;
    name?: string;
    description?: string;
    image_url?: string;
    price?: number;
    pix_price?: number;
    stock_quantity?: number;
    is_active?: boolean;
    discount_percent?: number;
  };
}

export const PromotionForm = ({ onSubmit, isSubmitting, initialData }: PromotionFormProps) => {
  const [activeTab, setActiveTab] = useState("basic");

  // ID gerenciado localmente — inicializa com o ID existente (edição) ou undefined (criação)
  const [currentPromotionId, setCurrentPromotionId] = useState<number | undefined>(
    initialData?.id
  );

  // Dados de precificação vindos da composição
  const [maxPossibleStock, setMaxPossibleStock] = useState(0);
  const [itemsTotalBasePrice, setItemsTotalBasePrice] = useState(0);
  const [itemsTotalBasePixPrice, setItemsTotalBasePixPrice] = useState(0);
  const [stockSurplus, setStockSurplus] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  // ─── Passo 1: Criar ou atualizar dados básicos ───────────────────────────────
  const handleCreateBasic = async (values: {
    name: string;
    description: string;
    image_url: string;
  }) => {
    // Se já tem ID (editando), apenas avança para composição
    if (currentPromotionId) {
      // Atualiza os dados básicos no banco sem mudar o fluxo
      const { error } = await supabase
        .from("promotions")
        .update({
          name: values.name,
          description: values.description || null,
          image_url: values.image_url || null,
        })
        .eq("id", currentPromotionId);

      if (error) {
        showError(`Erro ao atualizar dados básicos: ${error.message}`);
        return;
      }

      setActiveTab("composition");
      return;
    }

    // Criação nova: insere no banco e guarda o ID localmente
    try {
      const { data, error } = await supabase
        .from("promotions")
        .insert({
          name: values.name,
          description: values.description || null,
          image_url: values.image_url || null,
          price: 0,
          pix_price: 0,
          stock_quantity: 0,
          is_active: false,
          discount_percent: 0,
        })
        .select()
        .single();

      if (error) {
        showError(`Erro ao criar kit: ${error.message}`);
        return;
      }

      if (!data) {
        showError("Erro ao criar kit: resposta vazia do servidor.");
        return;
      }

      console.log("[PromotionForm] Kit criado com ID:", data.id);
      setCurrentPromotionId(data.id);
      setActiveTab("composition");
    } catch (err: any) {
      showError(`Erro inesperado: ${err.message || "Erro desconhecido"}`);
    }
  };

  // ─── Passo 2: Composição concluída ───────────────────────────────────────────
  const handleCompositionComplete = (
    surplus: number,
    totalBase: number,
    totalBasePix: number,
    itemsBreakdown: BreakdownItem[]
  ) => {
    setStockSurplus(surplus);
    setItemsTotalBasePrice(totalBase);
    setItemsTotalBasePixPrice(totalBasePix);
    setBreakdown(itemsBreakdown);

    const currentKitStock = initialData?.stock_quantity || 0;
    setMaxPossibleStock(currentKitStock + surplus);

    setActiveTab("pricing");
  };

  // ─── Passo 3: Salvar precificação e estoque ───────────────────────────────────
  const handleFinalSubmit = async (values: {
    price: number;
    pix_price: number;
    stock_quantity: number;
    is_active: boolean;
    discount_percent: number;
  }) => {
    if (!currentPromotionId) {
      showError("Erro: ID do kit não encontrado. Recarregue e tente novamente.");
      return;
    }

    if (values.stock_quantity > maxPossibleStock) {
      showError(
        `Quantidade máxima possível é ${maxPossibleStock} kits com o estoque atual.`
      );
      return;
    }

    try {
      // 1. Atualiza dados de precificação
      const { error: updateError } = await supabase
        .from("promotions")
        .update({
          price: values.price,
          pix_price: values.pix_price,
          is_active: values.is_active,
          discount_percent: values.discount_percent,
        })
        .eq("id", currentPromotionId);

      if (updateError) throw updateError;

      // 2. Atualiza estoque via RPC (gerencia reserva/devolução de produtos)
      const oldStock = initialData?.stock_quantity ?? 0;
      if (values.stock_quantity !== oldStock) {
        const { error: stockError } = await supabase.rpc("update_kit_stock_level", {
          p_promotion_id: currentPromotionId,
          p_new_stock: values.stock_quantity,
        });
        if (stockError) throw stockError;
      }

      // 3. Notifica o pai que tudo foi salvo
      onSubmit({ id: currentPromotionId, saved: true });
    } catch (err: any) {
      showError(`Erro ao salvar kit: ${err.message || "Erro desconhecido"}`);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger
            value="basic"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold"
          >
            1. Dados Básicos
          </TabsTrigger>
          <TabsTrigger
            value="composition"
            disabled={!currentPromotionId}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold disabled:opacity-50"
          >
            2. Composição
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            disabled={!currentPromotionId}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold disabled:opacity-50"
          >
            3. Precificação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-0">
          <BasicInfoTab
            onSubmit={handleCreateBasic}
            isSubmitting={isSubmitting && !currentPromotionId}
            initialData={initialData}
          />
        </TabsContent>

        <TabsContent value="composition" className="mt-0">
          <CompositionTab
            promotionId={currentPromotionId}
            onNext={handleCompositionComplete}
          />
        </TabsContent>

        <TabsContent value="pricing" className="mt-0">
          <PricingTab
            initialData={initialData}
            stats={{
              maxPossibleStock,
              stockSurplus,
              itemsTotalBasePrice,
              itemsTotalBasePixPrice,
            }}
            breakdown={breakdown}
            onSubmit={handleFinalSubmit}
            isSubmitting={isSubmitting}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
