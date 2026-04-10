import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInfoTab } from "./promotion-form/BasicInfoTab";
import { CompositionTab, BreakdownItem } from "./promotion-form/CompositionTab";
import { PricingTab } from "./promotion-form/PricingTab";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal("")),
  price: z.coerce.number().min(0, "O preço não pode ser negativo."),
  pix_price: z.coerce.number().min(0, "O preço pix não pode ser negativo."),
  stock_quantity: z.coerce.number().int().min(0, "O estoque não pode ser negativo."),
  is_active: z.boolean().default(false),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
});

type PromotionFormValues = z.infer<typeof formSchema>;

interface PromotionFormProps {
  onSubmit: (values: PromotionFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<PromotionFormValues>;
}

export const PromotionForm = ({ onSubmit, isSubmitting, initialData }: PromotionFormProps) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [maxPossibleStock, setMaxPossibleStock] = useState(0);
  const [itemsTotalBasePrice, setItemsTotalBasePrice] = useState(0);
  const [itemsTotalBasePixPrice, setItemsTotalBasePixPrice] = useState(0);
  const [stockSurplus, setStockSurplus] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  const promotionId = initialData?.id;

  console.log("[PromotionForm] Estado atual:", {
    activeTab,
    promotionId,
    hasInitialData: !!initialData,
    initialData
  });

  // Criar kit básico (Passo 1)
  const handleCreateBasic = async (values: { name: string; description: string; image_url: string }) => {
    // Preservar os valores recebidos do formulário, incluindo a imagem
    const kitValues: Partial<PromotionFormValues> = {
      name: values.name,
      description: values.description,
      image_url: values.image_url || "", // Preservar a imagem carregada
      price: 0,
      pix_price: 0,
      stock_quantity: 0,
      is_active: false,
      discount_percent: 0,
    };

    console.log("[PromotionForm.handleCreateBasic] Valores para criar/atualizar kit:", kitValues);

    // Se já tem ID (editando), apenas avança para a próxima aba
    if (promotionId) {
      console.log("[PromotionForm.handleCreateBasic] Editando kit existente, avançando para composição");
      setActiveTab("composition");
      return;
    }

    // Se não tem ID, precisa criar o kit primeiro
    try {
      console.log("[PromotionForm.handleCreateBasic] Criando novo kit no banco...");
      const { data, error } = await supabase.from("promotions").insert(kitValues).select().single();

      if (error) {
        console.error("Erro ao criar kit:", error);
        alert(`Erro ao criar kit: ${error.message}`);
        return;
      }

      if (!data) {
        alert("Erro ao criar kit: Não foi possível obter o ID da promoção criada.");
        return;
      }

      console.log("[PromotionForm.handleCreateBasic] Kit criado com sucesso:", data);

      // Chama o onSubmit com o novo ID para atualizar o estado no componente pai
      // Isso garante que o initialData seja atualizado com o ID correto
      onSubmit({ ...kitValues, id: data.id } as PromotionFormValues);
    } catch (error: any) {
      console.error("Erro ao criar kit:", error);
      alert(`Erro ao criar kit: ${error.message || "Erro desconhecido"}`);
    }
  };

  // Auto-navegar para composição quando um novo kit é criado
  useEffect(() => {
    console.log("[PromotionForm.useEffect.autoNav] Verificando auto-navegação:", {
      initialDataId: initialData?.id,
      activeTab,
      promotionId,
      shouldNavigate: initialData?.id && activeTab === "basic" && !promotionId
    });

    // Quando initialData é atualizado com um ID novo (após criar o kit),
    // e estamos ainda na aba básica, navegar automaticamente para composição
    if (initialData?.id && activeTab === "basic" && !promotionId) {
      console.log("[PromotionForm.useEffect.autoNav] Condições atendidas! Navegando para composição...");
      // Pequeno delay para garantir que o estado foi atualizado
      setTimeout(() => {
        setActiveTab("composition");
        console.log("[PromotionForm.useEffect.autoNav] Navegação para composição concluída");
      }, 100);
    }
  }, [initialData?.id, activeTab, promotionId]);

  // Recebe os dados da composição (Passo 2)
  const handleCompositionComplete = (surplus: number, totalBase: number, totalBasePix: number, itemsBreakdown: BreakdownItem[]) => {
    setStockSurplus(surplus);
    setItemsTotalBasePrice(totalBase);
    setItemsTotalBasePixPrice(totalBasePix);
    setBreakdown(itemsBreakdown);

    const currentKitStock = initialData?.stock_quantity || 0;
    setMaxPossibleStock(currentKitStock + surplus);

    setActiveTab("pricing");
  };

  // Salvar alterações finais (Passo 3)
  const handleFinalSubmit = async (values: PromotionFormValues) => {
    console.log("handleFinalSubmit chamado com values:", values);
    console.log("promotionId:", promotionId);
    
    if (!promotionId) {
      console.error("Tentativa de salvar sem promotionId");
      alert("Erro: ID da promoção não encontrado. Por favor, recarregue a página e tente novamente.");
      return;
    }

    // Validação de estoque
    if (values.stock_quantity > maxPossibleStock) {
      alert(`Erro: Você só tem produtos suficientes para montar ${maxPossibleStock} kits no total.`);
      return;
    }

    try {
      const { stock_quantity, ...basicData } = values;

      // Sempre atualiza os dados básicos (incluindo discount_percent, price, pix_price, is_active)
      console.log("Atualizando dados básicos da promoção:", basicData);
      const { error: basicError } = await supabase
        .from("promotions")
        .update(basicData)
        .eq("id", promotionId);

      if (basicError) {
        console.error("Erro ao atualizar dados básicos:", basicError);
        throw basicError;
      }

      // Atualiza o estoque via RPC (que gerencia reserva/devolução de produtos)
      if (stock_quantity !== initialData?.stock_quantity) {
        console.log("Atualizando estoque para:", stock_quantity);
        const { error: stockError } = await supabase.rpc("update_kit_stock_level", {
          p_promotion_id: promotionId,
          p_new_stock: stock_quantity,
        });

        if (stockError) {
          console.error("Erro ao atualizar estoque:", stockError);
          throw stockError;
        }
        console.log("Estoque atualizado com sucesso");
      }

      onSubmit({ ...values, id: promotionId });
    } catch (error: any) {
      console.error("Erro ao atualizar kit:", error);
      alert(`Erro ao atualizar kit: ${error.message || "Erro desconhecido"}`);
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
            disabled={!promotionId}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold disabled:opacity-50"
          >
            2. Composição
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            disabled={!promotionId}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold disabled:opacity-50"
          >
            3. Precificação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-0">
          <BasicInfoTab
            onSubmit={handleCreateBasic}
            isSubmitting={isSubmitting && !promotionId}
            initialData={initialData}
          />
        </TabsContent>

        <TabsContent value="composition" className="mt-0">
          <CompositionTab promotionId={promotionId} onNext={handleCompositionComplete} />
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